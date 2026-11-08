/** sing-box API adapter, executed in a separate ucode process. */
'use strict';
import { PATH } from 'shinra.core.constants';
import { read_text, parse_json_object } from 'shinra.core.utils';
import { request } from 'shinra.core.grpc_transport';
import { field_string, decode_groups, decode_mode } from 'shinra.core.grpc_proto';

function endpoint() {
	let config = parse_json_object(read_text(PATH.RUNTIME_CONFIG), 'Runtime config');
	let chosen = null;
	for (let service in config.services || []) {
		if (type(service) != 'object' || service == null || service.type != 'api') continue;
		if (chosen == null || service.tag == 'singbox-api' || service.tag == 'shinra-api') chosen = service;
		if (service.tag == 'singbox-api' || service.tag == 'shinra-api') break;
	}
	if (chosen == null) die('sing-box API service is not configured');
	if (type(chosen.tls) == 'object' && chosen.tls != null && chosen.tls.enabled == true)
		die('sing-box API TLS is not supported by this adapter');
	let host = chosen.listen || '0.0.0.0', port = int(chosen.listen_port || 0);
	if (host == '0.0.0.0') host = '127.0.0.1';
	else if (host == '::') host = '::1';
	if (index(host, ':') >= 0 && substr(host, 0, 1) != '[') host = '[' + host + ']';
	if (port <= 0 || port > 65535) die('invalid sing-box API port');
	return { url: 'http://' + host + ':' + port, secret: chosen.secret || '' };
}

function call(api, method, payload, stream) {
	return request(api.url, api.secret, method, payload || '', stream == true);
}

function groups(api) {
	return decode_groups(call(api, 'SubscribeGroups', '', true));
}

function find_group(list, name) {
	for (let group in list) if (group.name == name) return group;
	return null;
}

function contains(list, value) {
	for (let item in list) if (item == value) return true;
	return false;
}

function dispatch(action, args) {
	let api = endpoint();
	if (action == 'list') return { selectors: groups(api), available: true };
	if (action == 'mode_get') return decode_mode(call(api, 'GetClashModeStatus'));
	if (action == 'mode_set') {
		let current = decode_mode(call(api, 'GetClashModeStatus'));
		if (type(args.mode) != 'string' || !contains(current.modes, args.mode)) die('mode is not available');
		call(api, 'SetClashMode', field_string(3, args.mode));
		let after = decode_mode(call(api, 'GetClashModeStatus'));
		if (after.mode != args.mode) die('mode verification failed');
		return { mode: after.mode };
	}
	if (action == 'select') {
		let group = find_group(groups(api), args.selector);
		if (group == null || !group.controllable || !contains(group.all, args.target)) die('invalid selector or target');
		call(api, 'SelectOutbound', field_string(1, args.selector) + field_string(2, args.target));
		let after = find_group(groups(api), args.selector);
		if (after == null || after.now != args.target) die('selection verification failed');
		return { selector: args.selector, target: args.target };
	}
	if (action == 'test') {
		if (type(args.node) != 'string' || args.node == '') die('node is required');
		let valid = false;
		for (let group in groups(api))
			if (group.name == args.node || contains(group.all, args.node)) valid = true;
		if (!valid) die('node not found');
		call(api, 'URLTest', field_string(1, args.node));
		return { node: args.node, pending: true };
	}
	die('unknown native API action');
}

export { dispatch };
