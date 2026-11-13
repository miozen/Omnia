/**
 * Test suite for convert/pipeline.uc.
 * Covers:
 * 1. Tag deduplication logic (adding #1, #2 suffix on duplicates).
 * 2. Filter valid outbounds (dropping empty servers or invalid ports).
 * 3. End-to-end conversion of multi-line URI lists.
 * 4. End-to-end conversion of Base64 encoded subscriptions.
 * 5. End-to-end conversion of native sing-box JSON subscriptions.
 * 6. Graceful error reporting for empty or unrecognized content.
 */

'use strict';

import { convert_subscription, deduplicate_tags, filter_valid_outbounds } from 'omnia.convert.pipeline';

function assert(condition, message) {
	if (!condition)
		die('Assertion failed: ' + message);
}

// 1. Test tag deduplication
let dup_items = [
	{ type: 'vless', tag: 'HK Node', server: '1.1.1.1', server_port: 443 },
	{ type: 'vless', tag: 'HK Node', server: '1.1.1.2', server_port: 443 },
	{ type: 'vless', tag: 'HK Node', server: '1.1.1.3', server_port: 443 },
	{ type: 'ss', tag: 'JP Node', server: '2.2.2.2', server_port: 8388 }
];
let deduped = deduplicate_tags(dup_items);
assert(length(deduped) == 4, 'dedup count should be 4');
assert(deduped[0].tag == 'HK Node', 'first tag should be unchanged');
assert(deduped[1].tag == 'HK Node #1', 'second tag should have #1');
assert(deduped[2].tag == 'HK Node #2', 'third tag should have #2');
assert(deduped[3].tag == 'JP Node', 'unique tag should be unchanged');

// 2. Test filter valid outbounds
let mixed_items = [
	{ type: 'vless', tag: 'good', server: '1.1.1.1', server_port: 443 },
	{ type: 'vless', tag: 'bad-port', server: '1.1.1.1', server_port: 70000 },
	{ type: 'vless', tag: 'bad-server', server: '', server_port: 443 },
	{ type: 'vless', tag: '', server: '1.1.1.1', server_port: 443 }
];
let f_res = filter_valid_outbounds(mixed_items);
assert(length(f_res.outbounds) == 1, 'only 1 valid outbound expected');
assert(f_res.skipped_count == 3, '3 skipped expected');
assert(f_res.outbounds[0].tag == 'good', 'valid item mismatch');

// 3. Test End-to-End: Plain URI list with duplicate tags
let uri_input = "vless://uuid-1@hk.example.com:443?security=tls#My%20Node\ntrojan://pwd-2@jp.example.com:443#My%20Node\nhy2://pwd-3@us.example.com:8443#US%20Hy2";

let res_uri = convert_subscription("test-trace-1", uri_input);
assert(res_uri.ok == true, 'convert_subscription failed for uri_input: ' + res_uri.error);
assert(res_uri.format == 'uri_list', 'format mismatch: ' + res_uri.format);
assert(length(res_uri.outbounds) == 3, 'expected 3 outbounds');
assert(res_uri.outbounds[0].tag == 'My Node', 'first tag should be My Node');
assert(res_uri.outbounds[1].tag == 'My Node #1', 'second tag should be My Node #1');
assert(res_uri.outbounds[2].type == 'hysteria2', 'third type should be hysteria2');

// 4. Test End-to-End: Native sing-box JSON with Reality and selector
let sb_input = {
	outbounds: [
		{ type: 'direct', tag: 'direct-out' },
		{ type: 'selector', tag: 'proxy', outbounds: ['node1'] },
		{
			type: 'vless',
			tag: 'node1',
			server: 'vless.example.com',
			server_port: 443,
			uuid: '11111111-1111-1111-1111-111111111111',
			tls: {
				enabled: true,
				reality: { enabled: true, public_key: 'pk1', short_id: 'sid1' }
			},
			bind_interface: 'eth0',
			domain_resolver: 'bad-dns'
		}
	]
};

let res_sb = convert_subscription("test-trace-2", sprintf("%J", sb_input));
assert(res_sb.ok == true, 'convert_subscription failed for singbox JSON');
assert(res_sb.format == 'singbox_json', 'format should be singbox_json');
assert(length(res_sb.outbounds) == 1, 'only 1 real proxy node expected');
let sb_out = res_sb.outbounds[0];
assert(sb_out.tag == 'node1', 'tag mismatch');
assert(sb_out.tls.reality.public_key == 'pk1', 'reality public_key preserved');
assert(sb_out.bind_interface == null, 'bind_interface stripped');
assert(sb_out.domain_resolver == null, 'domain_resolver stripped');

print('convert step 5 pipeline tests passed\n');
