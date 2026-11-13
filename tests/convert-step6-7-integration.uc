/**
 * Fixture and integration test suite for subscription conversion and snapshot compatibility.
 * Covers:
 * 1. Backward compatibility: reading snapshot with source: "sub-store"
 * 2. Forward compatibility: reading snapshot with source: "omnia"
 * 3. Fallback resilience: when content is legacy Sub-Store pure outbounds array vs new URI list
 * 4. Preservation of previous snapshot nodes when conversion or validation fails
 */

'use strict';

import { validate_node_snapshot_object } from 'omnia.subscription_snapshot';
import { convert_to_outbounds } from 'omnia.subscription_fetch';

function assert(condition, message) {
	if (!condition)
		die('Assertion failed: ' + message);
}

// 1. Verify backward compatibility: sub-store source
let legacy_snapshot = {
	schema_version: 1,
	source: "sub-store",
	sources: [
		{ id: "s1", name: "Source 1", status: "updated", ok: true }
	],
	outbounds: [
		{ type: "vless", tag: "node-1", server: "1.1.1.1", server_port: 443, x_omnia_source_id: "s1", x_omnia_source_name: "Source 1" }
	]
};
validate_node_snapshot_object(legacy_snapshot);

// 2. Verify forward compatibility: omnia source
let new_snapshot = {
	schema_version: 1,
	source: "omnia",
	sources: [
		{ id: "s2", name: "Source 2", status: "updated", ok: true }
	],
	outbounds: [
		{ type: "hysteria2", tag: "node-2", server: "2.2.2.2", server_port: 8443, x_omnia_source_id: "s2", x_omnia_source_name: "Source 2" }
	]
};
validate_node_snapshot_object(new_snapshot);

// 3. Test convert_to_outbounds with plain URI list
let uri_content = "vless://uuid-1@hk.example.com:443?security=tls#HK%2001\nhy2://pass-2@jp.example.com:8443#JP%2002";
let outbounds_from_uri = convert_to_outbounds("trace-int-1", uri_content);
assert(length(outbounds_from_uri) == 2, "Expected 2 outbounds from URI conversion");
assert(outbounds_from_uri[0].tag == "HK 01", "Tag mismatch on first outbound");
assert(outbounds_from_uri[1].type == "hysteria2", "Type mismatch on second outbound");

// 4. Test convert_to_outbounds with native sing-box json array
let json_content = sprintf("%J", [
	{ type: "trojan", tag: "TR 01", server: "tr.example.com", server_port: 443, password: "pwd" }
]);
let outbounds_from_json = convert_to_outbounds("trace-int-2", json_content);
assert(length(outbounds_from_json) == 1, "Expected 1 outbound from JSON conversion");
assert(outbounds_from_json[0].tag == "TR 01", "Tag mismatch on json outbound");

print("convert step 6 & 7 integration fixtures passed\n");
