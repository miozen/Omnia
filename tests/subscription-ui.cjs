const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

let savedPayload = null;
let currentStatus = { msg: '', ok: null };

const mockElements = {
	'omnia-source-editor': { getAttribute: () => '-1' },
	'omnia-editor-name': { value: '' },
	'omnia-editor-type': { value: 'remote' },
	'omnia-editor-url': { value: '' },
	'omnia-editor-user-agent': { value: '' },
	'omnia-editor-enabled': { checked: true },
	'omnia-editor-save-btn': { disabled: false, innerText: '保存订阅源' },
	'omnia-status': {}
};

const context = vm.createContext({
	window: {
		confirm: () => true,
		setTimeout: (cb) => { cb(); },
		omniaNodeSnapshotSummary: {}
	},
	document: {
		getElementById: id => mockElements[id] || null,
		querySelectorAll: () => []
	},
	_: value => value,
	omniaUi: { paintStatus: () => {} },
	rpc: {
		declare: (cfg) => {
			if (cfg.method === 'subscriptions_save') {
				return (content) => {
					savedPayload = content;
					return Promise.resolve({ ok: true, data: {} });
				};
			}
			if (cfg.method === 'subscriptions_get') {
				return () => Promise.resolve({ ok: true, data: { content: savedPayload || '{"sources":[]}' } });
			}
			return () => Promise.resolve({ ok: true, data: {} });
		}
	},
	view: { extend: value => value },
	E: (tag, attrs, children) => ({ tag, attrs, children })
});
vm.runInContext("String.prototype.format = function() { let args = arguments, i = 0; return this.replace(/%[sd]/g, () => args[i++]); };", context);
const source = fs.readFileSync('luci-app-omnia/htdocs/luci-static/resources/view/omnia/subscriptions.js', 'utf8');
vm.runInContext('(function(){' + source.replace('return view.extend({', 'globalThis.refreshTest = { refreshResultText, refreshFinishedText, formatTrafficBytes, formatTrafficExpire, formatTrafficBadge, saveSourceEditor, removeSource, setStatus: (msg, ok) => { currentStatus = { msg, ok }; } }; return view.extend({') + '\n})()', context);
context.window.omniaSubscriptionRefresh = { task: { status: 'running' } };
assert.match(context.refreshTest.refreshResultText({ ok: true, node_count: 14 }), /正在保存/);
context.window.omniaSubscriptionRefresh.task.status = 'failed';
assert.match(context.refreshTest.refreshResultText({ ok: true, node_count: 14 }), /未保存/);
assert.match(context.refreshTest.refreshFinishedText({ task: { status: 'failed', last_error: 'snapshot error' } }), /snapshot error/);
context.window.omniaSubscriptionRefresh.task.status = 'success';
assert.match(context.refreshTest.refreshResultText({ ok: true, node_count: 14 }), /刷新完成/);

// Traffic quota & expiration badge tests
assert.equal(context.refreshTest.formatTrafficBytes(1073741824), '1.00 GB');
assert.equal(context.refreshTest.formatTrafficBytes(52428800), '50.00 MB');
assert.equal(context.refreshTest.formatTrafficBytes(0), '0 B');
assert.match(context.refreshTest.formatTrafficExpire(1735689600), /^\d{4}-\d{2}-\d{2}$/);
assert.equal(context.refreshTest.formatTrafficBadge(null), null);
const badge = context.refreshTest.formatTrafficBadge({ total: 107374182400, used: 6442450944, expire: 1735689600 });
assert(badge != null, 'badge should not be null');
assert.match(badge.children, /已用 6.00 GB \/ 总计 100.00 GB/);
assert.match(badge.children, /到期: \d{4}-\d{2}-\d{2}/);

// Atomic save validation tests
// 1. Rejects empty name
mockElements['omnia-editor-name'].value = '   ';
context.refreshTest.saveSourceEditor();
assert.equal(savedPayload, null, 'Should not save when name is empty');

// 2. Rejects invalid url
mockElements['omnia-editor-name'].value = 'My Airport';
mockElements['omnia-editor-url'].value = 'ftp://invalid-url';
context.refreshTest.saveSourceEditor();
assert.equal(savedPayload, null, 'Should not save when url is invalid');

// 3. Atomically persists when valid
mockElements['omnia-editor-url'].value = 'https://airport.example.com/sub';
const savePromise = context.refreshTest.saveSourceEditor();
assert(savePromise != null, 'saveSourceEditor should return a promise for atomic persistence');

savePromise.then(() => {
	assert(savedPayload != null, 'Payload should have been saved to backend');
	const parsed = JSON.parse(savedPayload);
	assert.equal(parsed.sources.length, 1);
	assert.equal(parsed.sources[0].name, 'My Airport');
	assert.equal(parsed.sources[0].url, 'https://airport.example.com/sub');
	console.log('subscription atomic save OK');

	// 4. Atomically persists deletion
	savedPayload = null;
	const removePromise = context.refreshTest.removeSource(0);
	assert(removePromise != null, 'removeSource should return a promise for atomic persistence');
	return removePromise.then(() => {
		assert(savedPayload != null, 'Payload should be updated on deletion');
		const afterRemove = JSON.parse(savedPayload);
		assert.equal(afterRemove.sources.length, 0, 'Sources array should be empty after deletion');
		console.log('subscription atomic delete OK');

		// 5. Atomically persists local source with enabled flag
		savedPayload = null;
		mockElements['omnia-editor-name'].value = 'My Local Nodes';
		mockElements['omnia-editor-type'].value = 'local';
		mockElements['omnia-editor-subtype'] = { value: 'paste' };
		mockElements['omnia-editor-payload'] = { value: 'ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@1.2.3.4:8388#TestNode' };
		mockElements['omnia-editor-enabled'].checked = true;
		const localSavePromise = context.refreshTest.saveSourceEditor();
		return localSavePromise.then(() => {
			assert(savedPayload != null, 'Local source payload should be saved');
			const parsedLocal = JSON.parse(savedPayload);
			assert.equal(parsedLocal.sources.length, 1);
			assert.equal(parsedLocal.sources[0].type, 'local');
			assert.equal(parsedLocal.sources[0].enabled, true);
			console.log('subscription local source save OK');
		});
	});
}).catch(e => {
	console.error(e);
	process.exit(1);
});

console.log('subscription UI OK');
