/**
 * Test suite for Milestone 3 (M3): Declarative DNS Scheme.
 * Covers:
 * 1. Default DNS inheritance: Sources without dedicated DNS produce nodes without domain_resolver.
 * 2. Dedicated DNS injection: Sources with dedicated DNS inject server into profile.dns.servers
 *    and bind domain_resolver to corresponding nodes.
 * 3. Isolation: Multiple sources with and without dedicated DNS maintain proper isolation.
 * 4. Deadlock prevention: Rejects dedicated DNS detouring through proxy nodes/selectors.
 * 5. Dangling reference prevention: validate_references strictly rejects non-existent DNS tags.
 */

'use strict';

import { apply_source_dedicated_dns } from 'omnia.generator_dns';
import { validate_references } from 'omnia.generator_validate';
import { normalize_source_dns } from 'omnia.subscription_policy_schema';

function assert(condition, message) {
	if (!condition)
		die('Assertion failed: ' + message);
}

// -----------------------------------------------------------------------------
// 1. Dedicated DNS Normalization & Deadlock Prevention
// -----------------------------------------------------------------------------
let valid_dns = {
	enabled: true,
	type: "https",
	server: "223.5.5.5",
	server_port: 443
};
let norm_valid = normalize_source_dns(valid_dns);
assert(norm_valid.enabled == true, "Enabled mismatch");
assert(norm_valid.type == "https", "Type mismatch");
assert(norm_valid.server == "223.5.5.5", "Server mismatch");
assert(norm_valid.server_port == 443, "Port mismatch");

// Deadlock rejection: detour through proxy
let bad_detour_dns = {
	enabled: true,
	type: "https",
	server: "8.8.8.8",
	detour: "proxy-node"
};
let deadlock_caught = false;
try {
	normalize_source_dns(bad_detour_dns);
} catch (e) {
	deadlock_caught = true;
}
assert(deadlock_caught == true, "Dedicated DNS detouring through proxy MUST be rejected to prevent deadlock");

// -----------------------------------------------------------------------------
// 2. Dedicated DNS Injection and Node Binding
// -----------------------------------------------------------------------------
let profile = {
	dns: {
		servers: [
			{ tag: "Ali-DNS", type: "https", server: "223.5.5.5" },
			{ tag: "Direct-DNS", type: "udp", server: "119.29.29.29" }
		]
	},
	outbounds: [
		{ type: "direct", tag: "🎯 全球直连" }
	]
};

let subscriptions = {
	sources: [
		{
			id: "s1",
			name: "Source 1 (Dedicated DNS)",
			enabled: true,
			dns: {
				enabled: true,
				type: "https",
				server: "1.1.1.1",
				server_port: 443
			}
		},
		{
			id: "s2",
			name: "Source 2 (Default DNS)",
			enabled: true,
			dns: {
				enabled: false
			}
		}
	]
};

let nodes = [
	{ type: "vless", tag: "S1-Node-1", server: "node1.com", server_port: 443, x_omnia_source_id: "s1" },
	{ type: "vless", tag: "S1-Node-2", server: "node2.com", server_port: 443, x_omnia_source_id: "s1" },
	{ type: "ss", tag: "S2-Node-1", server: "node3.com", server_port: 8388, x_omnia_source_id: "s2" }
];

let res = apply_source_dedicated_dns(profile, subscriptions, nodes);
assert(res.generated_dns_servers == 1, "Expected 1 dedicated DNS server generated, got: " + res.generated_dns_servers);
assert(res.assigned_nodes == 2, "Expected 2 nodes assigned domain_resolver, got: " + res.assigned_nodes);

// Check profile.dns.servers
let found_tag = "dns-src-s1";
let found_server = null;
for (let s in profile.dns.servers) {
	if (s.tag == found_tag) {
		found_server = s;
		break;
	}
}
assert(found_server != null, "Dedicated DNS server dns-src-s1 not found in profile.dns.servers");
assert(found_server.server == "1.1.1.1", "Dedicated DNS server host mismatch");
assert(found_server.type == "https", "Dedicated DNS type mismatch");

// Check node domain_resolver binding
assert(nodes[0].domain_resolver == found_tag, "Node 0 domain_resolver mismatch: " + nodes[0].domain_resolver);
assert(nodes[1].domain_resolver == found_tag, "Node 1 domain_resolver mismatch: " + nodes[1].domain_resolver);
assert(nodes[2].domain_resolver == null, "Node 2 (S2 default) must NOT have domain_resolver");

// Add nodes to profile.outbounds and test reference validation
for (let n in nodes)
	push(profile.outbounds, n);

// Valid references check
validate_references(profile);

// -----------------------------------------------------------------------------
// 3. Dangling Reference Detection
// -----------------------------------------------------------------------------
let bad_profile = {
	dns: {
		servers: [
			{ tag: "Ali-DNS", type: "https", server: "223.5.5.5" }
		]
	},
	outbounds: [
		{ type: "vless", tag: "Bad-Node", server: "bad.com", server_port: 443, domain_resolver: "non-existent-dns-tag" }
	]
};

let dangling_caught = false;
try {
	validate_references(bad_profile);
} catch (e) {
	dangling_caught = true;
}
assert(dangling_caught == true, "validate_references must catch non-existent outbound domain_resolver reference");

let bad_dns_bootstrap = {
	dns: {
		servers: [
			{ tag: "D1", type: "https", server: "d1.com", domain_resolver: "ghost-tag" }
		]
	},
	outbounds: []
};

let ghost_caught = false;
try {
	validate_references(bad_dns_bootstrap);
} catch (e) {
	ghost_caught = true;
}
assert(ghost_caught == true, "validate_references must catch non-existent DNS server bootstrap domain_resolver");

print("Milestone 3 declarative DNS tests passed\n");
