/**
 * Shinra | ruleset_inventory.uc | v1.0
 */

'use strict';

import { opendir, stat } from 'fs';
import { PATH } from 'shinra.core.constants';
import { Success, Fail } from 'shinra.core.result';
import { ERR } from 'shinra.core.error';
import { read_text, parse_json_object, file_exists } from 'shinra.core.utils';
import { ruleset_policy_config } from 'shinra.ruleset_policy';

function starts_with(value, prefix) {
	value = "" + value;
	prefix = "" + prefix;
	return substr(value, 0, length(prefix)) == prefix;
}

function source_path(source) {
	if (source == "profile")
		return PATH.PROFILE;
	if (source == "candidate")
		return PATH.CANDIDATE_CONFIG;
	if (source == "runtime")
		return PATH.RUNTIME_CONFIG;
	die("Unsupported ruleset inventory source: " + source);
}

function select_source(req) {
	let source = "auto";
	if (type(req) == "object" && req != null && type(req.source) == "string" && req.source != "")
		source = req.source;

	if (source == "auto") {
		if (file_exists(PATH.RUNTIME_CONFIG))
			return {
				requested: source,
				source: "runtime",
				path: PATH.RUNTIME_CONFIG,
				exists: true
			};
		if (file_exists(PATH.CANDIDATE_CONFIG))
			return {
				requested: source,
				source: "candidate",
				path: PATH.CANDIDATE_CONFIG,
				exists: true
			};
		return {
			requested: source,
			source: "profile",
			path: PATH.PROFILE,
			exists: file_exists(PATH.PROFILE)
		};
	}

	if (source != "profile" && source != "candidate" && source != "runtime")
		die("ruleset_inventory source must be auto, profile, candidate, or runtime");

	return {
		requested: source,
		source: source,
		path: source_path(source),
		exists: file_exists(source_path(source))
	};
}

function url_host(url) {
	if (type(url) != "string" || url == "")
		return "";

	let value = url;
	let start = 0;
	let scheme = index(value, "://");
	if (scheme >= 0)
		start = scheme + 3;

	let rest = substr(value, start);
	let slash = index(rest, "/");
	if (slash >= 0)
		return substr(rest, 0, slash);

	return rest;
}

function strip_query(value) {
	if (type(value) != "string")
		return "";
	let q = index(value, "?");
	if (q >= 0)
		return substr(value, 0, q);
	return value;
}

function basename(path) {
	let value = "" + path;
	let last = -1;

	for (let i = 0; i < length(value); i = i + 1) {
		if (substr(value, i, 1) == "/")
			last = i;
	}

	return substr(value, last + 1);
}

function append_unique(list, value) {
	if (type(value) != "string" || value == "")
		return;

	for (let item in list) {
		if (item == value)
			return;
	}

	push(list, value);
}

function ends_with(value, suffix) {
	value = "" + value;
	suffix = "" + suffix;
	if (length(suffix) > length(value))
		return false;
	return substr(value, length(value) - length(suffix)) == suffix;
}

function dir_entry_name(entry) {
	if (entry == null)
		return "";
	if (type(entry) == "object" && entry.name != null)
		return "" + entry.name;
	return "" + entry;
}

function redacted_url(url) {
	if (type(url) != "string" || url == "")
		return "";

	let host = url_host(url);
	let name = basename(strip_query(url));
	if (host == "")
		return "";
	if (name == "")
		return "https://" + host + "/...";
	return "https://" + host + "/.../" + name;
}

function file_metadata(path) {
	let info = stat(path);
	if (type(info) != "object" || info == null)
		return {
			exists: false,
			size: 0,
			mtime: 0
		};

	return {
		exists: true,
		size: info.size || 0,
		mtime: info.mtime || 0
	};
}

function is_managed_rule_path(path) {
	if (type(path) != "string" || path == "")
		return false;
	if (path == PATH.RULE_DIR)
		return true;
	return starts_with(path, PATH.RULE_DIR + "/");
}

function entry_errors(entry, duplicate) {
	let errors = [];

	if (duplicate)
		push(errors, "duplicate_tag");
	if (entry.type != "local" && entry.type != "remote" && entry.type != "")
		push(errors, "unsupported_type");
	if (entry.format != "binary" && entry.format != "")
		push(errors, "unsupported_format");
	if (entry.path != "" && !entry.managed_root)
		push(errors, "path_outside_managed_root");
	if (entry.path != "" && !entry.exists)
		push(errors, "missing_file");
	if (entry.referenced_count == 0)
		push(errors, "unreferenced_declaration");

	return errors;
}

function replace_tag_placeholder(value, tag) {
	return replace(value, "{tag}", tag);
}

