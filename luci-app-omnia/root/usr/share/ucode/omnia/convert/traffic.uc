/**
 * Omnia | convert/traffic.uc
 * Parser for Subscription-Userinfo HTTP headers.
 * Extracts upload, download, total traffic quotas and expiration timestamps.
 */

'use strict';

import { trim } from 'omnia.convert.utils';

/**
 * Parses raw Subscription-Userinfo header value.
 * Example: "upload=1073741824; download=5368709120; total=107374182400; expire=1735689600"
 * @param {string} userinfo_str - Header value string
 * @returns {object|null} Parsed traffic object or null if invalid
 */
function parse_subscription_userinfo(userinfo_str) {
	if (type(userinfo_str) != 'string')
		return null;

	let text = trim(userinfo_str);
	if (text == '')
		return null;

	let result = {
		upload: 0,
		download: 0,
		used: 0,
		total: 0,
		remaining: 0,
		expire: 0
	};

	let has_field = false;
	let parts = split(text, ';');
	for (let part in parts) {
		let p = trim(part);
		if (p == '')
			continue;
		let eq_idx = index(p, '=');
		if (eq_idx > 0) {
			let k = lc(trim(substr(p, 0, eq_idx)));
			let v = trim(substr(p, eq_idx + 1));
			let num = int(v);
			if (k == 'upload') {
				result.upload = num;
				has_field = true;
			} else if (k == 'download') {
				result.download = num;
				has_field = true;
			} else if (k == 'total') {
				result.total = num;
				has_field = true;
			} else if (k == 'expire') {
				result.expire = num;
				has_field = true;
			}
		}
	}

	if (!has_field)
		return null;

	result.used = result.upload + result.download;
	if (result.total > 0) {
		result.remaining = result.total > result.used ? (result.total - result.used) : 0;
	}

	return result;
}

/**
 * Extracts Subscription-Userinfo from raw HTTP response headers text.
 * @param {string} headers_text - Raw HTTP header lines (or stderr from wget)
 * @returns {object|null} Parsed traffic object or null
 */
function extract_userinfo_from_headers(headers_text) {
	if (type(headers_text) != 'string' || headers_text == '')
		return null;

	let lines = split(replace(replace(headers_text, '\r\n', '\n'), '\r', '\n'), '\n');
	for (let line in lines) {
		let trimmed = trim(line);
		let lower = lc(trimmed);
		if (index(lower, 'subscription-userinfo:') == 0) {
			let val = trim(substr(trimmed, length('subscription-userinfo:')));
			return parse_subscription_userinfo(val);
		}
	}

	return null;
}

export {
	parse_subscription_userinfo,
	extract_userinfo_from_headers
};
