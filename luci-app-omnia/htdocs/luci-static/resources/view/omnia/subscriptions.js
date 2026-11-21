'use strict';
'require view';
'require rpc';
'require omnia.time as omniaTime';
'require omnia.ui as omniaUi';
'require omnia.motion as omniaMotion';

const callSubscriptionsGet = rpc.declare({
	object: 'omnia',
	method: 'subscriptions_get',
	expect: { '': {} }
});

const callSubscriptionsSave = rpc.declare({
	object: 'omnia',
	method: 'subscriptions_save',
	params: [ 'content' ],
	expect: { '': {} }
});

const callGenerate = rpc.declare({
	object: 'omnia',
	method: 'config_generate',
	expect: { '': {} }
});

const callCheck = rpc.declare({
	object: 'omnia',
	method: 'config_check_candidate',
	expect: { '': {} }
});

const callApply = rpc.declare({
	object: 'omnia',
	method: 'config_apply',
	expect: { '': {} }
});

function applyToRuntimeContextual(btn) {
	if (btn) {
		btn.disabled = true;
		btn.innerText = _('⚡ 正在生成...');
	}
	setStatus(_('【1/3 生成配置】正在根据当前订阅与模板生成候选配置...'), true);

	return callGenerate().then(function(genRes) {
		if (!(genRes && genRes.ok)) {
			let detail = genRes && (genRes.detail || genRes.message) || _('生成配置失败');
			let errEl = E('div', { 'style': 'font-size: 13px; line-height: 1.5;' }, [
				E('div', { 'style': 'font-weight: 700; color: #dc2626;' }, '❌ ' + _('第 1 阶段失败：候选配置生成失败')),
				E('div', { 'style': 'background: rgba(0,0,0,0.06); padding: .4rem .6rem; border-radius: 4px; font-family: monospace; font-size: 12px; margin: .3rem 0;' }, detail),
				E('div', { 'style': 'font-size: 12px;' }, _('当前运行中的网络配置保持不变。'))
			]);
			setStatus(errEl, false);
			return;
		}

		let genData = omniaUi.dataOf(genRes) || {};
		let nodeCount = genData.node_count || 0;
		let groupCount = genData.generated_groups || 0;

		if (btn) btn.innerText = _('⚡ 正在校验...');
		setStatus(_('【2/3 内核校验】sing-box 正在校验生成配置语法...'), true);

		return callCheck().then(function(checkRes) {
			if (!(checkRes && checkRes.ok)) {
				let detail = checkRes && (checkRes.detail || checkRes.message) || _('语法校验未通过');
				let errEl = E('div', { 'style': 'font-size: 13px; line-height: 1.5;' }, [
					E('div', { 'style': 'font-weight: 700; color: #dc2626;' }, '❌ ' + _('第 2 阶段失败：sing-box 校验未通过')),
					E('div', { 'style': 'background: rgba(0,0,0,0.06); padding: .4rem .6rem; border-radius: 4px; font-family: monospace; font-size: 12px; margin: .3rem 0;' }, detail),
					E('div', { 'style': 'font-size: 12px;' }, _('当前运行配置保持不变。请根据报错排查。'))
				]);
				setStatus(errEl, false);
				return;
			}

			if (btn) btn.innerText = _('⚡ 正在应用...');
			setStatus(_('【3/3 应用配置】正在重载 sing-box 运行时...'), true);

			return callApply().then(function(applyRes) {
				if (!(applyRes && applyRes.ok)) {
					let detail = applyRes && (applyRes.detail || applyRes.message) || _('应用失败');
					let errEl = E('div', { 'style': 'font-size: 13px; line-height: 1.5;' }, [
						E('div', { 'style': 'font-weight: 700; color: #dc2626;' }, '❌ ' + _('第 3 阶段失败：应用配置失败（已自动回滚）')),
						E('div', { 'style': 'background: rgba(0,0,0,0.06); padding: .4rem .6rem; border-radius: 4px; font-family: monospace; font-size: 12px; margin: .3rem 0;' }, detail)
					]);
					setStatus(errEl, false);
					return;
				}

				let successMsg = E('div', { 'style': 'font-size: 13px; line-height: 1.5;' }, [
					E('div', { 'style': 'font-weight: 700; font-size: 14px; margin-bottom: .25rem;' }, '✓ ' + _('已成功应用到运行时！')),
					E('div', { 'style': 'font-size: 12px; color: #15803d;' }, _('已加载 %d 个出站节点、%d 个策略组，sing-box 运行正常。').format(nodeCount, groupCount))
				]);
				setStatus(successMsg, true);
			});
		});
	}).catch(function(err) {
		setStatus(err.message || String(err), false);
	}).finally(function() {
		if (btn) {
			btn.disabled = false;
			btn.innerText = _('⚡ 立即生成并应用到运行时');
		}
	});
}

const callSubscriptionRefreshSourceStart = rpc.declare({
	object: 'omnia',
	method: 'subscription_refresh_source_start',
	params: [ 'source_id', 'strategy' ],
	expect: { '': {} }
});

const callSubscriptionsRefreshStatus = rpc.declare({
	object: 'omnia',
	method: 'subscriptions_refresh_status',
	params: [ 'run_id' ],
	expect: { '': {} }
});

const callSubscriptionsRefreshStart = rpc.declare({
	object: 'omnia',
	method: 'subscriptions_refresh_start',
	params: [ 'strategy' ],
	expect: { '': {} }
});

const callNodeSnapshotSummary = rpc.declare({
	object: 'omnia',
	method: 'node_snapshot_summary',
	expect: { '': {} }
});

const callSubscriptionTestSource = rpc.declare({
	object: 'omnia',
	method: 'subscription_test_source',
	params: [ 'name', 'url', 'strategy', 'type', 'user_agent', 'payload', 'nodes', 'operators' ],
	expect: { '': {} }
});

const callNodeSnapshotGet = rpc.declare({
	object: 'omnia',
	method: 'node_snapshot_get',
	expect: { '': {} }
});

const callSubscriptionSourcePreview = rpc.declare({
	object: 'omnia',
	method: 'subscription_source_preview',
	params: [ 'source_id', 'strategy', 'source' ],
	expect: { '': {} }
});

const DEFAULT_REGION_KEYWORDS = {
	HK: [ 'HK', 'Hong Kong', 'HongKong', '香港' ],
	TW: [ 'TW', 'Taiwan', '台湾', '台灣' ],
	SG: [ 'SG', 'Singapore', '新加坡', '狮城', '獅城' ],
	JP: [ 'JP', 'Japan', '日本' ],
	US: [ 'US', 'USA', 'United States', '美国', '美國' ]
};
const DEFAULT_REGION_KEYS = [ 'HK', 'TW', 'SG', 'JP', 'US' ];

const KNOWN_COUNTRIES = {
	// 亚太地区
	HK: { name: '香港', flag: '🇭🇰', keywords: [ 'HK', 'Hong Kong', 'HongKong', '香港' ] },
	TW: { name: '台湾', flag: '🇹🇼', keywords: [ 'TW', 'Taiwan', '台湾', '台灣' ] },
	SG: { name: '新加坡', flag: '🇸🇬', keywords: [ 'SG', 'Singapore', '新加坡', '狮城', '獅城' ] },
	JP: { name: '日本', flag: '🇯🇵', keywords: [ 'JP', 'Japan', '日本', '东京', '大阪' ] },
	KR: { name: '韩国', flag: '🇰🇷', keywords: [ 'KR', 'Korea', '韩国', '首尔' ] },
	IN: { name: '印度', flag: '🇮🇳', keywords: [ 'IN', 'India', '印度', '孟买' ] },
	MY: { name: '马来西亚', flag: '🇲🇾', keywords: [ 'MY', 'Malaysia', '马来西亚', '吉隆坡' ] },
	TH: { name: '泰国', flag: '🇹🇭', keywords: [ 'TH', 'Thailand', '泰国', '曼谷' ] },
	VN: { name: '越南', flag: '🇻🇳', keywords: [ 'VN', 'Vietnam', '越南', '河内', '胡志明' ] },
	PH: { name: '菲律宾', flag: '🇵🇭', keywords: [ 'PH', 'Philippines', '菲律宾', '马尼拉' ] },
	ID: { name: '印度尼西亚', flag: '🇮🇩', keywords: [ 'ID', 'Indonesia', '印度尼西亚', '印尼', '雅加达' ] },
	AU: { name: '澳大利亚', flag: '🇦🇺', keywords: [ 'AU', 'Australia', '澳大利亚', '悉尼', '墨尔本' ] },
	NZ: { name: '新西兰', flag: '🇳🇿', keywords: [ 'NZ', 'New Zealand', '新西兰', '奥克兰' ] },
	MO: { name: '澳门', flag: '🇲🇴', keywords: [ 'MO', 'Macau', '澳门', '澳門' ] },
	KH: { name: '柬埔寨', flag: '🇰🇭', keywords: [ 'KH', 'Cambodia', '柬埔寨', '金边' ] },
	BD: { name: '孟加拉国', flag: '🇧🇩', keywords: [ 'BD', 'Bangladesh', '孟加拉', '达卡' ] },
	PK: { name: '巴基斯坦', flag: '🇵🇰', keywords: [ 'PK', 'Pakistan', '巴基斯坦', '卡拉奇', '伊斯兰堡' ] },
	LK: { name: '斯里兰卡', flag: '🇱🇰', keywords: [ 'LK', 'Sri Lanka', '斯里兰卡', '科伦坡' ] },
	NP: { name: '尼泊尔', flag: '🇳🇵', keywords: [ 'NP', 'Nepal', '尼泊尔', '加德满都' ] },
	MM: { name: '缅甸', flag: '🇲🇲', keywords: [ 'MM', 'Myanmar', '缅甸', '仰光' ] },
	MN: { name: '蒙古', flag: '🇲🇳', keywords: [ 'MN', 'Mongolia', '蒙古', '乌兰巴托' ] },

	// 美洲地区
	US: { name: '美国', flag: '🇺🇸', keywords: [ 'US', 'USA', 'United States', '美国', '美國' ] },
	CA: { name: '加拿大', flag: '🇨🇦', keywords: [ 'CA', 'Canada', '加拿大', '多伦多', '温哥华' ] },
	MX: { name: '墨西哥', flag: '🇲🇽', keywords: [ 'MX', 'Mexico', '墨西哥' ] },
	BR: { name: '巴西', flag: '🇧🇷', keywords: [ 'BR', 'Brazil', '巴西', '圣保罗' ] },
	AR: { name: '阿根廷', flag: '🇦🇷', keywords: [ 'AR', 'Argentina', '阿根廷', '布宜诺斯艾利斯' ] },
	CL: { name: '智利', flag: '🇨🇱', keywords: [ 'CL', 'Chile', '智利', '圣地亚哥' ] },
	CO: { name: '哥伦比亚', flag: '🇨🇴', keywords: [ 'CO', 'Colombia', '哥伦比亚', '波哥大' ] },
	PE: { name: '秘鲁', flag: '🇵🇪', keywords: [ 'PE', 'Peru', '秘鲁', '利马' ] },
	UY: { name: '乌拉圭', flag: '🇺🇾', keywords: [ 'UY', 'Uruguay', '乌拉圭' ] },
	EC: { name: '厄瓜多尔', flag: '🇪🇨', keywords: [ 'EC', 'Ecuador', '厄瓜多尔' ] },
	PA: { name: '巴拿马', flag: '🇵🇦', keywords: [ 'PA', 'Panama', '巴拿马' ] },
	CR: { name: '哥斯达黎加', flag: '🇨🇷', keywords: [ 'CR', 'Costa Rica', '哥斯达黎加' ] },

	// 欧洲地区
	UK: { name: '英国', flag: '🇬🇧', keywords: [ 'UK', 'GB', 'Britain', 'United Kingdom', '英国', '伦敦' ] },
	GB: { name: '英国', flag: '🇬🇧', keywords: [ 'GB', 'UK', 'Britain', 'United Kingdom', '英国', '伦敦' ] },
	DE: { name: '德国', flag: '🇩🇪', keywords: [ 'DE', 'Germany', '德国', '法兰克福', '柏林' ] },
	FR: { name: '法国', flag: '🇫🇷', keywords: [ 'FR', 'France', '法国', '巴黎' ] },
	NL: { name: '荷兰', flag: '🇳🇱', keywords: [ 'NL', 'Netherlands', '荷兰', '阿姆斯特丹' ] },
	RU: { name: '俄罗斯', flag: '🇷🇺', keywords: [ 'RU', 'Russia', '俄罗斯', '莫斯科', '圣彼得堡' ] },
	UA: { name: '乌克兰', flag: '🇺🇦', keywords: [ 'UA', 'Ukraine', '乌克兰', '基辅' ] },
	PL: { name: '波兰', flag: '🇵🇱', keywords: [ 'PL', 'Poland', '波兰', '华沙' ] },
	IT: { name: '意大利', flag: '🇮🇹', keywords: [ 'IT', 'Italy', '意大利', '米兰', '罗马' ] },
	ES: { name: '西班牙', flag: '🇪🇸', keywords: [ 'ES', 'Spain', '西班牙', '马德里' ] },
	CH: { name: '瑞士', flag: '🇨🇭', keywords: [ 'CH', 'Switzerland', '瑞士', '苏黎世', '日内瓦' ] },
	SE: { name: '瑞典', flag: '🇸🇪', keywords: [ 'SE', 'Sweden', '瑞典', '斯德哥尔摩' ] },
	NO: { name: '挪威', flag: '🇳🇴', keywords: [ 'NO', 'Norway', '挪威', '奥斯陆' ] },
	FI: { name: '芬兰', flag: '🇫🇮', keywords: [ 'FI', 'Finland', '芬兰', '赫尔辛基' ] },
	DK: { name: '丹麦', flag: '🇩🇰', keywords: [ 'DK', 'Denmark', '丹麦', '哥本哈根' ] },
	IE: { name: '爱尔兰', flag: '🇮🇪', keywords: [ 'IE', 'Ireland', '爱尔兰', '都柏林' ] },
	AT: { name: '奥地利', flag: '🇦🇹', keywords: [ 'AT', 'Austria', '奥地利', '维也纳' ] },
	PT: { name: '葡萄牙', flag: '🇵🇹', keywords: [ 'PT', 'Portugal', '葡萄牙', '里斯本' ] },
	BE: { name: '比利时', flag: '🇧🇪', keywords: [ 'BE', 'Belgium', '比利时', '布鲁塞尔' ] },
	CZ: { name: '捷克', flag: '🇨🇿', keywords: [ 'CZ', 'Czech', '捷克', '布拉格' ] },
	RO: { name: '罗马尼亚', flag: '🇷🇴', keywords: [ 'RO', 'Romania', '罗马尼亚', '布加勒斯特' ] },
	HU: { name: '匈牙利', flag: '🇭🇺', keywords: [ 'HU', 'Hungary', '匈牙利', '布达佩斯' ] },
	GR: { name: '希腊', flag: '🇬🇷', keywords: [ 'GR', 'Greece', '希腊', '雅典' ] },
	BG: { name: '保加利亚', flag: '🇧🇬', keywords: [ 'BG', 'Bulgaria', '保加利亚', '索菲亚' ] },
	RS: { name: '塞尔维亚', flag: '🇷🇸', keywords: [ 'RS', 'Serbia', '塞尔维亚', '贝尔格莱德' ] },
	IS: { name: '冰岛', flag: '🇮🇸', keywords: [ 'IS', 'Iceland', '冰岛' ] },
	LU: { name: '卢森堡', flag: '🇱🇺', keywords: [ 'LU', 'Luxembourg', '卢森堡' ] },
	HR: { name: '克罗地亚', flag: '🇭🇷', keywords: [ 'HR', 'Croatia', '克罗地亚' ] },
	SK: { name: '斯洛伐克', flag: '🇸🇰', keywords: [ 'SK', 'Slovakia', '斯洛伐克' ] },
	EE: { name: '爱沙尼亚', flag: '🇪🇪', keywords: [ 'EE', 'Estonia', '爱沙尼亚' ] },
	LV: { name: '拉脱维亚', flag: '🇱🇻', keywords: [ 'LV', 'Latvia', '拉脱维亚' ] },
	LT: { name: '立陶宛', flag: '🇱🇹', keywords: [ 'LT', 'Lithuania', '立陶宛' ] },
	MD: { name: '摩尔多瓦', flag: '🇲🇩', keywords: [ 'MD', 'Moldova', '摩尔多瓦' ] },
	GE: { name: '格鲁吉亚', flag: '🇬🇪', keywords: [ 'GE', 'Georgia', '格鲁吉亚' ] },
	AM: { name: '亚美尼亚', flag: '🇦🇲', keywords: [ 'AM', 'Armenia', '亚美尼亚' ] },
	AZ: { name: '阿塞拜疆', flag: '🇦🇿', keywords: [ 'AZ', 'Azerbaijan', '阿塞拜疆' ] },
	KZ: { name: '哈萨克斯坦', flag: '🇰🇿', keywords: [ 'KZ', 'Kazakhstan', '哈萨克斯坦', '阿拉木图' ] },
	UZ: { name: '乌兹别克斯坦', flag: 'UZ', flag: '🇺🇿', keywords: [ 'UZ', 'Uzbekistan', '乌兹别克斯坦' ] },
	CY: { name: '塞浦路斯', flag: '🇨🇾', keywords: [ 'CY', 'Cyprus', '塞浦路斯' ] },

	// 非洲与中东
	NG: { name: '尼日利亚', flag: '🇳🇬', keywords: [ 'NG', 'Nigeria', '尼日利亚', '拉各斯', '阿布贾' ] },
	EG: { name: '埃及', flag: '🇪🇬', keywords: [ 'EG', 'Egypt', '埃及', '开罗' ] },
	ZA: { name: '南非', flag: '🇿🇦', keywords: [ 'ZA', 'South Africa', '南非', '约翰内斯堡', '开普敦' ] },
	AE: { name: '阿联酋', flag: '🇦🇪', keywords: [ 'AE', 'UAE', '阿联酋', '迪拜', '阿布扎比' ] },
	SA: { name: '沙特阿拉伯', flag: '🇸🇦', keywords: [ 'SA', 'Saudi Arabia', '沙特阿拉伯', '沙特', '利雅得' ] },
	IL: { name: '以色列', flag: '🇮🇱', keywords: [ 'IL', 'Israel', '以色列', '特拉维夫' ] },
	TR: { name: '土耳其', flag: '🇹🇷', keywords: [ 'TR', 'Turkey', '土耳其', '伊斯坦布尔' ] },
	MA: { name: '摩洛哥', flag: '🇲🇦', keywords: [ 'MA', 'Morocco', '摩洛哥', '卡萨布兰卡' ] },
	KE: { name: '肯尼亚', flag: '🇰🇪', keywords: [ 'KE', 'Kenya', '肯尼亚', '内罗毕' ] },
	GH: { name: '加纳', flag: '🇬🇭', keywords: [ 'GH', 'Ghana', '加纳' ] },
	DZ: { name: '阿尔及利亚', flag: '🇩🇿', keywords: [ 'DZ', 'Algeria', '阿尔及利亚' ] },
	QA: { name: '卡塔尔', flag: '🇶🇦', keywords: [ 'QA', 'Qatar', '卡塔尔', '多哈' ] },
	KW: { name: '科威特', flag: '🇰🇼', keywords: [ 'KW', 'Kuwait', '科威特' ] },
	OM: { name: '阿曼', flag: '🇴🇲', keywords: [ 'OM', 'Oman', '阿曼' ] }
};

