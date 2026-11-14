/**
 * Comprehensive Integration and Cross-Format Consistency Test for Milestone 2.
 *
 * Verifies:
 * 1. Cross-format consistency: URI list, Clash YAML, and sing-box JSON producing identical outbounds.
 * 2. Ordered operators pipeline running end-to-end with multiple filters, renames, and flags.
 * 3. Traffic quota parsing and attribution preservation.
 */

'use strict';

import { convert_subscription } from 'omnia.convert.pipeline';
import { parse_subscription_userinfo } from 'omnia.convert.traffic';

function assert(condition, message) {
	if (!condition)
		die('Assertion failed: ' + message);
}

// -----------------------------------------------------------------------------
// 1. Cross-Format Consistency:
// A cluster of 3 nodes expressed in:
// - Format A: URI list
// - Format B: Clash YAML
// - Format C: sing-box JSON
// -----------------------------------------------------------------------------

// Node 1: Shadowsocks (1.1.1.1:8388, aes-128-gcm, pass1, HK SS)
// Node 2: VMess (2.2.2.2:443, uuid-2, JP VMess, network=ws, path=/ws, tls=true, sni=jp.com)
// Node 3: Trojan (3.3.3.3:443, pass3, US Trojan, sni=us.com, tls=true)

let input_uri = join('\n', [
	"ss://YWVzLTEyOC1nY206cGFzczE=@1.1.1.1:8388#HK%20SS",
	"vmess://eyJ2IjoiMiIsInBzIjoiSlAgVk1lc3MiLCJhZGQiOiIyLjIuMi4yIiwicG9ydCI6NDQzLCJpZCI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMiIsIm5ldCI6IndzIiwicGF0aCI6Ii93cyIsInRscyI6InRscyIsInNuaSI6ImpwLmNvbSJ9",
	"trojan://pass3@3.3.3.3:443?sni=us.com#US%20Trojan"
]);

let input_clash = `
proxies:
  - name: "HK SS"
    type: ss
    server: 1.1.1.1
    port: 8388
    cipher: aes-128-gcm
    password: pass1

  - name: "JP VMess"
    type: vmess
    server: 2.2.2.2
    port: 443
    uuid: 00000000-0000-0000-0000-000000000002
    cipher: auto
    network: ws
    ws-opts:
      path: /ws
    tls: true
    servername: jp.com

  - name: "US Trojan"
    type: trojan
    server: 3.3.3.3
    port: 443
    password: pass3
    sni: us.com
`;

let input_singbox = sprintf("%J", {
	outbounds: [
		{
			type: "ss",
			tag: "HK SS",
			server: "1.1.1.1",
			server_port: 8388,
			method: "aes-128-gcm",
			password: "pass1"
		},
		{
			type: "vmess",
			tag: "JP VMess",
			server: "2.2.2.2",
			server_port: 443,
			uuid: "00000000-0000-0000-0000-000000000002",
			security: "auto",
			transport: { type: "ws", path: "/ws" },
			tls: { enabled: true, server_name: "jp.com" }
		},
		{
			type: "trojan",
			tag: "US Trojan",
			server: "3.3.3.3",
			server_port: 443,
			password: "pass3",
			tls: { enabled: true, server_name: "us.com" }
		}
	]
});

let out_uri = convert_subscription("trace-uri", input_uri).outbounds;
let out_clash = convert_subscription("trace-clash", input_clash).outbounds;
let out_singbox = convert_subscription("trace-sb", input_singbox).outbounds;

assert(length(out_uri) == 3, "URI outbound count mismatch: " + length(out_uri));
assert(length(out_clash) == 3, "Clash outbound count mismatch: " + length(out_clash));
assert(length(out_singbox) == 3, "sing-box outbound count mismatch: " + length(out_singbox));

for (let i = 0; i < 3; i++) {
	let u = out_uri[i];
	let c = out_clash[i];
	let s = out_singbox[i];

	assert(u.tag == c.tag && c.tag == s.tag, sprintf("Tag mismatch at %d: %s vs %s vs %s", i, u.tag, c.tag, s.tag));
	assert(u.type == c.type && c.type == s.type, sprintf("Type mismatch at %d: %s vs %s vs %s", i, u.type, c.type, s.type));
	assert(u.server == c.server && c.server == s.server, sprintf("Server mismatch at %d: %s vs %s", i, u.server, c.server));
	assert(u.server_port == c.server_port && c.server_port == s.server_port, sprintf("Port mismatch at %d: %s vs %s", i, u.server_port, c.server_port));
}

// -----------------------------------------------------------------------------
// 2. End-to-End Pipeline with Multiple Operators
// -----------------------------------------------------------------------------
let ops = [
	// Step 1: Add national flag emoji
	{ type: "flag", action: "add" },
	// Step 2: Regex rename to append [M2]
	{ type: "regex_rename", pattern: "$", replacement: " [M2]" },
	// Step 3: Sort by regional priority: US first, HK second, JP third
	{ type: "sort", mode: "keywords", keywords: ["US", "HK", "JP"] }
];

let res_ops = convert_subscription("trace-m2-pipeline-ops", input_clash, { operators: ops });
assert(res_ops.ok == true, "Conversion with operators failed: " + res_ops.error);
assert(length(res_ops.outbounds) == 3, "Expected 3 outbounds after pipeline operators");

// Check sort order: US first
assert(index(res_ops.outbounds[0].tag, "US") >= 0, "First node should be US node");
assert(index(res_ops.outbounds[0].tag, "🇺🇸") >= 0, "First node should have US flag");
assert(index(res_ops.outbounds[0].tag, "[M2]") >= 0, "First node should have [M2] suffix");

// Check sort order: HK second
assert(index(res_ops.outbounds[1].tag, "HK") >= 0, "Second node should be HK node");
assert(index(res_ops.outbounds[1].tag, "🇭🇰") >= 0, "Second node should have HK flag");

// Check sort order: JP third
assert(index(res_ops.outbounds[2].tag, "JP") >= 0, "Third node should be JP node");
assert(index(res_ops.outbounds[2].tag, "🇯🇵") >= 0, "Third node should have JP flag");

// -----------------------------------------------------------------------------
// 3. Traffic Quota Parsing Validation
// -----------------------------------------------------------------------------
let userinfo_header = "upload=2147483648; download=10737418240; total=214748364800; expire=1767225600";
let traffic_info = parse_subscription_userinfo(userinfo_header);
assert(traffic_info.upload == 2147483648, "Traffic upload mismatch");
assert(traffic_info.download == 10737418240, "Traffic download mismatch");
assert(traffic_info.used == 12884901888, "Traffic used mismatch");
assert(traffic_info.total == 214748364800, "Traffic total mismatch");
assert(traffic_info.remaining == 201863462912, "Traffic remaining mismatch");
assert(traffic_info.expire == 1767225600, "Traffic expire mismatch");

print("convert step m2 integration & cross-format consistency tests passed\n");
