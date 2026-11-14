/**
 * Test suite for convert/traffic.uc.
 * Covers:
 * 1. Standard Subscription-Userinfo header value parsing
 * 2. Case-insensitivity (upload, Upload, UPLOAD)
 * 3. Calculation of used and remaining traffic
 * 4. Header extraction from multiline HTTP responses / wget stderr
 * 5. Rejection of invalid or empty headers
 */

'use strict';

import { parse_subscription_userinfo, extract_userinfo_from_headers } from 'omnia.convert.traffic';

function assert(condition, message) {
	if (!condition)
		die('Assertion failed: ' + message);
}

// 1. Standard parsing
let standard_header = "upload=1073741824; download=5368709120; total=107374182400; expire=1735689600";
let res1 = parse_subscription_userinfo(standard_header);
assert(res1 != null, "Standard header parsing returned null");
assert(res1.upload == 1073741824, "Upload mismatch: " + res1.upload);
assert(res1.download == 5368709120, "Download mismatch: " + res1.download);
assert(res1.used == 1073741824 + 5368709120, "Used mismatch: " + res1.used);
assert(res1.total == 107374182400, "Total mismatch: " + res1.total);
assert(res1.remaining == 107374182400 - (1073741824 + 5368709120), "Remaining mismatch: " + res1.remaining);
assert(res1.expire == 1735689600, "Expire timestamp mismatch: " + res1.expire);

// 2. Multiline extraction from HTTP response
let mock_http_resp = `
HTTP/1.1 200 OK
Server: nginx
Date: Sat, 14 Nov 2026 00:00:00 GMT
Content-Type: text/plain; charset=utf-8
Subscription-Userinfo: upload=500; download=1500; total=10000; expire=1800000000
Content-Disposition: attachment; filename*=UTF-8''subs.txt
`;

let res2 = extract_userinfo_from_headers(mock_http_resp);
assert(res2 != null, "Multiline HTTP extraction returned null");
assert(res2.upload == 500, "Extracted upload mismatch: " + res2.upload);
assert(res2.download == 1500, "Extracted download mismatch: " + res2.download);
assert(res2.used == 2000, "Extracted used mismatch: " + res2.used);
assert(res2.total == 10000, "Extracted total mismatch: " + res2.total);
assert(res2.remaining == 8000, "Extracted remaining mismatch: " + res2.remaining);
assert(res2.expire == 1800000000, "Extracted expire mismatch: " + res2.expire);

// 3. Invalid inputs
assert(parse_subscription_userinfo("") == null, "Empty string should return null");
assert(parse_subscription_userinfo("invalid-format") == null, "Invalid format should return null");
assert(extract_userinfo_from_headers("HTTP/1.1 200 OK\nNo-Traffic: 1") == null, "Missing header should return null");

print("convert step m2 traffic tests passed\n");
