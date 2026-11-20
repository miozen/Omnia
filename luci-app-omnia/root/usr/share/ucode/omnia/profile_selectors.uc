/**
 * Omnia | profile_selectors.uc | v1.0
 */

'use strict';

import { PATH } from 'omnia.core.constants';
import { read_optional_text, write_text_atomic, parse_json_object, json_stringify, append_unique, ExecResult, request_content } from 'omnia.core.utils';
import { Success, Fail } from 'omnia.core.result';
import { ERR } from 'omnia.core.error';
import { group_tag_list, group_tags_for_regions, region_order, generate_region_groups, grouped_node_tags, unmatched_node_tag_list } from 'omnia.generator_groups';
import { MANUAL_SELECTOR_TAG } from 'omnia.generator_manual_selector';
import { validated_main_selector_tag } from 'omnia.generator_validate';
import { parse_profile, parse_node_snapshot, parse_subscriptions_policy } from 'omnia.generator_input';
import { collect_profile_tags, normalized_nodes, collect_node_tags } from 'omnia.generator_nodes';
import { get_country_info, iso_to_flag_emoji } from 'omnia.convert.operators.flags';

function now_utc() {
	let result = ExecResult("profile_selectors", [ "date", "-u", "+%Y-%m-%dT%H:%M:%SZ" ]);
	if (result.code == 0)
		return replace(replace(result.stdout || "", "\n", ""), "\r", "");
	return "";
}

function get_direct_outbound_tag(profile) {
	if (type(profile) != "object" || type(profile.outbounds) != "array")
		return "";
	for (let outbound in profile.outbounds) {
		if (type(outbound) == "object" && outbound != null && outbound.type == "direct" && type(outbound.tag) == "string" && outbound.tag != "")
			return outbound.tag;
	}
	return "";
}

function get_main_selector_tag(profile, configured_main_tag) {
	if (type(profile) != "object" || type(profile.outbounds) != "array")
		return "";
	try {
		return validated_main_selector_tag(profile, configured_main_tag);
	} catch (e) {}
	return "";
}

function read_storage() {
	let content = read_optional_text(PATH.SELECTORS);
	if (content == "")
		return { schema_version: 1, templates: {} };

	try {
		let parsed = parse_json_object(content, "Selectors");
		if (type(parsed) == "object" && parsed != null && type(parsed.templates) == "object")
			return parsed;
	} catch (e) {}

	return { schema_version: 1, templates: {} };
}

function read_selectors_config(template_key) {
	let key = type(template_key) == "string" && template_key != "" ? template_key : "default";
	let storage = read_storage();
	let tmpl = storage.templates[key];
	if (type(tmpl) == "object" && tmpl != null && type(tmpl.selectors) == "object")
		return tmpl.selectors;
	return {};
}

function read_main_selector_config(template_key) {
	let key = type(template_key) == "string" && template_key != "" ? template_key : "default";
	let storage = read_storage();
	let tmpl = storage.templates[key];
	if (type(tmpl) == "object" && tmpl != null && type(tmpl.main_selector) == "string")
		return tmpl.main_selector;
	return "";
}

function save_selectors_config(template_key, selectors_dict, main_selector_tag) {
	let key = type(template_key) == "string" && template_key != "" ? template_key : "default";
	let storage = read_storage();
	let tmpl = storage.templates[key];
	if (type(tmpl) != "object" || tmpl == null)
		tmpl = {};
	tmpl.updated_at = now_utc();
	tmpl.selectors = type(selectors_dict) == "object" && selectors_dict != null ? selectors_dict : {};
	if (type(main_selector_tag) == "string")
		tmpl.main_selector = main_selector_tag;
	storage.templates[key] = tmpl;
	write_text_atomic(PATH.SELECTORS, json_stringify(storage) + "\n");
	return true;
}

function resolve_selector_members(configured_items, groups, main_tag, direct_tag, manual_tag) {
	let result = [];
	if (type(configured_items) != "array")
		return result;

	for (let item in configured_items) {
		if (item == "main" || item == main_tag) {
			if (main_tag != "")
				append_unique(result, main_tag);
		} else if (item == "direct" || item == direct_tag) {
			if (direct_tag != "")
				append_unique(result, direct_tag);
		} else if (item == "manual" || item == manual_tag) {
			if (manual_tag != "")
				append_unique(result, manual_tag);
		} else {
			let region_groups = group_tags_for_regions(groups, [ item ]);
			for (let g_tag in region_groups)
				append_unique(result, g_tag);
		}
	}

	// 自动兜底：若展开后有效列表为空，自动以 main (节点选择) 兜底
	if (length(result) == 0 && main_tag != "")
		append_unique(result, main_tag);

	return result;
}