function isoToFlagEmoji(code) {
	if (typeof code !== 'string' || code.length !== 2)
		return '';
	let u = code.toUpperCase();
	let c1 = u.charCodeAt(0);
	let c2 = u.charCodeAt(1);
	if (c1 >= 65 && c1 <= 90 && c2 >= 65 && c2 <= 90) {
		return String.fromCodePoint(0x1F1E6 + (c1 - 65), 0x1F1E6 + (c2 - 65));
	}
	return '';
}

function getCountryMetadata(code) {
	if (!code || typeof code !== 'string')
		return { code: '', flag: '', name: '', keywords: [] };
	let u = code.trim().toUpperCase();
	if (KNOWN_COUNTRIES[u]) {
		let item = KNOWN_COUNTRIES[u];
		return {
			code: u,
			flag: item.flag || isoToFlagEmoji(u),
			name: item.name || u,
			keywords: item.keywords ? item.keywords.slice() : [ u ]
		};
	}
	let flag = isoToFlagEmoji(u);
	return {
		code: u,
		flag: flag || '🌐',
		name: u,
		keywords: [ u ]
	};
}

const DEFAULT_BANNED_KEYWORDS = 'expire|expired|traffic|invalid|remaining|过期|到期|失效|无效|剩余|流量|重置|订阅|套餐|官网|用量';
const DEFAULT_URLTEST_PARAMS = {
	url: 'https://www.gstatic.com/generate_204',
	interval: '3m',
	tolerance: 150
};
const DEFAULT_DNS_URLTEST = {
	enabled: false,
	keywords: [ 'HK', 'Hong Kong', 'HongKong', '香港' ],
	url: 'https://www.gstatic.com/generate_204',
	interval: '3m',
	tolerance: 150
};
const DEFAULT_RATE_FILTER = {
	enabled: true,
	threshold: 1.5,
	operator: '>=',
	scope: 'matched_regions',
	matched_regions: [ 'HK', 'TW', 'SG', 'JP', 'US' ],
	unmatched_action: 'keep',
	matched_high_rate_action: 'drop',
	patterns: [ 'number_x' ],
	include_integer_one: false
};

const DEFAULT_SUBSCRIPTION_UPDATE = {
	auto_update: false,
	update_hour: 3,
	strategy: 'saved',
	run_on_boot: false
};

function cloneArray(values) {
	return Array.isArray(values) ? values.slice() : [];
}

function appendUnique(values, value) {
	if (typeof value !== 'string' || value === '')
		return;
	if (values.indexOf(value) < 0)
		values.push(value);
}

function mergeKeywordList(defaults, values) {
	let merged = cloneArray(defaults);
	(Array.isArray(values) ? values : []).forEach(function(value) {
		appendUnique(merged, value);
	});
	return merged;
}

function mergePipeText(defaults, value) {
	let merged = [];
	(defaults || '').split('|').forEach(function(item) {
		appendUnique(merged, item);
	});
	(value || '').split('|').forEach(function(item) {
		appendUnique(merged, item);
	});
	return merged.join('|');
}

function normalizeUrltestUrl(value) {
	let url = typeof value === 'string' && value !== '' ? value : DEFAULT_URLTEST_PARAMS.url;
	if (url.indexOf('://x.test/') >= 0 || url === 'http://x.test' || url === 'https://x.test')
		return DEFAULT_URLTEST_PARAMS.url;
	return url;
}

function regionKeys(policy) {
	if (!policy || !policy.region_keywords || typeof policy.region_keywords !== 'object' || Array.isArray(policy.region_keywords))
		return DEFAULT_REGION_KEYS.slice();
	return Object.keys(policy.region_keywords);
}

function normalizeStringChoice(value, choices, fallback) {
	return choices.indexOf(value) >= 0 ? value : fallback;
}

function normalizeRateFilter(raw, keys) {
	raw = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
	keys = Array.isArray(keys) ? keys : DEFAULT_REGION_KEYS;

	let threshold = raw.threshold != null ? Number(raw.threshold) : DEFAULT_RATE_FILTER.threshold;
	if (!Number.isFinite(threshold) || threshold < 0)
		threshold = DEFAULT_RATE_FILTER.threshold;

	let matchedRegions = Array.isArray(raw.matched_regions) ? raw.matched_regions.filter(function(region) {
		return keys.indexOf(region) >= 0;
	}) : keys.slice();

	let patterns = Array.isArray(raw.patterns) ? raw.patterns.filter(function(pattern) {
		return [ 'number_x', 'number_times_cn' ].indexOf(pattern) >= 0;
	}) : DEFAULT_RATE_FILTER.patterns.slice();

	return {
		enabled: raw.enabled === false ? false : true,
		threshold: threshold,
		operator: normalizeStringChoice(raw.operator, [ '>=', '>' ], DEFAULT_RATE_FILTER.operator),
		scope: normalizeStringChoice(raw.scope, [ 'matched_regions', 'all', 'none' ], DEFAULT_RATE_FILTER.scope),
		matched_regions: matchedRegions,
		unmatched_action: normalizeStringChoice(raw.unmatched_action, [ 'keep', 'drop' ], DEFAULT_RATE_FILTER.unmatched_action),
		matched_high_rate_action: normalizeStringChoice(raw.matched_high_rate_action, [ 'drop', 'raw' ], DEFAULT_RATE_FILTER.matched_high_rate_action),
		patterns: patterns,
		include_integer_one: raw.include_integer_one === true
	};
}

function normalizePolicy(raw) {
	let policy = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
	let regionKeywords = {};
	let hasExplicitKeywords = policy.region_keywords && typeof policy.region_keywords === 'object' && !Array.isArray(policy.region_keywords);
	let inputKeywords = hasExplicitKeywords ? policy.region_keywords : DEFAULT_REGION_KEYWORDS;

	let keys = Object.keys(inputKeywords);
	keys.forEach(function(region) {
		let values = Array.isArray(inputKeywords[region]) ? inputKeywords[region] : [];
		values = values.filter(function(value) {
			return typeof value === 'string' && value.trim() !== '';
		}).map(function(value) {
			return value.trim();
		});
		regionKeywords[region] = cloneArray(values);
	});

	let rKeys = Object.keys(regionKeywords);
	let sources = Array.isArray(policy.sources) ? policy.sources.map(function(source) {
		source = source || {};
		let allowed = Array.isArray(source.allowed_regions) ? cloneArray(source.allowed_regions).filter(function(region) {
			return rKeys.indexOf(region) >= 0;
		}) : rKeys.slice();
		let norm = {
			id: source.id || '',
			name: source.name || '',
			type: source.type === 'local' ? 'local' : 'remote',
			url: source.url || '',
			enabled: source.enabled === false ? false : true,
			allowed_regions: allowed
		};
		if (source.type === 'local') {
			if (source.subtype) norm.subtype = source.subtype;
			if (source.payload != null) norm.payload = source.payload;
			if (Array.isArray(source.nodes)) norm.nodes = source.nodes;
		}
		if (source.user_agent) norm.user_agent = source.user_agent;
		if (Array.isArray(source.operators)) norm.operators = source.operators;
		if (source.dns && typeof source.dns === 'object') norm.dns = source.dns;
		if (source.userinfo && typeof source.userinfo === 'object') norm.userinfo = source.userinfo;
		return norm;
	}) : [];

	return {
		schema_version: 1,
		refresh_strategy: policy.refresh_strategy === 'proxy' ? 'proxy' : 'direct',
		region_keywords: regionKeywords,
		manual_selector: {
			keywords: policy.manual_selector && Array.isArray(policy.manual_selector.keywords) ? policy.manual_selector.keywords.filter(function(value) {
				return typeof value === 'string' && value !== '';
			}) : []
		},
		banned_keywords: mergePipeText(DEFAULT_BANNED_KEYWORDS, policy.banned_keywords),
		urltest_params: {
			url: normalizeUrltestUrl(policy.urltest_params && policy.urltest_params.url),
			interval: policy.urltest_params && policy.urltest_params.interval || DEFAULT_URLTEST_PARAMS.interval,
			tolerance: policy.urltest_params && policy.urltest_params.tolerance != null ? Number(policy.urltest_params.tolerance) : DEFAULT_URLTEST_PARAMS.tolerance
		},
		dns_urltest: {
			enabled: policy.dns_urltest && policy.dns_urltest.enabled === true,
			keywords: policy.dns_urltest && Array.isArray(policy.dns_urltest.keywords) ? policy.dns_urltest.keywords.filter(function(value) {
				return typeof value === 'string' && value !== '';
			}) : DEFAULT_DNS_URLTEST.keywords.slice(),
			url: normalizeUrltestUrl(policy.dns_urltest && policy.dns_urltest.url),
			interval: policy.dns_urltest && policy.dns_urltest.interval || DEFAULT_DNS_URLTEST.interval,
			tolerance: policy.dns_urltest && policy.dns_urltest.tolerance != null ? Number(policy.dns_urltest.tolerance) : DEFAULT_DNS_URLTEST.tolerance
		},
		rate_filter: normalizeRateFilter(policy.rate_filter, rKeys),
		subscription_update: normalizeSubscriptionUpdate(policy.subscription_update),
		sources: sources
	};
}

function normalizeSubscriptionUpdate(raw) {
	raw = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
	let strategy = [ 'saved', 'direct', 'proxy' ].indexOf(raw.strategy) >= 0 ? raw.strategy : DEFAULT_SUBSCRIPTION_UPDATE.strategy;
	let updateHour = raw.update_hour != null ? Number(raw.update_hour) : DEFAULT_SUBSCRIPTION_UPDATE.update_hour;

	if (!Number.isFinite(updateHour) || updateHour < 0 || updateHour > 23)
		updateHour = DEFAULT_SUBSCRIPTION_UPDATE.update_hour;

	return {
		auto_update: raw.auto_update === true,
		update_hour: updateHour,
		strategy: strategy,
		run_on_boot: raw.run_on_boot === true
	};
}

function parseSubscriptions(content) {
	try {
		return normalizePolicy(JSON.parse(content || '{}'));
	} catch (e) {
		return normalizePolicy({});
	}
}

function getValue(id) {
	let el = document.getElementById(id);
	return el ? el.value : '';
}

function setValue(id, value) {
	let el = document.getElementById(id);
	if (el)
		el.value = value || '';
}

function checked(id) {
	let el = document.getElementById(id);
	if (!el) return false;
	if (typeof el.checked === 'boolean')
		return el.checked;
	let attr = el.getAttribute ? el.getAttribute('checked') : null;
	return attr === 'checked' || attr === 'true';
}

function activeRefresh() {
	return window.omniaSubscriptionRefresh && typeof window.omniaSubscriptionRefresh === 'object' ? window.omniaSubscriptionRefresh : null;
}

function refreshStatusDone(status) {
	return [ 'success', 'partial', 'failed_preserved', 'failed_no_snapshot', 'failed' ].indexOf(status || '') >= 0;
}

function refreshInProgress() {
	let refresh = activeRefresh();
	return !!(refresh && refresh.run_id && !refreshStatusDone(refresh.task && refresh.task.status));
}

function updateRefreshControls() {
	let disabled = refreshInProgress();
	let button = document.getElementById('omnia-refresh-all');
	if (button)
		button.disabled = disabled;
}

function setActiveRefresh(refresh) {
	window.omniaSubscriptionRefresh = refresh || null;
	updateRefreshControls();
}

function setStatus(message, ok, refreshRunId) {
	let refresh = activeRefresh();
	if (refreshInProgress() && refreshRunId !== refresh.run_id)
		return;
	omniaUi.paintStatus('omnia-subscriptions-status', message || '', ok ? 'ok' : 'error');
}

function setRefreshStatus(message, ok) {
	let refresh = activeRefresh();
	setStatus(message, ok, refresh && refresh.run_id || '');
}

function taskMetaOf(result) {
	const data = result && result.ok && result.data ? result.data : {};
	return data.task_meta && typeof data.task_meta === 'object' ? data.task_meta : {};
}

function taskDisplayName(result, fallback) {
	const meta = taskMetaOf(result);
	return meta.display_name || fallback || _('后台任务');
}

function setTestReport(target, result) {
	let node = document.getElementById(target);
	if (!node)
		return;

	let ok = result && result.ok;
	let pending = result && result.pending;
	let data = result && result.data ? result.data : {};
	let detail = result && (result.detail || result.message || result.code) || '';
	let nodes = data.nodes && Array.isArray(data.nodes) ? data.nodes : [];
	let bypassText = '';

	node.style.display = 'block';
	node.style.borderColor = pending ? '#bfdbfe' : ok ? '#bbf7d0' : '#fecaca';
	node.style.background = pending ? '#eff6ff' : ok ? '#f0fdf4' : '#fef2f2';
	node.style.color = pending ? '#1d4ed8' : ok ? '#166534' : '#991b1b';
	node.textContent = pending
		? _('正在测试订阅源...')
		: ok
		? _('测试通过：%d 个节点。').format(data.node_count || 0) + bypassText + (nodes.length ? ' ' + nodes.slice(0, 3).map(function(item) { return item.tag || '-'; }).join(' / ') : '')
		: _('测试失败：') + subscriptionFailureHint(detail);
}

function subscriptionFailureHint(detail) {
	detail = detail || '';
	if (detail.indexOf('tun_captures_lan_substore') >= 0 || detail.indexOf('tun_captures_lan') >= 0)
		return _('Runtime TUN 可能接管了这次局域网请求。请先停止运行时、使用代理刷新，或配置局域网绕行。') + ' ' + detail;
	return detail || _('无详细信息');
}

function testSource(name, url, strategy, target, extra) {
	setTestReport(target, { pending: true });
	extra = extra || {};
	let sourceType = extra.type || 'remote';
	let userAgent = extra.user_agent || '';
	let payload = extra.payload || '';
	let nodes = extra.nodes || [];
	let operators = extra.operators || [];
	return callSubscriptionTestSource(name || '', url || '', strategy || 'direct', sourceType, userAgent, payload, nodes, operators).then(function(result) {
		setTestReport(target, result);
		return result;
	}).catch(function(error) {
		setTestReport(target, { ok: false, detail: error.message || String(error) });
	});
}

function setDraft(policy) {
	policy = normalizePolicy(policy);
	window.omniaSubscriptionsDraft = policy;
}

function draftPolicy() {
	return normalizePolicy(window.omniaSubscriptionsDraft || {});
}

function shortUrl(url) {
	url = url || '';
	try {
		let parsed = new URL(url);
		return parsed.host + parsed.pathname;
	} catch (e) {
		return url || '-';
	}
}

function sourceStatusMap(summary) {
	let map = {};
	let sources = summary && Array.isArray(summary.sources) ? summary.sources : [];
	sources.forEach(function(source) {
		map[source.name || ''] = source;
	});
	return map;
}

function refreshResultForSource(source) {
	let refresh = activeRefresh();
	if (!refresh || !refresh.task)
		return null;

	let task = refresh.task;
	let meta = task.meta && typeof task.meta === 'object' ? task.meta : {};
	let results = Array.isArray(meta.source_results) ? meta.source_results : [];
	for (let i = 0; i < results.length; i++) {
		if (results[i] && results[i].id === source.id)
			return results[i];
	}

	if (!refreshStatusDone(task.status) && ((meta.source_id && meta.source_id === source.id) || task.current_item === source.name))
		return { status: 'running', node_count: 0, error: '' };
	return null;
}

function refreshResultText(result) {
	if (!result)
		return '';
	if (result.status === 'running')
		return _('正在刷新...');
	if (result.ok) {
		let refresh = activeRefresh(), taskStatus = refresh && refresh.task ? refresh.task.status : '';
		if (taskStatus === 'failed')
			return _('已获取 %d 个节点，但快照未保存。').format(result.node_count || 0);
		if (!refreshStatusDone(taskStatus))
			return _('已获取 %d 个节点，正在保存快照...').format(result.node_count || 0);
		return _('刷新完成：%d 个节点。').format(result.node_count || 0);
	}
	return _('刷新失败，已保留 %d 个节点。').format(result.node_count || 0);
}

function formatTrafficBytes(bytes) {
	if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	let u = 0;
	let val = Number(bytes);
	while (val >= 1024 && u < units.length - 1) {
		val /= 1024;
		u++;
	}
	return (u === 0 ? val : val.toFixed(2)) + ' ' + units[u];
}

function formatTrafficExpire(timestamp) {
	if (!timestamp || isNaN(timestamp) || timestamp <= 0) return '';
	let d = new Date(Number(timestamp) * 1000);
	if (isNaN(d.getTime())) return '';
	return d.toISOString().slice(0, 10);
}

function formatTrafficBadge(userinfo) {
	if (!userinfo || typeof userinfo !== 'object') return null;
	let parts = [];
	if (userinfo.total > 0) {
		let used = userinfo.used != null ? userinfo.used : ((userinfo.upload || 0) + (userinfo.download || 0));
		parts.push(_('已用 %s / 总计 %s').format(formatTrafficBytes(used), formatTrafficBytes(userinfo.total)));
	}
	if (userinfo.expire > 0) {
		let expStr = formatTrafficExpire(userinfo.expire);
		if (expStr) parts.push(_('到期: %s').format(expStr));
	}
	if (!parts.length) return null;
	return E('div', { 'style': 'font-size: 11px; color: #0284c7; margin-top: 2px; font-weight: normal;' }, parts.join(' | '));
}

function matrixId(index, field, region) {
	return 'omnia-matrix-' + index + '-' + field + (region ? '-' + region : '');
}

function sectionStyle() {
	return 'border: 1px solid #dfe3e8; border-radius: 8px; padding: .75rem 1rem; margin: 0 0 .75rem; background: #fff;';
}

function mutedStyle() {
	return 'color: #667; line-height: 1.35; overflow-wrap: anywhere;';
}

function pageHeader(title, description) {
	return E('div', { 'style': sectionStyle() }, [
		E('h2', { 'style': 'margin: 0 0 .35rem; line-height: 1.25;' }, title),
		E('p', { 'style': mutedStyle() + ' margin: 0;' }, description)
	]);
}

function sectionTitle(title, marginTop) {
	return E('h3', { 'style': 'margin: %s 0 .45rem; line-height: 1.25;'.format(marginTop || '0') }, title);
}

function sectionDescription(text) {
	return E('div', { 'style': mutedStyle() + ' margin: 0 0 .6rem;' }, text);
}

function field(label, value) {
	return E('div', { 'style': 'display: grid; grid-template-columns: minmax(130px, .8fr) minmax(0, 2fr); gap: .75rem; padding: .45rem 0; border-bottom: 1px solid #eef0f3;' }, [
		E('div', { 'style': 'color: #667;' }, label),
		E('div', { 'style': 'overflow-wrap: anywhere;' }, value == null || value === '' ? '-' : value)
	]);
}

