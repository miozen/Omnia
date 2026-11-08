/**
 * Omnia | control.uc | v1.0
 */

'use strict';

import { PATH } from 'omnia.core.constants';
import { Success, Fail } from 'omnia.core.result';
import { ERR } from 'omnia.core.error';
import { read_text, parse_json_object, json_escape, json_stringify } from 'omnia.core.utils';
import { http_get_json, http_put_json, http_patch_json, clash_api_url } from 'omnia.clash';

function is_selector(proxy) {
	if (type(proxy) != "object" || proxy == null)
		return false;
	if (proxy.type == "Selector" || proxy.type == "selector")
		return true;
	return false;
}

function is_selector_like(proxy) {
	if (is_selector(proxy))
		return true;
	return type(proxy.all) == "array" && type(proxy.now) == "string";
}

function observed_delay(proxy) {
	let delay = null;

	if (type(proxy) != "object" || proxy == null)
		return delay;

	if (type(proxy.history) == "array") {
		for (let item in proxy.history) {
			if (type(item) == "object" && item != null && item.delay != null)
				delay = item.delay;
		}
	}

	if (delay == null && proxy.delay != null)
		delay = proxy.delay;

	return delay;
}

function observed_alive(proxy) {
	if (type(proxy) != "object" || proxy == null)
		return null;
	if (proxy.alive == true)
		return true;
	if (proxy.alive == false)
		return false;
	return null;
}

function nested_proxy(proxies, proxy) {
	if (type(proxies) != "object" || proxies == null)
		return null;
	if (type(proxy) != "object" || proxy == null)
		return null;
	if (type(proxy.now) != "string" || proxy.now == "")
		return null;
	let nested = proxies[proxy.now];
	if (type(nested) != "object" || nested == null)
		return null;
	return nested;
}

function effective_delay(proxies, proxy, depth) {
	let delay = observed_delay(proxy);
	if (delay != null)
		return delay;
	if (depth <= 0)
		return null;

	let nested = nested_proxy(proxies, proxy);
	if (nested == null)
		return null;

	return effective_delay(proxies, nested, depth - 1);
}

function effective_alive(proxies, proxy, depth) {
	let alive = observed_alive(proxy);
	if (alive != null)
		return alive;
	if (depth <= 0)
		return null;

	let nested = nested_proxy(proxies, proxy);
	if (nested == null)
		return null;

	return effective_alive(proxies, nested, depth - 1);
}

function effective_proxy_name(proxies, name, depth) {
	if (type(proxies) != "object" || proxies == null)
		return name;
	if (type(name) != "string" || name == "")
		return "";
	if (depth <= 0)
		return name;

	let proxy = proxies[name];
	if (type(proxy) != "object" || proxy == null)
		return name;

	let delay = observed_delay(proxy);
	if (delay != null)
		return name;

	if (type(proxy.now) != "string" || proxy.now == "")
		return name;

	return effective_proxy_name(proxies, proxy.now, depth - 1);
}

function proxy_meta(proxies, name) {
	let proxy = null;
	if (type(proxies) == "object" && proxies != null)
		proxy = proxies[name];

	if (type(proxy) != "object" || proxy == null)
		return {
			name: name,
			type: "",
			delay: null,
			alive: null
		};

	return {
		name: name,
		type: type(proxy.type) == "string" ? proxy.type : "",
		delay: effective_delay(proxies, proxy, 4),
		alive: effective_alive(proxies, proxy, 4)
	};
}

function option_meta_list(proxies, names) {
	let options = [];
	if (type(names) != "array")
		return options;

	for (let name in names)
		push(options, proxy_meta(proxies, name));

	return options;
}

function load_selectors(trace_id) {
	let data = http_get_json(trace_id, clash_api_url("/proxies"));
	let selectors = [];

	if (type(data.proxies) != "object" || data.proxies == null)
		return selectors;

	for (let name in data.proxies) {
		let proxy = data.proxies[name];
		if (!is_selector_like(proxy))
			continue;

		push(selectors, {
			name: name,
			type: type(proxy.type) == "string" ? proxy.type : "",
			controllable: is_selector(proxy),
			now: type(proxy.now) == "string" ? proxy.now : "",
			all: type(proxy.all) == "array" ? proxy.all : [],
			delay: effective_delay(data.proxies, proxy, 4),
			alive: effective_alive(data.proxies, proxy, 4),
			options: option_meta_list(data.proxies, type(proxy.all) == "array" ? proxy.all : [])
		});
	}

	return selectors;
}

