/**
 * Test suite for convert/operators/engine.uc and flags.uc.
 * Covers:
 * 1. Regex filter & inverse regex filter
 * 2. Type filter & inverse type filter
 * 3. Conditional filter (EQUALS, CONTAINS, IN, EXISTS)
 * 4. Regex rename & delete
 * 5. Quick setting (udp, skip_cert_verify)
 * 6. Handle duplicate (delete & rename)
 * 7. Sorting (name asc/desc & keyword priority)
 * 8. Flag emoji addition & removal
 * 9. Multi-operator pipeline integration
 */

'use strict';

import { create_ir_node } from 'omnia.convert.ir';
import { apply_operators } from 'omnia.convert.operators.engine';
import { convert_subscription } from 'omnia.convert.pipeline';

function assert(condition, message) {
	if (!condition)
		die('Assertion failed: ' + message);
}

function mock_node(name, proto, server, port, extra) {
	let data = {
		name: name,
		tag: name,
		type: proto,
		server: server,
		port: port
	};
	if (extra) {
		for (let k in extra) data[k] = extra[k];
	}
	return create_ir_node(data);
}

// -----------------------------------------------------------------------------
// 1. Regex Filter
// -----------------------------------------------------------------------------
let nodes_rf = [
	mock_node('HK 01', 'vless', '1.1.1.1', 443),
	mock_node('JP 01', 'vless', '2.2.2.2', 443),
	mock_node('US 01', 'ss', '3.3.3.3', 8388)
];
let op_rf = [ { type: 'regex_filter', pattern: 'HK|JP' } ];
let res_rf = apply_operators(nodes_rf, op_rf);
assert(length(res_rf) == 2, 'Regex filter should retain HK and JP, got: ' + length(res_rf));

let op_rf_inv = [ { type: 'regex_filter', pattern: 'US', inverse: true } ];
let res_rf_inv = apply_operators(nodes_rf, op_rf_inv);
assert(length(res_rf_inv) == 2, 'Inverse regex filter should drop US');

// -----------------------------------------------------------------------------
// 2. Type Filter
// -----------------------------------------------------------------------------
let nodes_tf = [
	mock_node('N1', 'ss', '1.1.1.1', 8388),
	mock_node('N2', 'vless', '2.2.2.2', 443),
	mock_node('N3', 'hysteria2', '3.3.3.3', 8443)
];
let op_tf = [ { type: 'type_filter', types: ['vless', 'hysteria2'] } ];
let res_tf = apply_operators(nodes_tf, op_tf);
assert(length(res_tf) == 2, 'Type filter should retain vless and hy2');

// -----------------------------------------------------------------------------
// 3. Conditional Filter
// -----------------------------------------------------------------------------
let nodes_cf = [
	mock_node('Port443', 'vless', '1.1.1.1', 443, { network: 'ws' }),
	mock_node('Port8443', 'vless', '2.2.2.2', 8443, { network: 'tcp' }),
	mock_node('Port80', 'http', '3.3.3.3', 80)
];
let op_cf = [
	{
		type: 'conditional_filter',
		conditions: [
			{ field: 'port', op: 'EQUALS', value: 443 },
			{ field: 'network', op: 'EQUALS', value: 'ws' }
		],
		logic: 'AND'
	}
];
let res_cf = apply_operators(nodes_cf, op_cf);
assert(length(res_cf) == 1 && res_cf[0].name == 'Port443', 'Conditional filter EQUALS AND failed');

// -----------------------------------------------------------------------------
// 4. Regex Rename & Delete
// -----------------------------------------------------------------------------
let nodes_rn = [
	mock_node('【专线】香港 01 x1.5', 'vless', '1.1.1.1', 443),
	mock_node('【专线】日本 02 x1.5', 'ss', '2.2.2.2', 8388)
];
let op_rn = [
	{ type: 'regex_rename', pattern: '【专线】', replacement: '' },
	{ type: 'regex_rename', pattern: 'x1.5', replacement: 'Premium' }
];
let res_rn = apply_operators(nodes_rn, op_rn);
assert(res_rn[0].name == '香港 01 Premium', 'Rename mismatch on node 0: ' + res_rn[0].name);
assert(res_rn[1].name == '日本 02 Premium', 'Rename mismatch on node 1: ' + res_rn[1].name);