function sourceMatrix(policy, summary) {
	let keys = regionKeys(policy);
	let status = sourceStatusMap(summary);
	let sources = policy.sources || [];

	return E('div', { 'style': sectionStyle() }, [
		E('div', { 'style': 'display: flex; justify-content: space-between; align-items: center; gap: .75rem; margin-bottom: .6rem;' }, [
			E('h3', { 'style': 'margin: 0; line-height: 1.25;' }, _('订阅源区域矩阵')),
			E('button', {
				'class': omniaMotion.buttonClass('btn cbi-button'),
				'click': function(ev) {
					ev.preventDefault();
					addSource();
				}
			}, _('添加订阅源'))
		]),
		sources.length ? E('div', { 'style': 'overflow-x: auto;' }, [
			E('table', { 'class': 'table', 'style': 'min-width: 760px;' }, [
				E('thead', {}, [
					E('tr', {}, [
						E('th', {}, _('名称')),
						E('th', { 'style': 'text-align: center; white-space: nowrap; min-width: 3.5rem;' }, _('启用'))
					].concat(keys.map(function(region) {
						let meta = getCountryMetadata(region);
						let flagLabel = (meta.flag ? meta.flag + ' ' : '') + region;
						return E('th', { 'style': 'text-align: center; white-space: nowrap;' }, flagLabel);
					})).concat([
						E('th', { 'style': 'text-align: right; white-space: nowrap; min-width: 3.5rem;' }, _('节点')),
						E('th', { 'style': 'text-align: right; white-space: nowrap;' }, _('操作'))
					]))
				]),
				E('tbody', {}, sources.map(function(source, index) {
					let item = status[source.name || ''] || {};
					let refresh = refreshResultForSource(source);
					return E('tr', {}, [
						E('td', {}, [
							E('div', { 'style': 'font-weight: 700; overflow-wrap: anywhere;' }, source.name || _('未命名订阅源')),
							E('div', { 'style': 'font-size: 12px; color: #667; overflow-wrap: anywhere;' }, [
								source.type === 'local' ? E('span', { 'style': 'background: #3b82f6; color: #fff; padding: 1px 5px; border-radius: 4px;' }, _('本地节点')) : E('span', {}, shortUrl(source.url))
							]),
							(source.dns && source.dns.server || (source.operators && source.operators.length)) ? E('div', { 'style': 'font-size: 11px; margin-top: 2px; display: flex; gap: .5rem; flex-wrap: wrap;' }, [
								source.dns && source.dns.server ? E('span', { 'style': 'color: #059669;' }, '🌐 DNS: ' + source.dns.server) : '',
								source.operators && source.operators.length ? E('span', { 'style': 'color: #d97706;' }, '⚙️ ' + source.operators.length + _(' 操作符')) : ''
							]) : '',
							(formatTrafficBadge(source.userinfo || item.userinfo) || ''),
							refresh ? E('div', { 'style': 'font-size: 12px; color: %s; overflow-wrap: anywhere; margin-top: .25rem;'.format(refresh.ok || refresh.status === 'running' ? '#2563eb' : '#991b1b') }, refreshResultText(refresh)) : E('div')
						]),
						E('td', { 'style': 'text-align: center;' }, omniaUi.checkboxInput({
							'id': matrixId(index, 'enabled'),
							'checked': source.enabled !== false ? 'checked' : null,
							'change': function() {
								syncDraftFromMatrix();
							}
						}))
					].concat(keys.map(function(region) {
						return E('td', { 'style': 'text-align: center;' }, omniaUi.checkboxInput({
							'id': matrixId(index, 'region', region),
							'checked': source.allowed_regions.indexOf(region) >= 0 ? 'checked' : null,
							'change': function() {
								syncDraftFromMatrix();
							}
						}));
					})).concat([
						E('td', { 'style': 'text-align: right;' }, '%d'.format(item.node_count || 0)),
						E('td', { 'style': 'text-align: right; white-space: nowrap;' }, [
							E('button', {
								'class': omniaMotion.buttonClass('btn cbi-button'),
								'click': function(ev) {
									ev.preventDefault();
									openSourceEditor(index);
								}
							}, _('编辑')),
							' ',
							E('button', {
								'class': omniaMotion.buttonClass('btn cbi-button'),
								'click': function(ev) {
									ev.preventDefault();
									let policy = collectPolicyFromPage();
									let item = policy.sources[index] || {};
									testSource(item.name, item.url, policy.refresh_strategy, 'omnia-test-report');
								}
							}, _('测试')),
							' ',
							E('button', {
								'class': omniaMotion.buttonClass('btn cbi-button'),
								'click': function(ev) {
									ev.preventDefault();
									previewSourceNodes(index);
								}
							}, _('预览')),
							' ',
							E('button', {
								'class': omniaMotion.buttonClass('btn cbi-button cbi-button-apply'),
								'disabled': refreshInProgress() ? 'disabled' : null,
								'click': function(ev) {
									ev.preventDefault();
									refreshOneSource(index);
								}
							}, _('刷新')),
							' ',
							E('button', {
								'class': omniaMotion.buttonClass('btn cbi-button cbi-button-remove'),
								'click': function(ev) {
									ev.preventDefault();
									removeSource(index);
								}
							}, _('删除'))
						])
					]));
				}))
			])
		]) : E('div', { 'style': 'color: #667; padding: .75rem 0;' }, _('没有订阅源。'))
	]);
}

function deleteRegion(targetRegion, policy) {
	if (!policy)
		policy = collectPolicyFromPage();
	if (!targetRegion || !policy.region_keywords || !policy.region_keywords[targetRegion])
		return policy;

	delete policy.region_keywords[targetRegion];

	// Cascading cleanup: sources allowed_regions
	if (Array.isArray(policy.sources)) {
		policy.sources.forEach(function(s) {
			if (Array.isArray(s.allowed_regions)) {
				s.allowed_regions = s.allowed_regions.filter(function(r) { return r !== targetRegion; });
			}
		});
	}

	// Cascading cleanup: rate_filter matched_regions
	if (policy.rate_filter && Array.isArray(policy.rate_filter.matched_regions)) {
		policy.rate_filter.matched_regions = policy.rate_filter.matched_regions.filter(function(r) { return r !== targetRegion; });
	}

	setDraft(policy);
	updateMain(policy, window.omniaNodeSnapshotSummary || {}, null);
	updatePolicyDetails(policy);
	return policy;
}

function addRegion(code, keywords, policy) {
	if (!policy)
		policy = collectPolicyFromPage();
	if (!code || typeof code !== 'string')
		return policy;

	let cleanCode = code.trim().toUpperCase();
	if (!cleanCode.match(/^[A-Z0-9_-]{2,8}$/)) {
		if (typeof window !== 'undefined' && window.alert)
			window.alert(_('区域代码格式不正确，仅支持 2-8 位字母、数字、下划线或连字符'));
		return policy;
	}

	if ([ 'MAIN', 'DIRECT', 'MANUAL', 'DNS-OUT', 'BLOCK' ].indexOf(cleanCode) >= 0) {
		if (typeof window !== 'undefined' && window.alert)
			window.alert(_('区域代码不能使用系统保留字：%s').format(cleanCode));
		return policy;
	}

	if (!policy.region_keywords)
		policy.region_keywords = {};
	if (policy.region_keywords[cleanCode]) {
		if (typeof window !== 'undefined' && window.alert)
			window.alert(_('区域代码 “%s” 已存在').format(cleanCode));
		return policy;
	}

	let kwList = [];
	if (Array.isArray(keywords)) {
		kwList = keywords.map(function(k) { return String(k).trim(); }).filter(Boolean);
	} else if (typeof keywords === 'string' && keywords.trim() !== '') {
		kwList = keywords.split(',').map(function(k) { return k.trim(); }).filter(Boolean);
	}
	if (kwList.length === 0) {
		let meta = getCountryMetadata(cleanCode);
		kwList = meta.keywords && meta.keywords.length ? meta.keywords : [ cleanCode ];
	}

	policy.region_keywords[cleanCode] = kwList;

	// Automatically add to rate_filter.matched_regions if rate_filter matched_regions exists
	if (policy.rate_filter && Array.isArray(policy.rate_filter.matched_regions)) {
		if (policy.rate_filter.matched_regions.indexOf(cleanCode) < 0) {
			policy.rate_filter.matched_regions.push(cleanCode);
		}
	}

	setDraft(policy);
	updateMain(policy, window.omniaNodeSnapshotSummary || {}, null);
	updatePolicyDetails(policy);
	return policy;
}

function restoreDefaultRegions(policy) {
	if (!policy)
		policy = collectPolicyFromPage();
	policy.region_keywords = {};
	DEFAULT_REGION_KEYS.forEach(function(k) {
		policy.region_keywords[k] = cloneArray(DEFAULT_REGION_KEYWORDS[k]);
	});

	if (policy.rate_filter && Array.isArray(policy.rate_filter.matched_regions)) {
		policy.rate_filter.matched_regions = DEFAULT_REGION_KEYS.slice();
	}

	setDraft(policy);
	updateMain(policy, window.omniaNodeSnapshotSummary || {}, null);
	updatePolicyDetails(policy);
	return policy;
}

function openAddRegionModal(policy) {
	if (!policy)
		policy = collectPolicyFromPage();

	let existing = document.getElementById('omnia-add-region-modal-overlay');
	if (existing && existing.parentNode)
		existing.parentNode.removeChild(existing);

	let overlay = E('div', {
		'id': 'omnia-add-region-modal-overlay',
		'style': 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(4px); z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 1.25rem; box-sizing: border-box;'
	});

	let modal = E('div', {
		'class': 'cbi-section',
		'style': 'width: 480px; max-width: 95vw; margin: 0; display: flex; flex-direction: column; overflow: hidden; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); border: 1px solid var(--cbi-section-border, #cbd5e1); background: var(--cbi-section-background, #fff);'
	});

	function closeModal() {
		document.removeEventListener('keydown', handleKey);
		if (overlay.parentNode)
			overlay.parentNode.removeChild(overlay);
	}

	function handleKey(ev) {
		if (ev.key === 'Escape' || ev.keyCode === 27)
			closeModal();
	}
	document.addEventListener('keydown', handleKey);

	overlay.addEventListener('click', function(ev) {
		if (ev.target === overlay)
			closeModal();
	});

	let header = E('div', {
		'style': 'display: flex; align-items: center; justify-content: space-between; padding: 0.85rem 1.25rem; border-bottom: 1px solid var(--cbi-section-border, #e2e8f0);'
	}, [
		E('div', { 'style': 'display: flex; align-items: center; gap: .5rem;' }, [
			E('span', { 'style': 'font-size: 1.15rem;' }, '🌐'),
			E('h3', { 'style': 'margin: 0; font-size: 1.05rem; font-weight: 700;' }, _('添加自定义区域'))
		]),
		E('button', {
			'type': 'button',
			'class': 'btn cbi-button',
			'style': 'padding: 2px 8px; font-size: 1.1rem; line-height: 1; border: none; background: transparent; cursor: pointer;',
			'click': closeModal
		}, '✕')
	]);

	let badgeSpan = E('span', { 'style': 'font-weight: 600; color: #2563eb; display: inline-flex; align-items: center; gap: 4px;' }, '');

	let keywordsInput = E('textarea', {
		'id': 'omnia-add-region-kw-input',
		'class': 'cbi-input-textarea',
		'style': 'width: 100%; height: 64px; resize: vertical; font: inherit;',
		'placeholder': _('例如: NG, Nigeria, 尼日利亚, 拉各斯')
	});

	let kwAutoFilled = false;

	let codeInput = E('input', {
		'id': 'omnia-add-region-code-input',
		'class': 'cbi-input-text',
		'style': 'width: 100%; text-transform: uppercase;',
		'placeholder': _('例如: NG, UA, EG, PK, TR, AR 等'),
		'input': function(ev) {
			let val = (codeInput.value || '').trim().toUpperCase();
			codeInput.value = val;
			if (val) {
				let meta = getCountryMetadata(val);
				badgeSpan.textContent = (meta.flag ? meta.flag + ' ' : '') + meta.name + (meta.name !== val ? ' (' + val + ')' : '');
				if (!kwAutoFilled || keywordsInput.value.trim() === '') {
					keywordsInput.value = meta.keywords.join(', ');
				}
			} else {
				badgeSpan.textContent = '';
			}
		}
	});

	keywordsInput.addEventListener('input', function() {
		kwAutoFilled = true;
	});

	let body = E('div', { 'style': 'padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem;' }, [
		E('div', {}, [
			E('label', { 'class': 'cbi-value-title', 'style': 'font-weight: 600; margin-bottom: 4px; display: flex; justify-content: space-between;' }, [
				E('span', {}, _('区域代码 (ISO 2-8 位字母或标识)')),
				badgeSpan
			]),
			codeInput
		]),
		E('div', {}, [
			E('label', { 'class': 'cbi-value-title', 'style': 'font-weight: 600; margin-bottom: 4px; display: block;' }, _('匹配关键字 (逗号分隔)')),
			keywordsInput
		]),
		E('div', { 'style': 'color: #64748b; font-size: 0.85rem; line-height: 1.4;' }, _('输入国家/地区代码（如 NG、UA、EG 等），系统将自动识别国旗与中文名称并预填推荐关键词。'))
	]);

	let footer = E('div', {
		'style': 'display: flex; justify-content: flex-end; gap: .75rem; padding: .85rem 1.25rem; border-top: 1px solid var(--cbi-section-border, #e2e8f0); background: var(--cbi-section-footer, #f8fafc);'
	}, [
		E('button', {
			'type': 'button',
			'class': 'btn cbi-button',
			'click': closeModal
		}, _('取消')),
		E('button', {
			'type': 'button',
			'class': 'btn cbi-button cbi-button-action',
			'click': function(ev) {
				ev.preventDefault();
				let code = (codeInput.value || '').trim().toUpperCase();
				let kws = (keywordsInput.value || '').trim();
				if (!code) {
					if (typeof window !== 'undefined' && window.alert) window.alert(_('请输入区域代码'));
					return;
				}
				addRegion(code, kws, policy);
				closeModal();
			}
		}, [ '➕ ', _('确认添加') ])
	]);

	modal.appendChild(header);
	modal.appendChild(body);
	modal.appendChild(footer);
	overlay.appendChild(modal);
	if (typeof document !== 'undefined' && document.body) {
		document.body.appendChild(overlay);
		setTimeout(function() {
			codeInput.focus();
		}, 100);
	}
}

