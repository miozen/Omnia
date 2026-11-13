/**
 * Omnia | convert/pipeline.uc
 * Master conversion pipeline for proxy subscriptions.
 *
 * Execution flow:
 * 1. Sniff content format (singbox_json, clash_yaml, uri_list, base64_*).
 * 2. Parse into Unified IR nodes.
 * 3. Convert IR nodes into sing-box outbounds using producer.uc.
 * 4. Filter invalid nodes (missing server, invalid port 1~65535, empty tag).
 * 5. Tag deduplication / uniqueness guarantee (append #1, #2 suffix on collision).
 * 6. Return standard outbounds array and pipeline metadata.
 */

'use strict';

import { sniff_format } from 'omnia.convert.sniffer';
import { parse_uri_list } from 'omnia.convert.parsers.uri';
import { parse_singbox_outbounds } from 'omnia.convert.parsers.singbox';
import { produce_singbox_outbounds } from 'omnia.convert.producer';

function deduplicate_tags(outbounds) {
	let seen = {};
	let result = [];

	for (let outbound in outbounds) {
		if (type(outbound) != 'object' || outbound == null)
			continue;

		let base_tag = type(outbound.tag) == 'string' && outbound.tag != '' ? outbound.tag : (outbound.type + '-' + outbound.server);
		let final_tag = base_tag;

		if (!seen[base_tag]) {
			seen[base_tag] = 1;
			final_tag = base_tag;
		} else {
			let count = seen[base_tag];
			final_tag = base_tag + ' #' + count;
			seen[base_tag] = count + 1;
		}

		outbound.tag = final_tag;
		push(result, outbound);
	}

	return result;
}

function filter_valid_outbounds(outbounds) {
	let valid = [];
	let skipped_count = 0;

	for (let outbound in outbounds) {
		if (type(outbound) != 'object' || outbound == null) {
			skipped_count++;
			continue;
		}
		let server = type(outbound.server) == 'string' ? outbound.server : '';
		let port = int(outbound.server_port || outbound.port || 0);
		let tag = type(outbound.tag) == 'string' ? outbound.tag : '';

		if (server == '' || port <= 0 || port > 65535 || tag == '') {
			skipped_count++;
			continue;
		}

		push(valid, outbound);
	}

	return {
		outbounds: valid,
		skipped_count: skipped_count
	};
}

/**
 * Main conversion pipeline function.
 * @param {string} trace_id - Trace tracking identifier
 * @param {string} raw_content - Raw subscription text
 * @returns {object} { ok: bool, format: string, outbounds: array, stats: object, error: string }
 */
function convert_subscription(trace_id, raw_content) {
	let sniff = sniff_format(raw_content);
	let format = sniff.format;

	if (format == 'empty')
		return { ok: false, format: format, outbounds: [], error: 'Subscription content is empty' };

	if (format == 'unknown')
		return { ok: false, format: format, outbounds: [], error: 'Unsupported or unrecognized subscription format' };

	let ir_nodes = [];
	let parse_stats = {};

	if (format == 'singbox_json') {
		let res = parse_singbox_outbounds(sniff.parsed);
		ir_nodes = res.nodes;
		parse_stats = res.stats;
	} else if (format == 'uri_list') {
		ir_nodes = parse_uri_list(sniff.lines);
		parse_stats = { total_lines: length(sniff.lines), parsed_nodes: length(ir_nodes) };
	} else if (format == 'base64_uri_list') {
		ir_nodes = parse_uri_list(sniff.lines);
		parse_stats = { total_lines: length(sniff.lines), parsed_nodes: length(ir_nodes) };
	} else if (format == 'base64_json') {
		let res = parse_singbox_outbounds(sniff.parsed);
		ir_nodes = res.nodes;
		parse_stats = res.stats;
	} else if (format == 'clash_yaml' || format == 'base64_clash_yaml') {
		// Clash YAML is designated for M2
		return { ok: false, format: format, outbounds: [], error: 'Clash YAML format is designated for Milestone 2' };
	} else {
		return { ok: false, format: format, outbounds: [], error: 'Unsupported format in M1: ' + format };
	}

	// Produce sing-box outbounds from IR nodes
	let raw_outbounds = produce_singbox_outbounds(ir_nodes);

	// Filter out invalid items
	let filtered = filter_valid_outbounds(raw_outbounds);

	// Deduplicate tags to ensure strict global uniqueness
	let final_outbounds = deduplicate_tags(filtered.outbounds);

	return {
		ok: true,
		format: format,
		outbounds: final_outbounds,
		stats: {
			format: format,
			ir_count: length(ir_nodes),
			outbound_count: length(final_outbounds),
			skipped_invalid: filtered.skipped_count,
			parse_stats: parse_stats
		}
	};
}

export {
	convert_subscription,
	deduplicate_tags,
	filter_valid_outbounds
};
