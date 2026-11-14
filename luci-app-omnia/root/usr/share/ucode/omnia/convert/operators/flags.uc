/**
 * Omnia | convert/operators/flags.uc
 * Flag emoji recognition and manipulation for proxy node names.
 */

'use strict';

import { trim } from 'omnia.convert.utils';

const COUNTRY_FLAGS = [
	{ code: 'HK', flag: '🇭🇰', keywords: ['香港', 'hk', 'hongkong', 'hong kong'] },
	{ code: 'JP', flag: '🇯🇵', keywords: ['日本', 'jp', 'japan', 'tokyo', 'osaka'] },
	{ code: 'US', flag: '🇺🇸', keywords: ['美国', '美', 'us', 'usa', 'united states', 'america'] },
	{ code: 'SG', flag: '🇸🇬', keywords: ['新加坡', '狮城', 'sg', 'singapore'] },
	{ code: 'TW', flag: '🇹🇼', keywords: ['台湾', '台', 'tw', 'taiwan'] },
	{ code: 'KR', flag: '🇰🇷', keywords: ['韩国', '韩', 'kr', 'korea', 'seoul'] },
	{ code: 'UK', flag: '🇬🇧', keywords: ['英国', '英', 'uk', 'gb', 'britain', 'london'] },
	{ code: 'DE', flag: '🇩🇪', keywords: ['德国', '德', 'de', 'germany', 'frankfurt'] },
	{ code: 'FR', flag: '🇫🇷', keywords: ['法国', '法', 'fr', 'france', 'paris'] },
	{ code: 'CA', flag: '🇨🇦', keywords: ['加拿大', '加', 'ca', 'canada'] },
	{ code: 'AU', flag: '🇦🇺', keywords: ['澳大利亚', '澳洲', 'au', 'australia', 'sydney'] },
	{ code: 'RU', flag: '🇷🇺', keywords: ['俄罗斯', '俄', 'ru', 'russia', 'moscow'] },
	{ code: 'IN', flag: '🇮🇳', keywords: ['印度', 'in', 'india'] },
	{ code: 'MY', flag: '🇲🇾', keywords: ['马来西亚', '大马', 'my', 'malaysia'] },
	{ code: 'TH', flag: '🇹🇭', keywords: ['泰国', 'th', 'thailand'] },
	{ code: 'VN', flag: '🇻🇳', keywords: ['越南', 'vn', 'vietnam'] },
	{ code: 'PH', flag: '🇵🇭', keywords: ['菲律宾', 'ph', 'philippines'] },
	{ code: 'TR', flag: '🇹🇷', keywords: ['土耳其', 'tr', 'turkey'] },
	{ code: 'AR', flag: '🇦🇷', keywords: ['阿根廷', 'ar', 'argentina'] },
	{ code: 'NL', flag: '🇳🇱', keywords: ['荷兰', 'nl', 'netherlands', 'amsterdam'] }
];

/**
 * Detects matching flag emoji from node name based on region keywords.
 */
function detect_flag_for_name(name) {
	if (type(name) != 'string' || name == '')
		return '';

	let lower = lc(name);
	for (let item in COUNTRY_FLAGS) {
		for (let kw in item.keywords) {
			if (index(lower, kw) >= 0)
				return item.flag;
		}
	}
	return '';
}

/**
 * Adds appropriate flag emoji to the beginning of node name if not already present.
 */
function add_flag_to_name(name) {
	if (type(name) != 'string')
		return '';
	let s = trim(name);

	// Check if already starts with any known flag
	for (let item in COUNTRY_FLAGS) {
		if (index(s, item.flag) == 0)
			return s;
	}

	let flag = detect_flag_for_name(s);
	if (flag != '')
		return flag + ' ' + s;

	return s;
}

/**
 * Removes known flag emojis from the beginning of node name.
 */
function remove_flag_from_name(name) {
	if (type(name) != 'string')
		return '';
	let s = trim(name);

	for (let item in COUNTRY_FLAGS) {
		if (index(s, item.flag) == 0) {
			let rest = substr(s, length(item.flag));
			return trim(rest);
		}
	}

	return s;
}

export {
	COUNTRY_FLAGS,
	detect_flag_for_name,
	add_flag_to_name,
	remove_flag_from_name
};
