/**
 * Omnia | api_status.uc | v1.0
 */

'use strict';

import { PATH, BIN } from 'omnia.core.constants';
import { Success, Fail } from 'omnia.core.result';
import { ERR } from 'omnia.core.error';
import { read_optional_text, parse_json_object, file_exists, ExecResult } from 'omnia.core.utils';
import { observe_runtime } from 'omnia.runtime';
import { read_dashboard_source } from 'omnia.dashboard_config';
import { clash_api_url, api_available } from 'omnia.clash';

function runtime_config() {
	if (!file_exists(PATH.RUNTIME_CONFIG))
		return {};

	let content = read_optional_text(PATH.RUNTIME_CONFIG);
	if (content == "")
		return {};
	return parse_json_object(content, "Runtime Config");
}

function dashboard_host(listen) {
	if (listen == "0.0.0.0" || listen == "::")
		return "<router-host>";
	return listen;
}

function dashboard_url_from_endpoint(listen, port) {
	return "http://" + dashboard_host(listen) + ":" + port + "/dashboard/";
}

function api_url_from_endpoint(listen, port) {
	return "http://" + dashboard_host(listen) + ":" + port + "/";
}

function empty_singbox_api() {
	return {
		configured: false,
		source: "none",
		tag: "",
		listen: "",
		listen_port: 0,
		secret_configured: false,
		dashboard_enabled: false
	};
}

function runtime_singbox_api(config, source) {
	let fallback = empty_singbox_api();
	if (type(config.services) != "array")
		return fallback;

	for (let service in config.services) {
		if (type(service) != "object" || service == null)
			continue;
		if (service.type != "api")
			continue;

		let data = {
			configured: true,
			source: (service.tag == "singbox-api" || service.tag == "omnia-api") ? "dashboard" : "profile",
			tag: service.tag || "",
			listen: type(service.listen) == "string" && service.listen != "" ? service.listen : "0.0.0.0",
			listen_port: int(service.listen_port || 0),
			secret_configured: type(service.secret) == "string" && service.secret != "",
			tls_enabled: type(service.tls) == "object" && service.tls != null && service.tls.enabled == true,
			dashboard_enabled: type(service.dashboard) == "object" && service.dashboard != null && service.dashboard.enabled == true
		};

		if (service.tag == "singbox-api" || service.tag == "omnia-api")
			return data;
		if (!fallback.configured)
			fallback = data;
	}

	return fallback;
}

function runtime_clash_api(config) {
	if (type(config.experimental) != "object" || config.experimental == null || type(config.experimental) == "array")
		return null;
	if (type(config.experimental.clash_api) != "object" || config.experimental.clash_api == null || type(config.experimental.clash_api) == "array")
		return null;
	return config.experimental.clash_api;
}

function singbox_status(trace_id, source, config, running) {
	let runtime_api = runtime_singbox_api(config, source);
	let runtime_configured = runtime_api.configured == true;
	let configured = source.enabled == true || runtime_configured;
	let listen = runtime_configured ? runtime_api.listen : source.listen;
	let listen_port = runtime_configured ? runtime_api.listen_port : source.listen_port;
	let available = false;
	let verified = false;
	let reason = "ok";

	if (!configured)
		reason = "disabled";
	else if (!running)
		reason = "runtime_not_running";
	else if (!runtime_configured)
		reason = "runtime_service_missing";
	else if (runtime_api.secret_configured || runtime_api.tls_enabled) {
		available = null;
		reason = runtime_api.secret_configured ? "probe_secret_unsupported" : "probe_tls_unsupported";
	}
	else if (listen_port <= 0 || listen_port > 65535)
		reason = "invalid_endpoint";
	else {
		let host = listen;
		if (host == "0.0.0.0") host = "127.0.0.1";
		else if (host == "::") host = "::1";
		if (index(host, ":") >= 0 && substr(host, 0, 1) != "[") host = "[" + host + "]";
		let probe = ExecResult(trace_id, [ BIN.TIMEOUT, "5", BIN.SING_BOX, "api", "--url", "http://" + host + ":" + listen_port, "mode" ]);
		verified = true;
		available = probe.code == 0;
		reason = available ? "ok" : "probe_failed";
	}

	return {
		configured: configured,
		runtime_configured: runtime_configured,
		source_enabled: source.enabled == true,
		source: runtime_configured ? runtime_api.source : (source.enabled == true ? "dashboard" : "none"),
		tag: runtime_configured ? runtime_api.tag : "singbox-api",
		running: running,
		available: available,
		verified: verified,
		listen: listen,
		listen_port: listen_port,
		api_url: api_url_from_endpoint(listen, listen_port),
		dashboard_url: dashboard_url_from_endpoint(listen, listen_port),
		dashboard_enabled: runtime_configured ? runtime_api.dashboard_enabled : (type(source.dashboard) == "object" && source.dashboard != null && source.dashboard.enabled == true),
		secret_configured: runtime_configured ? runtime_api.secret_configured : source.secret != "",
		reason: reason
	};
}

function clash_status(trace_id, source, config, running) {
	let runtime_api = runtime_clash_api(config);
	let configured = type(runtime_api) == "object" && runtime_api != null;
	let source_enabled = type(source.clash_api) == "object" && source.clash_api != null && source.clash_api.enabled == true;
	let external_controller = configured && type(runtime_api.external_controller) == "string" ? runtime_api.external_controller : "";
	let available = false;
	let reason = "ok";

	if (!source_enabled)
		reason = "disabled";
	else if (!configured)
		reason = "runtime_config_missing";
	else if (!running)
		reason = "runtime_not_running";
	else {
		available = api_available(trace_id, clash_api_url("/proxies"));
		if (!available)
			reason = "unreachable";
	}

	return {
		configured: configured,
		source_enabled: source_enabled,
		running: running,
		available: available,
		external_controller: external_controller,
		secret_configured: configured && type(runtime_api.secret) == "string" && runtime_api.secret != "",
		reason: reason
	};
}

function api_status(trace_id, req) {
	try {
		let source = read_dashboard_source();
		let config = runtime_config();
		let observed = observe_runtime(trace_id);
		let running = observed.running == true;

		return Success({
			singbox_api: singbox_status(trace_id, source, config, running),
			clash_api: clash_status(trace_id, source, config, running)
		}, 200, trace_id, "API status observed");
	} catch (e) {
		let err = "" + e;
		return Fail(ERR.E_API_STATUS_FAILED, "Failed to observe API status", trace_id, err);
	}
}

export { api_status };
