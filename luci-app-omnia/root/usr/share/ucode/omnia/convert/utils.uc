/**
 * Omnia | convert/utils.uc
 * Common string, base64 and URL utility functions for proxy conversion.
 */

'use strict';

function trim(str) {
	if (type(str) != 'string')
		return '';
	let start = 0;
	let end = length(str) - 1;
	while (start <= end) {
		let c = substr(str, start, 1);
		if (c != ' ' && c != '\t' && c != '\r' && c != '\n')
			break;
		start++;
	}
	while (end >= start) {
		let c = substr(str, end, 1);
		if (c != ' ' && c != '\t' && c != '\r' && c != '\n')
			break;
		end--;
	}
	if (start > end)
		return '';
	return substr(str, start, end - start + 1);
}

function hex_digit_val(c) {
	if (c >= '0' && c <= '9') return ord(c) - 48;
	if (c >= 'a' && c <= 'f') return ord(c) - 97 + 10;
	if (c >= 'A' && c <= 'F') return ord(c) - 65 + 10;
	return -1;
}

function urldecode(str) {
	if (type(str) != 'string' || str == '')
		return '';
	let out = '';
	let len = length(str);
	let i = 0;
	while (i < len) {
		let c = substr(str, i, 1);
		if (c == '%' && i + 2 < len) {
			let h1 = hex_digit_val(substr(str, i + 1, 1));
			let h2 = hex_digit_val(substr(str, i + 2, 1));
			if (h1 >= 0 && h2 >= 0) {
				out += chr(h1 * 16 + h2);
				i += 3;
				continue;
			}
		} else if (c == '+') {
			out += ' ';
			i++;
			continue;
		}
		out += c;
		i++;
	}
	return out;
}

function parse_query(query_str) {
	let params = {};
	if (type(query_str) != 'string' || query_str == '')
		return params;
	if (substr(query_str, 0, 1) == '?')
		query_str = substr(query_str, 1);
	let pairs = split(query_str, '&');
	for (let pair in pairs) {
		if (pair == '')
			continue;
		let idx = index(pair, '=');
		if (idx >= 0) {
			let k = urldecode(substr(pair, 0, idx));
			let v = urldecode(substr(pair, idx + 1));
			params[k] = v;
		} else {
			params[urldecode(pair)] = '';
		}
	}
	return params;
}

function safe_b64decode(str) {
	if (type(str) != 'string')
		return null;
	str = trim(str);
	str = replace(str, '-', '+');
	str = replace(str, '_', '/');
	str = replace(str, '\r', '');
	str = replace(str, '\n', '');
	let pad_len = length(str) % 4;
	if (pad_len == 2) {
		str += '==';
	} else if (pad_len == 3) {
		str += '=';
	} else if (pad_len == 1) {
		return null;
	}
	try {
		return b64dec(str);
	} catch (e) {
		return null;
	}
}

function is_ascii_printable(str) {
	if (type(str) != 'string')
		return false;
	let len = length(str);
	for (let i = 0; i < len; i++) {
		let code = ord(substr(str, i, 1));
		if (code < 32 && code != 9 && code != 10 && code != 13)
			return false;
	}
	return true;
}

function split_lines(text) {
	if (type(text) != 'string' || text == '')
		return [];
	text = replace(text, '\r\n', '\n');
	text = replace(text, '\r', '\n');
	let raw_lines = split(text, '\n');
	let lines = [];
	for (let l in raw_lines) {
		let tl = trim(l);
		if (tl != '')
			push(lines, tl);
	}
	return lines;
}

export {
	trim,
	urldecode,
	parse_query,
	safe_b64decode,
	is_ascii_printable,
	split_lines
};