function policySettings(policy) {
	let keys = regionKeys(policy);

	let regionItems = keys.map(function(region) {
		let meta = getCountryMetadata(region);
		let titleLabel = (meta.flag ? meta.flag + ' ' : '') + (meta.name && meta.name !== region ? meta.name + ' (' + region + ')' : region);
		return E('div', { 'class': 'cbi-value', 'style': 'margin-bottom: .6rem;' }, [
			E('label', { 'class': 'cbi-value-title', 'style': 'text-align: left; margin-bottom: 3px; font-weight: 500;' }, [
				E('span', {}, titleLabel)
			]),
			E('div', { 'class': 'cbi-value-field', 'style': 'display: flex; gap: .5rem; align-items: center;' }, [
				E('input', {
					'id': 'omnia-region-keywords-' + region,
					'class': 'cbi-input-text',
					'style': 'flex: 1;',
					'value': (policy.region_keywords[region] || []).join(', ')
				}),
				E('button', {
					'type': 'button',
					'class': omniaMotion.buttonClass('btn cbi-button cbi-button-remove'),
					'title': _('删除此区域'),
					'click': function(ev) {
						ev.preventDefault();
						if (window.confirm && !window.confirm(_('确定要删除区域 “%s” 吗？\n删除后将自动从各订阅源及过滤规则中清理该区域。').format(titleLabel)))
							return;
						deleteRegion(region, policy);
					}
				}, _('删除'))
			])
		]);
	});

	if (keys.length === 0) {
		regionItems.push(E('div', { 'style': 'color: #94a3b8; font-size: 0.9em; font-style: italic; margin-bottom: 0.75rem;' }, _('当前未配置任何区域分组（所有节点将直接并入 🗽 节点选择 全局池）')));
	}

	let regionActions = E('div', { 'style': 'display: flex; gap: 0.5rem; margin-top: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap;' }, [
		E('button', {
			'type': 'button',
			'class': omniaMotion.buttonClass('btn cbi-button cbi-button-action'),
			'style': 'padding: 3px 10px; font-size: 12px;',
			'click': function(ev) {
				ev.preventDefault();
				openAddRegionModal(policy);
			}
		}, [ '➕ ', _('添加自定义区域') ]),
		E('button', {
			'type': 'button',
			'class': omniaMotion.buttonClass('btn cbi-button cbi-button-neutral'),
			'style': 'padding: 3px 10px; font-size: 12px;',
			'click': function(ev) {
				ev.preventDefault();
				if (window.confirm && !window.confirm(_('确定要恢复出厂预设的 5 大核心区域（HK, TW, SG, JP, US）吗？当前自定义区域关键字将被替换。')))
					return;
				restoreDefaultRegions(policy);
			}
		}, [ '↺ ', _('恢复出厂五区') ])
	]);

	return E('div', { 'style': 'display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-top: .75rem;' }, [
		E('div', { 'style': sectionStyle() }, [
			sectionTitle(_('区域关键字')),
			E('div', {}, regionItems),
			regionActions,
			sectionTitle(_('DNS 专用出站组'), '1rem'),
			field(_('启用'), omniaUi.checkboxInput({
				'id': 'omnia-dns-urltest-enabled',
				'checked': policy.dns_urltest.enabled ? 'checked' : null
			})),
			field(_('节点筛选关键词'), E('textarea', {
				'id': 'omnia-dns-urltest-keywords',
				'class': 'cbi-input-textarea',
				'style': 'width: 100%; height: 2.4rem; min-height: 2.4rem; resize: none; font: inherit;',
				'spellcheck': 'false'
			}, [ (policy.dns_urltest.keywords || []).join(', ') ])),
			field(_('测速地址'), E('input', {
				'id': 'omnia-dns-urltest-url',
				'class': 'cbi-input-text',
				'style': 'width: 100%;',
				'value': policy.dns_urltest.url || DEFAULT_DNS_URLTEST.url
			})),
			field(_('间隔'), E('input', {
				'id': 'omnia-dns-urltest-interval',
				'class': 'cbi-input-text',
				'style': 'width: 100%;',
				'value': policy.dns_urltest.interval || DEFAULT_DNS_URLTEST.interval
			})),
			field(_('容差'), E('input', {
				'id': 'omnia-dns-urltest-tolerance',
				'class': 'cbi-input-text',
				'type': 'number',
				'min': '0',
				'style': 'width: 100%;',
				'value': policy.dns_urltest.tolerance
			})),
			E('div', { 'style': 'color: #667; font-size: .9em; margin-top: -.35rem;' }, _('生成固定 tag “📡 dns-out”，并接管已有 detour 的 DNS server；关闭或无匹配节点时回退至主选择器。')),
			sectionTitle(_('手动选择组'), '1rem'),
			field(_('手动选择关键词'), E('textarea', {
				'id': 'omnia-manual-selector-keywords',
				'class': 'cbi-input-textarea',
				'style': 'width: 100%; height: 2.4rem; min-height: 2.4rem; resize: none; font: inherit;',
				'spellcheck': 'false',
				'placeholder': _('例如：Brazil, 巴西, 🇧🇷, Turkey, 土耳其, 🇹🇷')
			}, [ (policy.manual_selector.keywords || []).join(', ') ])),
			E('div', { 'style': 'color: #667; font-size: .9em; margin-top: -.35rem;' }, _('用于生成“🍭 手动选择”组，多个关键词可使用逗号或换行分隔。'))
		]),
		E('div', { 'style': sectionStyle() }, [
			sectionTitle(_('清洗与 URLTest')),
			field(_('过滤关键字'), E('textarea', {
				'id': 'omnia-banned-keywords',
				'class': 'cbi-input-textarea',
				'style': 'width: 100%; min-height: 4rem; font: inherit;',
				'spellcheck': 'false'
			}, [ policy.banned_keywords || '' ])),
			field(_('测速地址'), E('input', {
				'id': 'omnia-urltest-url',
				'class': 'cbi-input-text',
				'style': 'width: 100%;',
				'value': policy.urltest_params.url || DEFAULT_URLTEST_PARAMS.url
			})),
			field(_('间隔'), E('input', {
				'id': 'omnia-urltest-interval',
				'class': 'cbi-input-text',
				'style': 'width: 100%;',
				'value': policy.urltest_params.interval || DEFAULT_URLTEST_PARAMS.interval
			})),
			field(_('容差'), E('input', {
				'id': 'omnia-urltest-tolerance',
				'class': 'cbi-input-text',
				'type': 'number',
				'style': 'width: 100%;',
				'value': policy.urltest_params.tolerance
			})),
			field(_('倍率过滤'), omniaUi.checkboxInput({
				'id': 'omnia-rate-filter-enabled',
				'checked': policy.rate_filter.enabled ? 'checked' : null
			})),
			field(_('倍率阈值'), E('input', {
				'id': 'omnia-rate-filter-threshold',
				'class': 'cbi-input-text',
				'type': 'number',
				'step': '0.1',
				'min': '0',
				'style': 'width: 100%;',
				'value': policy.rate_filter.threshold
			})),
			field(_('比较方式'), E('select', { 'id': 'omnia-rate-filter-operator', 'class': 'cbi-input-select', 'style': 'width: 100%;' }, [
				E('option', { 'value': '>=', 'selected': policy.rate_filter.operator === '>=' ? 'selected' : null }, '>='),
				E('option', { 'value': '>', 'selected': policy.rate_filter.operator === '>' ? 'selected' : null }, '>')
			])),
			field(_('作用范围'), E('select', { 'id': 'omnia-rate-filter-scope', 'class': 'cbi-input-select', 'style': 'width: 100%;' }, [
				E('option', { 'value': 'matched_regions', 'selected': policy.rate_filter.scope === 'matched_regions' ? 'selected' : null }, _('匹配区域')),
				E('option', { 'value': 'all', 'selected': policy.rate_filter.scope === 'all' ? 'selected' : null }, _('全部节点')),
				E('option', { 'value': 'none', 'selected': policy.rate_filter.scope === 'none' ? 'selected' : null }, _('停用'))
			])),
			field(_('匹配区域'), E('div', {}, keys.map(function(region) {
				let meta = getCountryMetadata(region);
				let regLabel = (meta.flag ? meta.flag + ' ' : '') + region;
				return E('label', { 'style': 'display: inline-flex; align-items: center; gap: .25rem; margin: 0 .75rem .35rem 0;' }, [
					omniaUi.checkboxInput({
						'id': 'omnia-rate-filter-region-' + region,
						'checked': policy.rate_filter.matched_regions.indexOf(region) >= 0 ? 'checked' : null
					}),
					E('span', {}, regLabel)
				]);
			}))),
			field(_('匹配区域动作'), E('select', { 'id': 'omnia-rate-filter-high-action', 'class': 'cbi-input-select', 'style': 'width: 100%;' }, [
				E('option', { 'value': 'drop', 'selected': policy.rate_filter.matched_high_rate_action === 'drop' ? 'selected' : null }, _('完全丢弃')),
				E('option', { 'value': 'raw', 'selected': policy.rate_filter.matched_high_rate_action === 'raw' ? 'selected' : null }, _('仅排除 URLTest'))
			])),
			field(_('未匹配区域动作'), E('select', { 'id': 'omnia-rate-filter-unmatched-action', 'class': 'cbi-input-select', 'style': 'width: 100%;' }, [
				E('option', { 'value': 'keep', 'selected': policy.rate_filter.unmatched_action === 'keep' ? 'selected' : null }, _('保留')),
				E('option', { 'value': 'drop', 'selected': policy.rate_filter.unmatched_action === 'drop' ? 'selected' : null }, _('丢弃'))
			])),
			field(_('识别格式'), E('div', {}, [
				E('label', { 'style': 'display: inline-flex; align-items: center; gap: .25rem; margin: 0 .75rem .35rem 0;' }, [
					omniaUi.checkboxInput({
						'id': 'omnia-rate-filter-pattern-number-x',
						'checked': policy.rate_filter.patterns.indexOf('number_x') >= 0 ? 'checked' : null
					}),
					E('span', {}, '1.5x / 2x')
				]),
				E('label', { 'style': 'display: inline-flex; align-items: center; gap: .25rem; margin: 0 .75rem .35rem 0;' }, [
					omniaUi.checkboxInput({
						'id': 'omnia-rate-filter-pattern-number-cn',
						'checked': policy.rate_filter.patterns.indexOf('number_times_cn') >= 0 ? 'checked' : null
					}),
					E('span', {}, '1.5倍 / 2倍')
				])
			])),
			field(_('识别 1x'), omniaUi.checkboxInput({
				'id': 'omnia-rate-filter-include-one',
				'checked': policy.rate_filter.include_integer_one ? 'checked' : null
			}))
		])
	]);
}

function fetchSafetySettings(policy) {
	let bypass = normalizeFetchBypass(policy.fetch_bypass);

	return E('div', { 'style': 'display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-top: .75rem;' }, [
		E('div', { 'style': sectionStyle() }, [
			sectionTitle(_('局域网绕行')),
			field(_('启用'), omniaUi.checkboxInput({
				'id': 'omnia-fetch-bypass-enabled',
				'checked': bypass.enabled ? 'checked' : null,
				'change': function() {
					syncDraftFromMatrix();
				}
			})),
			field(_('允许局域网'), omniaUi.checkboxInput({
				'id': 'omnia-fetch-bypass-allow-lan',
				'checked': bypass.allow_lan ? 'checked' : null,
				'change': function() {
					syncDraftFromMatrix();
				}
			})),
			field(_('模式'), E('input', {
				'id': 'omnia-fetch-bypass-mode',
				'class': 'cbi-input-text',
				'style': 'width: 100%;',
				'readonly': 'readonly',
				'value': bypass.mode || DEFAULT_FETCH_BYPASS.mode
			})),
			field(_('优先级'), E('input', {
				'id': 'omnia-fetch-bypass-priority',
				'class': 'cbi-input-text',
				'type': 'number',
				'min': '7800',
				'max': '8099',
				'style': 'width: 100%;',
				'value': bypass.priority || DEFAULT_FETCH_BYPASS.priority
			}))
		]),
		E('div', { 'style': sectionStyle() }, [
			sectionTitle(_('允许的主机')),
			sectionDescription(_('只有明确配置的局域网 IPv4 主机才会使用临时抓取绕行。每行一个主机，也可以用逗号分隔。')),
			E('textarea', {
				'id': 'omnia-fetch-bypass-hosts',
				'class': 'cbi-input-textarea',
				'style': 'width: 100%; min-height: 6rem; font: inherit;',
				'spellcheck': 'false'
			}, [ bypass.hosts.join('\n') ]),
			E('div', { 'style': 'color: #667; font-size: 12px; margin-top: .5rem;' }, _('这只影响订阅抓取，不会修改模板、候选配置、运行配置或策略组状态。'))
		])
	]);
}

function collapsible(title, subtitle, content, open, id) {
	let attrs = {
		'open': open ? 'open' : null,
		'style': sectionStyle()
	};
	if (id)
		attrs.id = id;
	return E('details', attrs, [
		E('summary', { 'style': 'cursor: pointer; list-style-position: inside;' }, [
			E('span', { 'style': 'font-weight: 700;' }, title),
			subtitle ? E('span', { 'style': 'display: block; color: #667; font-size: 12px; margin-top: .25rem;' }, subtitle) : E('span')
		]),
		content
	]);
}

function policyDetails(policy, open) {
	return collapsible(
		_('全局策略'),
		_('区域关键字、清洗关键字，以及生成 URLTest 组时使用的参数。'),
		policySettings(policy),
		open === true,
		'omnia-subscriptions-policy-details'
	);
}

function updatePolicyDetails(policy) {
	let el = (typeof document !== 'undefined' && document.getElementById) ? document.getElementById('omnia-subscriptions-policy-details') : null;
	if (el && el.parentNode) {
		let wasOpen = el.open === true || (typeof el.hasAttribute === 'function' && el.hasAttribute('open'));
		el.parentNode.replaceChild(policyDetails(policy, wasOpen), el);
	}
}

function fetchSafetyDetails(policy) {
	let bypass = normalizeFetchBypass(policy.fetch_bypass);
	let subtitle = bypass.enabled
		? _('已为 %d 个主机启用，优先级 %d。').format(bypass.hosts.length, bypass.priority)
		: _('已停用。直连刷新会保持当前路由行为。');

	return collapsible(
		_('抓取安全'),
		subtitle,
		fetchSafetySettings(policy),
		false
	);
}

function subscriptionUpdateSettings(policy) {
	let update = normalizeSubscriptionUpdate(policy.subscription_update);

	return E('div', { 'style': 'display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-top: .75rem;' }, [
		E('div', { 'style': sectionStyle() }, [
			sectionTitle(_('调度策略')),
			field(_('自动刷新'), omniaUi.checkboxInput({
				'id': 'omnia-subscription-auto-update',
				'checked': update.auto_update ? 'checked' : null
			})),
			field(_('每日小时'), E('input', {
				'id': 'omnia-subscription-update-hour',
				'class': 'cbi-input-text',
				'type': 'number',
				'min': '0',
				'max': '23',
				'style': 'width: 100%;',
				'value': update.update_hour
			})),
			field(_('策略'), E('select', { 'id': 'omnia-subscription-update-strategy', 'class': 'cbi-input-select', 'style': 'width: 100%;' }, [
				E('option', { 'value': 'saved', 'selected': update.strategy === 'saved' ? 'selected' : null }, _('使用已保存的刷新策略')),
				E('option', { 'value': 'direct', 'selected': update.strategy === 'direct' ? 'selected' : null }, _('强制直连刷新')),
				E('option', { 'value': 'proxy', 'selected': update.strategy === 'proxy' ? 'selected' : null }, _('强制代理刷新'))
			])),
			field(_('启动时运行'), omniaUi.checkboxInput({
				'id': 'omnia-subscription-run-on-boot',
				'checked': update.run_on_boot ? 'checked' : null
			}))
		]),
		E('div', { 'style': sectionStyle() }, [
			sectionTitle(_('边界')),
			sectionDescription(_('这里只保存自动刷新策略。调度器会按该策略触发后台任务。')),
			E('div', { 'style': 'color: #667; font-size: 12px; line-height: 1.6;' }, [
				_('调度任务：订阅刷新任务（subscription.refresh）。'),
				E('br'),
				_('手动刷新节点快照保持不变，不会发送 Telegram 通知。')
			])
		])
	]);
}

function subscriptionUpdateDetails(policy) {
	let update = normalizeSubscriptionUpdate(policy.subscription_update);
	let subtitle = update.auto_update
		? _('已启用：%d:00，策略 %s。').format(update.update_hour, update.strategy)
		: _('已停用。策略仍会保存。');

	return collapsible(
		_('自动刷新'),
		subtitle,
		subscriptionUpdateSettings(policy),
		false
	);
}

