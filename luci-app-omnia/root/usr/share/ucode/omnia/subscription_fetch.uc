/**
 * Omnia | subscription_fetch.uc | v1.0
 */

'use strict';

import { json_escape } from 'omnia.core.utils';
import { trim } from 'omnia.convert.utils';
import { fetch_text } from 'omnia.resource_fetch';
import { preflight_for_url, preflight_detail } from 'omnia.subscription_preflight';
import { convert_subscription, convert_form_nodes } from 'omnia.convert.pipeline';
import { extract_userinfo_from_headers } from 'omnia.convert.traffic';

function is_legacy_compatible_input(content) {
	if (type(content) != 'string')
		return false;

	let text = trim(content);
	if (text == '')
		return false;

	let first_char = substr(text, 0, 1);
	if (first_char != '{' && first_char != '[')
		return false;

	let parsed = null;
	try {
		parsed = json(text);
	} catch (e) {
		return false;
	}

	if (type(parsed) == 'array') {
		if (length(parsed) == 0)
			return false;
		for (let item in parsed) {
			if (type(item) == 'object' && item != null && type(item) != 'array')
				return true;
		}
		return false;
	}

	if (type(parsed) == 'object' && parsed != null) {
		if (type(parsed.outbounds) == 'array')
			return true;
		if (parsed.source == 'sub-store' || parsed.target == 'sing-box')
			return true;
	}

	return false;
}

function parse_subscription_safely(trace_id, content, options) {
	let conv = convert_subscription(trace_id, content, options);
	if (conv.ok) {
		return {
			used_fallback: false,
			outbounds: conv.outbounds
		};
	}

	// Constraint 1: Unconditional fallback is prohibited.
	// Only fall back to legacy parser when explicitly identified as legacy Sub-Store input.
	// Malformed, unrecognized, or corrupted formats MUST fail closed.
	if (!is_legacy_compatible_input(content)) {
		die('Subscription conversion failed: ' + conv.error);
	}

	let legacy_outbounds = substore_outbounds(content);
	return {
		used_fallback: true,
		outbounds: legacy_outbounds
	};
}

function convert_to_outbounds(trace_id, content) {
	let conv = convert_subscription(trace_id, content);
	if (!conv.ok)
		die('Subscription conversion failed: ' + conv.error);
	return conv.outbounds;
}

function substore_outbounds(content) {
	let parsed = json(content);

	if (type(parsed) == "array")
		return parsed;

	if (type(parsed) == "object" && parsed != null && type(parsed.outbounds) == "array")
		return parsed.outbounds;

	die("Sub-Store output must be an outbounds array or an object with outbounds array");
}

function source_result_json(id, name, url, strategy, status, ok, node_count, error) {
	return "{" +
		"\"id\":\"" + json_escape(id) + "\"," +
		"\"name\":\"" + json_escape(name) + "\"," +
		"\"url\":\"" + json_escape(url) + "\"," +
		"\"refresh_strategy\":\"" + json_escape(strategy) + "\"," +
		"\"status\":\"" + json_escape(status) + "\"," +
		"\"ok\":" + (ok ? "true" : "false") + "," +
		"\"node_count\":" + node_count + "," +
		"\"error\":\"" + json_escape(error || "") + "\"" +
	"}";
}

function source_result_object(source, strategy, status, ok, node_count, error, userinfo) {
	let res = {
		id: source.id || "",
		name: source.name || "",
		url: source.url || "",
		refresh_strategy: strategy,
		status: status || "unknown",
		ok: ok == true,
		node_count: node_count || 0,
		error: error || ""
	};
	if (type(userinfo) == "object" && userinfo != null)
		res.userinfo = userinfo;
	else if (type(source.userinfo) == "object" && source.userinfo != null)
		res.userinfo = source.userinfo;
	return res;
}

function fetch_subscription_checked(trace_id, url, strategy, opts) {
	let preflight = preflight_for_url(trace_id, url);
	opts = type(opts) == "object" && opts != null ? opts : {};
	let fetch_opts = {
		timeout_sec: opts.timeout_sec || 10,
		min_bytes: opts.min_bytes || 16,
		user_agent: opts.user_agent || ""
	};
	let fetched = fetch_text(trace_id, url, strategy, fetch_opts);
	if (!fetched.ok)
		die("fetch failed: " + fetched.error + " exit=" + fetched.exit_code + " stderr=" + fetched.stderr + "; " + preflight_detail(preflight));

	let userinfo = extract_userinfo_from_headers(fetched.stderr);
	return {
		body: fetched.body,
		userinfo: userinfo
	};
}

function fetch_substore_output(trace_id, url, strategy) {
	let fetched = fetch_text(trace_id, url, strategy, { timeout_sec: 10, min_bytes: 16 });
	if (!fetched.ok)
		die("fetch failed: " + fetched.error + " exit=" + fetched.exit_code + " stderr=" + fetched.stderr);
	return fetched.body;
}

function fetch_substore_output_checked(trace_id, url, strategy) {
	let preflight = preflight_for_url(trace_id, url);
	let fetched = fetch_text(trace_id, url, strategy, { timeout_sec: 10, min_bytes: 16 });
	if (!fetched.ok)
		die("fetch failed: " + fetched.error + " exit=" + fetched.exit_code + " stderr=" + fetched.stderr + "; " + preflight_detail(preflight));
	return fetched.body;
}

function node_preview(outbounds) {
	let nodes = [];
	let count = 0;

	for (let outbound in outbounds) {
		if (count >= 20)
			break;
		push(nodes, {
			tag: type(outbound.tag) == "string" ? outbound.tag : "",
			type: type(outbound.type) == "string" ? outbound.type : ""
		});
		count = count + 1;
	}

	return nodes;
}

function preview_subscription_nodes(input, options) {
	let conv = null;
	if (type(input) == 'array') {
		conv = convert_form_nodes(input, options);
	} else {
		conv = convert_subscription('preview', input, options);
	}
	if (!conv.ok)
		die('Preview conversion failed: ' + conv.error);
	return conv.outbounds;
}

export {
	convert_to_outbounds,
	substore_outbounds,
	is_legacy_compatible_input,
	parse_subscription_safely,
	source_result_json,
	source_result_object,
	fetch_substore_output,
	fetch_substore_output_checked,
	fetch_subscription_checked,
	node_preview,
	preview_subscription_nodes
};
