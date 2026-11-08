const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = vm.createContext({
	window: {}, _: value => value,
	rpc: { declare: () => () => Promise.resolve({}) },
	view: { extend: value => value }
});
vm.runInContext("String.prototype.format = function() { let args = arguments, i = 0; return this.replace(/%[sd]/g, () => args[i++]); };", context);
const source = fs.readFileSync('luci-app-omnia/htdocs/luci-static/resources/view/omnia/subscriptions.js', 'utf8');
vm.runInContext('(function(){' + source.replace('return view.extend({', 'globalThis.refreshTest = { refreshResultText, refreshFinishedText }; return view.extend({') + '\n})()', context);
context.window.omniaSubscriptionRefresh = { task: { status: 'running' } };
assert.match(context.refreshTest.refreshResultText({ ok: true, node_count: 14 }), /正在保存/);
context.window.omniaSubscriptionRefresh.task.status = 'failed';
assert.match(context.refreshTest.refreshResultText({ ok: true, node_count: 14 }), /未保存/);
assert.match(context.refreshTest.refreshFinishedText({ task: { status: 'failed', last_error: 'snapshot error' } }), /snapshot error/);
context.window.omniaSubscriptionRefresh.task.status = 'success';
assert.match(context.refreshTest.refreshResultText({ ok: true, node_count: 14 }), /刷新完成/);
console.log('subscription UI OK');