function sourceEditor(policy, index) {
	if (index == null)
		return E('div', { 'id': 'omnia-source-editor', 'style': 'display: none;' });

	let isNew = index === 'new';
	let source = isNew ? {
		id: '',
		name: '',
		type: 'remote',
		url: '',
		user_agent: '',
		subtype: 'paste',
		payload: '',
		enabled: true,
		operators: [],
		dns: null,
		allowed_regions: regionKeys(policy)
	} : policy.sources[index] || {};
	let keys = regionKeys(policy);
	let isLocal = (source.type === 'local');
	let dnsConfig = (source.dns && typeof source.dns === 'object') ? JSON.parse(JSON.stringify(source.dns)) : {};
	let activeOps = Array.isArray(source.operators) ? JSON.parse(JSON.stringify(source.operators)) : [];
	window.omniaActiveEditorOps = activeOps;

	let dnsPresets = [
		{
			title: _('机场自建 DoH (带 Path 与前置解析)'),
			data: {
				tag: 'airport-doh',
				type: 'https',
				server: 'doh.airport.com',
				server_port: 443,
				path: '/dns-query',
				domain_resolver: 'Ali-DNS',
				strategy: 'prefer_ipv4'
			}
		},
		{
			title: _('自建传统 UDP DNS (带自定义端口)'),
			data: {
				tag: 'airport-udp',
				type: 'udp',
				server: '198.51.100.1',
				server_port: 5353
			}
		},
		{
			title: _('经由代理出站的 DoT DNS'),
			data: {
				tag: 'airport-dot',
				type: 'tls',
				server: 'dot.airport.com',
				server_port: 853,
				detour: '🗽 节点选择'
			}
		},
		{
			title: _('自建 HTTP/3 (h3) DNS'),
			data: {
				tag: 'airport-h3',
				type: 'h3',
				server: 'doh.airport.com',
				server_port: 443,
				path: '/dns-query'
			}
		}
	];

	let opPresets = [
		{
			title: _('基础常用 (自动国旗 + 开启 UDP)'),
			data: [
				{ type: 'flag' },
				{ type: 'quick_setting', udp: true }
			]
		},
		{
			title: _('地区保留与排序 (保留 HK/JP/SG/US + 字母排序)'),
			data: [
				{ type: 'regex_filter', pattern: '香港|日本|新加坡|美国|HK|JP|SG|US', invert: false, target: 'name' },
				{ type: 'sort', mode: 'alphabetical' }
			]
		},
		{
			title: _('垃圾节点清洗 (过滤高倍率/官网/重置)'),
			data: [
				{ type: 'regex_filter', pattern: '(官网|重置|剩余|到期|2x|3x|5x|高倍)', invert: true, target: 'name' }
			]
		},
		{
			title: _('统一节点规范前缀 (正则重命名)'),
			data: [
				{ type: 'regex_rename', pattern: '^(.*?)(香港|HK)(.*)$', replacement: '🇭🇰 香港 $3' }
			]
		}
	];

	function onTypeChange(ev) {
		let isLoc = ev.target.value === 'local';
		let remoteBox = document.getElementById('omnia-editor-remote-box');
		let localBox = document.getElementById('omnia-editor-local-box');
		if (remoteBox) remoteBox.style.display = isLoc ? 'none' : 'block';
		if (localBox) localBox.style.display = isLoc ? 'block' : 'none';
	}

	function onDnsToggle(ev) {
		let box = document.getElementById('omnia-editor-dns-fields');
		let jsonBox = document.getElementById('omnia-editor-dns-json-box');
		let modeBtn = document.getElementById('omnia-editor-dns-mode-btn');
		let show = ev.target.checked;
		if (box) box.style.display = (show && (!jsonBox || jsonBox.style.display === 'none')) ? 'block' : 'none';
		if (modeBtn) modeBtn.style.display = show ? 'inline-block' : 'none';
		if (!show && jsonBox) jsonBox.style.display = 'none';
	}

	function toggleDnsMode(ev) {
		if (ev) ev.preventDefault();
		let uiBox = document.getElementById('omnia-editor-dns-fields');
		let jsonBox = document.getElementById('omnia-editor-dns-json-box');
		let modeBtn = document.getElementById('omnia-editor-dns-mode-btn');
		let jsonArea = document.getElementById('omnia-editor-dns-json');
		if (!uiBox || !jsonBox) return;

		let toRaw = (uiBox.style.display !== 'none');
		if (toRaw) {
			let current = collectEditorDns() || {};
			delete current.enabled;
			jsonArea.value = JSON.stringify(current, null, 2);
			uiBox.style.display = 'none';
			jsonBox.style.display = 'block';
			if (modeBtn) modeBtn.textContent = _('切换到表单模式');
		} else {
			try {
				let parsed = jsonArea.value.trim() ? JSON.parse(jsonArea.value) : {};
				let tagInput = document.getElementById('omnia-editor-dns-tag');
				let typeSel = document.getElementById('omnia-editor-dns-type');
				let serverInput = document.getElementById('omnia-editor-dns-server');
				let portInput = document.getElementById('omnia-editor-dns-port');
				let pathInput = document.getElementById('omnia-editor-dns-path');
				let detourInput = document.getElementById('omnia-editor-dns-detour');
				let resInput = document.getElementById('omnia-editor-dns-resolver');
				let stratSel = document.getElementById('omnia-editor-dns-strategy');

				if (tagInput) tagInput.value = parsed.tag || '';
				if (typeSel) typeSel.value = parsed.type || 'https';
				if (serverInput) serverInput.value = parsed.server || '';
				if (portInput) portInput.value = parsed.server_port || '';
				if (pathInput) pathInput.value = parsed.path || '';
				if (detourInput) detourInput.value = parsed.detour || '';
				if (resInput) resInput.value = parsed.domain_resolver || '';
				if (stratSel) stratSel.value = parsed.strategy || '';
			} catch (err) {
				alert(_('JSON 格式有误，无法切回表单模式：') + err.message);
				return;
			}
			jsonBox.style.display = 'none';
			uiBox.style.display = 'block';
			if (modeBtn) modeBtn.textContent = _('高级 JSON 模式');
		}
	}

	function loadDnsPreset() {
		let sel = document.getElementById('omnia-editor-dns-preset-select');
		if (!sel || sel.value === '') return;
		let idx = parseInt(sel.value, 10);
		if (isNaN(idx) || !dnsPresets[idx]) return;
		let p = dnsPresets[idx].data;
		let jsonArea = document.getElementById('omnia-editor-dns-json');
		if (jsonArea) jsonArea.value = JSON.stringify(p, null, 2);
	}

	function toggleOpsMode(ev) {
		if (ev) ev.preventDefault();
		let cardBox = document.getElementById('omnia-editor-ops-card-box');
		let jsonBox = document.getElementById('omnia-editor-ops-json-box');
		let modeBtn = document.getElementById('omnia-editor-ops-mode-btn');
		let jsonArea = document.getElementById('omnia-editor-ops-json');
		if (!cardBox || !jsonBox) return;

		let toRaw = (cardBox.style.display !== 'none');
		if (toRaw) {
			jsonArea.value = JSON.stringify(activeOps, null, 2);
			cardBox.style.display = 'none';
			jsonBox.style.display = 'block';
			if (modeBtn) modeBtn.textContent = _('切换到卡片模式');
		} else {
			try {
				let parsed = jsonArea.value.trim() ? JSON.parse(jsonArea.value) : [];
				if (!Array.isArray(parsed)) throw new Error(_('操作符配置必须是数组'));
				activeOps = parsed;
				renderOpCards();
			} catch (err) {
				alert(_('JSON 格式有误，无法切回卡片模式：') + err.message);
				return;
			}
			jsonBox.style.display = 'none';
			cardBox.style.display = 'block';
			if (modeBtn) modeBtn.textContent = _('高级 JSON 模式');
		}
	}

	function loadOpPreset() {
		let sel = document.getElementById('omnia-editor-ops-preset-select');
		if (!sel || sel.value === '') return;
		let idx = parseInt(sel.value, 10);
		if (isNaN(idx) || !opPresets[idx]) return;
		let p = opPresets[idx].data;
		let jsonArea = document.getElementById('omnia-editor-ops-json');
		if (jsonArea) jsonArea.value = JSON.stringify(p, null, 2);
	}

	function addOp(type) {
		let newOp = { type: type };
		if (type === 'regex_filter') {
			newOp.pattern = 'HK|JP';
			newOp.invert = false;
			newOp.target = 'name';
		} else if (type === 'regex_rename') {
			newOp.pattern = '^(.*?)$';
			newOp.replacement = '$1';
		} else if (type === 'quick_setting') {
			newOp.udp = true;
		} else if (type === 'sort') {
			newOp.mode = 'alphabetical';
		} else if (type === 'script') {
			newOp.mode = 'single';
			newOp.script = 'node.name = "[VIP] " + node.name;\nreturn node;';
		}
		activeOps.push(newOp);
		renderOpCards();
	}

	function moveOp(idx, delta) {
		let target = idx + delta;
		if (target < 0 || target >= activeOps.length) return;
		let temp = activeOps[idx];
		activeOps[idx] = activeOps[target];
		activeOps[target] = temp;
		renderOpCards();
	}

	function removeOp(idx) {
		activeOps.splice(idx, 1);
		renderOpCards();
	}

	function renderSingleOpCard(op, idx) {
		let typeNames = {
			'regex_filter': _('正则过滤'),
			'regex_rename': _('正则重命名'),
			'flag': _('国旗添加'),
			'quick_setting': _('属性批量设置'),
			'sort': _('节点排序'),
			'script': _('ucode 脚本')
		};
		let typeTitle = typeNames[op.type] || op.type;

		let card = E('div', { 'style': 'border: 1px solid #cbd5e1; border-radius: 6px; padding: .65rem; margin-bottom: .5rem; background: #fff;' }, [
			E('div', { 'style': 'display: flex; justify-content: space-between; align-items: center; margin-bottom: .45rem; border-bottom: 1px solid #f1f5f9; padding-bottom: .35rem;' }, [
				E('div', { 'style': 'display: flex; align-items: center; gap: .45rem;' }, [
					E('span', { 'style': 'font-weight: 700; color: #334155;' }, '#' + (idx + 1)),
					E('span', { 'style': 'display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; background: #e0f2fe; color: #0369a1;' }, typeTitle)
				]),
				E('div', { 'style': 'display: flex; gap: .25rem;' }, [
					E('button', { 'class': omniaMotion.buttonClass('btn cbi-button'), 'style': 'padding: 1px 6px; font-size: 11px;', 'disabled': idx === 0 ? 'disabled' : null, 'click': function(ev) { ev.preventDefault(); moveOp(idx, -1); } }, '▲'),
					E('button', { 'class': omniaMotion.buttonClass('btn cbi-button'), 'style': 'padding: 1px 6px; font-size: 11px;', 'disabled': idx === activeOps.length - 1 ? 'disabled' : null, 'click': function(ev) { ev.preventDefault(); moveOp(idx, 1); } }, '▼'),
					E('button', { 'class': omniaMotion.buttonClass('btn cbi-button'), 'style': 'padding: 1px 6px; font-size: 11px; color: #ef4444;', 'click': function(ev) { ev.preventDefault(); removeOp(idx); } }, '✕')
				])
			])
		]);

		let body = E('div', { 'style': 'display: flex; flex-direction: column; gap: .45rem;' });

		if (op.type === 'regex_filter') {
			body.appendChild(E('div', { 'style': 'display: flex; gap: .5rem; flex-wrap: wrap;' }, [
				E('label', { 'style': 'display: flex; align-items: center; gap: .35rem; font-size: 12px;' }, [
					E('span', {}, _('模式：')),
					E('select', {
						'class': 'cbi-input-select',
						'style': 'font-size: 12px;',
						'change': function(ev) { op.invert = (ev.target.value === 'true'); }
					}, [
						E('option', { 'value': 'false', 'selected': !op.invert ? 'selected' : null }, _('保留匹配项 (Keep)')),
						E('option', { 'value': 'true', 'selected': op.invert ? 'selected' : null }, _('排除匹配项 (Drop)'))
					])
				]),
				E('label', { 'style': 'display: flex; align-items: center; gap: .35rem; font-size: 12px;' }, [
					E('span', {}, _('目标：')),
					E('select', {
						'class': 'cbi-input-select',
						'style': 'font-size: 12px;',
						'change': function(ev) { op.target = ev.target.value; }
					}, [
						E('option', { 'value': 'name', 'selected': (!op.target || op.target === 'name') ? 'selected' : null }, _('节点名称')),
						E('option', { 'value': 'type', 'selected': op.target === 'type' ? 'selected' : null }, _('协议类型')),
						E('option', { 'value': 'server', 'selected': op.target === 'server' ? 'selected' : null }, _('服务器地址'))
					])
				])
			]));
			body.appendChild(E('input', {
				'type': 'text',
				'class': 'cbi-input-text',
				'style': 'width: 100%; font-size: 12px;',
				'placeholder': _('正则表达式，例如：香港|HK|日本|JP'),
				'value': op.pattern || '',
				'input': function(ev) { op.pattern = ev.target.value; }
			}));
		} else if (op.type === 'regex_rename') {
			body.appendChild(E('div', { 'style': 'display: flex; gap: .5rem; flex-wrap: wrap;' }, [
				E('div', { 'style': 'flex: 1; min-width: 180px;' }, [
					E('div', { 'style': 'font-size: 11px; color: #64748b; margin-bottom: 2px;' }, _('匹配正则：')),
					E('input', {
						'type': 'text',
						'class': 'cbi-input-text',
						'style': 'width: 100%; font-size: 12px;',
						'placeholder': _('例如：^(.*?)(香港|HK)(.*)$'),
						'value': op.pattern || '',
						'input': function(ev) { op.pattern = ev.target.value; }
					})
				]),
				E('div', { 'style': 'flex: 1; min-width: 180px;' }, [
					E('div', { 'style': 'font-size: 11px; color: #64748b; margin-bottom: 2px;' }, _('替换为：')),
					E('input', {
						'type': 'text',
						'class': 'cbi-input-text',
						'style': 'width: 100%; font-size: 12px;',
						'placeholder': _('例如：🇭🇰 香港 $3'),
						'value': op.replacement || '',
						'input': function(ev) { op.replacement = ev.target.value; }
					})
				])
			]));
		} else if (op.type === 'flag') {
			body.appendChild(E('div', { 'style': 'font-size: 12px; color: #64748b;' }, _('自动根据节点名称识别国家/地区代码（如 HK, JP, US 等）并追加标准国旗 Emoji。')));
		} else if (op.type === 'quick_setting') {
			body.appendChild(E('div', { 'style': 'display: flex; gap: 1rem; flex-wrap: wrap;' }, [
				E('label', { 'style': 'display: inline-flex; align-items: center; gap: .35rem; font-size: 12px;' }, [
					omniaUi.checkboxInput({
						'checked': op.udp ? 'checked' : null,
						'change': function(ev) { op.udp = ev.target.checked; }
					}),
					E('span', {}, _('强制开启 UDP (udp: true)'))
				]),
				E('label', { 'style': 'display: inline-flex; align-items: center; gap: .35rem; font-size: 12px;' }, [
					omniaUi.checkboxInput({
						'checked': op.allow_insecure ? 'checked' : null,
						'change': function(ev) { op.allow_insecure = ev.target.checked; }
					}),
					E('span', {}, _('允许不安全证书 (allow_insecure)'))
				]),
				E('label', { 'style': 'display: inline-flex; align-items: center; gap: .35rem; font-size: 12px;' }, [
					omniaUi.checkboxInput({
						'checked': op.tcp_fast_open ? 'checked' : null,
						'change': function(ev) { op.tcp_fast_open = ev.target.checked; }
					}),
					E('span', {}, _('TCP Fast Open'))
				])
			]));
		} else if (op.type === 'sort') {
			body.appendChild(E('label', { 'style': 'display: flex; align-items: center; gap: .35rem; font-size: 12px;' }, [
				E('span', {}, _('排序模式：')),
				E('select', {
					'class': 'cbi-input-select',
					'style': 'font-size: 12px;',
					'change': function(ev) { op.mode = ev.target.value; }
				}, [
					E('option', { 'value': 'alphabetical', 'selected': (!op.mode || op.mode === 'alphabetical') ? 'selected' : null }, _('字母升序 (A-Z)')),
					E('option', { 'value': 'reverse', 'selected': op.mode === 'reverse' ? 'selected' : null }, _('字母降序 (Z-A)')),
					E('option', { 'value': 'keywords', 'selected': op.mode === 'keywords' ? 'selected' : null }, _('地区关键词优先级'))
				])
			]));
		} else if (op.type === 'script') {
			body.appendChild(E('div', { 'style': 'display: flex; justify-content: space-between; align-items: center;' }, [
				E('label', { 'style': 'display: flex; align-items: center; gap: .35rem; font-size: 12px;' }, [
					E('span', {}, _('处理模式：')),
					E('select', {
						'class': 'cbi-input-select',
						'style': 'font-size: 12px;',
						'change': function(ev) { op.mode = ev.target.value; }
					}, [
						E('option', { 'value': 'single', 'selected': (!op.mode || op.mode === 'single') ? 'selected' : null }, _('单节点处理 (node) => node')),
						E('option', { 'value': 'batch', 'selected': op.mode === 'batch' ? 'selected' : null }, _('全量数组处理 (nodes) => nodes'))
					])
				]),
				E('span', { 'style': 'font-size: 11px; color: #94a3b8;' }, _('沙箱 ucode 语法'))
			]));
			body.appendChild(E('textarea', {
				'class': 'cbi-input-textarea',
				'style': 'width: 100%; min-height: 60px; font-family: monospace; font-size: 11px;',
				'value': op.script || '',
				'input': function(ev) { op.script = ev.target.value; }
			}));
		}

		card.appendChild(body);
		return card;
	}

	function renderOpCards() {
		let listElem = document.getElementById('omnia-editor-ops-list');
		if (!listElem) return;
		listElem.innerHTML = '';
		if (!activeOps.length) {
			listElem.appendChild(E('div', { 'style': 'color: #94a3b8; font-size: 12px; text-align: center; padding: 1rem 0; border: 1px dashed #cbd5e1; border-radius: 6px;' }, _('暂无操作符。请点击上方按钮添加，或切换到高级 JSON 模式载入示例。')));
			return;
		}
		activeOps.forEach(function(op, idx) {
			listElem.appendChild(renderSingleOpCard(op, idx));
		});
	}

	setTimeout(function() {
		renderOpCards();
	}, 10);

	return E('div', {
		'id': 'omnia-source-editor',
		'data-index': isNew ? '-1' : index,
		'style': 'position: fixed; inset: 0; z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 1rem; background: rgba(15, 23, 42, .32);'
	}, [
		E('div', { 'style': 'width: min(780px, 100%); max-height: min(840px, calc(100vh - 2rem)); overflow: auto; border: 1px solid #d8dde6; border-radius: 10px; padding: 1.25rem; background: #fff; box-shadow: 0 18px 50px rgba(15, 23, 42, .22);' }, [
			E('div', { 'style': 'display: flex; justify-content: space-between; gap: 1rem; align-items: center; margin-bottom: 1rem;' }, [
				E('h3', { 'style': 'margin: 0;' }, isNew ? _('添加订阅源') : _('编辑订阅源')),
				E('button', { 'class': omniaMotion.buttonClass('btn cbi-button'), 'click': function(ev) { ev.preventDefault(); closeSourceEditor(); } }, _('取消'))
			]),
			field(_('名称'), E('input', { 'id': 'omnia-editor-name', 'class': 'cbi-input-text', 'style': 'width: 100%;', 'value': source.name || '' })),
			field(_('类型'), E('select', { 'id': 'omnia-editor-type', 'class': 'cbi-input-select', 'style': 'width: 100%;', 'change': onTypeChange }, [
				E('option', { 'value': 'remote', 'selected': !isLocal ? 'selected' : null }, _('远程订阅 (URL)')),
				E('option', { 'value': 'local', 'selected': isLocal ? 'selected' : null }, _('本地节点 (文本导入 / 表单)'))
			])),
			E('div', { 'id': 'omnia-editor-remote-box', 'style': !isLocal ? 'display: block;' : 'display: none;' }, [
				field(_('URL'), E('input', { 'id': 'omnia-editor-url', 'class': 'cbi-input-text', 'style': 'width: 100%;', 'value': source.url || '' })),
				field(_('客户端伪装 (User-Agent)'), E('input', { 'id': 'omnia-editor-user-agent', 'class': 'cbi-input-text', 'style': 'width: 100%;', 'placeholder': 'clash.meta / sing-box / Surge', 'value': source.user_agent || '' }))
			]),
			E('div', { 'id': 'omnia-editor-local-box', 'style': isLocal ? 'display: block;' : 'display: none;' }, [
				field(_('录入形式'), E('select', { 'id': 'omnia-editor-subtype', 'class': 'cbi-input-select', 'style': 'width: 100%;' }, [
					E('option', { 'value': 'paste', 'selected': source.subtype !== 'form' ? 'selected' : null }, _('文本导入 (多行 URI / Clash YAML / sing-box JSON / Base64)')),
					E('option', { 'value': 'form', 'selected': source.subtype === 'form' ? 'selected' : null }, _('表单节点数组 (JSON 格式)'))
				])),
				field(_('节点内容 (Payload)'), E('textarea', { 'id': 'omnia-editor-payload', 'class': 'cbi-input-textarea', 'style': 'width: 100%; min-height: 100px; font-family: monospace; font-size: 12px;', 'placeholder': _('粘贴订阅文本或 JSON 节点数组...') }, typeof source.payload === 'string' ? source.payload : (source.payload ? JSON.stringify(source.payload, null, 2) : (source.nodes ? JSON.stringify(source.nodes, null, 2) : ''))))
			]),
			field(_('启用'), omniaUi.checkboxInput({ 'id': 'omnia-editor-enabled', 'checked': source.enabled !== false ? 'checked' : null })),
			field(_('允许区域'), E('div', {}, keys.map(function(region) {
				return E('label', { 'style': 'display: inline-flex; align-items: center; gap: .35rem; border: 1px solid #ddd; border-radius: 6px; padding: .35rem .55rem; margin-right: .45rem; margin-bottom: .45rem;' }, [
					omniaUi.checkboxInput({
						'class': 'omnia-editor-region',
						'value': region,
						'checked': source.allowed_regions.indexOf(region) >= 0 ? 'checked' : null
					}),
					E('span', {}, (getCountryMetadata(region).flag ? getCountryMetadata(region).flag + ' ' : '') + region)
				]);
			}))),
			E('div', { 'style': 'margin-top: .75rem; border: 1px solid #e2e8f0; border-radius: 8px; padding: .65rem; background: #f8fafc;' }, [
				E('div', { 'style': 'display: flex; align-items: center; justify-content: space-between; margin-bottom: .5rem;' }, [
					E('strong', {}, _('机场自建 DNS 设置 (同步写入 sing-box 配置文件)')),
					E('div', { 'style': 'display: flex; align-items: center; gap: .5rem;' }, [
						E('button', {
							'id': 'omnia-editor-dns-mode-btn',
							'class': omniaMotion.buttonClass('btn cbi-button'),
							'style': 'font-size: 11px; padding: 2px 6px;' + (dnsConfig.enabled ? '' : ' display: none;'),
							'click': toggleDnsMode
						}, _('高级 JSON 模式')),
						E('label', { 'style': 'display: inline-flex; align-items: center; gap: .35rem;' }, [
							omniaUi.checkboxInput({ 'id': 'omnia-editor-dns-enabled', 'checked': dnsConfig.enabled ? 'checked' : null, 'change': onDnsToggle }),
							E('span', {}, _('启用自建 DNS'))
						])
					])
				]),
				E('div', { 'id': 'omnia-editor-dns-fields', 'style': dnsConfig.enabled ? 'display: block;' : 'display: none;' }, [
					field(_('DNS 标签 (Tag)'), E('input', { 'id': 'omnia-editor-dns-tag', 'class': 'cbi-input-text', 'style': 'width: 100%;', 'placeholder': '例如：airport-dns (留空自动生成)', 'value': dnsConfig.tag || '' })),
					field(_('协议类型 (Type)'), E('select', { 'id': 'omnia-editor-dns-type', 'class': 'cbi-input-select', 'style': 'width: 100%;' }, [
						E('option', { 'value': 'https', 'selected': (!dnsConfig.type || dnsConfig.type === 'https') ? 'selected' : null }, 'DoH (https)'),
						E('option', { 'value': 'tls', 'selected': dnsConfig.type === 'tls' ? 'selected' : null }, 'DoT (tls)'),
						E('option', { 'value': 'udp', 'selected': dnsConfig.type === 'udp' ? 'selected' : null }, '传统 UDP (udp)'),
						E('option', { 'value': 'tcp', 'selected': dnsConfig.type === 'tcp' ? 'selected' : null }, '传统 TCP (tcp)'),
						E('option', { 'value': 'quic', 'selected': dnsConfig.type === 'quic' ? 'selected' : null }, 'DoQ (quic)'),
						E('option', { 'value': 'h3', 'selected': dnsConfig.type === 'h3' ? 'selected' : null }, 'HTTP/3 (h3)')
					])),
					field(_('服务器地址 (Server)'), E('input', { 'id': 'omnia-editor-dns-server', 'class': 'cbi-input-text', 'style': 'width: 100%;', 'placeholder': '例如：dns.airport.com 或 1.1.1.1', 'value': dnsConfig.server || '' })),
					field(_('服务端口 (Port)'), E('input', { 'id': 'omnia-editor-dns-port', 'type': 'number', 'class': 'cbi-input-text', 'style': 'width: 100%;', 'placeholder': '留空使用协议默认端口 (DoH: 443, DoT: 853, UDP: 53)', 'value': dnsConfig.server_port || '' })),
					field(_('请求路径 (Path)'), E('input', { 'id': 'omnia-editor-dns-path', 'class': 'cbi-input-text', 'style': 'width: 100%;', 'placeholder': '/dns-query (仅 DoH/HTTP3 适用)', 'value': dnsConfig.path || '' })),
					field(_('出站连接 (Detour)'), E('input', { 'id': 'omnia-editor-dns-detour', 'class': 'cbi-input-text', 'style': 'width: 100%;', 'placeholder': '留空为系统默认直连，亦可填写代理出站标签 (如 🗽 节点选择)', 'value': dnsConfig.detour || '' })),
					field(_('前置解析器 (Domain Resolver)'), E('input', { 'id': 'omnia-editor-dns-resolver', 'class': 'cbi-input-text', 'style': 'width: 100%;', 'placeholder': '当自建 DNS 为域名时，用于解析此 DNS 自身的前置 DNS tag', 'value': dnsConfig.domain_resolver || '' })),
					field(_('解析策略 (Strategy)'), E('select', { 'id': 'omnia-editor-dns-strategy', 'class': 'cbi-input-select', 'style': 'width: 100%;' }, [
						E('option', { 'value': '', 'selected': !dnsConfig.strategy ? 'selected' : null }, _('默认 (跟随全局)')),
						E('option', { 'value': 'prefer_ipv4', 'selected': dnsConfig.strategy === 'prefer_ipv4' ? 'selected' : null }, 'prefer_ipv4 (优先 IPv4)'),
						E('option', { 'value': 'prefer_ipv6', 'selected': dnsConfig.strategy === 'prefer_ipv6' ? 'selected' : null }, 'prefer_ipv6 (优先 IPv6)'),
						E('option', { 'value': 'ipv4_only', 'selected': dnsConfig.strategy === 'ipv4_only' ? 'selected' : null }, 'ipv4_only (仅 IPv4)'),
						E('option', { 'value': 'ipv6_only', 'selected': dnsConfig.strategy === 'ipv6_only' ? 'selected' : null }, 'ipv6_only (仅 IPv6)')
					]))
				]),
				E('div', { 'id': 'omnia-editor-dns-json-box', 'style': 'display: none;' }, [
					E('div', { 'style': 'display: flex; gap: .35rem; align-items: center; margin-bottom: .45rem;' }, [
						E('select', { 'id': 'omnia-editor-dns-preset-select', 'class': 'cbi-input-select', 'style': 'flex: 1; font-size: 12px;' }, [
							E('option', { 'value': '' }, _('选择常用自建 DNS 模板...'))
						].concat(dnsPresets.map(function(item, i) {
							return E('option', { 'value': String(i) }, item.title);
						}))),
						E('button', { 'class': omniaMotion.buttonClass('btn cbi-button'), 'style': 'font-size: 11px; padding: 2px 8px;', 'click': function(ev) { ev.preventDefault(); loadDnsPreset(); } }, _('载入模板'))
					]),
					E('textarea', { 'id': 'omnia-editor-dns-json', 'class': 'cbi-input-textarea', 'style': 'width: 100%; min-height: 120px; font-family: monospace; font-size: 12px;', 'placeholder': '{\n  "tag": "airport-doh",\n  "type": "https",\n  "server": "doh.airport.com"\n}' })
				])
			]),
			E('div', { 'style': 'margin-top: .75rem; border: 1px solid #e2e8f0; border-radius: 8px; padding: .65rem; background: #f8fafc;' }, [
				E('div', { 'style': 'display: flex; align-items: center; justify-content: space-between; margin-bottom: .5rem;' }, [
					E('strong', {}, _('操作符管线 (参考 Sub-Store, 有序执行)')),
					E('button', {
						'id': 'omnia-editor-ops-mode-btn',
						'class': omniaMotion.buttonClass('btn cbi-button'),
						'style': 'font-size: 11px; padding: 2px 6px;',
						'click': toggleOpsMode
					}, _('高级 JSON 模式'))
				]),
				E('div', { 'id': 'omnia-editor-ops-card-box' }, [
					E('div', { 'style': 'display: flex; gap: .25rem; flex-wrap: wrap; margin-bottom: .5rem;' }, [
						E('button', { 'class': omniaMotion.buttonClass('btn cbi-button'), 'style': 'font-size: 11px; padding: 2px 6px;', 'click': function(ev) { ev.preventDefault(); addOp('regex_filter'); } }, '+ 正则过滤'),
						E('button', { 'class': omniaMotion.buttonClass('btn cbi-button'), 'style': 'font-size: 11px; padding: 2px 6px;', 'click': function(ev) { ev.preventDefault(); addOp('regex_rename'); } }, '+ 节点重命名'),
						E('button', { 'class': omniaMotion.buttonClass('btn cbi-button'), 'style': 'font-size: 11px; padding: 2px 6px;', 'click': function(ev) { ev.preventDefault(); addOp('flag'); } }, '+ 国旗添加'),
						E('button', { 'class': omniaMotion.buttonClass('btn cbi-button'), 'style': 'font-size: 11px; padding: 2px 6px;', 'click': function(ev) { ev.preventDefault(); addOp('quick_setting'); } }, '+ 属性设置'),
						E('button', { 'class': omniaMotion.buttonClass('btn cbi-button'), 'style': 'font-size: 11px; padding: 2px 6px;', 'click': function(ev) { ev.preventDefault(); addOp('sort'); } }, '+ 节点排序'),
						E('button', { 'class': omniaMotion.buttonClass('btn cbi-button'), 'style': 'font-size: 11px; padding: 2px 6px;', 'click': function(ev) { ev.preventDefault(); addOp('script'); } }, '+ ucode 脚本')
					]),
					E('div', { 'id': 'omnia-editor-ops-list' })
				]),
				E('div', { 'id': 'omnia-editor-ops-json-box', 'style': 'display: none;' }, [
					E('div', { 'style': 'display: flex; gap: .35rem; align-items: center; margin-bottom: .45rem;' }, [
						E('select', { 'id': 'omnia-editor-ops-preset-select', 'class': 'cbi-input-select', 'style': 'flex: 1; font-size: 12px;' }, [
							E('option', { 'value': '' }, _('选择常用操作符模板...'))
						].concat(opPresets.map(function(item, i) {
							return E('option', { 'value': String(i) }, item.title);
						}))),
						E('button', { 'class': omniaMotion.buttonClass('btn cbi-button'), 'style': 'font-size: 11px; padding: 2px 8px;', 'click': function(ev) { ev.preventDefault(); loadOpPreset(); } }, _('载入模板'))
					]),
					E('textarea', { 'id': 'omnia-editor-ops-json', 'class': 'cbi-input-textarea', 'style': 'width: 100%; min-height: 120px; font-family: monospace; font-size: 12px;', 'placeholder': '[\n  {\n    "type": "flag"\n  }\n]' })
				])
			]),
			E('div', { 'id': 'omnia-editor-test-report', 'style': 'display: none; border: 1px solid #ddd; border-radius: 8px; padding: .65rem; margin-top: .75rem; overflow-wrap: anywhere;' }),
			E('div', { 'style': 'display: flex; justify-content: flex-end; gap: .5rem; flex-wrap: wrap; margin-top: 1rem;' }, [
				E('button', { 'class': omniaMotion.buttonClass('btn cbi-button'), 'click': function(ev) { ev.preventDefault(); closeSourceEditor(); } }, _('取消')),
				E('button', { 'class': omniaMotion.buttonClass('btn cbi-button'), 'click': function(ev) { ev.preventDefault(); testEditorSource(); } }, _('测试连通性')),
				E('button', { 'class': omniaMotion.buttonClass('btn cbi-button'), 'click': function(ev) { ev.preventDefault(); previewEditorSource(); } }, _('👁️ 节点预览')),
				E('button', { 'id': 'omnia-editor-save-btn', 'class': omniaMotion.buttonClass('btn cbi-button cbi-button-save'), 'click': function(ev) { ev.preventDefault(); saveSourceEditor(); } }, _('保存订阅源'))
			])
		])
	]);
}

