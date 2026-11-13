/**
 * Comprehensive test suite for convert/parsers/singbox.uc.
 * Covers:
 * - Filtering reserved types (selector, urltest, direct, block, dns)
 * - Filtering wireguard
 * - Invariant 1: Rejecting nodes with non-empty detour without dropping independent nodes
 * - Invariant 2: Preserving TLS, Reality, Transport, Multiplex in _raw_outbound
 * - Stripping environment-bound fields (bind_interface, routing_mark, etc.)
 * - Stripping domain_resolver
 */

'use strict';

import { parse_singbox_outbounds, sanitize_raw_outbound } from 'omnia.convert.parsers.singbox';

function assert(condition, message) {
	if (!condition)
		die('Assertion failed: ' + message);
}

// 1. Full sing-box configuration sample
let full_singbox_config = {
	inbounds: [
		{ type: "tun", tag: "tun-in", interface_name: "tun0" }
	],
	outbounds: [
		{ type: "direct", tag: "direct-out" },
		{ type: "selector", tag: "proxy", outbounds: ["node-hk", "node-jp"] },
		{ type: "urltest", tag: "auto", outbounds: ["node-hk", "node-jp"] },
		{ type: "block", tag: "block-out" },
		{ type: "dns", tag: "dns-out" },
		{ type: "wireguard", tag: "wg-node", server: "wg.example.com", server_port: 51820 },
		// Valid VLESS with Reality and Multiplex and environment field to strip
		{
			type: "vless",
			tag: "node-hk",
			server: "hk.example.com",
			server_port: 443,
			uuid: "c0000000-0000-0000-0000-000000000003",
			flow: "xtls-rprx-vision",
			tls: {
				enabled: true,
				server_name: "hk-sni.com",
				reality: {
					enabled: true,
					public_key: "abc123realitykey=",
					short_id: "abcd"
				}
			},
			multiplex: {
				enabled: true,
				max_connections: 4
			},
			bind_interface: "eth0",
			routing_mark: 255,
			domain_resolver: "my-dns-tag"
		},
		// Valid independent Shadowsocks node (which might be referred by others)
		{
			type: "ss",
			tag: "node-jp",
			server: "jp.example.com",
			server_port: 8388,
			method: "aes-128-gcm",
			password: "pass"
		},
		// Chained node with detour (MUST be rejected, but MUST NOT drop node-jp)
		{
			type: "trojan",
			tag: "node-chained-trojan",
			server: "trojan.example.com",
			server_port: 443,
			password: "tr-pass",
			detour: "node-jp"
		}
	],
	route: {
		rules: []
	}
};

let res = parse_singbox_outbounds(full_singbox_config);

// Verify counts and statistics
assert(res.stats.total == 9, "Total outbounds should be 9");
assert(res.stats.accepted == 2, "Accepted proxy nodes should be exactly 2 (node-hk and node-jp)");
assert(res.stats.skipped_reserved == 5, "Skipped reserved should be 5 (direct, selector, urltest, block, dns)");
assert(res.stats.skipped_wireguard == 1, "Skipped wireguard should be 1");
assert(res.stats.skipped_chained == 1, "Skipped chained detour should be 1 (node-chained-trojan)");

assert(length(res.nodes) == 2, "Length of accepted nodes should be 2");

// Verify node-hk fidelity and sanitization
let hk = res.nodes[0];
assert(hk.name == "node-hk", "Node hk name mismatch");
assert(hk.type == "vless", "Node hk type mismatch");
assert(hk.server == "hk.example.com", "Node hk server mismatch");
assert(hk.port == 443, "Node hk port mismatch");
assert(hk._raw_outbound != null, "Node hk raw outbound should be preserved");

// Check _raw_outbound fidelity
let raw = hk._raw_outbound;
assert(raw.tls.reality.public_key == "abc123realitykey=", "Reality public key missing in raw outbound");
assert(raw.multiplex.max_connections == 4, "Multiplex missing in raw outbound");
assert(raw.flow == "xtls-rprx-vision", "Flow missing in raw outbound");

// Check stripped fields in _raw_outbound
assert(raw.bind_interface == null, "bind_interface must be stripped");
assert(raw.routing_mark == null, "routing_mark must be stripped");
assert(raw.domain_resolver == null, "domain_resolver must be stripped");

// Verify node-jp remains present even though node-chained-trojan referred to it via detour
let jp = res.nodes[1];
assert(jp.name == "node-jp", "Independent node-jp must be kept");
assert(jp.type == "ss", "Node jp type mismatch");
assert(jp.server == "jp.example.com", "Node jp server mismatch");

print("convert step 3 singbox parser tests passed\n");
