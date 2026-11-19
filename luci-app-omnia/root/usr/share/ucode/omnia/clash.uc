/**
 * Omnia | clash.uc | v1.0
 */

'use strict';

import { stat } from 'fs';
import { PATH, BIN, CLASH_API } from 'omnia.core.constants';
import { read_optional_text, parse_json_object, ExecResult, trim } from 'omnia.core.utils';

let _cached_mtime = -1;
let _cached_secret = "";
let _cached_controller = CLASH_API.DEFAULT_EXTERNAL_CONTROLLER;

function refresh_clash_api_cache() {
	let info = stat(PATH.RUNTIME_CONFIG);
	let current_mtime = type(info) == "object" && info != null ? int(info.mtime || 0) : 0;
	if (current_mtime > 0 && current_mtime == _cached_mtime)
		return;

	_cached_mtime = current_mtime;
	let content = read_optional_text(PATH.RUNTIME_CONFIG);
	if (content == "") {
		_cached_secret = "";
		_cached_controller = CLASH_API.DEFAULT_EXTERNAL_CONTROLLER;
		return;
	}

	try {
		let config = parse_json_object(content, "Runtime Config");
		if (type(config.experimental) == "object" && config.experimental != null &&
		    type(config.experimental.clash_api) == "object" && config.experimental.clash_api != null) {
			let api = config.experimental.clash_api;
			_cached_secret = type(api.secret) == "string" ? api.secret : "";
			_cached_controller = (type(api.external_controller) == "string" && api.external_controller != "") ? api.external_controller : CLASH_API.DEFAULT_EXTERNAL_CONTROLLER;
		} else {
			_cached_secret = "";
			_cached_controller = CLASH_API.DEFAULT_EXTERNAL_CONTROLLER;
		}
	} catch (e) {
		_cached_secret = "";
		_cached_controller = CLASH_API.DEFAULT_EXTERNAL_CONTROLLER;
	}
}

function first_json_line(text) {
	text = "" + text;
	let line = "";

	for (let i = 0; i < length(text); i++) {
		let ch = substr(text, i, 1);
		if (ch == "\r")
			continue;
		if (ch == "\n")
			break;
		line = line + ch;
	}

	return line;
}

function clash_api_secret() {
	refresh_clash_api_cache();
	return _cached_secret;
}

function clash_api_external_controller() {
	refresh_clash_api_cache();
	return _cached_controller;
}

function strip_trailing_slash(value) {
	value = "" + value;
	while (length(value) > 0 && substr(value, length(value) - 1, 1) == "/")
		value = substr(value, 0, length(value) - 1);
	return value;
}

function clash_api_base_url() {
	let controller = strip_trailing_slash(clash_api_external_controller());
	if (index(controller, "http://") == 0 || index(controller, "https://") == 0)
		return controller;
	return "http://" + controller;
}

function clash_api_url(path) {
	path = "" + path;
	if (path == "")
		return clash_api_base_url();
	if (substr(path, 0, 1) != "/")
		path = "/" + path;
	return clash_api_base_url() + path;
}

function wget_args(method, url, body, timeout_sec) {
	let limit = timeout_sec || 3;
	let args = [ BIN.TIMEOUT, "" + limit, "wget", "-q", "-T", "" + (limit - 1) ];
	let secret = clash_api_secret();

	if (secret != "")
		push(args, "--header=Authorization: Bearer " + secret);

	if (method == "PUT" || method == "PATCH") {
		push(args, "--method=" + method);
		push(args, "--header=Content-Type: application/json");
		push(args, "--body-data=" + body);
	}

	push(args, "-O");
	push(args, "-");
	push(args, url);
	return args;
}

function http_get_json(trace_id, url, timeout_sec) {
	let result = ExecResult(trace_id, wget_args("GET", url, "", timeout_sec));
	let text = trim(result.stdout);

	if (result.code != 0)
		die(result.stderr || result.stdout || "HTTP GET failed");
	if (text == "")
		die(result.stderr || "empty response from " + url);

	/* If multi-line response or stream, try parsing full text first, fallback to first line */
	let parsed = null;
	try {
		parsed = json(text);
	} catch (e) {
		let first_line = first_json_line(text);
		if (first_line != "" && first_line != text) {
			try {
				parsed = json(first_line);
			} catch (e2) {
				die("Failed to parse JSON response: " + e2);
			}
		} else {
			die("Failed to parse JSON response: " + e);
		}
	}

	return parsed;
}

function http_put_json(trace_id, url, body) {
	let result = ExecResult(trace_id, wget_args("PUT", url, body));

	if (result.code != 0)
		die(result.stderr || result.stdout || "HTTP PUT failed");

	return result.stdout || "";
}

function http_patch_json(trace_id, url, body) {
	let result = ExecResult(trace_id, wget_args("PATCH", url, body));
	if (result.code != 0)
		die(result.stderr || result.stdout || "HTTP PATCH failed");
	return result.stdout || "";
}

function api_available(trace_id, url) {
	try {
		http_get_json(trace_id, url);
		return true;
	} catch (e) {
		let err = "" + e;
		return false;
	}
}

export { clash_api_external_controller, clash_api_base_url, clash_api_url, http_get_json, http_put_json, http_patch_json, api_available };
