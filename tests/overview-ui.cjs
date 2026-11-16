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
	'globalThis.overviewTest = { runOneClickApply, operationButtons }; return view.extend({'
);
vm.runInContext('(function(){' + hookedSource + '\n})()', context);

async function runTests() {
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

	console.log('All overview-ui tests passed successfully!');
}

runTests().catch(e => {
	console.error(e);
	process.exit(1);
});
