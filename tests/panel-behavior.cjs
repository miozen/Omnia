const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const calls = [];
let active = true;
let selectResult = { ok: true };
let nativeListResult = { ok: true, data: { selectors: [{ name: 'native' }] } };
let nativeModeResult = { ok: true, data: { mode: 'rule', modes: ['rule'] } };
let inFlight = 0, peak = 0;
const responses = {
	selector_list: async () => ({ ok: true, data: { selectors: [] } }),
	mode_get: async () => ({ ok: true, data: { mode: 'rule', modes: ['direct', 'rule', 'global'] } }),
	mode_set: async name => ({ ok: true, data: { mode: name } }),
	native_list: async () => nativeListResult,
	native_mode_get: async () => nativeModeResult,
	native_mode_set: async name => ({ ok: true, data: { mode: name } }),
	native_select: async () => ({ ok: true }),
	native_test: async () => ({ ok: true, data: { pending: true } }),
	selector_set: async (...args) => { calls.push(['select', ...args]); return selectResult; },
	node_delay_test: async name => { calls.push(['test', name]); inFlight++; peak = Math.max(peak, inFlight); await new Promise(resolve => setTimeout(resolve, 5)); inFlight--; return { ok: true, data: { delay: 42 } }; }
};
const context = vm.createContext({
	console, setTimeout,
	rpc: { declare: spec => responses[spec.method] },
	view: { extend: value => value },
	_: value => value,
	document: { getElementById: () => active ? { replaceWith() {} } : null },
	E: (tag, attrs, children) => ({ tag, attrs, children, appendChild() {}, addEventListener() {} })
});
vm.runInContext("String.prototype.format = function() { let args = arguments, i = 0; return this.replace(/%s/g, () => args[i++]); };", context);
const source = fs.readFileSync('luci-app-omnia/htdocs/luci-static/resources/view/omnia/panel.js', 'utf8');
context.panelView = vm.runInContext('(function(){' + source.replace('return view.extend({', 'globalThis.panelTest = { testNodes, switchNode, visibleOptions, disabled, flagForName, setAllExpanded, changeBackend, setGroups: value => { groups = value; }, isExpanded: name => expanded[name], getStatus: () => status, getBackend: () => backend, getApis: () => availableApis.join(",") }; return view.extend({') + '\n})()', context);

(async () => {
	await vm.runInContext("panelTest.testNodes(['a', 'a', 'b'])", context);
	assert.deepEqual(calls, [['test', 'a'], ['test', 'b']], 'batch tests each node only once');
	assert.equal(peak, 1, 'tests are serialized to limit device load');
	assert.equal(vm.runInContext("panelTest.flagForName('HK 01')", context), '🇭🇰 ', 'known region receives a flag');
	assert.equal(vm.runInContext("panelTest.flagForName('🇭🇰 HK 01')", context), '', 'existing flag is not duplicated');
	calls.length = 0;
	await vm.runInContext("panelTest.switchNode({name:'auto',now:'a',controllable:false}, 'b')", context);
	assert.equal(calls.length, 0, 'automatic group cannot be switched');
	selectResult = { ok: false, detail: 'denied' };
	await vm.runInContext("panelTest.switchNode({name:'manual',now:'a',controllable:true}, 'b')", context);
	assert.deepEqual(calls, [['select', 'manual', 'b']]);
	assert.equal(vm.runInContext('panelTest.getStatus()', context), 'denied', 'switch failure remains visible');
	calls.length = 0;
	active = false;
	await vm.runInContext("panelTest.testNodes(['a'])", context);
	assert.equal(calls.length, 0, 'testing stops after leaving the page');
	assert.equal(vm.runInContext("panelTest.visibleOptions({name:'x',now:'n1'}, Array.from({length: 200}, (_, i) => ({name:'n'+i}))).length", context), 60, 'large groups start with a bounded page');
	assert.equal(vm.runInContext("panelTest.visibleOptions({name:'x',now:'n180'}, Array.from({length: 200}, (_, i) => ({name:'n'+i}))).length", context), 61, 'selected node remains visible without rendering the whole list');
	assert.equal(vm.runInContext('panelTest.disabled(false)', context), null, 'enabled buttons omit disabled attribute');
	assert.equal(vm.runInContext('panelTest.disabled(true)', context), 'disabled', 'busy buttons are disabled');
	vm.runInContext("panelTest.setGroups([{name:'a'},{name:'b'}]); panelTest.setAllExpanded(true)", context);
	assert.equal(vm.runInContext("panelTest.isExpanded('b')", context), true, 'expand all opens every group');
	vm.runInContext('panelTest.setAllExpanded(false)', context);
	assert.equal(vm.runInContext("panelTest.isExpanded('a')", context), false, 'collapse all closes every group');
	context.panelView.render(await context.panelView.load());
	assert.equal(vm.runInContext('panelTest.getApis()', context), 'clash,singbox', 'only working interfaces are offered');
	assert.equal(vm.runInContext('panelTest.getBackend()', context), 'singbox', 'native interface is preferred when both are available');
	await vm.runInContext("panelTest.changeBackend('clash')", context);
	await vm.runInContext("panelTest.changeBackend('singbox')", context);
	assert.equal(vm.runInContext('panelTest.getBackend()', context), 'singbox', 'native interface can be selected');
	nativeListResult = { ok: false, detail: 'offline' };
	await vm.runInContext("panelTest.changeBackend('clash')", context);
	await vm.runInContext("panelTest.changeBackend('singbox')", context);
	assert.equal(vm.runInContext('panelTest.getBackend()', context), 'clash', 'failed interface switch retains previous backend');
	assert.match(vm.runInContext('panelTest.getStatus()', context), /offline/);
	responses.selector_list = async () => ({ ok: false, detail: 'offline' });
	// RPC declarations retain their original functions; supply render results directly.
	context.panelView.render([{ ok: false }, { ok: false }, { ok: true, data: { selectors: [] } }, nativeModeResult]);
	assert.equal(vm.runInContext('panelTest.getApis()', context), 'singbox', 'a single working interface has no alternative');
	assert.equal(vm.runInContext('panelTest.getBackend()', context), 'singbox', 'native interface is selected when Clash is unavailable');
	context.panelView.render([{ ok: true, data: { selectors: [] } }, { ok: true, data: { mode: 'rule', modes: ['rule'] } }, { ok: false }, { ok: false }]);
	assert.equal(vm.runInContext('panelTest.getApis()', context), 'clash', 'unavailable native interface is not offered');
	assert.equal(vm.runInContext('panelTest.getBackend()', context), 'clash', 'Clash is used when native interface is unavailable');
	context.panelView.render([{ ok: false, detail: 'Failed to parse JSON string: unexpected character' }, { ok: false }, { ok: false }, { ok: false }]);
	assert.match(vm.runInContext('panelTest.getStatus()', context), /无法连接代理面板/);
	console.log('panel behavior OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
