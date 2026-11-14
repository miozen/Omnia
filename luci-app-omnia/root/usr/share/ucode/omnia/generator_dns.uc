/**
 * Omnia | generator_dns.uc | v1.0
 */

'use strict';

import { append_unique, tag_contains_keyword, upper_text } from 'omnia.generator_util';
import { rate_filter_excludes_from_urltest } from 'omnia.generator_nodes';

const DNS_OUTBOUND_TAG = "📡 dns-out";

function node_matches_keywords(node, keywords) {
	if (type(node.tag) != "string")
		return false;

	let tag_upper = upper_text(node.tag);
	for (let keyword in keywords) {
		if (tag_contains_keyword(tag_upper, keyword))
			return true;
	}

	return false;
}

function generate_dns_urltest(config, nodes, profile_tags, node_tags) {
	let policy = config.dns_urltest;
	if (type(policy) != "object" || policy == null || policy.enabled != true)
		return null;

	let outbounds = [];
	for (let node in nodes) {
		if (rate_filter_excludes_from_urltest(node.tag, config))
			continue;
		if (node_matches_keywords(node, policy.keywords))
			append_unique(outbounds, node.tag);
	}

	if (length(outbounds) == 0)
		return null;
	if (profile_tags[DNS_OUTBOUND_TAG])
		die("Generated DNS outbound tag conflicts with Profile outbound tag: " + DNS_OUTBOUND_TAG);
	if (node_tags[DNS_OUTBOUND_TAG])
		die("Generated DNS outbound tag conflicts with Node outbound tag: " + DNS_OUTBOUND_TAG);

	return {
		type: "urltest",
		tag: DNS_OUTBOUND_TAG,
		outbounds: outbounds,
		url: policy.url,
		interval: policy.interval,
		tolerance: policy.tolerance,
		interrupt_exist_connections: true
	};
}

function route_dns_detours(profile, dns_group, fallback_tag) {
	let adjusted = 0;
	if (type(profile.dns) != "object" || profile.dns == null || type(profile.dns.servers) != "array")
		return adjusted;

	let target = dns_group != null ? DNS_OUTBOUND_TAG : fallback_tag;
	for (let server in profile.dns.servers) {
		if (type(server) != "object" || server == null || type(server.detour) != "string" || server.detour == "")
			continue;
		server.detour = target;
		adjusted = adjusted + 1;
	}

	return adjusted;
}

/**
 * Milestone 3: Declarative DNS scheme.
 * Injects dedicated DNS servers for configured subscription sources and binds them to source nodes.
 */
function apply_source_dedicated_dns(profile, subscriptions, nodes) {
	let generated_count = 0;
	let assigned_count = 0;

	if (type(profile.dns) != "object" || profile.dns == null)
		return { generated_dns_servers: 0, assigned_nodes: 0 };
	if (type(profile.dns.servers) != "array")
		profile.dns.servers = [];

	let existing_dns_tags = {};
	for (let server in profile.dns.servers) {
		if (type(server) == "object" && server != null && type(server.tag) == "string")
			existing_dns_tags[server.tag] = true;
	}

	let source_dns_tag_map = {};

	if (type(subscriptions) == "object" && subscriptions != null && type(subscriptions.sources) == "array") {
		for (let source in subscriptions.sources) {
			if (source.enabled == false)
				continue;
			if (type(source.dns) != "object" || source.dns == null || source.dns.enabled != true)
				continue;
			if (type(source.dns.server) != "string" || source.dns.server == "")
				continue;

			let tag = "dns-src-" + source.id;
			if (existing_dns_tags[tag])
				die("Dedicated DNS tag conflicts with profile DNS server: " + tag);

			let dns_entry = {
				tag: tag,
				type: source.dns.type || "https",
				server: source.dns.server
			};
			if (source.dns.server_port)
				dns_entry.server_port = source.dns.server_port;
			if (source.dns.domain_resolver)
				dns_entry.domain_resolver = source.dns.domain_resolver;

			push(profile.dns.servers, dns_entry);
			existing_dns_tags[tag] = true;
			source_dns_tag_map[source.id] = tag;
			generated_count++;
		}
	}

	// Assign domain_resolver to corresponding nodes
	for (let node in nodes) {
		let src_id = node.x_omnia_source_id;
		if (src_id && source_dns_tag_map[src_id]) {
			node.domain_resolver = source_dns_tag_map[src_id];
			assigned_count++;
		}
	}

	return {
		generated_dns_servers: generated_count,
		assigned_nodes: assigned_count
	};
}

export { DNS_OUTBOUND_TAG, generate_dns_urltest, route_dns_detours, apply_source_dedicated_dns };