function sourceRows(summary) {
	let sources = summary && Array.isArray(summary.sources) ? summary.sources : [];
	if (!sources.length)
		return [ E('div', { 'style': 'color: #667; padding: .35rem 0;' }, _('没有观测到订阅源。')) ];

	return sources.map(function(source) {
		let trafficBadge = formatTrafficBadge(source.userinfo);
		return E('div', { 'class': omniaMotion.softRowClass(), 'style': 'display: grid; grid-template-columns: minmax(0, 1.4fr) 80px 90px minmax(0, 1fr); gap: .75rem; padding: .45rem 0; border-bottom: 1px solid #eee; align-items: center;' }, [
			E('div', { 'style': 'overflow-wrap: anywhere; font-weight: 600;' }, [
				E('div', {}, source.name || '-'),
				trafficBadge || ''
			]),
			E('div', {}, source.ok ? _('成功') : _('失败')),
			E('div', {}, '%d'.format(source.node_count || 0)),
			E('div', { 'style': 'overflow-wrap: anywhere; color: #667;' }, source.error || '-')
		]);
	});
}

function nodesForSource(summary, sourceId) {
	let nodes = summary && Array.isArray(summary.nodes) ? summary.nodes : [];
	if (!sourceId || sourceId === '__all__')
		return nodes;

	return nodes.filter(function(node) {
		return (node.source_id || '') === sourceId;
	});
}

function activeSnapshotSource(summary) {
	let sources = summary && Array.isArray(summary.sources) ? summary.sources : [];
	let active = window.omniaNodeSnapshotSource || '__all__';
	if (active === '__all__')
		return active;

	for (let i = 0; i < sources.length; i++) {
		if ((sources[i].id || '') === active)
			return active;
	}

	return '__all__';
}

function setSnapshotSource(sourceId) {
	window.omniaNodeSnapshotSource = sourceId || '__all__';
	let container = document.getElementById('omnia-node-snapshot-summary');
	if (container)
		container.parentNode.replaceChild(snapshotSummary(window.omniaNodeSnapshotSummary || {}), container);
}

function nodeList(nodes) {
	if (!nodes.length)
		return E('div', { 'style': 'color: #667; padding: .7rem 0;' }, _('该订阅源没有观测到节点。'));

	return E('div', {}, nodes.slice(0, 80).map(function(node) {
		return E('div', { 'class': omniaMotion.softRowClass(), 'style': 'display: grid; grid-template-columns: minmax(0, 2fr) minmax(90px, .6fr) minmax(90px, .8fr); gap: .75rem; padding: .45rem 0; border-bottom: 1px solid #eee; align-items: center;' }, [
			E('div', { 'style': 'overflow-wrap: anywhere; font-weight: 600;' }, node.tag || '-'),
			E('div', { 'style': 'color: #667;' }, node.type || '-'),
			E('div', { 'style': 'color: #667;' }, node.source || '-')
		]);
	}));
}

function nodeTabs(summary) {
	let sources = summary && Array.isArray(summary.sources) ? summary.sources : [];
	let active = activeSnapshotSource(summary);
	let tabs = [ { name: '__all__', label: _('全部'), count: summary && summary.node_count || 0 } ].concat(sources.map(function(source) {
		return {
			name: source.id || '',
			label: source.name || _('未命名订阅源'),
			count: source.node_count || 0
		};
	}));
	let nodes = nodesForSource(summary, active);

	return E('div', { 'style': sectionStyle() }, [
		sectionTitle(_('节点摘要')),
		E('div', { 'style': 'display: flex; gap: .45rem; flex-wrap: wrap; margin-bottom: .85rem;' }, tabs.map(function(tab) {
			let selected = tab.name === active;
			return E('button', {
				'class': omniaMotion.buttonClass('btn cbi-button'),
				'style': selected ? 'border-color: #2563eb; background: #eff6ff; color: #1d4ed8;' : '',
				'click': function(ev) {
					ev.preventDefault();
					setSnapshotSource(tab.name);
				}
			}, '%s (%d)'.format(tab.label, tab.count));
		})),
		E('div', { 'style': 'display: grid; grid-template-columns: minmax(0, 2fr) minmax(90px, .6fr) minmax(90px, .8fr); gap: .75rem; color: #667; font-size: 12px; padding-bottom: .4rem; border-bottom: 1px solid #ddd;' }, [
			E('div', {}, _('标签')),
			E('div', {}, _('类型')),
			E('div', {}, _('来源'))
		]),
		nodeList(nodes)
	]);
}

function snapshotSummary(summary) {
	return E('div', { 'id': 'omnia-node-snapshot-summary' }, [
		E('div', { 'style': 'display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: .75rem; margin-bottom: .75rem;' }, [
			omniaUi.statCard(_('节点'), '%d'.format(summary && summary.node_count || 0), { 'class': omniaMotion.cardClass() }),
			omniaUi.statCard(_('订阅源'), '%d'.format(summary && summary.source_count || 0), { 'class': omniaMotion.cardClass() }),
			omniaUi.statCard(_('策略'), summary && summary.refresh_strategy || 'direct', { 'class': omniaMotion.cardClass() }),
			omniaUi.statCard(_('更新时间'), omniaTime.formatMaybeTime(summary && summary.updated_at), { 'class': omniaMotion.cardClass() })
		]),
		E('div', { 'style': sectionStyle() }, [
			sectionTitle(_('订阅源摘要')),
			E('div', { 'style': 'display: grid; grid-template-columns: minmax(0, 1.4fr) 80px 90px minmax(0, 1fr); gap: .75rem; color: #667; font-size: 12px; padding-bottom: .4rem; border-bottom: 1px solid #ddd;' }, [
				E('div', {}, _('名称')),
				E('div', {}, _('状态')),
				E('div', {}, _('节点')),
				E('div', {}, _('错误'))
			]),
			E('div', {}, sourceRows(summary))
		]),
		nodeTabs(summary)
	]);
}

function snapshotDetails(summary) {
	return collapsible(
		_('节点快照'),
	_('%d 个节点，%d 个订阅源，更新于 %s').format(summary && summary.node_count || 0, summary && summary.source_count || 0, omniaTime.formatMaybeTime(summary && summary.updated_at)),
		snapshotSummary(summary),
		false
	);
}

function collectPolicyFromPage() {
	let policy = draftPolicy();
	let keys = regionKeys(policy);

	let pageKeys = keys.slice();
	let inputs = (typeof document !== 'undefined' && document.querySelectorAll) ? document.querySelectorAll('input[id^="omnia-region-keywords-"]') : [];
	for (let i = 0; i < inputs.length; i++) {
		let rCode = inputs[i].id.substring('omnia-region-keywords-'.length);
		if (rCode && pageKeys.indexOf(rCode) < 0) {
			pageKeys.push(rCode);
		}
	}

	policy.refresh_strategy = getValue('omnia-refresh-strategy') === 'proxy' ? 'proxy' : 'direct';
	policy.region_keywords = {};
	pageKeys.forEach(function(region) {
		let el = document.getElementById('omnia-region-keywords-' + region);
		if (el && el.value !== undefined) {
			policy.region_keywords[region] = String(el.value).split(',').map(function(value) {
				return value.trim();
			}).filter(function(value) {
				return value !== '';
			});
		} else if (draftPolicy().region_keywords && draftPolicy().region_keywords[region]) {
			policy.region_keywords[region] = cloneArray(draftPolicy().region_keywords[region]);
		}
	});
	policy.manual_selector = {
		keywords: getValue('omnia-manual-selector-keywords').split(/[\n,]+/).map(function(value) {
			return value.trim();
		}).filter(function(value) {
			return value !== '';
		})
	};
	policy.banned_keywords = getValue('omnia-banned-keywords') || DEFAULT_BANNED_KEYWORDS;
	policy.urltest_params = {
		url: normalizeUrltestUrl(getValue('omnia-urltest-url')),
		interval: getValue('omnia-urltest-interval') || DEFAULT_URLTEST_PARAMS.interval,
		tolerance: Number(getValue('omnia-urltest-tolerance') || DEFAULT_URLTEST_PARAMS.tolerance)
	};
	policy.dns_urltest = {
		enabled: checked('omnia-dns-urltest-enabled'),
		keywords: getValue('omnia-dns-urltest-keywords').split(/[\n,]+/).map(function(value) {
			return value.trim();
		}).filter(function(value) {
			return value !== '';
		}),
		url: normalizeUrltestUrl(getValue('omnia-dns-urltest-url')),
		interval: getValue('omnia-dns-urltest-interval') || DEFAULT_DNS_URLTEST.interval,
		tolerance: Number(getValue('omnia-dns-urltest-tolerance') || DEFAULT_DNS_URLTEST.tolerance)
	};
	let rateRegions = [];
	pageKeys.forEach(function(region) {
		if (checked('omnia-rate-filter-region-' + region))
			rateRegions.push(region);
	});
	let ratePatterns = [];
	if (checked('omnia-rate-filter-pattern-number-x'))
		ratePatterns.push('number_x');
	if (checked('omnia-rate-filter-pattern-number-cn'))
		ratePatterns.push('number_times_cn');
	policy.rate_filter = normalizeRateFilter({
		enabled: checked('omnia-rate-filter-enabled'),
		threshold: Number(getValue('omnia-rate-filter-threshold') || DEFAULT_RATE_FILTER.threshold),
		operator: getValue('omnia-rate-filter-operator') || DEFAULT_RATE_FILTER.operator,
		scope: getValue('omnia-rate-filter-scope') || DEFAULT_RATE_FILTER.scope,
		matched_regions: rateRegions,
		unmatched_action: getValue('omnia-rate-filter-unmatched-action') || DEFAULT_RATE_FILTER.unmatched_action,
		matched_high_rate_action: getValue('omnia-rate-filter-high-action') || DEFAULT_RATE_FILTER.matched_high_rate_action,
		patterns: ratePatterns,
		include_integer_one: checked('omnia-rate-filter-include-one')
	}, pageKeys);
	delete policy.fetch_bypass;
	policy.subscription_update = normalizeSubscriptionUpdate({
		auto_update: checked('omnia-subscription-auto-update'),
		update_hour: Number(getValue('omnia-subscription-update-hour') || DEFAULT_SUBSCRIPTION_UPDATE.update_hour),
		strategy: getValue('omnia-subscription-update-strategy') || DEFAULT_SUBSCRIPTION_UPDATE.strategy,
		run_on_boot: checked('omnia-subscription-run-on-boot')
	});
	policy.sources = policy.sources.map(function(source, index) {
		let allowed = [];
		pageKeys.forEach(function(region) {
			if (checked(matrixId(index, 'region', region)))
				allowed.push(region);
		});
		return Object.assign({}, source, {
			id: source.id,
			name: source.name,
			url: source.url,
			enabled: checked(matrixId(index, 'enabled')),
			allowed_regions: allowed
		});
	});

	setDraft(policy);
	return policy;
}

function syncDraftFromMatrix() {
	collectPolicyFromPage();
	setStatus(_('草稿已更新。请保存订阅设置以持久化更改。'), true);
}

function updateMain(policy, summary, editIndex) {
	let main = document.getElementById('omnia-subscriptions-main');
	if (main)
		main.parentNode.replaceChild(renderMain(policy, summary, editIndex), main);
}

function addSource() {
	let policy = collectPolicyFromPage();
	updateMain(policy, window.omniaNodeSnapshotSummary || {}, 'new');
}

function removeSource(index) {
	let policy = collectPolicyFromPage();
	let source = policy.sources[index] || {};
	let name = source.name || _('未命名订阅源');
	if (window.confirm && !window.confirm(_('确定要删除订阅源 “%s” 吗？').format(name)))
		return;
	policy.sources.splice(index, 1);
	setDraft(policy);
	updateMain(policy, window.omniaNodeSnapshotSummary || {}, null);
	setStatus(_('正在删除订阅源 “%s” 并保存...').format(name), true);
	return callSubscriptionsSave(JSON.stringify(policy, null, 2)).then(function(result) {
		if (result && result.ok) {
			return reloadPolicyFromBackend().then(function() {
				setStatus(_('订阅源 “%s” 已删除并保存。').format(name), true);
			});
		} else {
			setStatus('%s: %s'.format(result && (result.message || result.code) || _('删除失败'), result && (result.detail || result.code) || _('无详细信息')), false);
		}
	}).catch(function(error) {
		setStatus(error.message || String(error), false);
	});
}

