/**
 * Omnia | convert/parsers/uri.uc
 * URI parser converting various proxy protocol URLs to Unified IR Nodes.
 *
 * Supported protocols (Full):
 * - ss:// (SIP002, legacy base64, AEAD-2022)
 * - vmess:// (v2rayN base64 JSON, standard URI)
 * - vless:// (Standard URI, TLS, Reality, WS, gRPC)
 * - trojan:// (Standard URI, TLS, WS, gRPC)
 * - hysteria2:// / hy2:// (Standard URI, salamander obfs, port hopping, SNI)
 * - tuic:// (Standard URI, congestion control, ALPN)
 * - socks:// / socks5:// (Plain & base64 userinfo)
 * - http:// / https:// (Plain & user:pass auth)
 */

'use strict';

import { trim, urldecode, parse_query, safe_b64decode, split_lines } from 'omnia.convert.utils';
import { create_ir_node, validate_ir_node } from 'omnia.convert.ir';

function parse_authority(auth_str, default_port) {
	if (type(auth_str) != 'string' || auth_str == '')
		return { host: '', port: default_port || 0, userinfo: '' };

	let userinfo = '';
	let host_port = auth_str;
	let at_idx = index(auth_str, '@');
	if (at_idx >= 0) {
		userinfo = substr(auth_str, 0, at_idx);
		host_port = substr(auth_str, at_idx + 1);
	}

	let host = host_port;
	let port = default_port || 0;

	// Check IPv6 literal: [2001:db8::1]:443
	if (substr(host_port, 0, 1) == '[') {
		let close_bracket = index(host_port, ']');
		if (close_bracket > 0) {
			host = substr(host_port, 1, close_bracket - 1);
			let rest = substr(host_port, close_bracket + 1);
			if (substr(rest, 0, 1) == ':') {
				let p_str = substr(rest, 1);
				let dash_idx = index(p_str, '-');
				if (dash_idx > 0)
					p_str = substr(p_str, 0, dash_idx);
				let comma_idx = index(p_str, ',');
				if (comma_idx > 0)
					p_str = substr(p_str, 0, comma_idx);
				port = int(p_str);
			}
		}
	} else {
		let colon_idx = index(host_port, ':');
		if (colon_idx >= 0) {
			host = substr(host_port, 0, colon_idx);
			let p_str = substr(host_port, colon_idx + 1);
			let dash_idx = index(p_str, '-');
			if (dash_idx > 0)
				p_str = substr(p_str, 0, dash_idx);
			let comma_idx = index(p_str, ',');
			if (comma_idx > 0)
				p_str = substr(p_str, 0, comma_idx);
			port = int(p_str);
		}
	}

	return {
		host: host,
		port: port,
		userinfo: userinfo
	};
}

function parse_generic_uri(uri) {
	let hash_idx = index(uri, '#');
	let fragment = '';
	let main_part = uri;
	if (hash_idx >= 0) {
		fragment = urldecode(substr(uri, hash_idx + 1));
		main_part = substr(uri, 0, hash_idx);
	}

	let query_idx = index(main_part, '?');
	let query_str = '';
	let pre_query = main_part;
	if (query_idx >= 0) {
		query_str = substr(main_part, query_idx + 1);
		pre_query = substr(main_part, 0, query_idx);
	}

	let scheme_idx = index(pre_query, '://');
	if (scheme_idx < 0)
		return null;

	let scheme = lc(substr(pre_query, 0, scheme_idx));
	let auth_and_path = substr(pre_query, scheme_idx + 3);

	// Strip trailing slash before query if path is empty
	let slash_idx = index(auth_and_path, '/');
	let auth_str = auth_and_path;
	let path = '';
	if (slash_idx >= 0) {
		auth_str = substr(auth_and_path, 0, slash_idx);
		path = substr(auth_and_path, slash_idx);
	}

	let default_port = 0;
	if (scheme == 'https') default_port = 443;
	else if (scheme == 'http') default_port = 80;
	else if (scheme == 'socks5' || scheme == 'socks') default_port = 1080;

	let authority = parse_authority(auth_str, default_port);
	let query = parse_query(query_str);

	return {
		scheme: scheme,
		host: authority.host,
		port: authority.port,
		userinfo: authority.userinfo,
		path: path,
		query: query,
		fragment: fragment
	};
}

