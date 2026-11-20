/**
 * Omnia | generator_util.uc | v1.0
 */

'use strict';

function upper_text(value) {
	let text = "" + value;
	text = replace(text, "a", "A");
	text = replace(text, "b", "B");
	text = replace(text, "c", "C");
	text = replace(text, "d", "D");
	text = replace(text, "e", "E");
	text = replace(text, "f", "F");
	text = replace(text, "g", "G");
	text = replace(text, "h", "H");
	text = replace(text, "i", "I");
	text = replace(text, "j", "J");
	text = replace(text, "k", "K");
	text = replace(text, "l", "L");
	text = replace(text, "m", "M");
	text = replace(text, "n", "N");
	text = replace(text, "o", "O");
	text = replace(text, "p", "P");
	text = replace(text, "q", "Q");
	text = replace(text, "r", "R");
	text = replace(text, "s", "S");
	text = replace(text, "t", "T");
	text = replace(text, "u", "U");
	text = replace(text, "v", "V");
	text = replace(text, "w", "W");
	text = replace(text, "x", "X");
	text = replace(text, "y", "Y");
	text = replace(text, "z", "Z");
	return text;
}

function is_ascii_alpha_string(str) {
	if (type(str) != "string" || str == "")
		return false;
	for (let i = 0; i < length(str); i++) {
		let ch = substr(str, i, 1);
		if ((ch < "A" || ch > "Z") && (ch < "a" || ch > "z"))
			return false;
	}
	return true;
}

function tag_contains_keyword(tag_upper, keyword) {
	if (type(keyword) != "string" || keyword == "")
		return false;

	let kw_upper = upper_text(keyword);
	if (!is_ascii_alpha_string(kw_upper))
		return index(tag_upper, kw_upper) >= 0;

	let kw_len = length(kw_upper);
	let tag_len = length(tag_upper);
	let start_pos = 0;

	while (start_pos <= tag_len - kw_len) {
		let sub = substr(tag_upper, start_pos);
		let rel_idx = index(sub, kw_upper);
		if (rel_idx < 0)
			return false;

		let found_idx = start_pos + rel_idx;

		let prev_ok = true;
		if (found_idx > 0) {
			let prev_ch = substr(tag_upper, found_idx - 1, 1);
			if ((prev_ch >= "A" && prev_ch <= "Z") || (prev_ch >= "a" && prev_ch <= "z"))
				prev_ok = false;
		}

		let next_ok = true;
		if (found_idx + kw_len < tag_len) {
			let next_ch = substr(tag_upper, found_idx + kw_len, 1);
			if ((next_ch >= "A" && next_ch <= "Z") || (next_ch >= "a" && next_ch <= "z"))
				next_ok = false;
		}

		if (prev_ok && next_ok)
			return true;

		start_pos = found_idx + 1;
	}

	return false;
}

function is_digit(ch) {
	return ch == "0" || ch == "1" || ch == "2" || ch == "3" || ch == "4" || ch == "5" || ch == "6" || ch == "7" || ch == "8" || ch == "9";
}

function append_unique(list, value) {
	if (type(value) != "string" || value == "")
		return;

	for (let item in list) {
		if (item == value)
			return;
	}

	push(list, value);
}

export { append_unique, upper_text, tag_contains_keyword, is_digit };
