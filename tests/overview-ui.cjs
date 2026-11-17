const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

let rpcCalls = [];
let mockRpcResponses = {
	config_generate: { ok: true, data: { node_count: 42, generated_groups: 3 } },
	config_check_candidate: { ok: true, data: {} },
	config_apply: { ok: true, data: { health_ready: true } },
	overview_status: { ok: true, data: { items: {} } }
};

let lastStatusText = null;
let lastStatusTone = null;

const mockBtn = { disabled: false, innerText: '' };
const mockElements = {
	'omnia-one-click-apply-btn': mockBtn,
	'omnia-step-tools-btn': { innerText: '', style: {} },
	'omnia-step-tools-menu': { style: { display: 'none' } },
	'omnia-overview-action-status': {
		innerHTML: '',
		textContent: '',
		style: {},
		appendChild: function(child) {
			if (typeof child === 'string') this.textContent += child;
			else if (child && child.textContent) this.textContent += child.textContent;
		}
	}
};

const domHelpers = {
	tag: (t, attrs, children) => {
		const elem = {
			tagName: t,
			attrs: attrs || {},
			children: children || [],
			style: {},
			textContent: '',
			appendChild: function(c) {
				if (typeof c === 'string') this.textContent += c;
				else if (c && c.textContent) this.textContent += c.textContent;
				this.children.push(c);
			}
		};
		if (Array.isArray(children)) {
			children.forEach(c => {
				if (typeof c === 'string') elem.textContent += c;
				else if (c && c.textContent) elem.textContent += c.textContent;
			});
		} else if (typeof children === 'string') {
			elem.textContent = children;
		}
		return elem;
	}
};

const context = vm.createContext({
	window: {
		confirm: () => true,
		setTimeout: (cb) => cb()
	},
	document: {
		getElementById: id => mockElements[id] || null,
		createTextNode: t => ({ textContent: t })
	},
	L: {
		url: path => '/' + path
	},
	_: value => value,
	rpc: {
		declare: (cfg) => {
			return () => {
				rpcCalls.push(cfg.method);
				const resp = mockRpcResponses[cfg.method] || { ok: true, data: {} };
				return Promise.resolve(resp);
			};
		}
	},
	view: { extend: value => value },
	E: (tag, attrs, children) => domHelpers.tag(tag, attrs, children),
	omniaUi: {
		dataOf: res => (res && res.data ? res.data : {}),
		sectionStyle: () => '',
		sectionTitle: () => domHelpers.tag('h3'),
		sectionDescription: () => domHelpers.tag('p'),
		statusBox: () => domHelpers.tag('div'),
		pageHeader: () => domHelpers.tag('div'),
		paintStatus: (id, text, tone) => {
			lastStatusText = text;
			lastStatusTone = tone;
		}
	},
	omniaMotion: {
		inject: () => {},
		buttonClass: cls => cls,
		cardClass: () => '',
		softRowClass: () => ''
	},
	omniaTime: {
		formatMaybeTime: () => ''
	}
});

vm.runInContext("String.prototype.format = function() { let args = arguments, i = 0; return this.replace(/%[sd]/g, () => args[i++]); };", context);
const overviewSource = fs.readFileSync('luci-app-omnia/htdocs/luci-static/resources/view/omnia/overview.js', 'utf8');

// Inject test hook
const hookedSource = overviewSource.replace(
	'return view.extend({',
	'globalThis.overviewTest = { runOneClickApply, operationButtons, toggleStepTools, resourceStatusSection, renderSparklineSvg, renderSparkbarsSvg, maskIpAddress, formatBytesPerSec, formatUptimeDuration }; return view.extend({'
);
vm.runInContext('(function(){' + hookedSource + '\n})()', context);