function parse_ss(uri) {
	let parsed = parse_generic_uri(uri);
	if (!parsed)
		return null;

	let name = parsed.fragment != '' ? parsed.fragment : (parsed.host + ':' + parsed.port);
	let cipher = '';
	let password = '';
	let server = parsed.host;
	let port = parsed.port;

	if (parsed.userinfo != '') {
		let userinfo = parsed.userinfo;
		let decoded_ui = safe_b64decode(userinfo);
		let target_ui = decoded_ui != null && index(decoded_ui, ':') >= 0 ? decoded_ui : userinfo;
		let colon = index(target_ui, ':');
		if (colon >= 0) {
			cipher = urldecode(substr(target_ui, 0, colon));
			password = urldecode(substr(target_ui, colon + 1));
		}
	} else {
		// Legacy format: ss://base64(cipher:password@server:port)#name
		let main_b64 = substr(uri, 5);
		let hash_pos = index(main_b64, '#');
		if (hash_pos >= 0)
			main_b64 = substr(main_b64, 0, hash_pos);
		let q_pos = index(main_b64, '?');
		if (q_pos >= 0)
			main_b64 = substr(main_b64, 0, q_pos);
		let decoded = safe_b64decode(main_b64);
		if (decoded != null) {
			let authority = parse_authority(decoded, 0);
			server = authority.host;
			port = authority.port;
			let colon = index(authority.userinfo, ':');
			if (colon >= 0) {
				cipher = urldecode(substr(authority.userinfo, 0, colon));
				password = urldecode(substr(authority.userinfo, colon + 1));
			}
		}
	}

	let udp = parsed.query.udp != '0' && parsed.query.udp != 'false';

	return create_ir_node({
		name: name,
		type: 'ss',
		server: server,
		port: port,
		cipher: cipher,
		password: password,
		udp: udp
	});
}

function parse_vmess(uri) {
	let raw = substr(uri, 8);
	let decoded = safe_b64decode(raw);

	// 1. v2rayN JSON base64 format
	if (decoded != null && (substr(trim(decoded), 0, 1) == '{')) {
		try {
			let j = json(decoded);
			if (type(j) == 'object' && j != null) {
				let name = type(j.ps) == 'string' && j.ps != '' ? j.ps : (j.add + ':' + j.port);
				let port = int(j.port || 0);
				let network = type(j.net) == 'string' && j.net != '' ? j.net : 'tcp';
				let tls = j.tls == 'tls' || j.tls == true;
				let sni = type(j.sni) == 'string' && j.sni != '' ? j.sni : (type(j.host) == 'string' ? j.host : '');

				let ws_opts = null;
				let grpc_opts = null;
				let http_opts = null;

				if (network == 'ws') {
					ws_opts = {
						path: type(j.path) == 'string' && j.path != '' ? j.path : '/',
						headers: type(j.host) == 'string' && j.host != '' ? { Host: j.host } : {}
					};
				} else if (network == 'grpc') {
					grpc_opts = {
						service_name: type(j.path) == 'string' ? j.path : ''
					};
				} else if (network == 'http' || network == 'h2') {
					http_opts = {
						host: type(j.host) == 'string' && j.host != '' ? split(j.host, ',') : [],
						path: type(j.path) == 'string' && j.path != '' ? j.path : '/'
					};
				}

				return create_ir_node({
					name: name,
					type: 'vmess',
					server: j.add || '',
					port: port,
					uuid: j.id || '',
					alterId: int(j.aid || 0),
					security: j.scy || 'auto',
					network: network,
					tls: tls,
					sni: sni,
					alpn: type(j.alpn) == 'string' && j.alpn != '' ? split(j.alpn, ',') : [],
					ws_opts: ws_opts,
					grpc_opts: grpc_opts,
					http_opts: http_opts
				});
			}
		} catch (e) {}
	}

	// 2. Standard URI format: vmess://uuid@server:port?query#name
	let parsed = parse_generic_uri(uri);
	if (!parsed)
		return null;

	let q = parsed.query;
	let network = q.type || q.net || 'tcp';
	let tls = q.security == 'tls' || q.tls == '1' || q.tls == 'true';
	let sni = q.sni || q.host || '';

	let ws_opts = null;
	let grpc_opts = null;
	if (network == 'ws') {
		ws_opts = {
			path: q.path || '/',
			headers: q.host != '' ? { Host: q.host } : {}
		};
	} else if (network == 'grpc') {
		grpc_opts = {
			service_name: q.serviceName || q.path || ''
		};
	}

	return create_ir_node({
		name: parsed.fragment != '' ? parsed.fragment : (parsed.host + ':' + parsed.port),
		type: 'vmess',
		server: parsed.host,
		port: parsed.port,
		uuid: parsed.userinfo,
		alterId: int(q.alterId || 0),
		security: q.security || q.encryption || 'auto',
		network: network,
		tls: tls,
		sni: sni,
		ws_opts: ws_opts,
		grpc_opts: grpc_opts
	});
}

