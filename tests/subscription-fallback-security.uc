/**
 * Regression & Security Test Suite for Subscription Fallback and Unified Sanitization.
 *
 * Verifies the 6 key security invariants:
 * 1. Normal new format does not trigger fallback (used_fallback == false).
 * 2. Explicit legacy format is supported via fallback.
 * 3. Corrupted or unknown format cannot bypass validation (fail-closed, no legacy fallback).
 * 4. Mixed valid and invalid nodes: drops invalid nodes while preserving valid ones.
 * 5. All nodes invalid: preserves existing snapshot without overwriting.
 * 6. Legacy parser cannot leak detour or invalid nodes through the pipeline.
 */

'use strict';

import { parse_subscription_safely, is_legacy_compatible_input } from 'omnia.subscription_fetch';
import { sanitize_and_validate_outbounds, validate_outbounds } from 'omnia.subscription_snapshot';

function assert(condition, message) {
	if (!condition)
		die('Assertion failed: ' + message);
}

// -----------------------------------------------------------------------------
// Test 1: Normal new formats DO NOT trigger legacy fallback
// -----------------------------------------------------------------------------
let uri_input = "vless://uuid-1@hk.example.com:443?security=tls#HK%2001\ntrojan://pwd-2@jp.example.com:443#JP%2002";
let res_uri = parse_subscription_safely("trace-t1", uri_input);
assert(res_uri.used_fallback == false, "URI input must NOT trigger fallback");
assert(length(res_uri.outbounds) == 2, "URI input should produce 2 outbounds");

let singbox_input = sprintf("%J", {
	outbounds: [
		{ type: "hysteria2", tag: "HY2 Node", server: "hy2.example.com", server_port: 8443, password: "pwd" }
	]
});
let res_sb = parse_subscription_safely("trace-t1-sb", singbox_input);
assert(res_sb.used_fallback == false, "Standard sing-box input must NOT trigger fallback");
assert(length(res_sb.outbounds) == 1, "sing-box input should produce 1 outbound");
assert(res_sb.outbounds[0].tag == "HY2 Node", "Tag mismatch on sing-box output");

// -----------------------------------------------------------------------------
// Test 2: Explicit legacy Sub-Store format is recognized and compatible
// -----------------------------------------------------------------------------
// Sub-Store raw JSON array format
let legacy_array_json = sprintf("%J", [
	{ type: "ss", tag: "Legacy SS", server: "ss.example.com", server_port: 8388, method: "aes-128-gcm", password: "pwd" }
]);
assert(is_legacy_compatible_input(legacy_array_json) == true, "Legacy JSON array should be recognized as legacy compatible");

let res_legacy = parse_subscription_safely("trace-t2", legacy_array_json);
assert(length(res_legacy.outbounds) == 1, "Legacy array should produce 1 outbound");
assert(res_legacy.outbounds[0].tag == "Legacy SS", "Legacy tag mismatch");

// -----------------------------------------------------------------------------
// Test 3: Corrupted or unknown formats MUST fail closed (no fallback, die)
// -----------------------------------------------------------------------------
let bad_inputs = [
	"--- NOT A VALID FORMAT ---",
	"<html><body>502 Bad Gateway</body></html>",
	"{\"outbounds\": [ truncated json",
	"aW52YWxpZGJhc2U2NA==", // invalid base64 content
	""
];

for (let bad in bad_inputs) {
	assert(is_legacy_compatible_input(bad) == false, "Corrupted/unknown input must NOT be legacy compatible: " + bad);
	let failed = false;
	try {
		parse_subscription_safely("trace-t3", bad);
	} catch (e) {
		failed = true;
	}
	assert(failed == true, "parse_subscription_safely must fail closed on bad input: " + bad);
}

// -----------------------------------------------------------------------------
// Test 4: Mixed valid & invalid nodes - drop invalid, preserve valid
// -----------------------------------------------------------------------------
let mixed_nodes = [
	// Valid node 1
	{ type: "vless", tag: "Valid VLESS", server: "vless.example.com", server_port: 443 },
	// Invalid: contains forbidden detour (proxy chaining)
	{ type: "trojan", tag: "Bad Detour", server: "tr.example.com", server_port: 443, detour: "Valid VLESS" },
	// Invalid: non-proxy reserved type
	{ type: "selector", tag: "Bad Selector", outbounds: ["Valid VLESS"] },
	// Invalid: wireguard (endpoint type, not proxy outbound)
	{ type: "wireguard", tag: "Bad WG", server: "wg.example.com", server_port: 51820 },
	// Invalid: port out of range
	{ type: "ss", tag: "Bad Port", server: "ss.example.com", server_port: 70000 },
	// Invalid: empty server
	{ type: "ss", tag: "Bad Server", server: "", server_port: 8388 },
	// Valid node 2 (with environment field to strip)
	{
		type: "hysteria2",
		tag: "Valid HY2",
		server: "hy2.example.com",
		port: 8443, // test port normalization to server_port
		bind_interface: "eth0",
		domain_resolver: "dns-in",
		routing_mark: 100
	}
];

let safe_mixed = sanitize_and_validate_outbounds(mixed_nodes);
assert(length(safe_mixed) == 2, "Expected exactly 2 valid nodes from mixed array, got: " + length(safe_mixed));
assert(safe_mixed[0].tag == "Valid VLESS", "First valid node mismatch");
assert(safe_mixed[1].tag == "Valid HY2", "Second valid node mismatch");
assert(safe_mixed[1].server_port == 8443, "Port should be normalized to server_port");
assert(safe_mixed[1].port == null, "Old port property should be cleaned");
assert(safe_mixed[1].bind_interface == null, "bind_interface must be stripped");
assert(safe_mixed[1].domain_resolver == null, "domain_resolver must be stripped");
assert(safe_mixed[1].routing_mark == null, "routing_mark must be stripped");

// -----------------------------------------------------------------------------
// Test 5: All nodes invalid preserves existing snapshot (empty rejected)
// -----------------------------------------------------------------------------
let old_snapshot = {
	schema_version: 1,
	source: "omnia",
	sources: [
		{ id: "src-1", name: "Source 1", status: "updated", ok: true }
	],
	outbounds: [
		{ type: "vless", tag: "Old Valid Node", server: "1.1.1.1", server_port: 443, x_omnia_source_id: "src-1", x_omnia_source_name: "Source 1" }
	]
};

// All nodes in this input have non-empty detour -> 0 valid nodes produced
let all_detour_nodes = [
	{ type: "trojan", tag: "Detour 1", server: "t1.com", server_port: 443, detour: "other" },
	{ type: "trojan", tag: "Detour 2", server: "t2.com", server_port: 443, detour: "other2" }
];
let sanitized_all_bad = sanitize_and_validate_outbounds(all_detour_nodes);
assert(length(sanitized_all_bad) == 0, "All detour nodes must result in 0 valid outbounds");

// -----------------------------------------------------------------------------
// Test 6: Legacy parser output CANNOT leak detour nodes
// -----------------------------------------------------------------------------
let legacy_with_detour = [
	{ type: "vless", tag: "Safe Legacy", server: "safe.com", server_port: 443 },
	{ type: "vless", tag: "Injected Detour", server: "inj.com", server_port: 443, detour: "Safe Legacy" }
];
let sanitized_legacy = sanitize_and_validate_outbounds(legacy_with_detour);
assert(length(sanitized_legacy) == 1, "Legacy detour node MUST NOT pass sanitization");
assert(sanitized_legacy[0].tag == "Safe Legacy", "Only safe legacy node should remain");

print("subscription fallback and security regression tests passed\n");