function sync_template_selectors(template_key, profile) {
	if (type(profile) != "object" || type(profile.outbounds) != "array")
		return {};

	let configured_main = read_main_selector_config(template_key);
	let main_tag = get_main_selector_tag(profile, configured_main);
	let existing = read_selectors_config(template_key);
	let synced = {};

	for (let outbound in profile.outbounds) {
		if (type(outbound) != "object" || outbound == null || outbound.type != "selector")
			continue;
		if (outbound.tag == main_tag || outbound.x_rule == "main")
			continue; // main 根主池由底层全自动聚合并兜底保护，不作为业务分流组覆盖

		let tag = outbound.tag;
		if (type(tag) != "string" || tag == "")
			continue;

		if (type(existing[tag]) == "array")
			synced[tag] = existing[tag];
		else
			synced[tag] = [];
	}

	save_selectors_config(template_key, synced, configured_main);
	return synced;
}

function region_flag_str(region) {
	let info = get_country_info(region);
	if (info != null && type(info.flag) == "string")
		return info.flag;
	let dynamic = iso_to_flag_emoji(region);
	if (dynamic != "")
		return dynamic;
	return "";
}

function region_name_str(region) {
	let info = get_country_info(region);
	if (info != null && type(info.name) == "string")
		return info.name;
	return region;
}

function get_selector_candidate_pool(profile, groups, subscriptions, template_key, nodes) {
	let configured_main = read_main_selector_config(template_key);
	let main_tag = get_main_selector_tag(profile, configured_main);
	let direct_tag = get_direct_outbound_tag(profile);
	let manual_tag = MANUAL_SELECTOR_TAG;
	let current_configs = read_selectors_config(template_key);

	let all_selectors = [];
	for (let outbound in profile.outbounds) {
		if (type(outbound) == "object" && outbound != null && outbound.type == "selector" && type(outbound.tag) == "string" && outbound.tag != "") {
			push(all_selectors, {
				tag: outbound.tag,
				is_main: (outbound.tag == main_tag)
			});
		}
	}

	let r_keys = region_order(subscriptions);
	let regions = [];
	for (let r in r_keys) {
		let flag = region_flag_str(r);
		let cname = region_name_str(r);
		let label = (flag != "" ? flag + " " : "") + cname + " (" + r + ")";
		push(regions, {
			id: r,
			label: label
		});
	}

	let system_targets = [
		{ id: "main", tag: main_tag, label: main_tag != "" ? main_tag : "节点选择 (main)" },
		{ id: "direct", tag: direct_tag, label: direct_tag != "" ? direct_tag : "全球直连 (direct)" },
		{ id: "manual", tag: manual_tag, label: manual_tag }
	];

	let selectors = [];
	for (let outbound in profile.outbounds) {
		if (type(outbound) != "object" || outbound == null || outbound.type != "selector")
			continue;

		let tag = outbound.tag;
		let is_main = (tag == main_tag || outbound.x_rule == "main");
		let custom = current_configs[tag];
		let is_custom = (type(custom) == "array" && length(custom) > 0);

		// 计算预览的 outbounds
		let preview = [];
		if (is_main) {
			let all_groups = group_tag_list(groups);
			let matched_nodes = grouped_node_tags(groups);
			let unmatched = unmatched_node_tag_list(type(nodes) == "array" ? nodes : [], matched_nodes);
			for (let g_tag in all_groups)
				append_unique(preview, g_tag);
			for (let u_tag in unmatched)
				append_unique(preview, u_tag);
			if (length(preview) == 0 && type(outbound.outbounds) == "array")
				preview = outbound.outbounds;
		} else if (is_custom) {
			preview = resolve_selector_members(custom, groups, main_tag, direct_tag, manual_tag);
		} else {
			// 继承模板
			if (outbound.x_rule == "all_regions") {
				append_unique(preview, main_tag);
				for (let g in groups) append_unique(preview, g.tag);
			} else if (substr(outbound.x_rule, 0, 7) == "region:") {
				append_unique(preview, main_tag);
				let regs = split(substr(outbound.x_rule, 7), ",");
				for (let g_tag in group_tags_for_regions(groups, regs))
					append_unique(preview, g_tag);
			} else if (substr(outbound.x_rule, 0, 14) == "region+direct:") {
				append_unique(preview, main_tag);
				if (direct_tag != "") append_unique(preview, direct_tag);
				let regs = split(substr(outbound.x_rule, 14), ",");
				for (let g_tag in group_tags_for_regions(groups, regs))
					append_unique(preview, g_tag);
			} else {
				preview = outbound.outbounds || [];
			}
		}

		let preview_obj = {
			type: "selector",
			tag: tag,
			outbounds: preview
		};
		if (outbound.default != null)
			preview_obj.default = outbound.default;
		if (outbound.interrupt_exist_connections != null)
			preview_obj.interrupt_exist_connections = outbound.interrupt_exist_connections;

		push(selectors, {
			tag: tag,
			is_main: is_main,
			x_rule: outbound.x_rule || "",
			configured_members: type(custom) == "array" ? custom : [],
			is_custom: is_custom,
			preview_outbounds: preview,
			preview_object: preview_obj
		});
	}

	return {
		main_selector: main_tag,
		all_selectors: all_selectors,
		regions: regions,
		system: system_targets,
		selectors: selectors
	};
}