function normalized_tags(item) {
	if (type(item.tag) == "string" && item.tag != "")
		return [ item.tag ];
	if (type(item.tag) != "array")
		return [];

	let tags = [];
	for (let tag in item.tag) {
		if (type(tag) != "string" || tag == "")
			die("Rule Set tag array must contain non-empty strings");
		push(tags, tag);
	}
	if (length(tags) == 0)
		die("Rule Set tag array must not be empty");
	return tags;
}

function resolve_tagged_field(value, tag, multiple, label) {
	if (type(value) != "string")
		return "";
	if (multiple && index(value, "{tag}") < 0)
		die("Multiple Rule Set tags require {tag} in " + label);
	return multiple ? replace_tag_placeholder(value, tag) : value;
}

function normalize_declaration(item, tag, multiple, declaration_id) {
	if (type(item) != "object" || item == null || type(item) == "array")
		return null;
	if (type(tag) != "string" || tag == "")
		return null;

	let path = resolve_tagged_field(item.path, tag, multiple, "path");
	let url = resolve_tagged_field(item.url, tag, multiple, "url");
	if (multiple && item.type == "local" && path == "")
		die("Multiple local Rule Set tags require a path");
	if (multiple && item.type == "remote" && url == "")
		die("Multiple remote Rule Set tags require a URL");
	let meta = path != "" ? file_metadata(path) : {
		exists: false,
		size: 0,
		mtime: 0
	};

	return {
		tag: tag,
		declaration_id: declaration_id,
		type: type(item.type) == "string" ? item.type : "",
		format: type(item.format) == "string" ? item.format : "",
		path: path,
		source_url: url,
		url_present: url != "",
		url_host: url_host(url),
		url_redacted: redacted_url(url),
		download_detour: type(item.download_detour) == "string" ? item.download_detour : "",
		exists: meta.exists,
		size: meta.size,
		mtime: meta.mtime,
		managed_root: path != "" && is_managed_rule_path(path),
		referenced_count: 0,
		reference_scopes: [],
		reference_indexes: [],
		referenced_by: [],
		errors: []
	};
}

function collect_declarations(config) {
	let declarations = [];
	if (type(config.route) != "object" || config.route == null)
		return declarations;
	if (type(config.route.rule_set) != "array")
		return declarations;

	let declaration_index = 0;
	for (let item in config.route.rule_set) {
		if (type(item) != "object" || item == null || type(item) == "array")
		{
			declaration_index = declaration_index + 1;
			continue;
		}
		let tags = normalized_tags(item);
		let multiple = type(item.tag) == "array";
		for (let tag in tags) {
			let entry = normalize_declaration(item, tag, multiple, "route.rule_set:" + declaration_index);
			if (entry != null)
				push(declarations, entry);
		}
		declaration_index = declaration_index + 1;
	}

	return declarations;
}

function push_reference(references, tag, scope, index_value, declarations) {
	if (type(tag) != "string" || tag == "")
		return;

	let exists = declarations[tag] == true;
	let errors = [];
	if (!exists)
		push(errors, "reference_missing_declaration");

	push(references, {
		tag: tag,
		scope: scope,
		index: index_value,
		exists_in_declarations: exists,
		errors: errors
	});
}

function collect_rule_reference(references, value, scope, index_value, declarations) {
	if (type(value) == "string") {
		push_reference(references, value, scope, index_value, declarations);
		return;
	}

	if (type(value) != "array")
		return;

	for (let tag in value)
		push_reference(references, tag, scope, index_value, declarations);
}

function collect_references(config, declaration_map) {
	let references = [];

	if (type(config.route) == "object" && config.route != null && type(config.route.rules) == "array") {
		let idx = 0;
		for (let rule in config.route.rules) {
			if (type(rule) == "object" && rule != null)
				collect_rule_reference(references, rule.rule_set, "route", idx, declaration_map);
			idx = idx + 1;
		}
	}

	if (type(config.dns) == "object" && config.dns != null && type(config.dns.rules) == "array") {
		let idx = 0;
		for (let rule in config.dns.rules) {
			if (type(rule) == "object" && rule != null)
				collect_rule_reference(references, rule.rule_set, "dns", idx, declaration_map);
			idx = idx + 1;
		}
	}

	return references;
}

function count_references(entries, references) {
	for (let entry in entries) {
		let count = 0;
		let scopes = [];
		let indexes = [];
		let referenced_by = [];

		for (let reference in references) {
			if (reference.tag != entry.tag)
				continue;

			count = count + 1;
			append_unique(scopes, reference.scope);
			push(indexes, reference.scope + ":" + reference.index);
			push(referenced_by, {
				scope: reference.scope,
				index: reference.index
			});
		}

		entry.referenced_count = count;
		entry.reference_scopes = scopes;
		entry.reference_indexes = indexes;
		entry.referenced_by = referenced_by;
	}
}