function openSourceEditor(index) {
	updateMain(collectPolicyFromPage(), window.omniaNodeSnapshotSummary || {}, index);
}

function closeSourceEditor() {
	updateMain(collectPolicyFromPage(), window.omniaNodeSnapshotSummary || {}, null);
}

function collectEditorDns() {
	if (!checked('omnia-editor-dns-enabled')) return null;
	let jsonBox = document.getElementById('omnia-editor-dns-json-box');
	let isJson = jsonBox && jsonBox.style.display !== 'none';
	if (isJson) {
		let str = getValue('omnia-editor-dns-json').trim();
		if (!str) return null;
		try {
			let parsed = JSON.parse(str);
			if (parsed && typeof parsed === 'object') {
				parsed.enabled = true;
				return parsed;
			}
		} catch (e) {
			return null;
		}
	}
	let server = getValue('omnia-editor-dns-server').trim();
	if (!server) return null;
	let portVal = parseInt(getValue('omnia-editor-dns-port'), 10);
	let dnsObj = {
		enabled: true,
		type: getValue('omnia-editor-dns-type') || 'https',
		server: server
	};
	let tag = getValue('omnia-editor-dns-tag').trim();
	if (tag) dnsObj.tag = tag;
	if (!isNaN(portVal) && portVal > 0) dnsObj.server_port = portVal;
	let path = getValue('omnia-editor-dns-path').trim();
	if (path) dnsObj.path = path;
	let detour = getValue('omnia-editor-dns-detour').trim();
	if (detour) dnsObj.detour = detour;
	let resolver = getValue('omnia-editor-dns-resolver').trim();
	if (resolver) dnsObj.domain_resolver = resolver;
	let strategy = getValue('omnia-editor-dns-strategy');
	if (strategy) dnsObj.strategy = strategy;
	return dnsObj;
}

function collectEditorOperators() {
	let jsonBox = document.getElementById('omnia-editor-ops-json-box');
	let isJson = jsonBox && jsonBox.style.display !== 'none';
	if (isJson) {
		let str = getValue('omnia-editor-ops-json').trim();
		if (!str) return [];
		try {
			let parsed = JSON.parse(str);
			return Array.isArray(parsed) ? parsed : [];
		} catch (e) {
			return [];
		}
	}
	if (window.omniaActiveEditorOps && Array.isArray(window.omniaActiveEditorOps)) {
		return window.omniaActiveEditorOps;
	}
	return [];
}

function testEditorSource() {
	let policy = collectPolicyFromPage();
	let sType = getValue('omnia-editor-type') || 'remote';
	let ops = collectEditorOperators();

	let payloadStr = getValue('omnia-editor-payload');
	let nodes = null;
	if (sType === 'local' && getValue('omnia-editor-subtype') === 'form') {
		try {
			nodes = JSON.parse(payloadStr);
		} catch (e) {}
	}

	return testSource(
		getValue('omnia-editor-name').trim(),
		getValue('omnia-editor-url').trim(),
		policy.refresh_strategy,
		'omnia-editor-test-report',
		{
			type: sType,
			user_agent: getValue('omnia-editor-user-agent').trim(),
			payload: payloadStr,
			nodes: nodes,
			operators: ops
		}
	);
}

function protocolBadgeColor(proto) {
	let p = String(proto || '').toLowerCase();
	if (p === 'shadowsocks' || p === 'ss') return '#2563eb';
	if (p === 'vless') return '#7c3aed';
	if (p === 'vmess') return '#db2777';
	if (p === 'trojan') return '#0891b2';
	if (p === 'hysteria' || p === 'hysteria2') return '#f59e0b';
	if (p === 'tuic') return '#059669';
	if (p === 'wireguard') return '#dc2626';
	if (p === 'direct') return '#475569';
	return '#64748b';
}

function copyToClipboard(text, btn) {
	let finish = function(success) {
		if (!btn) return;
		let orig = btn.innerText;
		btn.innerText = success ? _('已复制！') : _('复制失败');
		setTimeout(function() { btn.innerText = orig; }, 2000);
	};
	if (navigator.clipboard && navigator.clipboard.writeText) {
		navigator.clipboard.writeText(text).then(function() { finish(true); }).catch(function() {
			finish(false);
		});
	} else {
		try {
			let ta = document.createElement('textarea');
			ta.value = text;
			ta.style.position = 'fixed';
			ta.style.opacity = '0';
			document.body.appendChild(ta);
			ta.select();
			let ok = document.execCommand('copy');
			document.body.removeChild(ta);
			finish(ok);
		} catch (e) {
			finish(false);
		}
	}
}

function openNodePreviewModal(opts) {
	let title = (opts && opts.title) || _('节点预览');
	let allOutbounds = (opts && Array.isArray(opts.outbounds)) ? opts.outbounds : [];
	let protocolCounts = (opts && opts.protocolCounts) || {};

	let activeView = 'cards';
	let filterQuery = '';
	let activeProtoFilter = '';

	let overlay = E('div', {
		'id': 'omnia-preview-modal-overlay',
		'style': 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(4px); z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 1.25rem; box-sizing: border-box;'
	});

	let modal = E('div', {
		'class': 'cbi-section',
		'style': 'width: 960px; max-width: 96vw; height: 86vh; max-height: 880px; margin: 0; display: flex; flex-direction: column; overflow: hidden; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); border: 1px solid var(--cbi-section-border, #cbd5e1);'
	});

	function closeModal() {
		document.removeEventListener('keydown', handleKey);
		if (overlay.parentNode)
			overlay.parentNode.removeChild(overlay);
	}

	function handleKey(ev) {
		if (ev.key === 'Escape' || ev.keyCode === 27)
			closeModal();
	}
	document.addEventListener('keydown', handleKey);

	overlay.addEventListener('click', function(ev) {
		if (ev.target === overlay)
			closeModal();
	});

	let header = E('div', {
		'style': 'display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; border-bottom: 1px solid var(--cbi-section-border, #e2e8f0);'
	}, [
		E('div', { 'style': 'display: flex; align-items: center; gap: .6rem;' }, [
			E('span', { 'style': 'font-size: 1.2rem;' }, '👁️'),
			E('h3', { 'style': 'margin: 0; font-size: 1.1rem; font-weight: 700;' }, title)
		]),
		E('button', {
			'type': 'button',
			'class': 'btn cbi-button',
			'style': 'font-size: 1.1rem; padding: 0 .5rem; line-height: 1.5; border-radius: 6px;',
			'click': closeModal
		}, '✕')
	]);

	let statsRow = E('div', {
		'style': 'display: flex; align-items: center; flex-wrap: wrap; gap: .4rem; padding: .65rem 1.25rem; background: var(--cbi-field-background, #f8fafc); border-bottom: 1px solid var(--cbi-section-border, #e2e8f0); font-size: 12px;'
	});

	function renderStatsRow() {
		statsRow.innerHTML = '';
		let totalPill = E('span', {
			'style': 'display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 12px; background: #334155; color: #fff; font-weight: 600; cursor: pointer;',
			'click': function() {
				activeProtoFilter = '';
				renderStatsRow();
				renderBody();
			}
		}, _('全部节点: %d').format(allOutbounds.length));
		statsRow.appendChild(totalPill);

		Object.keys(protocolCounts).sort().forEach(function(proto) {
			let cnt = protocolCounts[proto];
			let isSelected = (activeProtoFilter === proto);
			let color = protocolBadgeColor(proto);
			let protoPill = E('span', {
				'style': 'display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 12px; font-weight: 600; cursor: pointer; transition: all .15s ease;' +
					(isSelected ? 'background: ' + color + '; color: #fff; box-shadow: 0 0 0 2px #fff, 0 0 0 4px ' + color + ';' : 'background: ' + color + '15; color: ' + color + '; border: 1px solid ' + color + '40;'),
				'click': function() {
					activeProtoFilter = (activeProtoFilter === proto ? '' : proto);
					renderStatsRow();
					renderBody();
				}
			}, proto.toUpperCase() + ' (' + cnt + ')');
			statsRow.appendChild(protoPill);
		});
	}

	let toolbar = E('div', {
		'style': 'display: flex; align-items: center; justify-content: space-between; gap: .75rem; flex-wrap: wrap; padding: .65rem 1.25rem; border-bottom: 1px solid var(--cbi-section-border, #e2e8f0);'
	});

	let searchInput = E('input', {
		'type': 'text',
		'class': 'cbi-input-text',
		'style': 'flex: 1; min-width: 220px; font-size: 13px;',
		'placeholder': _('🔍 过滤节点名称、服务器地址、端口、协议...'),
		'input': function(ev) {
			filterQuery = (ev.target.value || '').trim().toLowerCase();
			renderBody();
		}
	});

	let viewSwitchCards = E('button', {
		'class': 'btn cbi-button cbi-button-action',
		'style': 'font-size: 12px; font-weight: 600;',
		'click': function() {
			activeView = 'cards';
			updateViewSwitch();
			renderBody();
		}
	}, _('📋 节点卡片'));

	let viewSwitchJson = E('button', {
		'class': 'btn cbi-button',
		'style': 'font-size: 12px; font-weight: 600;',
		'click': function() {
			activeView = 'json';
			updateViewSwitch();
			renderBody();
		}
	}, _('⚙️ sing-box JSON'));

	let copyJsonBtn = E('button', {
		'class': 'btn cbi-button',
		'style': 'font-size: 12px; font-weight: 600; display: none;',
		'click': function(ev) {
			let filtered = getFilteredOutbounds();
			copyToClipboard(JSON.stringify(filtered, null, 2), ev.target);
		}
	}, _('📄 复制 JSON'));

	function updateViewSwitch() {
		if (activeView === 'cards') {
			viewSwitchCards.className = 'btn cbi-button cbi-button-action';
			viewSwitchJson.className = 'btn cbi-button';
			copyJsonBtn.style.display = 'none';
		} else {
			viewSwitchCards.className = 'btn cbi-button';
			viewSwitchJson.className = 'btn cbi-button cbi-button-action';
			copyJsonBtn.style.display = 'inline-block';
		}
	}

	toolbar.appendChild(searchInput);
	toolbar.appendChild(E('div', { 'style': 'display: flex; gap: .4rem; align-items: center;' }, [
		viewSwitchCards,
		viewSwitchJson,
		copyJsonBtn
	]));

	let bodyContainer = E('div', {
		'style': 'flex: 1; overflow-y: auto; padding: 1rem 1.25rem;'
	});

	function getFilteredOutbounds() {
		return allOutbounds.filter(function(ob) {
			if (activeProtoFilter && String(ob.type || '').toLowerCase() !== activeProtoFilter.toLowerCase())
				return false;
			if (!filterQuery) return true;
			let tag = String(ob.tag || '').toLowerCase();
			let srv = String(ob.server || '').toLowerCase();
			let proto = String(ob.type || '').toLowerCase();
			let port = String(ob.server_port || '');
			return tag.indexOf(filterQuery) >= 0 || srv.indexOf(filterQuery) >= 0 || proto.indexOf(filterQuery) >= 0 || port.indexOf(filterQuery) >= 0;
		});
	}

	function renderBody() {
		bodyContainer.innerHTML = '';
		let filtered = getFilteredOutbounds();

		if (activeView === 'json') {
			let codeEl = E('pre', {
				'style': 'margin: 0; padding: 1rem; background: #0f172a; color: #f8fafc; border-radius: 8px; font-family: monospace; font-size: 12px; line-height: 1.5; overflow: auto; max-height: 100%; word-break: break-all; white-space: pre-wrap;'
			}, JSON.stringify(filtered, null, 2));
			bodyContainer.appendChild(codeEl);
			return;
		}

		if (filtered.length === 0) {
			bodyContainer.appendChild(E('div', {
				'style': 'text-align: center; color: #64748b; padding: 3rem 1rem;'
			}, [
				E('div', { 'style': 'font-size: 2rem; margin-bottom: .5rem;' }, '🔍'),
				E('div', { 'style': 'font-size: 14px; font-weight: 600;' }, _('未找到匹配的节点')),
				E('div', { 'style': 'font-size: 12px; margin-top: .25rem;' }, _('请尝试调整搜索关键词或协议筛选'))
			]));
			return;
		}

		let list = E('div', {
			'style': 'display: flex; flex-direction: column; gap: .6rem;'
		});

		filtered.forEach(function(ob, idx) {
			let proto = String(ob.type || 'unknown').toLowerCase();
			let badgeColor = protocolBadgeColor(proto);

			let tlsTag = '';
			if (ob.tls && ob.tls.enabled) {
				if (ob.tls.reality && ob.tls.reality.enabled) {
					tlsTag = 'Reality';
				} else {
					tlsTag = 'TLS';
				}
			}
			let transportTag = (ob.transport && ob.transport.type) ? String(ob.transport.type).toUpperCase() : '';

			let jsonDetailBox = E('div', {
				'style': 'display: none; margin-top: .6rem; padding-top: .6rem; border-top: 1px dashed var(--cbi-section-border, #e2e8f0);'
			}, [
				E('pre', {
					'style': 'margin: 0; padding: .6rem; background: #0f172a; color: #f8fafc; border-radius: 6px; font-family: monospace; font-size: 11px; line-height: 1.4; overflow: auto; max-height: 250px; white-space: pre-wrap; word-break: break-all;'
				}, JSON.stringify(ob, null, 2))
			]);

			let toggleBtn = E('button', {
				'type': 'button',
				'class': 'btn cbi-button',
				'style': 'font-size: 11px; padding: 2px 6px; line-height: 1.2;',
				'click': function(ev) {
					ev.preventDefault();
					let isOpen = (jsonDetailBox.style.display !== 'none');
					jsonDetailBox.style.display = isOpen ? 'none' : 'block';
					toggleBtn.innerText = isOpen ? _('{ } 配置') : _('✕ 收起');
				}
			}, _('{ } 配置'));

			let card = E('div', {
				'style': 'background: var(--cbi-section-background, #fff); border: 1px solid var(--cbi-section-border, #e2e8f0); border-radius: 8px; padding: .65rem .85rem; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); transition: border-color .15s ease;'
			}, [
				E('div', { 'style': 'display: flex; align-items: center; justify-content: space-between; gap: .5rem; flex-wrap: wrap;' }, [
					E('div', { 'style': 'display: flex; align-items: center; gap: .5rem; flex: 1; min-width: 200px;' }, [
						E('span', {
							'style': 'font-size: 11px; font-family: monospace; color: #94a3b8; min-width: 24px;'
						}, '#' + (idx + 1)),
						E('span', {
							'style': 'display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 700; color: #fff; background: ' + badgeColor + ';'
						}, proto.toUpperCase()),
						E('span', {
							'style': 'font-weight: 600; font-size: 13px; color: var(--cbi-color-text, #1e293b); word-break: break-word;'
						}, ob.tag || _('未命名节点'))
					]),
					E('div', { 'style': 'display: flex; align-items: center; gap: .4rem; font-size: 12px;' }, [
						ob.server ? E('span', {
							'style': 'font-family: monospace; color: #64748b;'
						}, ob.server + (ob.server_port ? ':' + ob.server_port : '')) : E('span'),
						tlsTag ? E('span', {
							'style': 'padding: 1px 5px; border-radius: 3px; font-size: 10px; font-weight: 600; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;'
						}, tlsTag) : E('span'),
						transportTag ? E('span', {
							'style': 'padding: 1px 5px; border-radius: 3px; font-size: 10px; font-weight: 600; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;'
						}, transportTag) : E('span'),
						toggleBtn
					])
				]),
				jsonDetailBox
			]);

			list.appendChild(card);
		});

		bodyContainer.appendChild(list);
	}

	renderStatsRow();
	renderBody();

	modal.appendChild(header);
	modal.appendChild(statsRow);
	modal.appendChild(toolbar);
	modal.appendChild(bodyContainer);
	overlay.appendChild(modal);
	document.body.appendChild(overlay);
}

function previewSourceNodes(index) {
	let policy = collectPolicyFromPage();
	let item = (policy.sources && policy.sources[index]) || {};
	let name = item.name || item.id || _('未命名源');

	setStatus(_('正在加载订阅源节点预览...'), true);
	return callSubscriptionSourcePreview(item.id || '', policy.refresh_strategy, item).then(function(result) {
		if (result && result.ok && result.data) {
			setStatus('', true);
			openNodePreviewModal({
				title: _('订阅源节点预览 - %s').format(name),
				outbounds: result.data.outbounds || [],
				protocolCounts: result.data.protocol_counts || {}
			});
		} else {
			let msg = (result && (result.detail || result.message)) || _('加载预览失败');
			setStatus(_('预览失败：%s').format(msg), false);
		}
	}).catch(function(err) {
		setStatus(_('预览失败：%s').format(err.message || String(err)), false);
	});
}

function previewSnapshotNodes() {
	setStatus(_('正在加载全局节点快照预览...'), true);
	return callNodeSnapshotGet().then(function(result) {
		if (result && result.ok && result.data) {
			let snapshot = {};
			try {
				snapshot = JSON.parse(result.data.content || '{}');
			} catch (e) {
				setStatus(_('解析节点快照失败：%s').format(e.message || String(e)), false);
				return;
			}
			let outbounds = Array.isArray(snapshot.outbounds) ? snapshot.outbounds : [];
			let protoCounts = {};
			outbounds.forEach(function(ob) {
				let proto = String(ob.type || 'unknown').toLowerCase();
				protoCounts[proto] = (protoCounts[proto] || 0) + 1;
			});
			setStatus('', true);
			openNodePreviewModal({
				title: _('全局节点快照预览'),
				outbounds: outbounds,
				protocolCounts: protoCounts
			});
		} else {
			let msg = (result && (result.detail || result.message)) || _('加载快照失败');
			setStatus(_('预览快照失败：%s').format(msg), false);
		}
	}).catch(function(err) {
		setStatus(_('预览快照失败：%s').format(err.message || String(err)), false);
	});
}

