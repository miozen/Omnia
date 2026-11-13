/**
 * Omnia | convert/producer.uc
 * sing-box Outbound Producer.
 *
 * Converts a Unified IR Node into a valid sing-box outbound dictionary.
 *
 * Architecture Invariants:
 * 1. Base template preservation (_raw_outbound):
 *    If the node originated from native sing-box JSON, its _raw_outbound dictionary is
 *    used as the baseline, guaranteeing 100% preservation of Reality, TLS, Multiplex,
 *    Transport (WS/gRPC/H2/XHTTP), and future experimental fields.
 * 2. Deterministic field merging priority:
 *    final_outbound = sanitize(_raw_outbound) <- override with pipeline-controlled tag/server/port
 * 3. Synthesis from IR for other sources (URI / base64):
 *    Standard protocol mappings for ss, vmess, vless, trojan, hysteria2, tuic, anytls, socks, http.
 * 4. Strict Type Safety:
 *    server_port is int, alpn is array of string, booleans are bool.
 */

'use strict';

import { sanitize_raw_outbound } from 'omnia.convert.parsers.singbox';

function produce_tls(ir) {
	if (!ir.tls)
		return null;

	let tls = {
		enabled: true,
		server_name: ir.sni != '' ? ir.sni : ir.server,
		insecure: ir.skip_cert_verify == true
	};

	if (type(ir.alpn) == 'array' && length(ir.alpn) > 0)
		tls.alpn = ir.alpn;

	if (type(ir.reality) == 'object' && ir.reality != null) {
		tls.reality = {
			enabled: true,
			public_key: ir.reality.public_key || '',
			short_id: ir.reality.short_id || ''
		};
	}

	return tls;
}

function produce_transport(ir) {
	if (ir.network == 'ws' && type(ir.ws_opts) == 'object' && ir.ws_opts != null) {
		let tr = {
			type: 'ws',
			path: ir.ws_opts.path || '/'
		};
		if (type(ir.ws_opts.headers) == 'object' && ir.ws_opts.headers != null)
			tr.headers = ir.ws_opts.headers;
		return tr;
	}

	if (ir.network == 'grpc' && type(ir.grpc_opts) == 'object' && ir.grpc_opts != null) {
		return {
			type: 'grpc',
			service_name: ir.grpc_opts.service_name || ''
		};
	}

	if ((ir.network == 'http' || ir.network == 'h2') && type(ir.http_opts) == 'object' && ir.http_opts != null) {
		return {
			type: 'http',
			host: type(ir.http_opts.host) == 'array' ? ir.http_opts.host : (ir.http_opts.host ? [ir.http_opts.host] : []),
			path: ir.http_opts.path || '/'
		};
	}

	return null;
}

function produce_ss(ir) {
	let out = {
		type: 'ss',
		tag: ir.name,
		server: ir.server,
		server_port: ir.port,
		method: ir.cipher != '' ? ir.cipher : 'aes-128-gcm',
		password: ir.password || ''
	};
	return out;
}

function produce_vmess(ir) {
	let out = {
		type: 'vmess',
		tag: ir.name,
		server: ir.server,
		server_port: ir.port,
		uuid: ir.uuid || '',
		security: ir.security != '' ? ir.security : 'auto',
		alter_id: ir.alterId || 0
	};

	let tls = produce_tls(ir);
	if (tls != null)
		out.tls = tls;

	let tr = produce_transport(ir);
	if (tr != null)
		out.transport = tr;

	return out;
}

function produce_vless(ir) {
	let out = {
		type: 'vless',
		tag: ir.name,
		server: ir.server,
		server_port: ir.port,
		uuid: ir.uuid || ''
	};

	if (ir.flow != '')
		out.flow = ir.flow;

	let tls = produce_tls(ir);
	if (tls != null)
		out.tls = tls;

	let tr = produce_transport(ir);
	if (tr != null)
		out.transport = tr;

	return out;
}