function declaration_map(entries) {
	let result = {};
	for (let entry in entries)
		result[entry.tag] = true;
	return result;
}

function duplicate_map(entries) {
	let seen = {};
	let duplicated = {};

	for (let entry in entries) {
		if (seen[entry.tag])
			duplicated[entry.tag] = true;
		seen[entry.tag] = true;
	}

	return duplicated;
}

function finalize_entries(entries) {
	let duplicated = duplicate_map(entries);

	for (let entry in entries)
		entry.errors = entry_errors(entry, duplicated[entry.tag] == true);
}

function summary(entries, references) {
	let existing = 0;
	let missing = 0;
	let duplicate = 0;
	let invalid = 0;
	let outside = 0;
	let missing_references = 0;
	let duplicated = duplicate_map(entries);

	for (let entry in entries) {
		if (entry.exists)
			existing = existing + 1;
		if (entry.path != "" && !entry.exists)
			missing = missing + 1;
		if (duplicated[entry.tag])
			duplicate = duplicate + 1;
		if (length(entry.errors) > 0)
			invalid = invalid + 1;
		if (entry.path != "" && !entry.managed_root)
			outside = outside + 1;
	}

	for (let reference in references) {
		if (!reference.exists_in_declarations)
			missing_references = missing_references + 1;
	}

	return {
		declared_count: length(entries),
		referenced_count: length(references),
		existing_count: existing,
		missing_count: missing,
		duplicate_count: duplicate,
		invalid_count: invalid,
		outside_managed_root_count: outside,
		missing_reference_count: missing_references
	};
}

function push_diagnostic(diagnostics, level, code, message, data) {
	push(diagnostics, {
		level: level,
		code: code,
		message: message,
		data: data || {}
	});
}

function build_diagnostics(entries, references) {
	let diagnostics = [];

	for (let entry in entries) {
		for (let err in entry.errors) {
			if (err == "missing_file") {
				push_diagnostic(diagnostics, "error", err, "Rule Set local file is missing", {
					tag: entry.tag,
					path: entry.path
				});
			} else if (err == "duplicate_tag") {
				push_diagnostic(diagnostics, "error", err, "Rule Set tag is duplicated", {
					tag: entry.tag
				});
			} else if (err == "unsupported_type") {
				push_diagnostic(diagnostics, "warning", err, "Rule Set type is not recognized by Shinra inventory", {
					tag: entry.tag,
					type: entry.type
				});
			} else if (err == "unsupported_format") {
				push_diagnostic(diagnostics, "warning", err, "Rule Set format is not recognized by Shinra inventory", {
					tag: entry.tag,
					format: entry.format
				});
			} else if (err == "path_outside_managed_root") {
				push_diagnostic(diagnostics, "warning", err, "Rule Set path is outside Shinra managed root", {
					tag: entry.tag,
					path: entry.path
				});
			} else if (err == "unreferenced_declaration") {
				push_diagnostic(diagnostics, "info", err, "Rule Set declaration is not referenced", {
					tag: entry.tag
				});
			} else {
				push_diagnostic(diagnostics, "warning", err, "Rule Set diagnostic", {
					tag: entry.tag
				});
			}
		}
	}

	for (let reference in references) {
		for (let err in reference.errors) {
			if (err == "reference_missing_declaration") {
				push_diagnostic(diagnostics, "error", err, "Rule Set reference has no declaration", {
					tag: reference.tag,
					scope: reference.scope,
					index: reference.index
				});
			} else {
				push_diagnostic(diagnostics, "warning", err, "Rule Set reference diagnostic", {
					tag: reference.tag,
					scope: reference.scope,
					index: reference.index
				});
			}
		}
	}

	return diagnostics;
}

function required_entries_from_profile() {
	let config = parse_json_object(read_text(PATH.PROFILE), "Profile");
	let entries = collect_declarations(config);
	let refs = collect_references(config, declaration_map(entries));

	count_references(entries, refs);
	finalize_entries(entries);

	/*
	 * A local/auto generation rewrites every remote declaration, even one not
	 * referenced by a route rule. Keep this list aligned with that generator
	 * input so a successful sync can never leave generation blocked.
	 */
	let managed_remote = [];
	for (let entry in entries) {
		if (entry.type == "remote")
			push(managed_remote, entry);
	}

	return {
		entries: managed_remote,
		declarations: entries,
		references: refs
	};
}