async function runTests() {
	// Test 0: SVG Sparkline, Sparkbars, Masking & formatting utilities
	const svg = context.overviewTest.renderSparklineSvg([0, 10, 50, 30, 80], '#2563eb', '#3b82f6');
	assert.ok(svg.includes('<svg') && svg.includes('path'), 'Sparkline SVG renders valid SVG paths');
	assert.equal(context.overviewTest.formatBytesPerSec(1024), '1.0 KB/s');
	assert.equal(context.overviewTest.formatBytesPerSec(1048576), '1.00 MB/s');
	assert.equal(context.overviewTest.formatUptimeDuration(125), '2 分 5 秒');

	// Slice 3 assertions: maskIpAddress & renderSparkbarsSvg
	assert.equal(context.overviewTest.maskIpAddress('192.168.1.100'), '192.168.***.***');
	assert.equal(context.overviewTest.maskIpAddress('2408:825c:2140:12::1'), '2408:825c:****');
	assert.equal(context.overviewTest.maskIpAddress(''), '-');

	const barsSvg = context.overviewTest.renderSparkbarsSvg([28, 120, 260]);
	assert.ok(barsSvg.includes('<svg') && barsSvg.includes('<rect'), 'Sparkbars SVG renders valid rect bars');
	assert.ok(barsSvg.includes('#10b981') && barsSvg.includes('#f59e0b') && barsSvg.includes('#ef4444'), 'Sparkbars SVG renders threshold colors');
	console.log('Test 0: Formatting, Sparklines, Sparkbars & IP masking OK');

	// Test 1: Happy path
	rpcCalls = [];
	await context.overviewTest.runOneClickApply();
	assert.deepEqual(rpcCalls, ['config_generate', 'config_check_candidate', 'config_apply', 'overview_status']);
	assert.equal(lastStatusTone, 'ok');
	assert.match(lastStatusText.textContent, /一键生成并应用成功/);
	assert.match(lastStatusText.textContent, /42 个出站节点/);
	console.log('Test 1: Happy path OK');

	// Test 2: Stage 1 failure (generation error)
	rpcCalls = [];
	mockRpcResponses.config_generate = { ok: false, detail: 'RUNTIME_CONTRACT: inbounds.tun missing' };
	await context.overviewTest.runOneClickApply();
	assert.deepEqual(rpcCalls, ['config_generate']);
	assert.equal(lastStatusTone, 'error');
	assert.match(lastStatusText.textContent, /第 1 阶段失败/);
	assert.match(lastStatusText.textContent, /inbounds\.tun/);
	console.log('Test 2: Stage 1 failure handling OK');

	// Test 3: Stage 2 failure (sing-box syntax check error)
	rpcCalls = [];
	mockRpcResponses.config_generate = { ok: true, data: { node_count: 10, generated_groups: 2 } };
	mockRpcResponses.config_check_candidate = { ok: false, detail: 'inbounds.tun.stack: invalid value' };
	await context.overviewTest.runOneClickApply();
	assert.deepEqual(rpcCalls, ['config_generate', 'config_check_candidate']);
	assert.equal(lastStatusTone, 'error');
	assert.match(lastStatusText.textContent, /第 2 阶段失败/);
	assert.match(lastStatusText.textContent, /inbounds\.tun\.stack/);
	console.log('Test 3: Stage 2 failure handling OK');

	// Test 4: Stage 3 failure (apply error, rollback)
	rpcCalls = [];
	mockRpcResponses.config_check_candidate = { ok: true, data: {} };
	mockRpcResponses.config_apply = { ok: false, detail: 'Foreign process detected' };
	await context.overviewTest.runOneClickApply();
	assert.deepEqual(rpcCalls, ['config_generate', 'config_check_candidate', 'config_apply']);
	assert.equal(lastStatusTone, 'error');
	assert.match(lastStatusText.textContent, /第 3 阶段失败/);
	assert.match(lastStatusText.textContent, /自动回滚/);
	console.log('Test 4: Stage 3 failure handling OK');

	// Test 5: Slice 4 - Dropdown toggle & Resource Status Bar DOM
	context.overviewTest.toggleStepTools();
	assert.equal(mockElements['omnia-step-tools-btn'].innerText, '单步工具 ▴');
	assert.equal(mockElements['omnia-step-tools-menu'].style.display, 'flex');
	context.overviewTest.toggleStepTools();
	assert.equal(mockElements['omnia-step-tools-btn'].innerText, '单步工具 ▾');
	assert.equal(mockElements['omnia-step-tools-menu'].style.display, 'none');

	const resSec = context.overviewTest.resourceStatusSection();
	assert.ok(resSec && resSec.children && resSec.children.length >= 2, 'Resource section renders title bar and 3-column container');
	console.log('Test 5: Dropdown toggle & Resource status bar OK');

	console.log('All overview-ui tests passed successfully!');
}

runTests().catch(e => {
	console.error(e);
	process.exit(1);
});
