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
	let is_inherent_tls = (ir.type == 'hysteria2' || ir.type == 'tuic' || ir.type == 'anytls');
	if (!ir.tls && !is_inherent_tls)
		return null;

	let tls = {
		enabled: true,
		server_name: ir.sni != '' ? ir.sni : ir.server,
		insecure: ir.skip_cert_verify == true
	};

	if (type(ir.alpn) == 'array' && length(ir.alpn) > 0)
		tls.alpn = ir.alpn;

	if (type(ir.fingerprint) == 'string' && ir.fingerprint != '') {
		tls.utls = {
			enabled: true,
			fingerprint: ir.fingerprint
		};
	}

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

	if ((ir.network == 'httpupgrade' || ir.network == 'xhttp') && (type(ir.httpupgrade_opts) == 'object' || type(ir.ws_opts) == 'object')) {
		let opts = type(ir.httpupgrade_opts) == 'object' && ir.httpupgrade_opts != null ? ir.httpupgrade_opts : (type(ir.ws_opts) == 'object' && ir.ws_opts != null ? ir.ws_opts : {});
		let tr = {
			type: 'httpupgrade',
			path: opts.path || '/'
		};
		if (opts.host != '' && opts.host != null)
			tr.host = opts.host;
		if (type(opts.headers) == 'object' && opts.headers != null)
			tr.headers = opts.headers;
		return tr;
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

	let obfs_type = lc(ir.obfs || '');
	if ((obfs_type == 'salamander' || obfs_type == 'gecko') && ir.obfs_password != '') {
		out.obfs = {
			type: obfs_type,
			password: ir.obfs_password
		};
		if (obfs_type == 'gecko') {
			if (ir.obfs_min_packet_size > 0)
				out.obfs.min_packet_size = int(ir.obfs_min_packet_size);
			if (ir.obfs_max_packet_size > 0)
				out.obfs.max_packet_size = int(ir.obfs_max_packet_size);
		}
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
 * Normalizes outbound schema and purges invalid, unparsable, or environment-bound fields
 * to guarantee that candidate configurations comply with sing-box official schema.
 * Optionally collects dropped fields in dropped_stats map and attaches x_omnia_dropped_fields
 * to the outbound for observability before extensions are stripped.
 */
function clean_singbox_outbound(outbound, dropped_stats) {
	if (type(outbound) != 'object' || outbound == null)
		return null;

	let record_drop = function(field) {
		if (type(dropped_stats) == 'object' && dropped_stats != null)
			dropped_stats[field] = (dropped_stats[field] || 0) + 1;
		if (type(outbound.x_omnia_dropped_fields) != 'array')
			outbound.x_omnia_dropped_fields = [];
		push(outbound.x_omnia_dropped_fields, field);
	};

	if (outbound.type == 'ss')
		outbound.type = 'shadowsocks';
	else if (outbound.type == 'hy2')
		outbound.type = 'hysteria2';

	let p_type = outbound.type;

	// 1. Obfuscation rules
	// sing-box constraint: Only hysteria2 supports root obfs; only "salamander" and "gecko" are valid with non-empty password.
	// Any other obfs (e.g. obfs.type: "none" or non-hy2 protocols) causes fatal decode error: "unknown obfs type".
	if (p_type == 'hysteria2') {
		if (outbound.obfs != null) {
			let o_type = type(outbound.obfs) == 'object' ? lc(outbound.obfs.type || '') : '';
			if ((o_type == 'salamander' || o_type == 'gecko') &&
			    type(outbound.obfs.password) == 'string' &&
			    outbound.obfs.password != '') {
				outbound.obfs.type = o_type;
				if (o_type == 'gecko') {
					if (outbound.obfs.min_packet_size != null) {
						let min_p = int(outbound.obfs.min_packet_size);
						if (min_p > 0) outbound.obfs.min_packet_size = min_p;
						else delete outbound.obfs.min_packet_size;
					}
					if (outbound.obfs.max_packet_size != null) {
						let max_p = int(outbound.obfs.max_packet_size);
						if (max_p > 0) outbound.obfs.max_packet_size = max_p;
						else delete outbound.obfs.max_packet_size;
					}
				} else {
					delete outbound.obfs.min_packet_size;
					delete outbound.obfs.max_packet_size;
				}
			} else {
				record_drop('obfs');
				delete outbound.obfs;
			}
		}
	} else {
		if (outbound.obfs != null) {
			record_drop('obfs');
			delete outbound.obfs;
		}
	}

	// 2. Shadowsocks plugin rules
	// sing-box constraint: Shadowsocks plugins must be a recognized binary string (e.g. obfs-local, v2ray-plugin).
	// "none" or empty string causes decode/exec failure; non-SS protocols do not accept plugin fields.
	if (p_type == 'shadowsocks') {
		if (outbound.plugin != null) {
			if (type(outbound.plugin) != 'string' || outbound.plugin == '' || lc(outbound.plugin) == 'none') {
				record_drop('plugin');
				delete outbound.plugin;
				delete outbound.plugin_opts;
			}
		}
		if (outbound.plugin_opts == '' || outbound.plugin_opts == null) {
			delete outbound.plugin_opts;
		}
	} else {
		if (outbound.plugin != null) {
			record_drop('plugin');
			delete outbound.plugin;
			delete outbound.plugin_opts;
		}
	}

	// 3. VMess / VLESS packet_encoding & flow
	// sing-box constraint: packet_encoding and flow must not be empty strings.
	// flow is valid only for VLESS (e.g. "xtls-rprx-vision"); other protocols reject it.
	if (p_type == 'vmess') {
		if (outbound.packet_encoding == '' || outbound.packet_encoding == null)
			delete outbound.packet_encoding;
	} else if (p_type == 'vless') {
		if (outbound.flow == '' || outbound.flow == null)
			delete outbound.flow;
		if (outbound.packet_encoding == '' || outbound.packet_encoding == null)
			delete outbound.packet_encoding;
	} else {
		if (outbound.flow != null && outbound.flow != '') {
			record_drop('flow');
			delete outbound.flow;
		}
		if (outbound.packet_encoding != null && outbound.packet_encoding != '') {
			record_drop('packet_encoding');
			delete outbound.packet_encoding;
		}
	}

	// 4. Detour cleanup
	// sing-box constraint: empty detour reference tag causes missing outbound reference error.
	if (outbound.detour == '' || outbound.detour == null)
		delete outbound.detour;

	// 5. TLS cleanup
	// sing-box constraint: reality without a valid public_key or empty ALPN array triggers validation errors.
	if (type(outbound.tls) == 'object' && outbound.tls != null) {
		if (outbound.tls.reality != null) {
			if (type(outbound.tls.reality) != 'object' || outbound.tls.reality.public_key == '' || outbound.tls.reality.public_key == null) {
				record_drop('reality');
				delete outbound.tls.reality;
			} else if (outbound.tls.reality.short_id == null) {
				outbound.tls.reality.short_id = '';
			}
		}
		if (type(outbound.tls.utls) == 'object' && outbound.tls.utls != null) {
			if (outbound.tls.utls.fingerprint == '' || outbound.tls.utls.fingerprint == null) {
				delete outbound.tls.utls;
			}
		}
		if (type(outbound.tls.alpn) == 'array' && length(outbound.tls.alpn) == 0)
			delete outbound.tls.alpn;
		if (outbound.tls.server_name == '' || outbound.tls.server_name == null)
			delete outbound.tls.server_name;
	}

	// 6. Transport cleanup
	// sing-box constraint: empty headers on websocket or empty service_name on grpc cause parser rejections.
	if (type(outbound.transport) == 'object' && outbound.transport != null) {
		if (outbound.transport.type == 'ws') {
			if (type(outbound.transport.headers) == 'object' && outbound.transport.headers != null && length(keys(outbound.transport.headers)) == 0)
				delete outbound.transport.headers;
		} else if (outbound.transport.type == 'grpc') {
			if (outbound.transport.service_name == '' || outbound.transport.service_name == null)
				delete outbound.transport.service_name;
		} else if (outbound.transport.type == 'httpupgrade') {
			if (outbound.transport.host == '' || outbound.transport.host == null)
				delete outbound.transport.host;
			if (type(outbound.transport.headers) == 'object' && outbound.transport.headers != null && length(keys(outbound.transport.headers)) == 0)
				delete outbound.transport.headers;
		}
	}

	// 7. Multiplex cleanup
	// sing-box constraint: multiplex block with enabled: false is rejected in strict schemas.
	if (type(outbound.multiplex) == 'object' && outbound.multiplex != null) {
		if (outbound.multiplex.enabled == false)
			delete outbound.multiplex;
	}

	// 8. Bandwidth cleanup
	// sing-box constraint: 0 mbps ratings or Clash-specific up/down fields are not part of sing-box schema.
	if (outbound.up_mbps == 0 || outbound.up_mbps == null)
		delete outbound.up_mbps;
	if (outbound.down_mbps == 0 || outbound.down_mbps == null)
		delete outbound.down_mbps;
	delete outbound.up;
	delete outbound.down;

	// 9. Environment & DNS fields cleanup
	// sing-box & Omnia architecture constraint:
	// Outbound-level interface/network bindings bypass Omnia's centralized routing topology;
	// domain_resolver must be centrally controlled via generator_dns to avoid circular deadlocks.
	if (outbound.bind_interface != null) record_drop('bind_interface');
	if (outbound.routing_mark != null) record_drop('routing_mark');
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
function produce_singbox_outbound(ir, dropped_stats) {
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
		return clean_singbox_outbound(out, dropped_stats);
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
		return clean_singbox_outbound(out, dropped_stats);

	return null;
}

function produce_singbox_outbounds(ir_list, dropped_stats) {
	let outbounds = [];
	if (type(ir_list) != 'array')
		return outbounds;

	for (let ir in ir_list) {
		let out = produce_singbox_outbound(ir, dropped_stats);
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