function local_rule_files() {
	let files = {};
	if (!file_exists(PATH.RULE_DIR))
		return files;

	let dir = opendir(PATH.RULE_DIR);
	if (!dir)
		return files;

	for (let item = dir.read(); item != null; item = dir.read()) {
		let name = dir_entry_name(item);
		if (!ends_with(name, ".srs"))
			continue;

		let path = PATH.RULE_DIR + "/" + name;
		let info = stat(path);
		if (type(info) != "object" || info == null)
			continue;
		if (type(info.type) == "string" && info.type != "file")
			continue;

		let tag = substr(name, 0, length(name) - 4);
		files[tag] = {
			tag: tag,
			path: path,
			exists: true,
			size: info.size || 0,
			mtime: info.mtime || 0
		};
	}

	dir.close();
	return files;
}

function canonical_local_metadata(tag) {
	return file_metadata(PATH.RULE_DIR + "/" + tag + ".srs");
}

function metadata_ready(meta) {
	return meta.exists == true && meta.size > 0;
}

function push_runtime_reason(reasons, code, tag) {
	push(reasons, {
		code: code,
		tag: tag || ""
	});
}

/*
 * Match the generator's Rule Set selection without modifying the profile:
 * - local always uses Shinra's managed local files;
 * - remote preserves the template declaration;
 * - auto uses a complete local declaration group, otherwise preserves it.
 *
 * This deliberately reports Shinra's selection viability, not the semantics of
 * a template declaration or network reachability. Those belong to the template
 * Schema / sing-box check and to sing-box at runtime respectively.
 */
function ruleset_runtime_state(declarations, references, ruleset_policy) {
	let mode = ruleset_policy.mode || "auto";
	let state = {
		status: "unused",
		local_count: 0,
		remote_count: 0,
		template_count: 0,
		fallback_count: 0,
		invalid_count: 0,
		reasons: []
	};

	for (let reference in references) {
		if (!reference.exists_in_declarations) {
			state.invalid_count = state.invalid_count + 1;
			push_runtime_reason(state.reasons, "reference_missing_declaration", reference.tag);
		}
	}
	if (length(declarations) == 0) {
		if (state.invalid_count > 0)
			state.status = "invalid";
		return state;
	}

	let groups = {};
	for (let entry in declarations) {
		let key = entry.declaration_id || entry.tag;
		if (type(groups[key]) != "array")
			groups[key] = [];
		push(groups[key], entry);
	}

	for (let key in groups) {
		let entries = groups[key];
		let remote_declaration = entries[0].type == "remote";
		if (!remote_declaration) {
			let local_invalid = false;
			for (let entry in entries) {
				if (entry.type == "local" && !metadata_ready(entry)) {
					local_invalid = true;
					push_runtime_reason(state.reasons, "template_local_missing", entry.tag);
				}
			}
			if (local_invalid)
				state.invalid_count = state.invalid_count + 1;
			else
				state.template_count = state.template_count + length(entries);
			continue;
		}
		let canonical_ready = true;
		let canonical_ready_count = 0;
		for (let entry in entries) {
			let meta = canonical_local_metadata(entry.tag);
			if (metadata_ready(meta))
				canonical_ready_count = canonical_ready_count + 1;
			else
				canonical_ready = false;
		}

		if (mode == "local") {
			if (canonical_ready)
				state.local_count = state.local_count + length(entries);
			else {
				state.invalid_count = state.invalid_count + 1;
				push_runtime_reason(state.reasons, "required_local_missing", entries[0].tag);
			}
			continue;
		}

		if (mode == "remote") {
			/* The generator preserves this declaration verbatim. */
			state.remote_count = state.remote_count + length(entries);
			continue;
		}

		if (mode == "auto" && canonical_ready) {
			state.local_count = state.local_count + length(entries);
			continue;
		}

		/*
		 * auto uses the original declaration for the whole group when any
		 * managed local file is absent. Do not interpret its type or options:
		 * keeping that template compatible is explicitly the template owner's
		 * responsibility.
		 */
		state.remote_count = state.remote_count + length(entries);
		if (canonical_ready_count > 0)
			state.fallback_count = state.fallback_count + length(entries);
	}

	if (state.invalid_count > 0)
		state.status = "invalid";
	else if (state.fallback_count > 0)
		state.status = "degraded_remote_fallback";
	else if (state.remote_count > 0)
		state.status = "ready_remote";
	else if (state.template_count > 0)
		state.status = "ready_template";
	else
		state.status = "ready_local";

	return state;
}

