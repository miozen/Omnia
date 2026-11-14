/**
 * Omnia | tests/convert-step-m4-local-and-script.uc
 * Milestone 4: Form-based local nodes, paste import, and sandboxed ucode script engine tests.
 */

'use strict';

import { parse_form_node, parse_form_nodes, normalize_form_protocol } from 'omnia.convert.parsers.form';
import { execute_script_operator, create_script_utils, is_ip, is_ipv4, is_ipv6 } from 'omnia.convert.operators.script';
import { convert_form_nodes, convert_subscription } from 'omnia.convert.pipeline';
import { apply_operators } from 'omnia.convert.operators.engine';
import { normalize_source } from 'omnia.subscription_policy_schema';
import { preview_subscription_nodes } from 'omnia.subscription_fetch';

function assert(condition, message) {
	if (!condition)
		die('Assertion failed: ' + message);
}

print('=== Test 1: Form-based node parser across protocols ===\n');

// 1.1 Shadowsocks
let ss_raw = {
	type: 'ss',
	name: 'HK SS Node',
	server: '1.2.3.4',
	port: 8388,
	cipher: 'chacha20-ietf-poly1305',
	password: 'secretpassword',
	udp: true
};
let ss_ir = parse_form_node(ss_raw);
assert(ss_ir != null, 'SS IR node should parse successfully');
assert(ss_ir.name == 'HK SS Node', 'SS name matches');
assert(ss_ir.cipher == 'chacha20-ietf-poly1305', 'SS cipher matches');
assert(ss_ir.password == 'secretpassword', 'SS password matches');
assert(ss_ir.udp == true, 'SS UDP enabled');

// 1.2 VMess
let vmess_raw = {
	type: 'vmess',
	name: 'JP VMess',
	server: 'jp.node.com',
	port: 443,
	uuid: 'b831381d-6324-4d53-ad4f-8cda48b30811',
	alterId: 0,
	security: 'auto',
	network: 'ws',
	ws_opts: { path: '/vmess-ws' },
	tls: true,
	sni: 'jp.node.com'
};
let vmess_ir = parse_form_node(vmess_raw);
assert(vmess_ir != null, 'VMess IR should parse successfully');
assert(vmess_ir.uuid == 'b831381d-6324-4d53-ad4f-8cda48b30811', 'VMess UUID matches');
assert(vmess_ir.network == 'ws', 'VMess network matches');
assert(vmess_ir.tls == true, 'VMess TLS enabled');

// 1.3 VLESS with Reality
let vless_raw = {
	type: 'vless',
	name: 'US VLESS Reality',
	server: 'us.vless.net',
	port: 443,
	uuid: 'a63086e3-2898-466d-88b9-e1e55ec56b00',
	flow: 'xtls-rprx-vision',
	tls: true,
	reality: {
		enabled: true,
		public_key: 'abc123publickey',
		short_id: '12345678'
	}
};
let vless_ir = parse_form_node(vless_raw);
assert(vless_ir != null, 'VLESS IR should parse successfully');
assert(vless_ir.flow == 'xtls-rprx-vision', 'VLESS flow matches');
assert(vless_ir.reality != null && vless_ir.reality.public_key == 'abc123publickey', 'Reality options preserved');

// 1.4 Trojan
let trojan_raw = {
	type: 'trojan',
	name: 'SG Trojan',
	server: 'sg.trojan.org',
	port: 443,
	password: 'trojanpassword',
	tls: true
};
let trojan_ir = parse_form_node(trojan_raw);
assert(trojan_ir != null, 'Trojan IR should parse successfully');
assert(trojan_ir.password == 'trojanpassword', 'Trojan password matches');

// 1.5 Hysteria 2 (and hy2 alias)
let hy2_raw = {
	type: 'hy2',
	name: 'DE Hy2 Node',
	server: 'de.hy2.com',
	port: 8443,
	password: 'hy2authpassword',
	up_mbps: 100,
	down_mbps: 300,
	obfs: 'salamander',
	obfs_password: 'obfspwd'
};
let hy2_ir = parse_form_node(hy2_raw);
assert(hy2_ir != null, 'Hy2 IR should parse successfully');
assert(hy2_ir.type == 'hysteria2', 'hy2 normalized to hysteria2');
assert(hy2_ir.up_mbps == 100, 'Hy2 up_mbps matches');
assert(hy2_ir.obfs == 'salamander', 'Hy2 obfs matches');

// 1.6 TUIC
let tuic_raw = {
	type: 'tuic',
	name: 'KR TUIC Node',
	server: 'kr.tuic.net',
	port: 8443,
	uuid: 'c813589b-0011-2233-4455-66778899aabb',
	password: 'tuicpassword',
	congestion_control: 'bbr'
};
let tuic_ir = parse_form_node(tuic_raw);
assert(tuic_ir != null, 'TUIC IR should parse successfully');
assert(tuic_ir.congestion_control == 'bbr', 'TUIC congestion control matches');