function profile_selector_order() {
	let profile = parse_json_object(read_text(PATH.PROFILE), "Profile");
	let order = [];

	if (type(profile.outbounds) != "array")
		return order;

	for (let outbound in profile.outbounds) {
		if (type(outbound) != "object" || outbound == null)
			continue;
		if (outbound.type != "selector")
			continue;
		if (type(outbound.tag) != "string" || outbound.tag == "")
			continue;

		push(order, outbound.tag);
	}

	return order;
}

function contains_selector(selectors, name) {
	for (let selector in selectors) {
		if (selector.name == name)
			return true;
	}

	return false;
}

function order_selectors_by_profile(selectors) {
	let order = [];
	try {
		order = profile_selector_order();
	} catch (e) {
		let err = "" + e;
		order = [];
	}

	if (length(order) == 0)
		return selectors;

	let ordered = [];

	for (let tag in order) {
		for (let selector in selectors) {
			if (selector.name == tag && !contains_selector(ordered, selector.name))
				push(ordered, selector);
		}
	}

	for (let selector in selectors) {
		if (!contains_selector(ordered, selector.name))
			push(ordered, selector);
	}

	return ordered;
}

function validate_selector_input(req) {
	if (type(req) != "object" || req == null)
		die("selector_set requires request object");
	if (type(req.selector) != "string" || req.selector == "")
		die("selector must be a non-empty string");
	if (type(req.target) != "string" || req.target == "")
		die("target must be a non-empty string");
}

function find_selector(selectors, name) {
	for (let selector in selectors) {
		if (selector.name == name)
			return selector;
	}

	return null;
}

function has_target(selector, target) {
	if (type(selector.all) != "array")
		return false;

	for (let option in selector.all) {
		if (option == target)
			return true;
	}

	return false;
}

function path_segment_escape(value) {
	value = "" + value;
	let encoded = "";
	for (let i = 0; ; i++) {
		let byte = ord(value, i);
		if (byte == null)
			break;
		if ((byte >= 65 && byte <= 90) || (byte >= 97 && byte <= 122) ||
		    (byte >= 48 && byte <= 57) || byte == 45 || byte == 95 || byte == 126 ||
		    (byte == 46 && value != "." && value != ".."))
			encoded += chr(byte);
		else
			encoded += sprintf("%%%02X", byte);
	}
	return encoded;
}

function selector_url(selector) {
	return clash_api_url("/proxies") + "/" + path_segment_escape(selector);
}

function delay_url(selector) {
	return selector_url(selector) + "/delay?timeout=5000&url=https%3A%2F%2Fwww.gstatic.com%2Fgenerate_204";
}

function validate_delay_input(req) {
	if (type(req) != "object" || req == null)
		die("selector_delay_test requires request object");
	if (type(req.selector) != "string" || req.selector == "")
		die("selector must be a non-empty string");
}

function selector_list(trace_id, req) {
	try {
		let selectors = order_selectors_by_profile(load_selectors(trace_id));

		return Success({
			available: true,
			selectors: selectors
		}, 200, trace_id, "Selectors loaded");
	} catch (e) {
		let err = "" + e;
		return Fail(ERR.E_CLASH_API_UNAVAILABLE, "Failed to load selectors", trace_id, err);
	}
}

function mode_get(trace_id, req) {
	try {
		let config = http_get_json(trace_id, clash_api_url('/configs'));
		return Success({ mode: config.mode, modes: config['mode-list'] || [] }, 200, trace_id, 'Clash mode loaded');
	} catch (e) {
		return Fail(ERR.E_CLASH_API_UNAVAILABLE, 'Failed to load Clash mode', trace_id, '' + e);
	}
}

