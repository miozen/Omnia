/**
 * Omnia | convert/operators/flags.uc
 * Flag emoji recognition and manipulation for proxy node names.
 */

'use strict';

import { trim } from 'omnia.convert.utils';

const COUNTRY_FLAGS = [
	// 亚太地区
	{ code: 'HK', flag: '🇭🇰', name: '香港', keywords: ['香港', 'hk', 'hongkong', 'hong kong'] },
	{ code: 'TW', flag: '🇹🇼', name: '台湾', keywords: ['台湾', '台', 'tw', 'taiwan', '台灣'] },
	{ code: 'SG', flag: '🇸🇬', name: '新加坡', keywords: ['新加坡', '狮城', 'sg', 'singapore', '獅城'] },
	{ code: 'JP', flag: '🇯🇵', name: '日本', keywords: ['日本', 'jp', 'japan', 'tokyo', 'osaka', '东京', '大阪'] },
	{ code: 'KR', flag: '🇰🇷', name: '韩国', keywords: ['韩国', '韩', 'kr', 'korea', 'seoul', '首尔'] },
	{ code: 'IN', flag: '🇮🇳', name: '印度', keywords: ['印度', 'in', 'india', 'mumbai', '孟买'] },
	{ code: 'MY', flag: '🇲🇾', name: '马来西亚', keywords: ['马来西亚', '大马', 'my', 'malaysia', '吉隆坡', 'kuala lumpur'] },
	{ code: 'TH', flag: '🇹🇭', name: '泰国', keywords: ['泰国', 'th', 'thailand', '曼谷', 'bangkok'] },
	{ code: 'VN', flag: '🇻🇳', name: '越南', keywords: ['越南', 'vn', 'vietnam', '河内', '胡志明', 'hanoi', 'saigon'] },
	{ code: 'PH', flag: '🇵🇭', name: '菲律宾', keywords: ['菲律宾', 'ph', 'philippines', '马尼拉', 'manila'] },
	{ code: 'ID', flag: '🇮🇩', name: '印度尼西亚', keywords: ['印度尼西亚', '印尼', 'id', 'indonesia', 'jakarta', '雅加达'] },
	{ code: 'AU', flag: '🇦🇺', name: '澳大利亚', keywords: ['澳大利亚', '澳洲', 'au', 'australia', 'sydney', 'melbourne', '悉尼', '墨尔本'] },
	{ code: 'NZ', flag: '🇳🇿', name: '新西兰', keywords: ['新西兰', '纽西兰', 'nz', 'new zealand', 'auckland', '奥克兰'] },
	{ code: 'MO', flag: '🇲🇴', name: '澳门', keywords: ['澳门', 'mo', 'macau', 'macao', '澳門'] },
	{ code: 'KH', flag: '🇰🇭', name: '柬埔寨', keywords: ['柬埔寨', 'kh', 'cambodia', '金边', 'phnom penh'] },
	{ code: 'BD', flag: '🇧🇩', name: '孟加拉国', keywords: ['孟加拉', 'bd', 'bangladesh', '达卡', 'dhaka'] },
	{ code: 'PK', flag: '🇵🇰', name: '巴基斯坦', keywords: ['巴基斯坦', 'pk', 'pakistan', '卡拉奇', 'karachi', '伊斯兰堡', 'islamabad'] },
	{ code: 'LK', flag: '🇱🇰', name: '斯里兰卡', keywords: ['斯里兰卡', 'lk', 'sri lanka', '科伦坡', 'colombo'] },
	{ code: 'NP', flag: '🇳🇵', name: '尼泊尔', keywords: ['尼泊尔', 'np', 'nepal', '加德满都', 'kathmandu'] },
	{ code: 'MM', flag: '🇲🇲', name: '缅甸', keywords: ['缅甸', 'mm', 'myanmar', 'burma', '仰光', 'yangon'] },
	{ code: 'MN', flag: '🇲🇳', name: '蒙古', keywords: ['蒙古', 'mn', 'mongolia', '乌兰巴托', 'ulaanbaatar'] },

	// 北美与拉美地区
	{ code: 'US', flag: '🇺🇸', name: '美国', keywords: ['美国', '美', 'us', 'usa', 'united states', 'america'] },
	{ code: 'CA', flag: '🇨🇦', name: '加拿大', keywords: ['加拿大', '加', 'ca', 'canada', 'toronto', 'vancouver', '多伦多', '温哥华'] },
	{ code: 'MX', flag: '🇲🇽', name: '墨西哥', keywords: ['墨西哥', 'mx', 'mexico', 'mexico city'] },
	{ code: 'BR', flag: '🇧🇷', name: '巴西', keywords: ['巴西', 'br', 'brazil', 'sao paulo', '圣保罗'] },
	{ code: 'AR', flag: '🇦🇷', name: '阿根廷', keywords: ['阿根廷', 'ar', 'argentina', 'buenos aires', '布宜诺斯艾利斯'] },
	{ code: 'CL', flag: '🇨🇱', name: '智利', keywords: ['智利', 'cl', 'chile', 'santiago', '圣地亚哥'] },
	{ code: 'CO', flag: '🇨🇴', name: '哥伦比亚', keywords: ['哥伦比亚', 'co', 'colombia', 'bogota', '波哥大'] },
	{ code: 'PE', flag: '🇵🇪', name: '秘鲁', keywords: ['秘鲁', 'pe', 'peru', 'lima', '利马'] },
	{ code: 'UY', flag: '🇺🇾', name: '乌拉圭', keywords: ['乌拉圭', 'uy', 'uruguay', 'montevideo', '蒙得维的亚'] },
	{ code: 'EC', flag: '🇪🇨', name: '厄瓜多尔', keywords: ['厄瓜多尔', 'ec', 'ecuador', 'quito', '基多'] },
	{ code: 'PA', flag: '🇵🇦', name: '巴拿马', keywords: ['巴拿马', 'pa', 'panama'] },
	{ code: 'CR', flag: '🇨🇷', name: '哥斯达黎加', keywords: ['哥斯达黎加', 'cr', 'costa rica'] },

	// 欧洲地区
	{ code: 'UK', flag: '🇬🇧', name: '英国', keywords: ['英国', '英', 'uk', 'gb', 'britain', 'london', '伦敦'] },
	{ code: 'DE', flag: '🇩🇪', name: '德国', keywords: ['德国', '德', 'de', 'germany', 'frankfurt', 'berlin', '法兰克福', '柏林'] },
	{ code: 'FR', flag: '🇫🇷', name: '法国', keywords: ['法国', '法', 'fr', 'france', 'paris', '巴黎'] },
	{ code: 'NL', flag: '🇳🇱', name: '荷兰', keywords: ['荷兰', 'nl', 'netherlands', 'amsterdam', '阿姆斯特丹'] },
	{ code: 'RU', flag: '🇷🇺', name: '俄罗斯', keywords: ['俄罗斯', '俄', 'ru', 'russia', 'moscow', '莫斯科', '圣彼得堡'] },
	{ code: 'UA', flag: '🇺🇦', name: '乌克兰', keywords: ['乌克兰', 'ua', 'ukraine', 'kyiv', 'kiev', '基辅'] },
	{ code: 'PL', flag: '🇵🇱', name: '波兰', keywords: ['波兰', 'pl', 'poland', 'warsaw', '华沙'] },
	{ code: 'IT', flag: '🇮🇹', name: '意大利', keywords: ['意大利', 'it', 'italy', 'milan', 'rome', '米兰', '罗马'] },
	{ code: 'ES', flag: '🇪🇸', name: '西班牙', keywords: ['西班牙', 'es', 'spain', 'madrid', 'barcelona', '马德里'] },
	{ code: 'CH', flag: '🇨🇭', name: '瑞士', keywords: ['瑞士', 'ch', 'switzerland', 'zurich', 'geneva', '苏黎世', '日内瓦'] },
	{ code: 'SE', flag: '🇸🇪', name: '瑞典', keywords: ['瑞典', 'se', 'sweden', 'stockholm', '斯德哥尔摩'] },
	{ code: 'NO', flag: '🇳🇴', name: '挪威', keywords: ['挪威', 'no', 'norway', 'oslo', '奥斯陆'] },
	{ code: 'FI', flag: '🇫🇮', name: '芬兰', keywords: ['芬兰', 'fi', 'finland', 'helsinki', '赫尔辛基'] },
	{ code: 'DK', flag: '🇩🇰', name: '丹麦', keywords: ['丹麦', 'dk', 'denmark', 'copenhagen', '哥本哈根'] },
	{ code: 'IE', flag: '🇮🇪', name: '爱尔兰', keywords: ['爱尔兰', 'ie', 'ireland', 'dublin', '都柏林'] },
	{ code: 'AT', flag: '🇦🇹', name: '奥地利', keywords: ['奥地利', 'at', 'austria', 'vienna', '维也纳'] },
	{ code: 'PT', flag: '🇵🇹', name: '葡萄牙', keywords: ['葡萄牙', 'pt', 'portugal', 'lisbon', '里斯本'] },
	{ code: 'BE', flag: '🇧🇪', name: '比利时', keywords: ['比利时', 'be', 'belgium', 'brussels', '布鲁塞尔'] },
	{ code: 'CZ', flag: '🇨🇿', name: '捷克', keywords: ['捷克', 'cz', 'czech', 'prague', '布拉格'] },
	{ code: 'RO', flag: '🇷🇴', name: '罗马尼亚', keywords: ['罗马尼亚', 'ro', 'romania', 'bucharest', '布加勒斯特'] },
	{ code: 'HU', flag: '🇭🇺', name: '匈牙利', keywords: ['匈牙利', 'hu', 'hungary', 'budapest', '布达佩斯'] },
	{ code: 'GR', flag: '🇬🇷', name: '希腊', keywords: ['希腊', 'gr', 'greece', 'athens', '雅典'] },
	{ code: 'BG', flag: '🇧🇬', name: '保加利亚', keywords: ['保加利亚', 'bg', 'bulgaria', 'sofia', '索菲亚'] },
	{ code: 'RS', flag: '🇷🇸', name: '塞尔维亚', keywords: ['塞尔维亚', 'rs', 'serbia', 'belgrade', '贝尔格莱德'] },
	{ code: 'IS', flag: '🇮🇸', name: '冰岛', keywords: ['冰岛', 'is', 'iceland', 'reykjavik'] },
	{ code: 'LU', flag: '🇱🇺', name: '卢森堡', keywords: ['卢森堡', 'lu', 'luxembourg'] },
	{ code: 'HR', flag: '🇭🇷', name: '克罗地亚', keywords: ['克罗地亚', 'hr', 'croatia', 'zagreb'] },
	{ code: 'SK', flag: '🇸🇰', name: '斯洛伐克', keywords: ['斯洛伐克', 'sk', 'slovakia', 'bratislava'] },
	{ code: 'EE', flag: '🇪🇪', name: '爱沙尼亚', keywords: ['爱沙尼亚', 'ee', 'estonia', 'tallinn'] },
	{ code: 'LV', flag: '🇱🇻', name: '拉脱维亚', keywords: ['拉脱维亚', 'lv', 'latvia', 'riga'] },
	{ code: 'LT', flag: '🇱🇹', name: '立陶宛', keywords: ['立陶宛', 'lt', 'lithuania', 'vilnius'] },
	{ code: 'MD', flag: '🇲🇩', name: '摩尔多瓦', keywords: ['摩尔多瓦', 'md', 'moldova', 'chisinau'] },
	{ code: 'GE', flag: '🇬🇪', name: '格鲁吉亚', keywords: ['格鲁吉亚', 'ge', 'georgia', 'tbilisi'] },
	{ code: 'AM', flag: '🇦🇲', name: '亚美尼亚', keywords: ['亚美尼亚', 'am', 'armenia', 'yerevan'] },
	{ code: 'AZ', flag: '🇦🇿', name: '阿塞拜疆', keywords: ['阿塞拜疆', 'az', 'azerbaijan', 'baku'] },
	{ code: 'KZ', flag: '🇰🇿', name: '哈萨克斯坦', keywords: ['哈萨克斯坦', 'kz', 'kazakhstan', 'almaty', 'astana', '阿拉木图'] },
	{ code: 'UZ', flag: '🇺🇿', name: '乌兹别克斯坦', keywords: ['乌兹别克斯坦', 'uz', 'uzbekistan', 'tashkent'] },
	{ code: 'CY', flag: '🇨🇾', name: '塞浦路斯', keywords: ['塞浦路斯', 'cy', 'cyprus', 'nicosia'] },

	// 中东与非洲地区
	{ code: 'NG', flag: '🇳🇬', name: '尼日利亚', keywords: ['尼日利亚', 'ng', 'nigeria', 'lagos', 'abuja', '拉各斯', '阿布贾'] },
	{ code: 'EG', flag: '🇪🇬', name: '埃及', keywords: ['埃及', 'eg', 'egypt', 'cairo', '开罗'] },
	{ code: 'ZA', flag: '🇿🇦', name: '南非', keywords: ['南非', 'za', 'south africa', 'johannesburg', 'cape town', '约翰内斯堡', '开普敦'] },
	{ code: 'AE', flag: '🇦🇪', name: '阿联酋', keywords: ['阿联酋', 'ae', 'uae', 'dubai', 'abu dhabi', '迪拜', '阿布扎比'] },
	{ code: 'SA', flag: '🇸🇦', name: '沙特阿拉伯', keywords: ['沙特阿拉伯', '沙特', 'sa', 'saudi arabia', 'riyadh', '利雅得'] },
	{ code: 'IL', flag: '🇮🇱', name: '以色列', keywords: ['以色列', 'il', 'israel', 'tel aviv', '特拉维夫'] },
	{ code: 'TR', flag: '🇹🇷', name: '土耳其', keywords: ['土耳其', 'tr', 'turkey', 'istanbul', '伊斯坦布尔'] },
	{ code: 'MA', flag: '🇲🇦', name: '摩洛哥', keywords: ['摩洛哥', 'ma', 'morocco', 'casablanca', '卡萨布兰卡'] },
	{ code: 'KE', flag: '🇰🇪', name: '肯尼亚', keywords: ['肯尼亚', 'ke', 'kenya', 'nairobi', '内罗毕'] },
	{ code: 'GH', flag: '🇬🇭', name: '加纳', keywords: ['加纳', 'gh', 'ghana', 'accra'] },
	{ code: 'DZ', flag: '🇩🇿', name: '阿尔及利亚', keywords: ['阿尔及利亚', 'dz', 'algeria', 'algiers'] },
	{ code: 'QA', flag: '🇶🇦', name: '卡塔尔', keywords: ['卡塔尔', 'qa', 'qatar', 'doha', '多哈'] },
	{ code: 'KW', flag: '🇰🇼', name: '科威特', keywords: ['科威特', 'kw', 'kuwait'] },
	{ code: 'OM', flag: '🇴🇲', name: '阿曼', keywords: ['阿曼', 'om', 'oman', 'muscat'] }
];

/**
 * Algorithmic fallback: generates Unicode Regional Indicator Flag from any 2-letter uppercase ISO code.
 */
function iso_to_flag_emoji(code) {
	if (type(code) != 'string' || length(code) != 2)
		return '';
	let u = uc(code);
	let c1 = ord(substr(u, 0, 1));
	let c2 = ord(substr(u, 1, 1));
	if (c1 >= 65 && c1 <= 90 && c2 >= 65 && c2 <= 90)
		return sprintf("\xf0\x9f\x87%c\xf0\x9f\x87%c", 166 + (c1 - 65), 166 + (c2 - 65));
	return '';
}

/**
 * Looks up country metadata (flag, name, keywords) by country code.
 */
function get_country_info(code) {
	if (type(code) != 'string' || code == '')
		return null;
	let upper = uc(code);
	for (let item in COUNTRY_FLAGS) {
		if (item.code == upper)
			return item;
	}
	let dynamic_flag = iso_to_flag_emoji(upper);
	if (dynamic_flag != '') {
		return {
			code: upper,
			flag: dynamic_flag,
			name: upper,
			keywords: [ upper ]
		};
	}
	return null;
}

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
	remove_flag_from_name,
	iso_to_flag_emoji,
	get_country_info
};