function previewEditorSource() {
	let policy = collectPolicyFromPage();
	let sType = getValue('omnia-editor-type') || 'remote';
	let ops = collectEditorOperators();
	let dnsConfig = collectEditorDns();
	let name = getValue('omnia-editor-name').trim() || _('草稿源');
	let regions = [];
	let inputs = document.querySelectorAll ? document.querySelectorAll('.omnia-editor-region') : [];
	for (let i = 0; i < inputs.length; i++) {
		if (inputs[i].checked)
			regions.push(inputs[i].value);
	}

	let sourceObj = {
		name: name,
		type: sType,
		url: sType === 'remote' ? getValue('omnia-editor-url').trim() : '',
		allowed_regions: regions,
		operators: ops,
		dns: dnsConfig
	};

	if (sType === 'remote') {
		let ua = getValue('omnia-editor-user-agent').trim();
		if (ua) sourceObj.user_agent = ua;
		if (!sourceObj.url) {
			setStatus(_('订阅源 URL 不能为空。'), false);
			let urlInput = document.getElementById('omnia-editor-url');
			if (urlInput && typeof urlInput.focus === 'function') urlInput.focus();
			return;
		}
	} else {
		let subtype = getValue('omnia-editor-subtype') || 'paste';
		sourceObj.subtype = subtype;
		let payload = getValue('omnia-editor-payload');
		if (subtype === 'form') {
			try {
				sourceObj.nodes = JSON.parse(payload);
			} catch (e) {
				sourceObj.payload = payload;
			}
		} else {
			sourceObj.payload = payload;
		}
		if (!sourceObj.payload && (!sourceObj.nodes || !sourceObj.nodes.length)) {
			setStatus(_('本地节点内容不能为空。'), false);
			return;
		}
	}

	setStatus(_('正在生成当前编辑源节点预览...'), true);
	return callSubscriptionSourcePreview('', policy.refresh_strategy, sourceObj).then(function(result) {
		if (result && result.ok && result.data) {
			setStatus('', true);
			openNodePreviewModal({
				title: _('节点预览 - %s').format(name),
				outbounds: result.data.outbounds || [],
				protocolCounts: result.data.protocol_counts || {}
			});
		} else {
			let msg = (result && (result.detail || result.message)) || _('生成预览失败');
			setStatus(_('预览失败：%s').format(msg), false);
		}
	}).catch(function(err) {
		setStatus(_('预览失败：%s').format(err.message || String(err)), false);
	});
}

function refreshProgressText(refresh) {
	let task = refresh.task || {};
	let meta = task.meta && typeof task.meta === 'object' ? task.meta : {};
	if (refresh.scope === 'source')
		return _('正在刷新订阅源：%s...').format(refresh.source_name || meta.source_name || '-');
	return _('正在刷新节点快照：%d / %d，当前 %s。').format(task.completed_count || 0, task.total_count || 0, task.current_item || '-');
}

function refreshFinishedText(refresh) {
	let task = refresh.task || {};
	let status = task.status || '';
	if (refresh.scope === 'source') {
		if (status === 'success')
			return _('订阅源已刷新：%s。准备使用新节点时，请生成候选配置。').format(refresh.source_name || '-');
		if (status === 'failed_preserved')
			return _('订阅源刷新失败，已保留旧节点：%s。').format(refresh.source_name || '-');
	}
	if (status === 'success')
		return _('节点快照已刷新。准备使用新节点时，请生成候选配置。');
	if (status === 'partial')
		return _('节点快照部分刷新完成，请查看各订阅源结果。');
	return task.last_error ? _('订阅刷新未完成：%s。').format(task.last_error) : _('订阅刷新未完成：%s。').format(status || _('未知'));
}

function refreshTaskStale(task) {
	let updatedAt = task && task.updated_at ? Date.parse(task.updated_at) : NaN;
	return Number.isFinite(updatedAt) && Date.now() - updatedAt > 120000;
}

function redrawRefreshState() {
	updateMain(draftPolicy(), window.omniaNodeSnapshotSummary || {}, null);
	updateRefreshControls();
}

const MAX_REFRESH_POLL_ATTEMPTS = 120;

function waitRefresh(runId, attempt) {
	if (attempt >= MAX_REFRESH_POLL_ATTEMPTS) {
		setActiveRefresh(null);
		setStatus(_('订阅刷新任务轮询超时，任务可能已在后台中断。请刷新页面或前往【网络诊断】查看日志。'), false);
		redrawRefreshState();
		return Promise.resolve();
	}

	return callSubscriptionsRefreshStatus(runId).then(function(result) {
		let data = result && result.ok && result.data ? result.data : {};
		let refresh = activeRefresh();
		if (!refresh || refresh.run_id !== runId)
			return;
		if (!data.matches_run) {
			setActiveRefresh(null);
			setStatus(_('订阅刷新任务已被其他操作替换。'), false);
			redrawRefreshState();
			return;
		}

		refresh.task = data.task || {};
		setActiveRefresh(refresh);
		redrawRefreshState();
		if (!refreshStatusDone(refresh.task.status)) {
			setRefreshStatus(refreshTaskStale(refresh.task) ? _('订阅刷新任务超过两分钟没有更新，仍在等待后台恢复。') : refreshProgressText(refresh), !refreshTaskStale(refresh.task));
			return new Promise(function(resolve) {
				window.setTimeout(resolve, refreshTaskStale(refresh.task) ? 5000 : 1000);
			}).then(function() {
				return waitRefresh(runId, attempt + 1);
			});
		}

		return callNodeSnapshotSummary().then(function(summary) {
			if (summary && summary.ok && summary.data)
				updateSummary(summary.data);
			let ok = refresh.task.status === 'success';
			if (ok) {
				let statusEl = E('div', { 'style': 'display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: .5rem;' }, [
					E('span', {}, refreshFinishedText(refresh)),
					E('button', {
						'class': 'cbi-button cbi-button-action',
						'style': 'margin-left: auto; font-weight: 600;',
						'click': function(ev) {
							applyToRuntimeContextual(ev.target);
						}
					}, _('⚡ 立即生成并应用到运行时'))
				]);
				setStatus(statusEl, true);
			} else {
				setStatus(refreshFinishedText(refresh), false);
			}
			redrawRefreshState();
		});
	}).catch(function(error) {
		let refresh = activeRefresh();
		if (refresh && refresh.run_id === runId) {
			setActiveRefresh(null);
			setStatus(error.message || String(error), false);
			redrawRefreshState();
		}
	});
}

function beginRefresh(result, scope, sourceId, sourceName) {
	let data = result && result.data ? result.data : {};
	let task = data.task || {};
	let runId = data.run_id || (task.meta && task.meta.run_id) || '';
	if (!runId) {
		setStatus(_('订阅刷新任务未返回运行标识。'), false);
		return;
	}

	setActiveRefresh({
		run_id: runId,
		scope: data.scope || (task.meta && task.meta.scope) || scope,
		source_id: data.source_id || (task.meta && task.meta.target_source_id) || sourceId || '',
		source_name: sourceName || '',
		task: task
	});
	redrawRefreshState();
	setRefreshStatus(refreshProgressText(activeRefresh()), true);
	return waitRefresh(runId, 0);
}

function refreshOneSource(index, retried) {
	let policy = collectPolicyFromPage();
	let source = policy.sources[index] || {};
	let sourceId = source.id || '';
	let sourceName = source.name || _('未命名订阅源');
	let strategy = policy.refresh_strategy || getValue('omnia-refresh-strategy') || 'direct';

	if (!sourceId) {
		if (!retried) {
			setStatus(_('Reloading saved subscription settings...'), true);
			return reloadPolicyFromBackend().then(function() {
				return refreshOneSource(index, true);
			}).catch(function(error) {
				setStatus(error.message || String(error), false);
			});
		}
		setStatus(_('请先保存订阅设置，再刷新单个订阅源。'), false);
		return Promise.resolve();
	}

	setStatus(_('正在提交订阅源刷新：%s...').format(sourceName), true);
	return callSubscriptionRefreshSourceStart(sourceId, strategy).then(function(result) {
		if (!(result && result.ok)) {
			setStatus('%s: %s'.format(result && (result.message || result.code) || _('刷新失败'), subscriptionFailureHint(result && (result.detail || result.code) || '')), false);
			return;
		}
		if (!(result.data && result.data.started)) {
			let task = result.data && result.data.task ? result.data.task : {};
			let runId = task.meta && task.meta.run_id || '';
			if (runId)
				return beginRefresh(result, task.meta && task.meta.scope || 'all', task.meta && task.meta.target_source_id || '', '');
			setStatus(_('已有%s正在运行，请稍后再试。').format(taskDisplayName(result, _('订阅刷新任务'))), false);
			return;
		}
		return beginRefresh(result, 'source', sourceId, sourceName);
	}).catch(function(error) {
		setStatus(error.message || String(error), false);
	});
}

function saveSourceEditor() {
	let editor = document.getElementById('omnia-source-editor');
	let index = editor ? Number(editor.getAttribute('data-index')) : -1;
	let policy = collectPolicyFromPage();
	let regions = [];
	let inputs = document.querySelectorAll ? document.querySelectorAll('.omnia-editor-region') : [];

	for (let i = 0; i < inputs.length; i++) {
		if (inputs[i].checked)
			regions.push(inputs[i].value);
	}

	let sType = getValue('omnia-editor-type') || 'remote';
	let ops = collectEditorOperators();
	let dnsConfig = collectEditorDns();

	let name = getValue('omnia-editor-name').trim();
	if (!name) {
		setStatus(_('订阅源名称不能为空。'), false);
		let nameInput = document.getElementById('omnia-editor-name');
		if (nameInput && typeof nameInput.focus === 'function') nameInput.focus();
		return;
	}

	let enabledEl = document.getElementById('omnia-editor-enabled');
	let isEnabled = true;
	if (enabledEl) {
		if (typeof enabledEl.checked === 'boolean')
			isEnabled = enabledEl.checked;
		else {
			let attr = enabledEl.getAttribute ? enabledEl.getAttribute('checked') : null;
			isEnabled = (attr === 'checked' || attr === 'true' || attr === '');
		}
	} else if (index >= 0 && policy.sources[index] && policy.sources[index].enabled != null) {
		isEnabled = !!policy.sources[index].enabled;
	}

	let sourceObj = {
		id: (index >= 0 && policy.sources[index] && policy.sources[index].id) ? policy.sources[index].id : '',
		name: name,
		type: sType,
		url: sType === 'remote' ? getValue('omnia-editor-url').trim() : '',
		enabled: isEnabled,
		allowed_regions: regions,
		operators: ops,
		dns: dnsConfig
	};

	if (sType === 'remote') {
		if (!sourceObj.url) {
			setStatus(_('订阅源 URL 不能为空。'), false);
			let urlInput = document.getElementById('omnia-editor-url');
			if (urlInput && typeof urlInput.focus === 'function') urlInput.focus();
			return;
		}
		if (sourceObj.url.indexOf('http://') !== 0 && sourceObj.url.indexOf('https://') !== 0) {
			setStatus(_('订阅源 URL 必须以 http:// 或 https:// 开头。'), false);
			let urlInput = document.getElementById('omnia-editor-url');
			if (urlInput && typeof urlInput.focus === 'function') urlInput.focus();
			return;
		}
		let ua = getValue('omnia-editor-user-agent').trim();
		if (ua) sourceObj.user_agent = ua;
	} else {
		let subtype = getValue('omnia-editor-subtype') || 'paste';
		sourceObj.subtype = subtype;
		let payload = getValue('omnia-editor-payload');
		if (subtype === 'form') {
			try {
				sourceObj.nodes = JSON.parse(payload);
			} catch (e) {
				sourceObj.payload = payload;
			}
		} else {
			sourceObj.payload = payload;
		}
		if (!sourceObj.payload && (!sourceObj.nodes || !sourceObj.nodes.length)) {
			setStatus(_('本地节点内容不能为空。'), false);
			return;
		}
	}

	if (index >= 0 && policy.sources[index] && policy.sources[index].userinfo)
		sourceObj.userinfo = policy.sources[index].userinfo;

	if (index < 0 || !policy.sources[index])
		policy.sources.push(sourceObj);
	else
		policy.sources[index] = sourceObj;

	setDraft(policy);
	setStatus(_('正在保存订阅源设置...'), true);

	let saveBtn = document.getElementById('omnia-editor-save-btn');
	if (saveBtn) {
		saveBtn.disabled = true;
		saveBtn.innerText = _('正在保存...');
	}

	return callSubscriptionsSave(JSON.stringify(policy, null, 2)).then(function(result) {
		if (result && result.ok) {
			return reloadPolicyFromBackend().then(function() {
				let statusEl = E('div', { 'style': 'display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: .5rem;' }, [
					E('span', {}, _('订阅源 “%s” 已成功保存！').format(name)),
					E('button', {
						'class': 'cbi-button cbi-button-action',
						'style': 'margin-left: auto; font-weight: 600;',
						'click': function(ev) {
							applyToRuntimeContextual(ev.target);
						}
					}, _('⚡ 立即生成并应用到运行时'))
				]);
				setStatus(statusEl, true);
			});
		} else {
			setStatus('%s: %s'.format(result && (result.message || result.code) || _('保存失败'), result && (result.detail || result.code) || _('无详细信息')), false);
			if (saveBtn) {
				saveBtn.disabled = false;
				saveBtn.innerText = _('保存订阅源');
			}
		}
	}).catch(function(error) {
		setStatus(error.message || String(error), false);
		if (saveBtn) {
			saveBtn.disabled = false;
			saveBtn.innerText = _('保存订阅源');
		}
	});
}

function updateSummary(summary) {
	window.omniaNodeSnapshotSummary = summary || {};
	let container = document.getElementById('omnia-node-snapshot-summary');
	if (container)
		container.parentNode.replaceChild(snapshotSummary(summary), container);
	updateMain(draftPolicy(), summary || {}, null);
}

function reloadPolicyFromBackend() {
	return Promise.all([
		callSubscriptionsGet(),
		callNodeSnapshotSummary().catch(function() { return null; })
	]).then(function(results) {
		let subRes = results[0];
		let snapRes = results[1];
		if (snapRes && snapRes.ok && snapRes.data) {
			window.omniaNodeSnapshotSummary = snapRes.data;
			let container = document.getElementById('omnia-node-snapshot-summary');
			if (container)
				container.parentNode.replaceChild(snapshotSummary(snapRes.data), container);
		}
		if (!(subRes && subRes.ok && subRes.data))
			return;

		let policy = parseSubscriptions(subRes.data.content || '{}');
		setDraft(policy);
		updateMain(policy, window.omniaNodeSnapshotSummary || {}, null);
		updatePolicyDetails(policy);
	});
}

function renderMain(policy, summary, editIndex) {
	return E('div', { 'id': 'omnia-subscriptions-main' }, [
		sourceMatrix(policy, summary),
		E('div', { 'id': 'omnia-test-report', 'style': 'display: none; border: 1px solid #ddd; border-radius: 8px; padding: .65rem; margin: -.35rem 0 1rem; overflow-wrap: anywhere;' }),
		sourceEditor(policy, editIndex)
	]);
}

return view.extend({
	load: function() {
		return Promise.all([
			callSubscriptionsGet(),
			callNodeSnapshotSummary().catch(function(e) {
				return { ok: false, message: _('节点快照摘要加载失败'), detail: e.message || String(e) };
			}),
			callSubscriptionsRefreshStatus().catch(function(e) {
				return { ok: false, message: _('订阅刷新状态加载失败'), detail: e.message || String(e) };
			})
		]);
	},

	render: function(data) {
		let content = data && data[0] && data[0].ok && data[0].data ? data[0].data.content : '{}';
		let summary = data && data[1] && data[1].ok && data[1].data ? data[1].data : {};
		let refreshData = data && data[2] && data[2].ok && data[2].data ? data[2].data : {};
		let refreshTask = refreshData.task || {};
		let refreshMeta = refreshTask.meta && typeof refreshTask.meta === 'object' ? refreshTask.meta : {};
		if (!refreshStatusDone(refreshTask.status) && refreshMeta.run_id) {
			setActiveRefresh({
				run_id: refreshMeta.run_id,
				scope: refreshMeta.scope || 'all',
				source_id: refreshMeta.target_source_id || '',
				source_name: refreshMeta.source_name || '',
				task: refreshTask
			});
		} else {
			setActiveRefresh(null);
		}
		let policy = parseSubscriptions(content);
		omniaMotion.inject();
		window.omniaNodeSnapshotSummary = summary;
		setDraft(policy);

		let page = E('div', { 'class': 'cbi-map' }, [
			E('div', {}, [
				pageHeader(_('订阅'), _('管理原生订阅转换源、本地节点录入、专用 DNS、有序操作符与脚本过滤。刷新只写入节点快照。')),
				omniaUi.statusBox('omnia-subscriptions-status', '', 'neutral', { margin: '0 0 .75rem' }),
				E('div', { 'style': 'display: flex; justify-content: flex-end; gap: .5rem; flex-wrap: wrap; margin: 0 0 .75rem;' }, [
					E('select', { 'id': 'omnia-refresh-strategy', 'class': 'cbi-input-select' }, [
						E('option', { 'value': 'direct', 'selected': policy.refresh_strategy === 'direct' ? 'selected' : null }, _('直连刷新')),
						E('option', { 'value': 'proxy', 'selected': policy.refresh_strategy === 'proxy' ? 'selected' : null }, _('代理刷新'))
					]),
					E('button', { 'class': omniaMotion.buttonClass('btn cbi-button cbi-button-save'), 'click': this.handleSave.bind(this) }, _('保存订阅设置')),
					E('button', { 'id': 'omnia-preview-all', 'class': omniaMotion.buttonClass('btn cbi-button'), 'click': function(ev) { ev.preventDefault(); previewSnapshotNodes(); } }, _('👁️ 预览快照节点')),
					E('button', { 'id': 'omnia-refresh-all', 'class': omniaMotion.buttonClass('btn cbi-button cbi-button-apply'), 'disabled': refreshInProgress() ? 'disabled' : null, 'click': this.handleRefresh.bind(this) }, _('刷新节点快照'))
				]),
				renderMain(policy, summary, null),
				subscriptionUpdateDetails(policy),
				policyDetails(policy),
				snapshotDetails(summary)
			])
		]);
		let refresh = activeRefresh();
		if (refresh)
			window.setTimeout(function() { waitRefresh(refresh.run_id, 0); }, 0);
		return page;
	},

	handleSave: function(ev) {
		if (ev)
			ev.preventDefault();
		let policy = collectPolicyFromPage();
		setStatus(_('正在保存订阅设置...'), true);
		return callSubscriptionsSave(JSON.stringify(policy, null, 2)).then(function(result) {
			if (result && result.ok)
				setStatus(_('订阅设置已保存。准备使用这些更改时，请生成候选配置。'), true);
			else
				setStatus('%s: %s'.format(result && (result.message || result.code) || _('保存失败'), result && (result.detail || result.code) || _('无详细信息')), false);
		}).catch(function(error) {
			setStatus(error.message || String(error), false);
		});
	},

	handleRefresh: function(ev) {
		if (ev)
			ev.preventDefault();
		let strategy = getValue('omnia-refresh-strategy') || '';
		setStatus(_('正在提交节点快照刷新...'), true);
		return callSubscriptionsRefreshStart(strategy).then(function(result) {
			if (!(result && result.ok)) {
				setStatus('%s: %s'.format(result && (result.message || result.code) || _('刷新失败'), subscriptionFailureHint(result && (result.detail || result.code) || '')), false);
				return;
			}

			if (!(result.data && result.data.started)) {
				let task = result.data && result.data.task ? result.data.task : {};
				let runId = task.meta && task.meta.run_id || '';
				if (runId)
					return beginRefresh(result, task.meta && task.meta.scope || 'all', task.meta && task.meta.target_source_id || '', '');
				setStatus(_('已有%s正在运行，请稍后再试。').format(taskDisplayName(result, _('订阅刷新任务'))), false);
				return;
			}
			return beginRefresh(result, 'all', '', '');
		}).catch(function(error) {
			setStatus(error.message || String(error), false);
		});
	},

	handleSaveApply: null,
	handleReset: null
});
