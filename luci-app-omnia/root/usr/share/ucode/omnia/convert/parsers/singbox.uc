/**
 * Omnia | convert/parsers/singbox.uc
 * Parser for native sing-box JSON configuration to Unified IR Nodes.
 *
 * Requirements & Invariants:
 * 1. Filter out non-proxy outbounds: selector, urltest, direct, block, dns.
 * 2. Explicitly reject wireguard (in sing-box it belongs to endpoints, not proxy outbound).
 * 3. Chained detour handling:
 *    - Reject nodes having non-empty detour (proxy chaining not supported in M1).
 *    - DO NOT drop independent nodes just because other nodes refer to them.
 *    - Ensure final snapshot has zero dangling references.
 * 4. Field fidelity:
 *    - Preserve full raw outbound (_raw_outbound) so TLS, Reality, Transport, Multiplex, etc. are 100% kept.
 *    - Strip environment-bound fields (bind_interface, routing_mark, inet4_bind_address, inet6_bind_address).
 *    - Strip DNS fields (domain_resolver, domain_strategy) to allow Omnia DNS management.
 */

'use strict';

import { is_protocol_supported, create_ir_node } from 'omnia.convert.ir';

const RESERVED_NON_PROXY_TYPES = {
	'selector': true,
	'urltest': true,
	'direct': true,
	'block': true,
	'dns': true
};

const ENVIRONMENT_FIELDS = [
	'bind_interface',
	'routing_mark',
	'reuse_addr',
	'netns',
	'tcp_fast_open',
	'tcp_multi_path',
	'udp_fragment',
	'inet4_bind_address',
	'inet6_bind_address'
];

function sanitize_raw_outbound(raw) {
	if (type(raw) != 'object' || raw == null)
		return {};

	let sanitized = {};
	for (let k in raw) {
		sanitized[k] = raw[k];
	}

	// 1. Strip environment-bound fields
	for (let env_key in ENVIRONMENT_FIELDS) {
		delete sanitized[env_key];
	}

	// 2. Strip DNS management fields (Omnia manages DNS declarations)
	delete sanitized.domain_resolver;
	delete sanitized.domain_strategy;

	return sanitized;
}

function parse_singbox_outbounds(parsed_json) {
	let raw_outbounds = [];

	if (type(parsed_json) == 'array') {
		raw_outbounds = parsed_json;
	} else if (type(parsed_json) == 'object' && parsed_json != null) {
		if (type(parsed_json.outbounds) == 'array')
			raw_outbounds = parsed_json.outbounds;
	} else {
		return {
			nodes: [],
			stats: { total: 0, accepted: 0, skipped_reserved: 0, skipped_wireguard: 0, skipped_chained: 0, skipped_unsupported: 0, skipped_invalid: 0 }
		};
	}

	let nodes = [];
	let stats = {
		total: length(raw_outbounds),
		accepted: 0,
		skipped_reserved: 0,
		skipped_wireguard: 0,
		skipped_chained: 0,
		skipped_unsupported: 0,
		skipped_invalid: 0
	};

	for (let outbound in raw_outbounds) {
		if (type(outbound) != 'object' || outbound == null) {
			stats.skipped_invalid++;
			continue;
		}

		let p_type = type(outbound.type) == 'string' ? outbound.type : '';
		let tag = type(outbound.tag) == 'string' ? outbound.tag : '';

		// 1. Skip reserved non-proxy types (selector, urltest, direct, block, dns)
		if (RESERVED_NON_PROXY_TYPES[p_type]) {
			stats.skipped_reserved++;
			continue;
		}

		// 2. Skip wireguard (endpoints architecture)
		if (p_type == 'wireguard') {
			stats.skipped_wireguard++;
			continue;
		}

		// 3. Skip unsupported protocol types
		if (!is_protocol_supported(p_type)) {
			stats.skipped_unsupported++;
			continue;
		}

		// 4. Invariant 1: Reject nodes with non-empty detour (proxy chaining)
		// Do not silently delete detour and generate a broken node.
		if (type(outbound.detour) == 'string' && outbound.detour != '') {
			stats.skipped_chained++;
			continue;
		}

		let server = type(outbound.server) == 'string' ? outbound.server : '';
		let port = int(outbound.server_port || outbound.port || 0);

		if (server == '' || port <= 0 || port > 65535 || tag == '') {
			stats.skipped_invalid++;
			continue;
		}

		// 5. Invariant 2: Sanitize raw outbound while preserving TLS, Reality, Transport, Multiplex, etc.
		let raw_copy = sanitize_raw_outbound(outbound);

		let ir_node = create_ir_node({
			name: tag,
			tag: tag,
			type: p_type,
			server: server,
			port: port,
			uuid: type(outbound.uuid) == 'string' ? outbound.uuid : '',
			password: type(outbound.password) == 'string' ? outbound.password : '',
			security: type(outbound.security) == 'string' ? outbound.security : '',
			cipher: type(outbound.method) == 'string' ? outbound.method : '',
			alterId: int(outbound.alter_id || 0),
			network: type(outbound.transport) == 'object' && outbound.transport != null ? outbound.transport.type : 'tcp',
			tls: type(outbound.tls) == 'object' && outbound.tls != null && outbound.tls.enabled == true,
			sni: type(outbound.tls) == 'object' && outbound.tls != null ? outbound.tls.server_name : '',
			_raw_outbound: raw_copy
		});

		push(nodes, ir_node);
		stats.accepted++;
	}

	return {
		nodes: nodes,
		stats: stats
	};
}

export {
	parse_singbox_outbounds,
	sanitize_raw_outbound
};