// 1.7 SOCKS (and socks5 alias) & HTTP
let socks_raw = {
	type: 'socks5',
	name: 'Local Socks5',
	server: '127.0.0.1',
	port: 1080
};
let socks_ir = parse_form_node(socks_raw);
assert(socks_ir != null, 'SOCKS IR should parse successfully');
assert(socks_ir.type == 'socks', 'socks5 normalized to socks');

let http_raw = {
	type: 'http',
	name: 'Local HTTP',
	server: '127.0.0.1',
	port: 8080
};
let http_ir = parse_form_node(http_raw);
assert(http_ir != null, 'HTTP IR should parse successfully');

print('PASS: All protocol form nodes parsed successfully\n\n');

print('=== Test 2: Form node security and invalid input rejection ===\n');

// Detour rejection
let detour_node = {
	type: 'ss',
	name: 'Malicious Detour',
	server: '1.2.3.4',
	port: 8388,
	password: 'pwd',
	cipher: 'aes-128-gcm',
	detour: 'proxy-chain'
};
assert(parse_form_node(detour_node) == null, 'Detour must be rejected');

// Port boundary checks
let bad_port_node = {
	type: 'ss',
	server: '1.2.3.4',
	port: 70000,
	password: 'pwd',
	cipher: 'aes-128-gcm'
};
assert(parse_form_node(bad_port_node) == null, 'Port > 65535 rejected');

let zero_port_node = {
	type: 'ss',
	server: '1.2.3.4',
	port: 0,
	password: 'pwd',
	cipher: 'aes-128-gcm'
};
assert(parse_form_node(zero_port_node) == null, 'Port 0 rejected');

// Missing required fields
let missing_pwd_ss = {
	type: 'ss',
	server: '1.2.3.4',
	port: 8388
};
assert(parse_form_node(missing_pwd_ss) == null, 'SS without password rejected');

let missing_uuid_vmess = {
	type: 'vmess',
	server: '1.2.3.4',
	port: 443
};
assert(parse_form_node(missing_uuid_vmess) == null, 'VMess without UUID rejected');

print('PASS: Security invariants and validation rejection verified\n\n');

print('=== Test 3: Form nodes batch parsing and sing-box outbounds production ===\n');

let form_batch = [
	ss_raw,
	bad_port_node,
	vmess_raw,
	detour_node,
	vless_raw
];
let parsed_batch = parse_form_nodes(form_batch);
assert(parsed_batch.stats.total == 5, 'Total nodes 5');
assert(parsed_batch.stats.valid == 3, 'Valid nodes 3');
assert(parsed_batch.stats.skipped == 2, 'Skipped invalid nodes 2');

let conv_res = convert_form_nodes(form_batch);
assert(conv_res.ok == true, 'Form batch conversion succeeded');
assert(length(conv_res.outbounds) == 3, 'Outbounds count matches valid nodes');
assert(conv_res.outbounds[0].type == 'ss', 'Outbound 0 is ss');
assert(conv_res.outbounds[1].type == 'vmess', 'Outbound 1 is vmess');
assert(conv_res.outbounds[2].type == 'vless', 'Outbound 2 is vless');

print('PASS: Form nodes conversion to sing-box outbounds verified\n\n');

print('=== Test 4: Script Operator - Batch Mode ===\n');

function get_test_nodes() {
	return [
		{ name: 'HK Node 1', type: 'ss', server: '1.1.1.1', port: 8388, cipher: 'aes-128-gcm', password: 'p1' },
		{ name: 'JP Node 2', type: 'vmess', server: '2.2.2.2', port: 443, uuid: 'u1' },
		{ name: 'US Node 3', type: 'http', server: 'example.com', port: 8080 }
	];
}

// Script: Filter out HTTP, prepend tag prefix from params, and add flag emoji to HK/JP
let batch_script = `
let out = [];
for (let n in nodes) {
	if (n.type == "http")
		continue;
	n.name = context.params.prefix + n.name;
	n.name = utils.flags.add(n.name);
	push(out, n);
}
return out;
`;

let batch_op = {
	type: 'script',
	mode: 'batch',
	script: batch_script,
	params: { prefix: '[PRO] ' }
};

let script_res = execute_script_operator(get_test_nodes(), batch_op);
assert(length(script_res) == 2, 'HTTP dropped, 2 nodes remain');
assert(index(script_res[0].name, '[PRO]') >= 0, 'Prefix injected from params');
assert(index(script_res[0].name, '🇭🇰') >= 0, 'Flag emoji added by utils.flags.add');
assert(index(script_res[1].name, '🇯🇵') >= 0, 'JP flag emoji added');

print('PASS: Batch mode script executed with flags and params injection\n\n');

print('=== Test 5: Script Operator - Single Node Mode ===\n');

// Script: Drop any node whose server is not an IP address, and append port to name
let single_script = `
if (!utils.is_ip(node.server))
	return null; // drop domain nodes
node.name = node.name + ":" + node.port;
return node;
`;

