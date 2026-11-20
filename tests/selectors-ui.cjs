const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

let savedSelectorsContent = null;
let configGenerateCalled = false;
let configCheckCalled = false;
let configApplyCalled = false;
let statusMessage = '';
let statusOk = true;

const responses = {
	config_generate: async () => { configGenerateCalled = true; return { ok: true, data: { node_count: 30, generated_groups: 3 } }; },
	config_check_candidate: async () => { configCheckCalled = true; return { ok: true, data: {} }; },
	config_apply: async () => { configApplyCalled = true; return { ok: true, data: { health_ready: true } }; },
	template_selectors_get: async () => ({
		ok: true,
		data: {
			main_selector: '🗽 节点选择',
			all_selectors: [
				{ tag: '🗽 节点选择', is_main: true },
				{ tag: '📺️ Netflix', is_main: false },
				{ tag: '🅾️ OpenAI', is_main: false }
			],
			regions: [
				{ id: 'HK', label: '🇭🇰 香港 (HK)' },
				{ id: 'TW', label: '🇹🇼 台湾 (TW)' },
				{ id: 'SG', label: '🇸🇬 新加坡 (SG)' },
				{ id: 'JP', label: '🇯🇵 日本 (JP)' },
				{ id: 'US', label: '🇺🇸 美国 (US)' }
			],
			system: [
				{ id: 'main', tag: '🗽 节点选择', label: '🗽 节点选择' },
				{ id: 'direct', tag: '🎯 全球直连', label: '🎯 全球直连' },
				{ id: 'manual', tag: '🍭 手动选择', label: '🍭 手动选择' }
			],
			selectors: [
				{
					tag: '🗽 节点选择',
					is_main: true,
					x_rule: 'main',
					configured_members: [],
					is_custom: false,
					preview_outbounds: ['🇸🇬 SG-Group', '🇭🇰 HK-Group', 'node-unmatched-1'],
					preview_object: {
						type: 'selector',
						tag: '🗽 节点选择',
						outbounds: ['🇸🇬 SG-Group', '🇭🇰 HK-Group', 'node-unmatched-1']
					}
				},
				{
					tag: '📺️ Netflix',
					is_main: false,
					x_rule: 'region:SG,HK,TW',
					configured_members: [],
					is_custom: false,
					preview_outbounds: ['🗽 节点选择', '🇸🇬 SG-Group', '🇭🇰 HK-Group', '🇹🇼 TW-Group'],
					preview_object: {
						type: 'selector',
						tag: '📺️ Netflix',
						outbounds: ['🗽 节点选择', '🇸🇬 SG-Group', '🇭🇰 HK-Group', '🇹🇼 TW-Group']
					}
				},
				{
					tag: '🅾️ OpenAI',
					is_main: false,
					x_rule: 'region:US',
					configured_members: [],
					is_custom: false,
					preview_outbounds: ['🗽 节点选择', '🇺🇸 US-Group'],
					preview_object: {
						type: 'selector',
						tag: '🅾️ OpenAI',
						outbounds: ['🗽 节点选择', '🇺🇸 US-Group']
					}
				}
			]
		}
	}),
	template_selectors_save: async (content) => {
		savedSelectorsContent = content;
		return { ok: true, data: { saved: true } };
	}
};

const domElements = {};

function createElement(tag, attrs, children) {
	const el = {
		tag,
		attrs: attrs || {},
		children: children || [],
		value: attrs && attrs.value !== undefined ? attrs.value : (typeof children === 'string' ? children : ''),
		className: attrs && attrs.class || '',
		textContent: (typeof children === 'string') ? children : '',
		selectionStart: 0,
		selectionEnd: 0,
		style: attrs && attrs.style || {},
		addEventListener() {},
		appendChild(c) {
			if (Array.isArray(children)) children.push(c);
		}
	};
	if (attrs && attrs.id) {
		domElements[attrs.id] = el;
	}
	return el;
}

