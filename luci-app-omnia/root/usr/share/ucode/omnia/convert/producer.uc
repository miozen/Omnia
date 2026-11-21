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
		type: 'shadowsocks',
		tag: ir.name,
		server: ir.server,
		server_port: ir.port,
		method: ir.cipher != '' ? ir.cipher : 'aes-128-gcm',
		password: ir.password || ''
	};
	if (type(ir.plugin) == 'string' && ir.plugin != '' && lc(ir.plugin) != 'none') {
		out.plugin = ir.plugin;
		if (ir.plugin_opts != null && ir.plugin_opts != '' && ir.plugin_opts != {})
			out.plugin_opts = ir.plugin_opts;
	}
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

	if (type(ir.packet_encoding) == 'string' && ir.packet_encoding != '')
		out.packet_encoding = ir.packet_encoding;

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

	if (lc(ir.obfs || '') == 'salamander' && ir.obfs_password != '') {
		out.obfs = {
			type: 'salamander',
			password: ir.obfs_password
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
 * Strict schema cleaner for sing-box outbounds.
 * Replicates Sub-Store's cleanSingboxOutbound logic to ensure candidate
 * configuration never contains invalid or unknown fields (e.g., obfs.type: "none", plugin: "none").
 */
function clean_singbox_outbound(outbound) {
	if (type(outbound) != 'object' || outbound == null)
		return null;

	if (outbound.type == 'ss')
		outbound.type = 'shadowsocks';
	else if (outbound.type == 'hy2')
		outbound.type = 'hysteria2';

	let p_type = outbound.type;

	// 1. Obfuscation rules
	if (p_type == 'hysteria2') {
		if (outbound.obfs != null) {
			if (type(outbound.obfs) == 'object' &&
			    lc(outbound.obfs.type || '') == 'salamander' &&
			    type(outbound.obfs.password) == 'string' &&
			    outbound.obfs.password != '') {
				outbound.obfs.type = 'salamander';
			} else {
				delete outbound.obfs;
			}
		}
	} else {
		// Only hysteria2 supports root obfs in sing-box
		delete outbound.obfs;
	}

	// 2. Shadowsocks plugin rules
	if (p_type == 'shadowsocks') {
		if (outbound.plugin != null) {
			if (type(outbound.plugin) != 'string' || outbound.plugin == '' || lc(outbound.plugin) == 'none') {
				delete outbound.plugin;
				delete outbound.plugin_opts;
			}
		}
		if (outbound.plugin_opts == '' || outbound.plugin_opts == null) {
			delete outbound.plugin_opts;
		}
	} else {
		delete outbound.plugin;
		delete outbound.plugin_opts;
	}

	// 3. VMess / VLESS packet_encoding & flow
	if (p_type == 'vmess') {
		if (outbound.packet_encoding == '' || outbound.packet_encoding == null)
			delete outbound.packet_encoding;
	} else if (p_type == 'vless') {
		if (outbound.flow == '' || outbound.flow == null)
			delete outbound.flow;
		if (outbound.packet_encoding == '' || outbound.packet_encoding == null)
			delete outbound.packet_encoding;
	} else {
		delete outbound.flow;
		delete outbound.packet_encoding;
	}

	// 4. Detour cleanup
	if (outbound.detour == '' || outbound.detour == null)
		delete outbound.detour;

	// 5. TLS cleanup
	if (type(outbound.tls) == 'object' && outbound.tls != null) {
		if (outbound.tls.reality != null) {
			if (type(outbound.tls.reality) != 'object' || outbound.tls.reality.public_key == '' || outbound.tls.reality.public_key == null) {
				delete outbound.tls.reality;
			} else if (outbound.tls.reality.short_id == null) {
				outbound.tls.reality.short_id = '';
			}
		}
		if (type(outbound.tls.alpn) == 'array' && length(outbound.tls.alpn) == 0)
			delete outbound.tls.alpn;
		if (outbound.tls.server_name == '' || outbound.tls.server_name == null)
			delete outbound.tls.server_name;
	}

	// 6. Transport cleanup
	if (type(outbound.transport) == 'object' && outbound.transport != null) {
		if (outbound.transport.type == 'ws') {
			if (type(outbound.transport.headers) == 'object' && outbound.transport.headers != null && length(keys(outbound.transport.headers)) == 0)
				delete outbound.transport.headers;
		} else if (outbound.transport.type == 'grpc') {
			if (outbound.transport.service_name == '' || outbound.transport.service_name == null)
				delete outbound.transport.service_name;
		}
	}

	// 7. Multiplex cleanup
	if (type(outbound.multiplex) == 'object' && outbound.multiplex != null) {
		if (outbound.multiplex.enabled == false)
			delete outbound.multiplex;
	}

	// 8. Bandwidth cleanup
	if (outbound.up_mbps == 0 || outbound.up_mbps == null)
		delete outbound.up_mbps;
	if (outbound.down_mbps == 0 || outbound.down_mbps == null)
		delete outbound.down_mbps;
	delete outbound.up;
	delete outbound.down;

	// 9. Environment & DNS fields cleanup
	delete outbound.bind_interface;
	delete outbound.routing_mark;
	delete outbound.reuse_addr;
	delete outbound.netns;
	delete outbound.tcp_fast_open;
	delete outbound.tcp_multi_path;
	delete outbound.udp_fragment;
	delete outbound.inet4_bind_address;
	delete outbound.inet6_bind_address;
	delete outbound.domain_resolver;
	delete outbound.domain_strategy;

	return outbound;
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
		if (out.type == 'ss')
			out.type = 'shadowsocks';
		return clean_singbox_outbound(out);
	}

	// Synthesis for non-raw IR nodes
	let p_type = ir.type;
	let out = null;
	if (p_type == 'ss' || p_type == 'shadowsocks') out = produce_ss(ir);
	else if (p_type == 'vmess') out = produce_vmess(ir);
	else if (p_type == 'vless') out = produce_vless(ir);
	else if (p_type == 'trojan') out = produce_trojan(ir);
	else if (p_type == 'hysteria2') out = produce_hysteria2(ir);
	else if (p_type == 'tuic') out = produce_tuic(ir);
	else if (p_type == 'anytls') out = produce_anytls(ir);
	else if (p_type == 'socks' || p_type == 'http') out = produce_socks_http(ir);

	if (out != null)
		return clean_singbox_outbound(out);

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
	clean_singbox_outbound,
	produce_singbox_outbound,
	produce_singbox_outbounds
};