let single_op = {
	type: 'script',
	mode: 'single',
	script: single_script
};

let single_res = execute_script_operator(get_test_nodes(), single_op);
assert(length(single_res) == 2, 'Domain node dropped, 2 IP nodes remain');
assert(single_res[0].name == 'HK Node 1:8388', 'Node name modified with port');
assert(single_res[1].name == 'JP Node 2:443', 'Node 2 name modified with port');

print('PASS: Single mode script successfully filtered and mutated nodes\n\n');

print('=== Test 6: Script Error Trapping & Safety ===\n');

// 6.1 Syntax error
let syntax_err_op = {
	type: 'script',
	mode: 'batch',
	script: 'let a = ;'
};
let caught_syntax = false;
try {
	execute_script_operator(get_test_nodes(), syntax_err_op);
} catch (e) {
	caught_syntax = true;
	assert(index('' + e, 'Script compilation error') >= 0, 'Clear compilation error message');
}
assert(caught_syntax, 'Syntax error caught');

// 6.2 Runtime error
let runtime_err_op = {
	type: 'script',
	mode: 'single',
	script: 'let x = null; return x.non_existent_method();'
};
let caught_runtime = false;
try {
	execute_script_operator(get_test_nodes(), runtime_err_op);
} catch (e) {
	caught_runtime = true;
	assert(index('' + e, 'Script runtime error') >= 0, 'Clear runtime error message');
}
assert(caught_runtime, 'Runtime error caught');

// 6.3 Invalid return type in batch mode
let bad_return_op = {
	type: 'script',
	mode: 'batch',
	script: 'return "not an array";'
};
let caught_return = false;
try {
	execute_script_operator(get_test_nodes(), bad_return_op);
} catch (e) {
	caught_return = true;
	assert(index('' + e, 'must return an array') >= 0, 'Clear return type error message');
}
assert(caught_return, 'Return type error caught');

print('PASS: Script error trapping handles compilation, runtime and type violations gracefully\n\n');

print('=== Test 7: Integration in Operator Pipeline ===\n');

let mixed_ops = [
	{
		type: 'script',
		mode: 'single',
		script: 'node.name = "[VIP] " + node.name; return node;'
	},
	{
		type: 'regex_filter',
		pattern: 'VIP'
	},
	{
		type: 'quick_setting',
		udp: true,
		skip_cert_verify: true
	}
];

let pipeline_nodes = apply_operators(get_test_nodes(), mixed_ops);
assert(length(pipeline_nodes) == 3, 'All 3 retained');
for (let n in pipeline_nodes) {
	assert(index(n.name, '[VIP]') == 0, 'VIP prefix applied by script');
	assert(n.udp == true, 'Quick setting udp applied');
	assert(n.skip_cert_verify == true, 'Quick setting skip_cert_verify applied');
}

print('PASS: Script operator seamlessly works in ordered pipeline\n\n');

print('=== Test 8: Local Subscription Source in Schema ===\n');

let dummy_regions = { HK: ['HK'], TW: ['TW'], SG: ['SG'], JP: ['JP'], US: ['US'] };

// 8.1 Remote source requires URL
let caught_url_err = false;
try {
	normalize_source({ name: 'Remote Source' }, dummy_regions, 0, {}, {});
} catch (e) {
	caught_url_err = true;
}
assert(caught_url_err, 'Remote source without URL rejected');

// 8.2 Local source does not require URL
let local_src = normalize_source({
	name: 'My Local Nodes',
	type: 'local',
	payload: 'ss://YWVzLTEyOC1nY206c2VjcmV0QDEuMi4zLjQ6ODM4OA==#LocalSS',
	operators: [
		{ type: 'script', mode: 'single', script: 'node.name = "[LOCAL] " + node.name; return node;' }
	]
}, dummy_regions, 0, {}, {});

assert(local_src != null, 'Local source normalized');
assert(local_src.type == 'local', 'Local source type preserved');
assert(substr(local_src.url, 0, 8) == 'local://', 'Default local URL generated');
assert(local_src.payload != null, 'Payload preserved');
assert(length(local_src.operators) == 1, 'Operators preserved');

print('PASS: Local subscription source schema verified\n\n');

print('=== Test 9: Preview Function ===\n');

let preview_nodes = preview_subscription_nodes(
	'ss://YWVzLTEyOC1nY206c2VjcmV0QDEuMi4zLjQ6ODM4OA==#TestPreview',
	{
		operators: [
			{ type: 'script', mode: 'single', script: 'node.name = "Previewed " + node.name; return node;' }
		]
	}
);

assert(length(preview_nodes) == 1, 'Preview produced 1 node');
assert(index(preview_nodes[0].tag, 'Previewed TestPreview') == 0, 'Script executed in preview');

print('PASS: Preview conversion function verified\n\n');

print('=== ALL Milestone 4 Tests Successfully Passed! ===\n');
