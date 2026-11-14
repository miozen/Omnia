/**
 * Omnia | convert/parsers/clash.uc
 * Restricted Clash/Mihomo YAML parser for proxy subscriptions.
 *
 * Capabilities & Boundaries:
 * - Only extracts the `proxies:` or `payload:` mapping section.
 * - Supports both Block Style (indented multi-line) and Flow Style (inline { ... }).
 * - Maps supported proxy protocols to Unified IR Nodes (ss, vmess, vless, trojan, hy2, tuic, socks, http, anytls).
 * - Explicitly rejects wireguard, shadowtls, and chained proxies (dialer-proxy / detour).
 * - Strict field validation: drops items missing server, port out of 1~65535, or empty name.
 */

'use strict';

import { trim, safe_b64decode } from 'omnia.convert.utils';
import { is_protocol_supported, create_ir_node } from 'omnia.convert.ir';

/**
 * Strips comments from a YAML line while respecting quoted strings.
 */
function strip_yaml_comment(line) {
	let len = length(line);
	let in_single = false;
	let in_double = false;
	let out = '';

	for (let i = 0; i < len; i++) {
		let c = substr(line, i, 1);
		if (c == "'" && !in_double) {
			in_single = !in_single;
		} else if (c == '"' && !in_single) {
			if (i == 0 || substr(line, i - 1, 1) != '\\')
				in_double = !in_double;
		} else if (c == '#' && !in_single && !in_double) {
			break;
		}
		out += c;
	}

	return out;
}

/**
 * Parses a simple YAML scalar value (string, integer, boolean, or flow sub-mapping).
 */
function parse_yaml_scalar(val_str) {
	let s = trim(val_str);
	if (s == '')
		return '';

	// 1. Quoted string
	let first = substr(s, 0, 1);
	let last = substr(s, length(s) - 1, 1);
	if ((first == '"' && last == '"') || (first == "'" && last == "'")) {
		let inner = substr(s, 1, length(s) - 2);
		if (first == '"') {
			inner = replace(inner, '\\"', '"');
			inner = replace(inner, '\\\\', '\\');
			inner = replace(inner, '\\n', '\n');
			inner = replace(inner, '\\t', '\t');
		}
		return inner;
	}

	// 2. Flow mapping { ... }
	if (first == '{' && last == '}') {
		return parse_flow_mapping(s);
	}

	// 3. Flow list [ ... ]
	if (first == '[' && last == ']') {
		return parse_flow_list(s);
	}

	// 4. Booleans
	let lower = lc(s);
	if (lower == 'true' || lower == 'yes' || lower == 'on')
		return true;
	if (lower == 'false' || lower == 'no' || lower == 'off')
		return false;

	// 5. Integers / Numbers
	if (match(s, /^[+-]?[0-9]+$/))
		return int(s);

	return s;
}

/**
 * Splits comma-separated items inside flow mapping or list, respecting quotes and braces.
 */
function split_flow_items(str) {
	let len = length(str);
	let items = [];
	let current = '';
	let in_single = false;
	let in_double = false;
	let brace_depth = 0;
	let bracket_depth = 0;

	for (let i = 0; i < len; i++) {
		let c = substr(str, i, 1);
		if (c == "'" && !in_double) {
			in_single = !in_single;
		} else if (c == '"' && !in_single) {
			if (i == 0 || substr(str, i - 1, 1) != '\\')
				in_double = !in_double;
		} else if (!in_single && !in_double) {
			if (c == '{') brace_depth++;
			else if (c == '}') brace_depth--;
			else if (c == '[') bracket_depth++;
			else if (c == ']') bracket_depth--;
			else if (c == ',' && brace_depth == 0 && bracket_depth == 0) {
				push(items, trim(current));
				current = '';
				continue;
			}
		}
		current += c;
	}

	let last_trimmed = trim(current);
	if (last_trimmed != '')
		push(items, last_trimmed);

	return items;
}

/**
 * Parses flow style mapping: { a: 1, b: "two", c: { d: true } }
 */
function parse_flow_mapping(flow_str) {
	let s = trim(flow_str);
	if (substr(s, 0, 1) == '{' && substr(s, length(s) - 1, 1) == '}')
		s = substr(s, 1, length(s) - 2);

	let obj = {};
	let items = split_flow_items(s);
	for (let item in items) {
		let colon_idx = -1;
		let in_single = false;
		let in_double = false;
		let len = length(item);
		for (let i = 0; i < len; i++) {
			let c = substr(item, i, 1);
			if (c == "'" && !in_double) in_single = !in_single;
			else if (c == '"' && !in_single) in_double = !in_double;
			else if (c == ':' && !in_single && !in_double) {
				colon_idx = i;
				break;
			}
		}

		if (colon_idx > 0) {
			let key = trim(substr(item, 0, colon_idx));
			let val_str = trim(substr(item, colon_idx + 1));
			if (substr(key, 0, 1) == '"' || substr(key, 0, 1) == "'")
				key = substr(key, 1, length(key) - 2);
			obj[key] = parse_yaml_scalar(val_str);
		}
	}

	return obj;
}