function parse_vless(uri) {
	let parsed = parse_generic_uri(uri);
	if (!parsed)
		return null;

	let q = parsed.query;
	let network = q.type || q.net || 'tcp';
	let security = lc(q.security || '');
	let tls = security == 'tls' || security == 'reality';
	let sni = q.sni || q.host || '';

	let reality = null;
	if (security == 'reality') {
		reality = {
			enabled: true,
			public_key: q.pbk || '',
			short_id: q.sid || ''
		};
	}

	let ws_opts = null;
	let grpc_opts = null;
	if (network == 'ws') {
		ws_opts = {
			path: q.path || '/',
			headers: q.host != '' ? { Host: q.host } : {}
		};
	} else if (network == 'grpc') {
		grpc_opts = {
			service_name: q.serviceName || q.path || ''
		};
	}

	let alpn = [];
	if (q.alpn != '')
		alpn = split(q.alpn, ',');

	return create_ir_node({
		name: parsed.fragment != '' ? parsed.fragment : (parsed.host + ':' + parsed.port),
		type: 'vless',
		server: parsed.host,
		port: parsed.port,
		uuid: parsed.userinfo,
		flow: q.flow || '',
		network: network,
		tls: tls,
		sni: sni,
		alpn: alpn,
		skip_cert_verify: q.allowInsecure == '1' || q.insecure == '1',
		reality: reality,
		ws_opts: ws_opts,
		grpc_opts: grpc_opts
	});
}

function parse_trojan(uri) {
	let parsed = parse_generic_uri(uri);
	if (!parsed)
		return null;

	let q = parsed.query;
	let network = q.type || q.net || 'tcp';
	let sni = q.sni || q.peer || '';

	let ws_opts = null;
	let grpc_opts = null;
	if (network == 'ws') {
		ws_opts = {
			path: q.path || '/',
			headers: q.host != '' ? { Host: q.host } : {}
		};
	} else if (network == 'grpc') {
		grpc_opts = {
			service_name: q.serviceName || q.path || ''
		};
	}

	let alpn = [];
	if (q.alpn != '')
		alpn = split(q.alpn, ',');

	return create_ir_node({
		name: parsed.fragment != '' ? parsed.fragment : (parsed.host + ':' + parsed.port),
		type: 'trojan',
		server: parsed.host,
		port: parsed.port,
		password: parsed.userinfo,
		network: network,
		tls: true,
		sni: sni,
		alpn: alpn,
		skip_cert_verify: q.allowInsecure == '1' || q.insecure == '1',
		ws_opts: ws_opts,
		grpc_opts: grpc_opts
	});
}

function parse_hysteria2(uri) {
	let parsed = parse_generic_uri(uri);
	if (!parsed)
		return null;

	let q = parsed.query;
	let sni = q.sni || q.peer || '';
	let obfs_type = q.obfs || '';
	let obfs_password = q['obfs-password'] || '';

	let alpn = [];
	if (q.alpn != '')
		alpn = split(q.alpn, ',');

	return create_ir_node({
		name: parsed.fragment != '' ? parsed.fragment : (parsed.host + ':' + parsed.port),
		type: 'hysteria2',
		server: parsed.host,
		port: parsed.port,
		password: parsed.userinfo,
		tls: true,
		sni: sni,
		alpn: alpn,
		skip_cert_verify: q.insecure == '1' || q.allowInsecure == '1',
		obfs: obfs_type,
		obfs_password: obfs_password,
		up_mbps: int(q.upmbps || 0),
		down_mbps: int(q.downmbps || 0)
	});
}