function mode_set(trace_id, req) {
	try {
		if (type(req) != 'object' || req == null || type(req.mode) != 'string')
			die('mode is required');
		let current = http_get_json(trace_id, clash_api_url('/configs'));
		let allowed = false;
		for (let mode in current['mode-list'] || [])
			if (lc(mode) == lc(req.mode) && (lc(mode) == 'direct' || lc(mode) == 'rule' || lc(mode) == 'global'))
				allowed = true;
		if (!allowed)
			die('mode is not available');
		http_patch_json(trace_id, clash_api_url('/configs'), '{"mode":"' + json_escape(req.mode) + '"}');
		let observed = http_get_json(trace_id, clash_api_url('/configs'));
		if (type(observed.mode) != 'string' || lc(observed.mode) != lc(req.mode))
			die('mode change verification failed');
		return Success({ mode: observed.mode }, 200, trace_id, 'Clash mode changed');
	} catch (e) {
		return Fail(ERR.E_CONTROL_FAILED, 'Failed to change Clash mode', trace_id, '' + e);
	}
}

function selector_delay_test(trace_id, req) {
	try {
		validate_delay_input(req);

		let data = http_get_json(trace_id, clash_api_url("/proxies"));
		if (type(data.proxies) != "object" || data.proxies == null)
			return Fail(ERR.E_SELECTOR_NOT_FOUND, "Selector target not found", trace_id, req.selector);

		let target = effective_proxy_name(data.proxies, req.selector, 4);
		if (target == "" || type(data.proxies[target]) != "object" || data.proxies[target] == null)
			return Fail(ERR.E_SELECTOR_NOT_FOUND, "Selector target not found", trace_id, req.selector);

		let result = http_get_json(trace_id, delay_url(target), 7);
		let delay = result.delay != null ? result.delay : null;

		return Success({
			selector: req.selector,
			target: target,
			delay: delay
		}, 200, trace_id, "Delay test completed");
	} catch (e) {
		let err = "" + e;
		return Fail(ERR.E_CONTROL_FAILED, "Delay test failed", trace_id, err);
	}
}

function node_delay_test(trace_id, req) {
	try {
		if (type(req) != "object" || req == null || type(req.node) != "string" || req.node == "")
			die("node must be a non-empty string");
		/* The Clash delay endpoint validates the outbound name itself. */
		let result = http_get_json(trace_id, delay_url(req.node), 7);
		return Success({ node: req.node, delay: result.delay != null ? result.delay : null }, 200, trace_id, "Node delay test completed");
	} catch (e) {
		return Fail(ERR.E_CONTROL_FAILED, "Node delay test failed", trace_id, "" + e);
	}
}

function selector_set(trace_id, req) {
	try {
		validate_selector_input(req);

		let selectors = load_selectors(trace_id);
		let selector = find_selector(selectors, req.selector);
		if (selector == null)
			return Fail(ERR.E_SELECTOR_NOT_FOUND, "Selector not found", trace_id, req.selector);
		if (!selector.controllable)
			return Fail(ERR.E_SELECTOR_TARGET_INVALID, "Selector is not manually switchable", trace_id, req.selector);
		if (!has_target(selector, req.target))
			return Fail(ERR.E_SELECTOR_TARGET_INVALID, "Selector target is not available", trace_id, req.target);

		http_put_json(trace_id, selector_url(req.selector), "{\"name\":\"" + json_escape(req.target) + "\"}");

		let verified = http_get_json(trace_id, selector_url(req.selector));
		if (type(verified) != "object" || verified == null || verified.now != req.target)
			return Fail(ERR.E_SELECTOR_SWITCH_FAILED, "Selector switch verification failed", trace_id, json_stringify(verified));

		return Success({
			selector: req.selector,
			target: req.target
		}, 200, trace_id, "Selector switched");
	} catch (e) {
		let err = "" + e;
		return Fail(ERR.E_CONTROL_FAILED, "Failed to switch selector", trace_id, err);
	}
}

export { selector_list, selector_delay_test, node_delay_test, selector_set, mode_get, mode_set, path_segment_escape };
