const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const mockProfile = {
	inbounds: [{ type: 'tun', tag: 'tun-in' }],
	outbounds: [{ type: 'selector', tag: 'select', x_rule: 'main', outbounds: ['direct'] }, { type: 'direct', tag: 'direct' }],
	route: { rules: [] }
};

let runtimeConfigCalled = false;
const responses = {
	runtime_config_get: async () => {
		runtimeConfigCalled = true;
		return {
			ok: true,
			data: {
				exists: true,
				path: '/etc/omnia/runtime/config.json',
				content: JSON.stringify(mockProfile, null, 2),
				size: 1024,
				mtime: 1731750000
			}
		};
	},
	api_status: async () => ({ ok: true, data: {} }),
	diagnostics_get: async () => ({ ok: true, data: { files: {}, runtime: {}, service: {} } }),
	last_error_get: async () => ({ ok: true, data: { content: '' } }),
	task_locks_get: async () => ({ ok: true, data: { locks: [] } }),
	logs_get: async () => ({ ok: true, data: { lines: [] } }),
	connectivity_probe: async () => ({ ok: true, data: {} })
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
	setTimeout: (fn) => fn(),
	window: {
		confirm: () => true,
		setTimeout: (fn) => fn()
	},
	document: {
		getElementById: (id) => domElements[id] || null
	},
	rpc: {
		declare: spec => () => responses[spec.method]()
	},
	view: {
		extend: value => value
	},
	_: value => value,
	E: createElement
});

vm.runInContext("String.prototype.format = function() { let args = arguments, i = 0; return this.replace(/%s|%d/g, () => args[i++]); };", context);

const mockOmniaUi = {
	sectionStyle: () => 'section;',
	mutedStyle: () => 'muted;',
	sectionTitle: t => createElement('h3', {}, t),
	sectionDescription: d => createElement('p', {}, d),
	fieldLabel: l => createElement('label', {}, l),
	actionRow: children => createElement('div', { class: 'action-row' }, children),
	pageHeader: (t, d) => createElement('div', {}, [t, d]),
	pill: (text, tone, options) => {
		options = options || {};
		return createElement('span', { id: options.id || null, class: 'pill-' + (tone || 'neutral') }, text);
	},
	valueText: v => String(v || '-'),
	dataOf: res => (res && res.ok && res.data) ? res.data : {}
};

const mockOmniaMotion = {
	buttonClass: c => c,
	softRowClass: () => 'soft-row',
	inject: () => {}
};

const mockOmniaTime = {
	formatMaybeTime: t => String(t || '-'),
	formatUnixTime: t => String(t || '-')
};

const source = fs.readFileSync('luci-app-omnia/htdocs/luci-static/resources/view/omnia/diagnostics.js', 'utf8');

const wrapped = `
(function() {
	const omniaUi = ${JSON.stringify(mockOmniaUi)};
	omniaUi.sectionStyle = () => 'section;';
	omniaUi.mutedStyle = () => 'muted;';
	omniaUi.sectionTitle = t => E('h3', {}, t);
	omniaUi.sectionDescription = d => E('p', {}, d);
	omniaUi.fieldLabel = l => E('label', {}, l);
	omniaUi.actionRow = children => E('div', { class: 'action-row' }, children);
	omniaUi.pageHeader = (t, d) => E('div', {}, [t, d]);
	omniaUi.pill = (text, tone, options) => E('span', {}, text);
	omniaUi.valueText = v => String(v || '-');
	omniaUi.dataOf = res => (res && res.ok && res.data) ? res.data : {};

	const omniaMotion = {
		buttonClass: c => c,
		softRowClass: () => 'soft-row',
		inject: () => {}
	};

	const omniaTime = {
		formatMaybeTime: t => String(t || '-'),
		formatUnixTime: t => String(t || '-')
	};

	${source
		.replace(/'require omnia.ui as omniaUi';/, '')
		.replace(/'require omnia.motion as omniaMotion';/, '')
		.replace(/'require omnia.time as omniaTime';/, '')
		.replace('return view.extend({', `
			globalThis.diagnosticsModule = {
				getActiveTab: () => activeTab,
				setActiveTab: (t) => { activeTab = t; },
				renderPage,
				updateConfigLineNumbers,
				formattedConfigContent
			};
			return view.extend({
		`)}
})()
`;

const viewObj = vm.runInContext(wrapped, context);

(async () => {
	const data = await viewObj.load();
	assert.ok(runtimeConfigCalled, 'runtime_config_get called on initial load');

	const rendered = viewObj.render(data);
	assert.ok(rendered, 'View renders DOM elements');

	const mod = context.diagnosticsModule;
	assert.equal(mod.getActiveTab(), 'config', 'Default tab is config (运行配置)');

	// Verify line number and textarea elements
	assert.ok(domElements['omnia-runtime-config-viewer'], 'Runtime config textarea rendered');
	assert.ok(domElements['omnia-runtime-config-gutter'], 'Runtime config gutter rendered');

	const viewer = domElements['omnia-runtime-config-viewer'];
	const gutter = domElements['omnia-runtime-config-gutter'];

	// Trigger line numbers update
	mod.updateConfigLineNumbers();
	const lines = viewer.value.split('\n').length;
	assert.ok(lines > 1, 'Config content has multiple lines');
	assert.ok(gutter.textContent.includes('1\n'), 'Gutter contains line numbers');
	assert.ok(gutter.textContent.includes(String(lines)), 'Gutter contains maximum line number');

	console.log('All diagnostics-ui tests passed successfully!');
})().catch(err => {
	console.error('Test failed:', err);
	process.exit(1);
});