function profile_source_key() {
	let content = read_optional_text(PATH.PROFILE_SOURCE);
	if (content != "") {
		try {
			let src = parse_json_object(content, "Profile Source");
			if (type(src) == "object" && src != null && type(src.url) == "string" && src.url != "")
				return src.url;
		} catch (e) {}
	}
	return "default";
}

function template_selectors_get(trace_id, req) {
	try {
		let profile = {};
		try { profile = parse_profile(); } catch (e) {}
		let snapshot = { schema_version: 1, source: "omnia", outbounds: [] };
		try { snapshot = parse_node_snapshot(); } catch (e) {}
		let subscriptions = {};
		try { subscriptions = parse_subscriptions_policy(); } catch (e) {}

		let profile_tags = collect_profile_tags(profile);
		let normalized = { nodes: [] };
		try {
			normalized = normalized_nodes(snapshot, profile_tags, subscriptions);
		} catch (e) {}
		let nodes = normalized.nodes;
		let node_tags = collect_node_tags(nodes);
		let groups = [];
		try {
			groups = generate_region_groups(subscriptions, nodes, profile_tags, node_tags);
		} catch (e) {}
		let key = profile_source_key();
		let data = get_selector_candidate_pool(profile, groups, subscriptions, key, nodes);
		return Success(data, 200, trace_id, "Template selectors pool loaded");
	} catch (e) {
		let err = "" + e;
		return Fail(ERR.E_INTERNAL, "Failed to load template selectors", trace_id, err);
	}
}

function template_selectors_save(trace_id, req) {
	try {
		let selectors = null;
		let main_selector = null;
		let content = request_content(req);
		if (content != "") {
			let parsed = parse_json_object(content, "Selectors");
			if (type(parsed) == "object" && parsed != null) {
				if (type(parsed.selectors) == "object" && parsed.selectors != null) {
					selectors = parsed.selectors;
					if (type(parsed.main_selector) == "string")
						main_selector = parsed.main_selector;
				} else {
					selectors = parsed;
				}
			}
		} else if (type(req) == "object" && req != null) {
			if (type(req.selectors) == "object" && req.selectors != null)
				selectors = req.selectors;
			else
				selectors = req;
			if (type(req.main_selector) == "string")
				main_selector = req.main_selector;
		}
		if (type(selectors) != "object" || selectors == null)
			die("Missing or invalid selectors payload");

		let key = profile_source_key();
		save_selectors_config(key, selectors, main_selector);
		return Success({ saved: true }, 200, trace_id, "Template selectors saved");
	} catch (e) {
		let err = "" + e;
		return Fail(ERR.E_INTERNAL, "Failed to save template selectors", trace_id, err);
	}
}

export {
	profile_source_key,
	read_selectors_config,
	read_main_selector_config,
	save_selectors_config,
	resolve_selector_members,
	sync_template_selectors,
	get_selector_candidate_pool,
	get_direct_outbound_tag,
	get_main_selector_tag,
	region_flag_str,
	region_name_str,
	template_selectors_get,
	template_selectors_save
};
