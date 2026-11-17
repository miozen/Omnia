/**
 * Omnia | dashboard.uc | v1.0
 */

'use strict';

import { Success, Fail } from 'omnia.core.result';
import { ERR } from 'omnia.core.error';
import { PATH } from 'omnia.core.constants';
import { read_optional_text } from 'omnia.core.utils';
import { observe_runtime } from 'omnia.runtime';
import { http_get_json, clash_api_url } from 'omnia.clash';

function empty_clash_api(reason) {
	return {
		available: false,
		reason: reason,
		traffic: {
			up: 0,
			down: 0
		},
		connections: {
			count: 0,
			upload_total: 0,
			download_total: 0
		},
		proxies: {
			selectors: []
		}
	};
}

function number_or_zero(value) {
	if (type(value) == "int" || type(value) == "double")
		return value;
	return 0;
}

function observe_traffic(trace_id) {
	/* The /traffic endpoint in Clash API is an infinite SSE stream.
	   To avoid blocking rpcd/ubus for seconds on wget timeout, traffic
	   rates are calculated smoothly by frontend deltas on cumulative bytes. */
	return {
		up: 0,
		down: 0
	};
}

function observe_connections(trace_id) {
	let data = http_get_json(trace_id, clash_api_url("/connections"));
	let count = 0;

	if (type(data.connections) == "array")
		count = length(data.connections);

	return {
		count: count,
		upload_total: number_or_zero(data.uploadTotal),
		download_total: number_or_zero(data.downloadTotal)
	};
}

function is_selector(proxy) {
	if (type(proxy) != "object" || proxy == null)
		return false;
	if (proxy.type == "Selector" || proxy.type == "selector")
		return true;
	return type(proxy.all) == "array" && type(proxy.now) == "string";
}

function observe_proxies(trace_id) {
	let data = http_get_json(trace_id, clash_api_url("/proxies"));
	let selectors = [];

	if (type(data.proxies) == "object" && data.proxies != null) {
		for (let name in data.proxies) {
			let proxy = data.proxies[name];
			if (!is_selector(proxy))
				continue;

			push(selectors, {
				name: name,
				now: type(proxy.now) == "string" ? proxy.now : "",
				all_count: type(proxy.all) == "array" ? length(proxy.all) : 0
			});
		}
	}

	return {
		selectors: selectors
	};
}

function observe_clash_api(trace_id, runtime_state) {
	if (!runtime_state.sing_box_running)
		return empty_clash_api("runtime_not_running");

	let proxies = null;
	try {
		proxies = observe_proxies(trace_id);
	} catch (e) {
		let err = "" + e;
		return empty_clash_api("api_unreachable");
	}

	let traffic = {
		up: 0,
		down: 0
	};
	let connections = {
		count: 0
	};

	try {
		traffic = observe_traffic(trace_id);
	} catch (e) {
		let err = "" + e;
	}

	try {
		connections = observe_connections(trace_id);
	} catch (e) {
		let err = "" + e;
	}

	return {
		available: true,
		reason: "ok",
		traffic: traffic,
		connections: connections,
		proxies: proxies
	};
}

function dashboard_overview(trace_id, req) {
	try {
		let observed = observe_runtime(trace_id);
		let state = json(observed.state);

		return Success({
			runtime: state,
			cards: {
				running: state.sing_box_running,
				tun: state.tun_exists,
				clash_api: state.clash_api_available,
				runtime_config: state.runtime_config_exists,
				last_apply_result: state.last_apply_result,
				recent_error: state.recent_error,
				checked_at: state.checked_at
			}
		}, 200, trace_id, "Dashboard overview observed");
	} catch (e) {
		let err = "" + e;
		return Fail(ERR.E_DASHBOARD_OBSERVE_FAILED, "Failed to observe Dashboard overview", trace_id, err);
	}
}

function dashboard_metrics(trace_id, req) {
	try {
		let cached_text = read_optional_text(PATH.RUNTIME_STATE);
		let state = {};
		if (cached_text && cached_text != "") {
			try {
				state = json(cached_text);
			} catch (e) {
				state = {};
			}
		}

		/* Fetch connections and bandwidth totals directly without blocking.
		   Avoid running heavy observe_runtime or observe_proxies. */
		let conns_data = null;
		let available = false;
		try {
			conns_data = observe_connections(trace_id);
			available = true;
		} catch (e) {
			conns_data = {
				count: 0,
				upload_total: 0,
				download_total: 0
			};
			available = false;
		}

		return Success({
			runtime: state,
			clash_api: {
				available: available,
				reason: available ? "ok" : "unreachable",
				traffic: { up: 0, down: 0 },
				connections: conns_data,
				proxies: { selectors: [] }
			}
		}, 200, trace_id, "Dashboard metrics observed");
	} catch (e) {
		let err = "" + e;
		return Fail(ERR.E_DASHBOARD_OBSERVE_FAILED, "Failed to observe Dashboard metrics", trace_id, err);
	}
}

export { dashboard_overview, dashboard_metrics };