function ruleset_required_inventory(trace_id, req) {
	try {
		let required_info = required_entries_from_profile();
		let required = required_info.entries;
		let ruleset_policy = ruleset_policy_config().policy;
		let locals = local_rule_files();
		let required_map = {};
		let entries = [];
		let diagnostics = [];
		let ready = 0;
		let missing = 0;

		for (let entry in required) {
			let tag = entry.tag;
			let local_path = PATH.RULE_DIR + "/" + tag + ".srs";
			let meta = file_metadata(local_path);
			let status = meta.exists && meta.size > 0 ? "ready" : "missing";
			required_map[tag] = true;

			if (status == "ready")
				ready = ready + 1;
			else {
				missing = missing + 1;
				push(diagnostics, {
					level: ruleset_policy.mode == "local" ? "error" : "info",
					code: "required_local_missing",
					message: ruleset_policy.mode == "local" ? "Required local Rule Set is missing" : "Local Rule Set cache is missing",
					data: {
						tag: tag,
						path: local_path
					}
				});
			}

			push(entries, {
				tag: tag,
				required: true,
				status: status,
				local_path: local_path,
				local_exists: meta.exists,
				local_size: meta.size,
				local_mtime: meta.mtime,
				referenced_count: entry.referenced_count,
				reference_scopes: entry.reference_scopes,
				reference_indexes: entry.reference_indexes,
				referenced_by: entry.referenced_by
			});
		}

		let extras = [];
		let local_count = 0;
		for (let tag in locals) {
			local_count = local_count + 1;
			if (required_map[tag])
				continue;
			let item = locals[tag];
			push(extras, {
				tag: tag,
				required: false,
				status: "extra",
				local_path: item.path,
				local_exists: true,
				local_size: item.size,
				local_mtime: item.mtime
			});
		}

		let runtime = ruleset_runtime_state(required_info.declarations, required_info.references, ruleset_policy);
		for (let reason in runtime.reasons) {
			if (reason.code == "required_local_missing")
				continue;
			push(diagnostics, {
				level: "error",
				code: "runtime_" + reason.code,
				message: "Rule Set runtime contract is not satisfiable",
				data: reason
			});
		}

		return Success({
			source: "profile",
			profile_path: PATH.PROFILE,
			rule_dir: PATH.RULE_DIR,
			mode: ruleset_policy.mode,
			fetch_strategy: ruleset_policy.fetch_strategy,
			runtime_status: runtime.status,
			runtime: runtime,
			summary: {
				required_count: length(required),
				ready_count: ready,
				missing_count: missing,
				local_count: local_count,
				local_extra_count: length(extras)
			},
			entries: entries,
			extras: extras,
			references: required_info.references,
			diagnostics: diagnostics
		}, 200, trace_id, "Required Rule Set inventory loaded");
	} catch (e) {
		let err = "" + e;
		return Fail(ERR.E_RULESET_INVENTORY_FAILED, "Failed to load Required Rule Set inventory", trace_id, err);
	}
}

function ruleset_inventory(trace_id, req) {
	try {
		let selected = select_source(req);
		if (!selected.exists) {
			return Success({
				source_requested: selected.requested,
				source_used: selected.source,
				path: selected.path,
				source_exists: false,
				summary: summary([], []),
				entries: [],
				references: [],
				diagnostics: [
					{
						level: "info",
						code: "source_missing",
						message: "Rule Set inventory source does not exist yet",
						data: {
							source: selected.source,
							path: selected.path
						}
					}
				]
			}, 200, trace_id, "Rule Set inventory source missing");
		}

		let config = parse_json_object(read_text(selected.path), "Rule Set inventory source");
		let entries = collect_declarations(config);
		let refs = collect_references(config, declaration_map(entries));

		count_references(entries, refs);
		finalize_entries(entries);

		return Success({
			source_requested: selected.requested,
			source_used: selected.source,
			path: selected.path,
			source_exists: selected.exists,
			summary: summary(entries, refs),
			entries: entries,
			references: refs,
			diagnostics: build_diagnostics(entries, refs)
		}, 200, trace_id, "Rule Set inventory loaded");
	} catch (e) {
		let err = "" + e;
		return Fail(ERR.E_RULESET_INVENTORY_FAILED, "Failed to load Rule Set inventory", trace_id, err);
	}
}

function ruleset_required_inventory_impl(trace_id, req) {
	return ruleset_required_inventory(trace_id, req);
}

function ruleset_inventory_impl(trace_id, req) {
	return ruleset_inventory(trace_id, req);
}

export {
	redacted_url,
	file_metadata,
	required_entries_from_profile,
	ruleset_required_inventory,
	ruleset_inventory,
	ruleset_required_inventory_impl,
	ruleset_inventory_impl
};