function parse_tuic(uri) {
	let parsed = parse_generic_uri(uri);
	if (!parsed)
		return null;

	let q = parsed.query;
	let uuid = '';
	let password = '';
	let colon = index(parsed.userinfo, ':');
	if (colon >= 0) {
		uuid = substr(parsed.userinfo, 0, colon);
		password = substr(parsed.userinfo, colon + 1);
	} else {
		uuid = parsed.userinfo;
		password = q.password || '';
	}

	let alpn = [];
	if (q.alpn != '')
		alpn = split(q.alpn, ',');

	return create_ir_node({
		name: parsed.fragment != '' ? parsed.fragment : (parsed.host + ':' + parsed.port),
		type: 'tuic',
		server: parsed.host,
		port: parsed.port,
		uuid: uuid,
		password: password,
		tls: true,
		sni: q.sni || '',
		alpn: alpn,
		congestion_control: q.congestion_control || q.cc || 'bbr',
		skip_cert_verify: q.allow_insecure == '1' || q.insecure == '1',
		udp: true
	});
}

function parse_socks_http(uri) {
	let parsed = parse_generic_uri(uri);
	if (!parsed)
		return null;

	let is_socks = parsed.scheme == 'socks5' || parsed.scheme == 'socks';
	let is_tls = parsed.scheme == 'https';
	let username = '';
	let password = '';

	if (parsed.userinfo != '') {
		let ui = parsed.userinfo;
		let decoded = safe_b64decode(ui);
		let target = decoded != null && index(decoded, ':') >= 0 ? decoded : ui;
		let colon = index(target, ':');
		if (colon >= 0) {
			username = urldecode(substr(target, 0, colon));
			password = urldecode(substr(target, colon + 1));
		} else {
			username = urldecode(target);
		}
	}

	return create_ir_node({
		name: parsed.fragment != '' ? parsed.fragment : (parsed.host + ':' + parsed.port),
		type: is_socks ? 'socks' : 'http',
		server: parsed.host,
		port: parsed.port,
		uuid: username,
		password: password,
		tls: is_tls
	});
}

function parse_anytls(uri) {
	let parsed = parse_generic_uri(uri);
	if (!parsed)
		return null;

	let q = parsed.query;
	let alpn = [];
	if (q.alpn != '')
		alpn = split(q.alpn, ',');

	return create_ir_node({
		name: parsed.fragment != '' ? parsed.fragment : (parsed.host + ':' + parsed.port),
		type: 'anytls',
		server: parsed.host,
		port: parsed.port,
		password: parsed.userinfo,
		tls: true,
		sni: q.sni || q.peer || parsed.host,
		alpn: alpn,
		skip_cert_verify: q.insecure == '1' || q.allowInsecure == '1',
		udp: q.udp == '1' || q.udp == 'true'
	});
}

function parse_single_uri(line) {
	line = trim(line);
	if (line == '')
		return null;

	let lower = lc(line);
	let node = null;

	if (index(lower, 'ss://') == 0) {
		node = parse_ss(line);
	} else if (index(lower, 'vmess://') == 0) {
		node = parse_vmess(line);
	} else if (index(lower, 'vless://') == 0) {
		node = parse_vless(line);
	} else if (index(lower, 'trojan://') == 0) {
		node = parse_trojan(line);
	} else if (index(lower, 'hysteria2://') == 0 || index(lower, 'hy2://') == 0) {
		node = parse_hysteria2(line);
	} else if (index(lower, 'tuic://') == 0) {
		node = parse_tuic(line);
	} else if (index(lower, 'anytls://') == 0) {
		node = parse_anytls(line);
	} else if (index(lower, 'socks5://') == 0 || index(lower, 'socks://') == 0 ||
	           index(lower, 'http://') == 0 || index(lower, 'https://') == 0) {
		node = parse_socks_http(line);
	}

	if (node != null) {
		let val = validate_ir_node(node);
		if (val.ok)
			return node;
	}

	return null;
}

function parse_uri_list(lines) {
	let nodes = [];
	if (type(lines) != 'array')
		return nodes;

	for (let line in lines) {
		let node = parse_single_uri(line);
		if (node != null)
			push(nodes, node);
	}

	return nodes;
}

export {
	parse_single_uri,
	parse_uri_list
};