function produce_trojan(ir) {
	let out = {
		type: 'trojan',
		tag: ir.name,
		server: ir.server,
		server_port: ir.port,
		password: ir.password || '',
		tls: produce_tls(ir) || { enabled: true, server_name: ir.sni != '' ? ir.sni : ir.server, insecure: false }
	};

	let tr = produce_transport(ir);
	if (tr != null)
		out.transport = tr;

	return out;
}

function produce_hysteria2(ir) {
	let out = {
		type: 'hysteria2',
		tag: ir.name,
		server: ir.server,
		server_port: ir.port,
		password: ir.password || '',
		tls: produce_tls(ir) || { enabled: true, server_name: ir.sni != '' ? ir.sni : ir.server, insecure: false }
	};

	if (ir.obfs != '') {
		out.obfs = {
			type: ir.obfs,
			password: ir.obfs_password || ''
		};
	}

	if (ir.up_mbps > 0)
		out.up_mbps = ir.up_mbps;
	if (ir.down_mbps > 0)
		out.down_mbps = ir.down_mbps;

	return out;
}

function produce_tuic(ir) {
	let out = {
		type: 'tuic',
		tag: ir.name,
		server: ir.server,
		server_port: ir.port,
		uuid: ir.uuid || '',
		password: ir.password || '',
		congestion_control: ir.congestion_control != '' ? ir.congestion_control : 'bbr',
		tls: produce_tls(ir) || { enabled: true, server_name: ir.sni != '' ? ir.sni : ir.server, insecure: false }
	};

	return out;
}

function produce_anytls(ir) {
	let out = {
		type: 'anytls',
		tag: ir.name,
		server: ir.server,
		server_port: ir.port,
		password: ir.password || '',
		tls: produce_tls(ir) || { enabled: true, server_name: ir.sni != '' ? ir.sni : ir.server, insecure: false }
	};

	return out;
}

function produce_socks_http(ir) {
	let out = {
		type: ir.type,
		tag: ir.name,
		server: ir.server,
		server_port: ir.port
	};

	if (ir.uuid != '')
		out.username = ir.uuid;
	if (ir.password != '')
		out.password = ir.password;

	if (ir.tls) {
		out.tls = produce_tls(ir) || { enabled: true, server_name: ir.sni != '' ? ir.sni : ir.server, insecure: false };
	}

	return out;
}

/**
 * Main producer entry point.
 */
function produce_singbox_outbound(ir) {
	if (type(ir) != 'object' || ir == null)
		return null;

	// Invariant 1: If _raw_outbound is present, use it as baseline
	if (type(ir._raw_outbound) == 'object' && ir._raw_outbound != null) {
		let out = sanitize_raw_outbound(ir._raw_outbound);
		// Override with pipeline-controlled tag, server, and port
		out.tag = ir.name;
		out.server = ir.server;
		out.server_port = ir.port;
		return out;
	}

	// Synthesis for non-raw IR nodes
	let p_type = ir.type;
	if (p_type == 'ss') return produce_ss(ir);
	if (p_type == 'vmess') return produce_vmess(ir);
	if (p_type == 'vless') return produce_vless(ir);
	if (p_type == 'trojan') return produce_trojan(ir);
	if (p_type == 'hysteria2') return produce_hysteria2(ir);
	if (p_type == 'tuic') return produce_tuic(ir);
	if (p_type == 'anytls') return produce_anytls(ir);
	if (p_type == 'socks' || p_type == 'http') return produce_socks_http(ir);

	return null;
}

function produce_singbox_outbounds(ir_list) {
	let outbounds = [];
	if (type(ir_list) != 'array')
		return outbounds;

	for (let ir in ir_list) {
		let out = produce_singbox_outbound(ir);
		if (out != null)
			push(outbounds, out);
	}

	return outbounds;
}

export {
	produce_singbox_outbound,
	produce_singbox_outbounds
};