/**
 * Parses flow style list: [ a, b, "c" ]
 */
function parse_flow_list(flow_str) {
	let s = trim(flow_str);
	if (substr(s, 0, 1) == '[' && substr(s, length(s) - 1, 1) == ']')
		s = substr(s, 1, length(s) - 2);

	let list = [];
	let items = split_flow_items(s);
	for (let item in items) {
		push(list, parse_yaml_scalar(item));
	}
	return list;
}

/**
 * Measures leading indentation spaces of a line.
 */
function get_indent(line) {
	let len = length(line);
	let count = 0;
	while (count < len && substr(line, count, 1) == ' ')
		count++;
	return count;
}

/**
 * Extracts raw proxy mapping dictionaries from Clash YAML text.
 */
function extract_clash_proxy_dicts(yaml_text) {
	if (type(yaml_text) != 'string')
		return [];

	let raw_lines = split(replace(replace(yaml_text, '\r\n', '\n'), '\r', '\n'), '\n');
	let lines = [];
	for (let l in raw_lines) {
		let clean = strip_yaml_comment(l);
		if (trim(clean) != '')
			push(lines, clean);
	}

	let total = length(lines);
	let in_proxies = false;
	let proxies_indent = 0;
	let proxy_dicts = [];
	let current_dict = null;
	let current_dict_indent = -1;
	let sub_mapping_key = null;
	let sub_mapping_indent = -1;

	for (let i = 0; i < total; i++) {
		let line = lines[i];
		let indent = get_indent(line);
		let trimmed = trim(line);

		// 1. Locate proxies: or payload:
		if (!in_proxies) {
			if (index(trimmed, 'proxies:') == 0 || index(trimmed, 'payload:') == 0) {
				in_proxies = true;
				proxies_indent = indent;
			}
			continue;
		}

		// 2. Check if proxies section ended (same or lower indent of another top-level key)
		if (indent <= proxies_indent && substr(trimmed, 0, 1) != '-' && index(trimmed, ':') > 0) {
			break;
		}

		// 3. Check for new item marker "- "
		if (substr(trimmed, 0, 2) == '- ') {
			if (current_dict != null) {
				push(proxy_dicts, current_dict);
				current_dict = null;
			}
			sub_mapping_key = null;
			sub_mapping_indent = -1;

			let rest = trim(substr(trimmed, 2));
			// Case A: Flow style item: - { name: "...", ... }
			if (substr(rest, 0, 1) == '{') {
				let parsed_flow = parse_flow_mapping(rest);
				if (type(parsed_flow) == 'object' && parsed_flow != null)
					push(proxy_dicts, parsed_flow);
				current_dict = null;
				continue;
			}

			// Case B: Block style item starting on the same line: - name: "..."
			current_dict = {};
			current_dict_indent = indent;

			if (rest != '') {
				let c_idx = index(rest, ':');
				if (c_idx > 0) {
					let k = trim(substr(rest, 0, c_idx));
					let v_str = trim(substr(rest, c_idx + 1));
					current_dict[k] = parse_yaml_scalar(v_str);
				}
			}
			continue;
		}

		// 4. Continued lines inside the current block style dict
		if (current_dict != null) {
			let c_idx = index(trimmed, ':');
			if (c_idx > 0) {
				let k = trim(substr(trimmed, 0, c_idx));
				let v_str = trim(substr(trimmed, c_idx + 1));

				if (v_str == '') {
					// Sub-mapping starts (e.g. ws-opts:, reality-opts:, plugin-opts:)
					current_dict[k] = {};
					sub_mapping_key = k;
					sub_mapping_indent = indent;
				} else {
					if (sub_mapping_key != null && indent > sub_mapping_indent) {
						current_dict[sub_mapping_key][k] = parse_yaml_scalar(v_str);
					} else {
						sub_mapping_key = null;
						sub_mapping_indent = -1;
						current_dict[k] = parse_yaml_scalar(v_str);
					}
				}
			} else if (sub_mapping_key != null && indent > sub_mapping_indent) {
				// Continuation inside sub-mapping
				let eq_idx = index(trimmed, '=');
				if (eq_idx > 0) {
					let k = trim(substr(trimmed, 0, eq_idx));
					let v = trim(substr(trimmed, eq_idx + 1));
					current_dict[sub_mapping_key][k] = parse_yaml_scalar(v);
				}
			}
		}
	}

	if (current_dict != null)
		push(proxy_dicts, current_dict);

	return proxy_dicts;
}

/**
 * Normalizes protocol name from Clash representation.
 */
function normalize_clash_type(type_str) {
	if (type(type_str) != 'string')
		return '';
	let t = lc(trim(type_str));
	if (t == 'ss' || t == 'shadowsocks') return 'ss';
	if (t == 'vmess') return 'vmess';
	if (t == 'vless') return 'vless';
	if (t == 'trojan') return 'trojan';
	if (t == 'hysteria2' || t == 'hy2') return 'hysteria2';
	if (t == 'tuic') return 'tuic';
	if (t == 'socks5' || t == 'socks') return 'socks';
	if (t == 'http' || t == 'https') return 'http';
	if (t == 'anytls') return 'anytls';
	return t;
}

