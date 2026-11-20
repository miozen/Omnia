/**
 * Omnia | convert/parsers/form.uc
 * Parser and validator for form-based / manual entry local nodes.
 */

'use strict';

import { create_ir_node, validate_ir_node, is_protocol_supported } from 'omnia.convert.ir';
import { trim } from 'omnia.convert.utils';

function normalize_form_protocol(proto) {
	if (type(proto) != 'string')
		return '';
	let p = lc(trim(proto));
	if (p == 'hy2')
		return 'hysteria2';
	if (p == 'socks5')
		return 'socks';
	return p;
}

function parse_form_node(raw) {
	if (type(raw) != 'object' || raw == null)
		return null;

	// Invariant: Reject detour or proxy chaining on local nodes
	if (raw.detour != null && raw.detour != '' && raw.detour != 'direct')
		return null;

	let proto = normalize_form_protocol(raw.type);
	if (!is_protocol_supported(proto))
		return null;

	let port = int(raw.port || raw.server_port || 0);
	if (port <= 0 || port > 65535)
		return null;

	let server = trim(type(raw.server) == 'string' ? raw.server : '');
	if (server == '')
		return null;

	let name = trim(type(raw.name) == 'string' && raw.name != '' ? raw.name : (type(raw.tag) == 'string' && raw.tag != '' ? raw.tag : (proto + '-' + server + ':' + port)));

	// Protocol-specific validation & extraction
	let uuid = '';
	let password = '';
	let cipher = '';
	let security = '';

	if (proto == 'ss') {
		cipher = type(raw.cipher) == 'string' ? raw.cipher : (type(raw.method) == 'string' ? raw.method : '');
		if (cipher == '')
			cipher = 'aes-128-gcm';
		password = type(raw.password) == 'string' ? raw.password : '';
		if (password == '')
			return null;
	} else if (proto == 'vmess' || proto == 'vless' || proto == 'tuic') {
		uuid = type(raw.uuid) == 'string' ? raw.uuid : '';
		if (uuid == '')
			return null;
		if (proto == 'vmess') {
			security = type(raw.security) == 'string' && raw.security != '' ? raw.security : 'auto';
		} else if (proto == 'tuic') {
			password = type(raw.password) == 'string' ? raw.password : '';
		}
	} else if (proto == 'trojan' || proto == 'hysteria2') {
		password = type(raw.password) == 'string' ? raw.password : (type(raw.auth) == 'string' ? raw.auth : '');
		if (password == '')
			return null;
	} else if (proto == 'socks' || proto == 'http') {
		if (type(raw.password) == 'string')
			password = raw.password;
	}

	let raw_tls = type(raw.tls) == 'object' && raw.tls != null ? raw.tls : null;
	let has_reality = (type(raw.reality) == 'object' && raw.reality != null && raw.reality.enabled == true) ||
	                  (raw_tls != null && type(raw_tls.reality) == 'object' && raw_tls.reality != null && raw_tls.reality.enabled == true);
	let has_tls = raw.tls == true || raw.tls == 'tls' || raw.tls == 1 || (raw_tls != null && raw_tls.enabled != false) || has_reality;
	let sni = type(raw.sni) == 'string' ? raw.sni : (type(raw.server_name) == 'string' ? raw.server_name : (raw_tls != null && type(raw_tls.server_name) == 'string' ? raw_tls.server_name : ''));
	let reality = type(raw.reality) == 'object' && raw.reality != null ? raw.reality : (raw_tls != null && type(raw_tls.reality) == 'object' && raw_tls.reality != null ? raw_tls.reality : null);
	let raw_tr = type(raw.transport) == 'object' && raw.transport != null ? raw.transport : null;
	let network = type(raw.network) == 'string' ? raw.network : (type(raw.transport) == 'string' ? raw.transport : (raw_tr != null && type(raw_tr.type) == 'string' ? raw_tr.type : 'tcp'));
	let ws_opts = type(raw.ws_opts) == 'object' && raw.ws_opts != null ? raw.ws_opts : (type(raw['ws-opts']) == 'object' ? raw['ws-opts'] : (raw_tr != null && raw_tr.type == 'ws' ? raw_tr : null));
	let grpc_opts = type(raw.grpc_opts) == 'object' && raw.grpc_opts != null ? raw.grpc_opts : (type(raw['grpc-opts']) == 'object' ? raw['grpc-opts'] : (raw_tr != null && raw_tr.type == 'grpc' ? raw_tr : null));
	let http_opts = type(raw.http_opts) == 'object' && raw.http_opts != null ? raw.http_opts : (type(raw['http-opts']) == 'object' ? raw['http-opts'] : (raw_tr != null && (raw_tr.type == 'http' || raw_tr.type == 'h2') ? raw_tr : null));

	let ir_data = {
		name: name,
		type: proto,
		server: server,
		port: port,
		uuid: uuid,
		password: password,
		cipher: cipher,
		security: security,
		alterId: int(raw.alterId || raw.alter_id || 0),
		network: network,
		tls: has_tls,
		sni: sni,
		alpn: type(raw.alpn) == 'array' ? raw.alpn : (raw_tls != null && type(raw_tls.alpn) == 'array' ? raw_tls.alpn : []),
		skip_cert_verify: raw.skip_cert_verify == true || raw['skip-cert-verify'] == true || raw.insecure == true || (raw_tls != null && (raw_tls.insecure == true || raw_tls.skip_cert_verify == true)),
		flow: type(raw.flow) == 'string' ? raw.flow : '',
		reality: reality,
		ws_opts: ws_opts,
		grpc_opts: grpc_opts,
		http_opts: http_opts,
		up_mbps: int(raw.up_mbps || raw.up || 0),
		down_mbps: int(raw.down_mbps || raw.down || 0),
		congestion_control: type(raw.congestion_control) == 'string' ? raw.congestion_control : (type(raw.congestion_controller) == 'string' ? raw.congestion_controller : ''),
		obfs: type(raw.obfs) == 'string' ? raw.obfs : '',
		obfs_password: type(raw.obfs_password) == 'string' ? raw.obfs_password : '',
		udp: raw.udp == true,
		_raw_outbound: raw
	};

	let ir = create_ir_node(ir_data);
	let check = validate_ir_node(ir);
	if (!check.ok)
		return null;

	return ir;
}

function parse_form_nodes(nodes_list) {
	if (type(nodes_list) != 'array')
		return { nodes: [], stats: { total: 0, valid: 0, skipped: 0 } };

	let valid_nodes = [];
	let skipped = 0;

	for (let raw in nodes_list) {
		let ir = parse_form_node(raw);
		if (ir != null) {
			push(valid_nodes, ir);
		} else {
			skipped++;
		}
	}

	return {
		nodes: valid_nodes,
		stats: {
			total: length(nodes_list),
			valid: length(valid_nodes),
			skipped: skipped
		}
	};
}

export {
	parse_form_node,
	parse_form_nodes,
	normalize_form_protocol
};
