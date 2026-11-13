/**
 * Omnia | convert/sniffer.uc
 * Content format sniffer for proxy subscriptions.
 * Distinguishes sing-box JSON, Clash YAML, base64 block, and plain URI lists.
 */

'use strict';

import { trim, safe_b64decode, is_ascii_printable, split_lines } from 'omnia.convert.utils';

const KNOWN_SCHEMES = {
	'ss://': true,
	'vmess://': true,
	'vless://': true,
	'trojan://': true,
	'hysteria2://': true,
	'hy2://': true,
	'tuic://': true,
	'anytls://': true,
	'socks5://': true,
	'socks://': true
};

function has_known_scheme_line(lines) {
	let count = 0;
	for (let line in lines) {
		let lower = lc(line);
		for (let s in KNOWN_SCHEMES) {
			if (index(lower, s) == 0) {
				count++;
				break;
			}
		}
		if (index(lower, 'http://') == 0 || index(lower, 'https://') == 0) {
			let at_idx = index(lower, '@');
			let slash_idx = index(substr(lower, 8), '/');
			if (at_idx > 7 && (slash_idx < 0 || at_idx < 8 + slash_idx))
				count++;
		}
	}
	return count;
}

function sniff_format(raw_content) {
	if (type(raw_content) != 'string')
		return { format: 'unknown', error: 'Content is not a string' };

	let text = trim(raw_content);
	if (text == '')
		return { format: 'empty', error: 'Content is empty' };

	// 1. Check sing-box JSON
	if (substr(text, 0, 1) == '{' || substr(text, 0, 1) == '[') {
		try {
			let parsed = json(text);
			if (type(parsed) == 'object' && parsed != null) {
				if (type(parsed.outbounds) == 'array')
					return { format: 'singbox_json', parsed: parsed };
				if (type(parsed.inbounds) == 'array' || type(parsed.route) == 'object')
					return { format: 'singbox_json', parsed: parsed };
			} else if (type(parsed) == 'array') {
				let has_outbounds = false;
				for (let item in parsed) {
					if (type(item) == 'object' && item != null && type(item.type) == 'string' && type(item.tag) == 'string') {
						has_outbounds = true;
						break;
					}
				}
				if (has_outbounds)
					return { format: 'singbox_json', parsed: parsed };
			}
		} catch (e) {
			// Not valid JSON, continue sniffing
		}
	}

	// 2. Check Clash YAML
	let lines = split_lines(text);
	for (let line in lines) {
		let tl = trim(line);
		if (index(tl, 'proxies:') == 0 || index(tl, 'payload:') == 0)
			return { format: 'clash_yaml' };
	}

	// 3. Check plain URI list
	let uri_count = has_known_scheme_line(lines);
	if (uri_count > 0 && uri_count >= int(length(lines) / 2))
		return { format: 'uri_list', lines: lines };

	// 4. Check base64 block
	let decoded = safe_b64decode(text);
	if (decoded != null && is_ascii_printable(decoded)) {
		let d_lines = split_lines(decoded);
		let d_uri_count = has_known_scheme_line(d_lines);
		if (d_uri_count > 0)
			return { format: 'base64_uri_list', decoded: decoded, lines: d_lines };

		if (substr(trim(decoded), 0, 1) == '{' || substr(trim(decoded), 0, 1) == '[') {
			try {
				let d_json = json(decoded);
				if (type(d_json) == 'object' || type(d_json) == 'array')
					return { format: 'base64_json', decoded: decoded, parsed: d_json };
			} catch (e) {}
		}

		for (let line in d_lines) {
			let tl = trim(line);
			if (index(tl, 'proxies:') == 0 || index(tl, 'payload:') == 0)
				return { format: 'base64_clash_yaml', decoded: decoded };
		}

		if (length(d_lines) > 0)
			return { format: 'base64_raw', decoded: decoded, lines: d_lines };
	}

	if (uri_count > 0)
		return { format: 'uri_list', lines: lines };

	return { format: 'unknown', error: 'Unable to detect content format' };
}

export {
	sniff_format
};