/**
 * Maps a single Clash proxy dictionary to a Unified IR Node.
 */
function clash_dict_to_ir(p) {
	if (type(p) != 'object' || p == null)
		return null;

	let raw_type = type(p.type) == 'string' ? p.type : '';
	let proto = normalize_clash_type(raw_type);

	// Reject non-proxies and unsupported types
	if (!is_protocol_supported(proto))
		return null;

	// Invariant: Reject chained detour proxies (dialer-proxy / detour)
	if (p['dialer-proxy'] != null && p['dialer-proxy'] != '')
		return null;
	if (p.detour != null && p.detour != '')
		return null;

	let name = type(p.name) == 'string' ? trim(p.name) : '';
	let server = type(p.server) == 'string' ? trim(p.server) : '';
	let port = int(p.port || 0);

	if (name == '' || server == '' || port <= 0 || port > 65535)
		return null;

	let network = type(p.network) == 'string' ? lc(trim(p.network)) : 'tcp';
	let tls = p.tls == true || p.tls == 1 || p.tls == 'true';
	let sni = type(p.servername) == 'string' ? p.servername : (type(p.sni) == 'string' ? p.sni : '');
	let alpn = type(p.alpn) == 'array' ? p.alpn : [];
	let skip_cert_verify = p['skip-cert-verify'] == true || p['skip_cert_verify'] == true || p.insecure == true;

	// Build specialized sub-options
	let ws_opts = null;
	if (type(p['ws-opts']) == 'object' && p['ws-opts'] != null) {
		ws_opts = {
			path: p['ws-opts'].path || '/',
			headers: type(p['ws-opts'].headers) == 'object' ? p['ws-opts'].headers : {}
		};
	} else if (type(p['ws-path']) == 'string') {
		ws_opts = {
			path: p['ws-path'],
			headers: type(p['ws-headers']) == 'object' ? p['ws-headers'] : {}
		};
	}

	let grpc_opts = null;
	if (type(p['grpc-opts']) == 'object' && p['grpc-opts'] != null) {
		grpc_opts = {
			service_name: p['grpc-opts']['grpc-service-name'] || p['grpc-opts'].service_name || ''
		};
	}

	let reality = null;
	if (type(p['reality-opts']) == 'object' && p['reality-opts'] != null) {
		reality = {
			enabled: true,
			public_key: p['reality-opts']['public-key'] || p['reality-opts'].public_key || '',
			short_id: p['reality-opts']['short-id'] || p['reality-opts'].short_id || ''
		};
	}

	return create_ir_node({
		name: name,
		tag: name,
		type: proto,
		server: server,
		port: port,
		uuid: type(p.uuid) == 'string' ? p.uuid : (type(p.token) == 'string' ? p.token : ''),
		password: type(p.password) == 'string' ? p.password : (type(p.auth) == 'string' ? p.auth : ''),
		security: type(p.cipher) == 'string' ? p.cipher : '',
		cipher: type(p.cipher) == 'string' ? p.cipher : '',
		alterId: int(p.alterId || 0),
		network: network,
		tls: tls,
		sni: sni,
		alpn: alpn,
		skip_cert_verify: skip_cert_verify,
		flow: type(p.flow) == 'string' ? p.flow : '',
		reality: reality,
		ws_opts: ws_opts,
		grpc_opts: grpc_opts,
		up_mbps: int(p.up || 0),
		down_mbps: int(p.down || 0),
		congestion_control: type(p['congestion-controller']) == 'string' ? p['congestion-controller'] : '',
		obfs: type(p.obfs) == 'string' ? p.obfs : (type(p.plugin) == 'string' ? p.plugin : ''),
		obfs_password: type(p['obfs-password']) == 'string' ? p['obfs-password'] : '',
		udp: p.udp == true || p.udp == 1,
		packet_encoding: type(p['packet-encoding']) == 'string' ? p['packet-encoding'] : ''
	});
}

/**
 * Main parser entry point for Clash YAML subscription content.
 */
function parse_clash_yaml(raw_yaml) {
	let dicts = extract_clash_proxy_dicts(raw_yaml);
	let nodes = [];
	let stats = {
		total: length(dicts),
		accepted: 0,
		skipped_unsupported: 0,
		skipped_invalid: 0,
		skipped_chained: 0
	};

	for (let d in dicts) {
		let p_type = normalize_clash_type(d.type);
		if (!is_protocol_supported(p_type)) {
			stats.skipped_unsupported++;
			continue;
		}

		if ((d['dialer-proxy'] != null && d['dialer-proxy'] != '') || (d.detour != null && d.detour != '')) {
			stats.skipped_chained++;
			continue;
		}

		let node = clash_dict_to_ir(d);
		if (node != null) {
			push(nodes, node);
			stats.accepted++;
		} else {
			stats.skipped_invalid++;
		}
	}

	return {
		nodes: nodes,
		stats: stats
	};
}

export {
	extract_clash_proxy_dicts,
	parse_flow_mapping,
	parse_flow_list,
	parse_clash_yaml,
	clash_dict_to_ir
};
