/**
 * Test suite for convert utils, ir and sniffer modules.
 */

'use strict';

import { trim, urldecode, parse_query, safe_b64decode, split_lines } from 'omnia.convert.utils';
import { SUPPORTED_PROTOCOLS, is_protocol_supported, create_ir_node, validate_ir_node } from 'omnia.convert.ir';
import { sniff_format } from 'omnia.convert.sniffer';

function assert(condition, message) {
	if (!condition)
		die('Assertion failed: ' + message);
}

// 1. Test convert/utils
assert(trim('  hello world \r\n ') == 'hello world', 'trim failed');
assert(urldecode('hello%20world%2Btest') == 'hello world+test', 'urldecode failed');
assert(urldecode('foo+bar') == 'foo bar', 'urldecode plus failed');

let q = parse_query('type=ws&security=tls&path=%2Fchat&sni=example.com');
assert(q.type == 'ws', 'query type failed');
assert(q.security == 'tls', 'query security failed');
assert(q.path == '/chat', 'query path failed');
assert(q.sni == 'example.com', 'query sni failed');

let b64 = safe_b64decode('SGVsbG8gT21uaWE=');
assert(b64 == 'Hello Omnia', 'safe_b64decode failed: ' + b64);
let b64_url = safe_b64decode('SGVsbG8tT21uaWE'); // URL safe without padding
assert(b64_url == 'Hello-Omnia', 'safe_b64decode url-safe failed: ' + b64_url);

let lines = split_lines("line1\r\nline2\n\nline3\r");
assert(length(lines) == 3, 'split_lines count failed');
assert(lines[0] == 'line1' && lines[1] == 'line2' && lines[2] == 'line3', 'split_lines content failed');

// 2. Test convert/ir
assert(is_protocol_supported('vless') == true, 'vless should be supported');
assert(is_protocol_supported('hysteria2') == true, 'hysteria2 should be supported');
assert(is_protocol_supported('hysteria') == false, 'hysteria v1 should not be supported in M1');
assert(is_protocol_supported('wireguard') == false, 'wireguard should not be supported in IR outbounds');

let ir = create_ir_node({
	name: 'HK-01',
	type: 'vless',
	server: 'hk.example.com',
	port: 443,
	uuid: '11111111-2222-3333-4444-555555555555',
	tls: true,
	sni: 'hk.example.com'
});
assert(ir != null, 'create_ir_node returned null');
let ir_val = validate_ir_node(ir);
assert(ir_val.ok == true, 'validate_ir_node failed: ' + ir_val.error);

let invalid_ir = create_ir_node({
	name: 'bad',
	type: 'vless',
	server: 'hk.example.com',
	port: 70000
});
assert(validate_ir_node(invalid_ir).ok == false, 'out-of-range port should fail validation');

// 3. Test convert/sniffer
let json_sub = '{"outbounds":[{"type":"vless","tag":"node1","server":"1.1.1.1","server_port":443}]}';
let res1 = sniff_format(json_sub);
assert(res1.format == 'singbox_json', 'sniff singbox_json failed: ' + res1.format);

let clash_sub = "proxies:\n  - name: hk01\n    type: ss\n    server: 1.1.1.1\n    port: 443";
let res2 = sniff_format(clash_sub);
assert(res2.format == 'clash_yaml', 'sniff clash_yaml failed: ' + res2.format);

let plain_uri = "vless://uuid@hk.example.com:443?security=tls#HK01\ntrojan://pwd@jp.example.com:443#JP01";
let res3 = sniff_format(plain_uri);
assert(res3.format == 'uri_list', 'sniff uri_list failed: ' + res3.format);

// Base64 encoded plain_uri
let b64_sub = 'dmxlc3M6Ly91dWlkQGhrLmV4YW1wbGUuY29tOjQ0Mz9zZWN1cml0eT10bHMjSEswMQp0cm9qYW46Ly9wd2RAanAuZXhhbXBsZS5jb206NDQzI0pQMDE=';
let res4 = sniff_format(b64_sub);
assert(res4.format == 'base64_uri_list', 'sniff base64_uri_list failed: ' + res4.format);

// Test non-proxy regular URL string (must not be misdetected as proxy URI list)
let regular_web_url = "https://example.com/api/v1/client/subscribe?token=123456";
let res5 = sniff_format(regular_web_url);
assert(res5.format != 'uri_list', 'regular http web url should not be misdetected as proxy uri_list');

print('convert step 1 tests passed\n');