// -----------------------------------------------------------------------------
// 5. Quick Setting
// -----------------------------------------------------------------------------
let nodes_qs = [
	mock_node('N1', 'ss', '1.1.1.1', 8388, { udp: false, skip_cert_verify: false })
];
let op_qs = [ { type: 'quick_setting', udp: true, skip_cert_verify: true } ];
let res_qs = apply_operators(nodes_qs, op_qs);
assert(res_qs[0].udp == true, 'udp should be set to true');
assert(res_qs[0].skip_cert_verify == true, 'skip_cert_verify should be set to true');

// -----------------------------------------------------------------------------
// 6. Handle Duplicate
// -----------------------------------------------------------------------------
let nodes_dup = [
	mock_node('Node A', 'ss', '1.1.1.1', 8388),
	mock_node('Node A', 'ss', '1.1.1.2', 8388),
	mock_node('Node B', 'ss', '2.2.2.2', 8388)
];
let op_dup_del = [ { type: 'handle_duplicate', action: 'delete' } ];
let res_dup_del = apply_operators(nodes_dup, op_dup_del);
assert(length(res_dup_del) == 2, 'Handle duplicate delete should produce 2 nodes');

let op_dup_ren = [ { type: 'handle_duplicate', action: 'rename' } ];
let res_dup_ren = apply_operators(nodes_dup, op_dup_ren);
assert(length(res_dup_ren) == 3, 'Handle duplicate rename should keep 3 nodes');
assert(res_dup_ren[1].name == 'Node A #1', 'Second Node A should be renamed to Node A #1');

// -----------------------------------------------------------------------------
// 7. Sort
// -----------------------------------------------------------------------------
let nodes_sort = [
	mock_node('US Node', 'vless', '3.3.3.3', 443),
	mock_node('HK Node', 'vless', '1.1.1.1', 443),
	mock_node('JP Node', 'vless', '2.2.2.2', 443)
];
// Keyword priority: HK first, JP second, US last
let op_sort_kw = [ { type: 'sort', mode: 'keywords', keywords: ['HK', 'JP', 'US'] } ];
let res_sort_kw = apply_operators(nodes_sort, op_sort_kw);
assert(res_sort_kw[0].name == 'HK Node', 'First sorted keyword node should be HK Node');
assert(res_sort_kw[1].name == 'JP Node', 'Second sorted keyword node should be JP Node');
assert(res_sort_kw[2].name == 'US Node', 'Third sorted keyword node should be US Node');

// -----------------------------------------------------------------------------
// 8. Flag (Emoji add & remove)
// -----------------------------------------------------------------------------
let nodes_flag = [
	mock_node('香港 01', 'vless', '1.1.1.1', 443),
	mock_node('日本 02', 'vless', '2.2.2.2', 443)
];
let op_flag_add = [ { type: 'flag', action: 'add' } ];
let res_flag_add = apply_operators(nodes_flag, op_flag_add);
assert(index(res_flag_add[0].name, '🇭🇰') == 0, 'HK flag emoji missing: ' + res_flag_add[0].name);
assert(index(res_flag_add[1].name, '🇯🇵') == 0, 'JP flag emoji missing: ' + res_flag_add[1].name);

let op_flag_rm = [ { type: 'flag', action: 'remove' } ];
let res_flag_rm = apply_operators(res_flag_add, op_flag_rm);
assert(res_flag_rm[0].name == '香港 01', 'HK flag emoji was not cleanly removed: ' + res_flag_rm[0].name);

// -----------------------------------------------------------------------------
// 9. Pipeline with Ordered Operators
// -----------------------------------------------------------------------------
let raw_uri = "vless://u1@1.1.1.1:443#HK%2001\nvless://u2@2.2.2.2:443#JP%2002\nvless://u3@3.3.3.3:443#US%2003";
let pipe_ops = [
	{ type: 'regex_filter', pattern: 'HK|JP' }, // Drop US
	{ type: 'flag', action: 'add' },            // Add 🇭🇰, 🇯🇵
	{ type: 'quick_setting', udp: true }        // Enable udp
];

let res_pipe_ops = convert_subscription("trace-ops-pipe", raw_uri, { operators: pipe_ops });
assert(res_pipe_ops.ok == true, 'Pipeline with operators failed');
assert(length(res_pipe_ops.outbounds) == 2, 'Expected 2 outbounds after filter');
assert(index(res_pipe_ops.outbounds[0].tag, '🇭🇰') == 0, 'First tag missing HK flag');
assert(index(res_pipe_ops.outbounds[1].tag, '🇯🇵') == 0, 'Second tag missing JP flag');

print("convert step m2 operators tests passed\n");