const context = vm.createContext({
	console,
	setTimeout,
	window: {
		confirm: () => true
	},
	document: {
		getElementById: (id) => domElements[id] || null
	},
	rpc: {
		declare: spec => (content) => responses[spec.method](content)
	},
	view: {
		extend: value => value
	},
	_: value => value,
	E: createElement
});

vm.runInContext("String.prototype.format = function() { let args = arguments, i = 0; return this.replace(/%s/g, () => args[i++]); };", context);

const source = fs.readFileSync('luci-app-omnia/htdocs/luci-static/resources/view/omnia/selectors.js', 'utf8');

const wrapped = `
(function() {
	const omniaUi = {
		dataOf: res => (res && res.data ? res.data : (res || {})),
		sectionStyle: () => 'section;',
		sectionTitle: t => E('h3', {}, t),
		sectionDescription: d => E('p', {}, d),
		fieldLabel: l => E('label', {}, l),
		actionRow: children => E('div', { class: 'action-row' }, children),
		statusBox: (id, text, type) => E('div', { id }),
		paintStatus: (id, text, type) => {
			globalThis.statusMessage = text;
			globalThis.statusOk = (type === 'ok');
		},
		pageHeader: (t, d) => E('div', {}, [t, d]),
		pill: (text, tone, options) => {
			options = options || {};
			return E('span', { id: options.id || null, class: 'pill-' + (tone || 'neutral') }, text);
		},
		pillClass: t => 'pill-' + t,
		paintPill: (id, text, type) => {
			let node = typeof id === 'string' ? domElements[id] : id;
			if (node) {
				if (text != null) node.textContent = text;
				node.className = 'pill-' + (type || 'neutral');
			}
		}
	};

	const omniaMotion = {
		buttonClass: c => c,
		inject: () => {}
	};

	${source
		.replace(/'require omnia.ui as omniaUi';/, '')
		.replace(/'require omnia.motion as omniaMotion';/, '')
		.replace('return view.extend({', `
			globalThis.selectorsModule = {
				initSelectorState,
				onMainSelectorChange,
				addMember,
				removeMember,
				addAllRegions,
				resetSelector,
				resetAllSelectors,
				saveSelectors,
				saveAndApplySelectors,
				generateSelectorPreview,
				openPreviewModal,
				closePreviewModal,
				candidateLabel,
				getCandidatePool: () => candidatePool,
				getSelectedMainSelector: () => selectedMainSelector,
				getSelectorConfigState: () => selectorConfigState
			};
			return view.extend({
		`)}
})()
`;

const viewObj = vm.runInContext(wrapped, context);

(async () => {
	// Initialize view
	const data = await viewObj.load();
	const rendered = viewObj.render(data);
	assert.ok(rendered, 'View renders DOM elements');
	assert.ok(domElements['omnia-main-selector-container'], 'Main selector container rendered');
	assert.ok(domElements['omnia-selector-cards-container'], 'Business selector cards container rendered');
	assert.ok(domElements['omnia-selectors-save-btn'], 'Save button rendered');
	assert.ok(domElements['omnia-selectors-save-apply-btn'], 'Save and apply button rendered');

	const mod = context.selectorsModule;

	// 1. Check Initial State & Main Selector resolution
	assert.equal(mod.getSelectedMainSelector(), '🗽 节点选择', 'Initial main selector is 🗽 节点选择');
	const pool = mod.getCandidatePool();
	assert.equal(pool.all_selectors.length, 3, 'All selectors listed');

	// 2. Test Main Selector change
	mod.onMainSelectorChange('📺️ Netflix');
	assert.equal(mod.getSelectedMainSelector(), '📺️ Netflix', 'Main selector updated to 📺️ Netflix');
	// Switch back
	mod.onMainSelectorChange('🗽 节点选择');
	assert.equal(mod.getSelectedMainSelector(), '🗽 节点选择', 'Main selector switched back');

	// 3. Test Preview for Main Selector
	const mainItem = {
		tag: '🗽 节点选择',
		is_main: true,
		preview_outbounds: ['🇸🇬 SG-Group', '🇭🇰 HK-Group', 'node-unmatched-1']
	};
	const mainPreview = mod.generateSelectorPreview(mainItem);
	assert.equal(mainPreview.type, 'selector');
	assert.equal(mainPreview.tag, '🗽 节点选择');
	assert.deepEqual(mainPreview.outbounds, ['🇸🇬 SG-Group', '🇭🇰 HK-Group', 'node-unmatched-1'], 'Main selector previews aggregated groups');

	// 4. Test Member Allocation on Business Selector
	const tag = '📺️ Netflix';
	mod.addMember(tag, 'SG');
	mod.addMember(tag, 'HK');
	mod.addMember(tag, 'main');
	let netflixPreview = mod.generateSelectorPreview({ tag });
	assert.equal(netflixPreview.type, 'selector');
	assert.equal(netflixPreview.tag, tag);
	assert.ok(netflixPreview.outbounds.includes('🇸🇬 新加坡测速组'), 'Preview includes SG group');
	assert.ok(netflixPreview.outbounds.includes('🇭🇰 香港测速组'), 'Preview includes HK group');
	assert.ok(netflixPreview.outbounds.includes('🗽 节点选择'), 'Preview includes main root selector');

	// 5. Test Remove Member
	mod.removeMember(tag, 'SG');
	netflixPreview = mod.generateSelectorPreview({ tag });
	assert.ok(!netflixPreview.outbounds.includes('🇸🇬 新加坡测速组'), 'Removed SG group');

	// 6. Test Add All Regions Shortcut
	mod.addAllRegions(tag);
	netflixPreview = mod.generateSelectorPreview({ tag });
	assert.ok(netflixPreview.outbounds.includes('🇸🇬 新加坡测速组'), 'All regions re-added SG');
	assert.ok(netflixPreview.outbounds.includes('🇯🇵 日本测速组'), 'All regions added JP');
	assert.ok(netflixPreview.outbounds.includes('🇺🇸 美国测速组'), 'All regions added US');

	// 7. Test Reset Selector
	mod.resetSelector(tag);
	const fallbackItem = {
		tag,
		preview_outbounds: ['🗽 节点选择', '🇸🇬 SG-Group', '🇭🇰 HK-Group', '🇹🇼 TW-Group']
	};
	const fallbackPreview = mod.generateSelectorPreview(fallbackItem);
	assert.deepEqual(fallbackPreview.outbounds, ['🗽 节点选择', '🇸🇬 SG-Group', '🇭🇰 HK-Group', '🇹🇼 TW-Group'], 'Reset selector falls back to template');

	// 8. Test Save Flow with Main Selector Payload
	mod.addMember(tag, 'HK');
	savedSelectorsContent = null;
	await mod.saveSelectors();
	assert.ok(savedSelectorsContent != null, 'saveSelectors invoked template_selectors_save');
	const parsedPayload = JSON.parse(savedSelectorsContent);
	assert.equal(typeof parsedPayload, 'object', 'Payload is JSON object');
	assert.equal(parsedPayload.main_selector, '🗽 节点选择', 'Payload includes main_selector');
	assert.ok(Array.isArray(parsedPayload.selectors[tag]), 'Payload includes selectors object with tag');
	assert.ok(parsedPayload.selectors[tag].includes('HK'), 'Tag contains member HK');

	// 9. Test Save and Apply Flow
	savedSelectorsContent = null;
	configGenerateCalled = false;
	configCheckCalled = false;
	configApplyCalled = false;
	await mod.saveAndApplySelectors();
	assert.ok(savedSelectorsContent != null, 'saveAndApplySelectors saved configuration');
	assert.ok(configGenerateCalled, 'config_generate called');
	assert.ok(configCheckCalled, 'config_check_candidate called');
	assert.ok(configApplyCalled, 'config_apply called');
	assert.equal(context.statusOk, true, 'Status marked ok');

	console.log('All selectors-ui tests passed successfully!');
})().catch(err => {
	console.error('Test failed:', err);
	process.exit(1);
});
