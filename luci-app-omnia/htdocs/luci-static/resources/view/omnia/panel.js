'use strict';
'require view';
'require rpc';

const list = rpc.declare({ object: 'omnia', method: 'selector_list', expect: { '': {} } });
const select = rpc.declare({ object: 'omnia', method: 'selector_set', params: [ 'selector', 'target' ], expect: { '': {} } });
const test = rpc.declare({ object: 'omnia', method: 'node_delay_test', params: [ 'node' ], expect: { '': {} } });
const getMode = rpc.declare({ object: 'omnia', method: 'mode_get', expect: { '': {} } });
const setMode = rpc.declare({ object: 'omnia', method: 'mode_set', params: [ 'mode' ], expect: { '': {} } });
const nativeList = rpc.declare({ object: 'omnia', method: 'native_list', expect: { '': {} } });
const nativeSelect = rpc.declare({ object: 'omnia', method: 'native_select', params: [ 'selector', 'target' ], expect: { '': {} } });
const nativeTest = rpc.declare({ object: 'omnia', method: 'native_test', params: [ 'node' ], expect: { '': {} } });
const nativeMode = rpc.declare({ object: 'omnia', method: 'native_mode_get', expect: { '': {} } });
const nativeSetMode = rpc.declare({ object: 'omnia', method: 'native_mode_set', params: [ 'mode' ], expect: { '': {} } });
let groups = [], delays = Object.create(null), expanded = Object.create(null), limits = Object.create(null), busy = false, status = '', testingNodes = Object.create(null), activeTab = 'all', mode = '', modes = [], backend = 'clash', availableApis = ['clash'];
const PAGE_SIZE = 60;
const TEST_CONCURRENCY = 1;

function flagForName(name) {
	if (/\p{Regional_Indicator}{2}/u.test(name)) return '';
	let rules = [ [/香港|hong\s*kong|\bhk\b/i, '🇭🇰'], [/台湾|台灣|taiwan|\btw\b/i, '🇹🇼'], [/日本|japan|tokyo|\bjp\b/i, '🇯🇵'], [/新加坡|狮城|singapore|\bsg\b/i, '🇸🇬'], [/美国|美國|united states|\busa?\b/i, '🇺🇸'], [/英国|英國|united kingdom|\buk\b/i, '🇬🇧'], [/韩国|韓國|korea|\bkr\b/i, '🇰🇷'] ];
	let found = rules.find(function(rule) { return rule[0].test(name); });
	return found ? found[1] + ' ' : '';
}

function disabled(value) { return value ? 'disabled' : null; }

function setAllExpanded(value) {
	groups.forEach(function(group) { expanded[group.name] = value; });
	redraw();
}

function groupCategory(group) {
	let groupNames = new Set(groups.map(function(item) { return item.name; }));
	return (group.all || []).some(function(name) { return groupNames.has(name); }) ? 'policy' : 'node';
}

function changeMode(value) {
	if (busy || !value || value.toLowerCase() === String(mode).toLowerCase()) return;
	busy = true; status = _('正在切换模式…'); redraw();
	return (backend === 'singbox' ? nativeSetMode(value) : setMode(value)).then(function(r) {
		if (!r || !r.ok) throw new Error(error(r));
		mode = r.data.mode; status = _('模式已切换');
	}).catch(function(e) { status = e.message || String(e); }).finally(function() { busy = false; redraw(); });
}

function visibleOptions(group, options) {
	let limit = limits[group.name] || PAGE_SIZE;
	let selected = options.findIndex(function(option) { return option.name === group.now; });
	let result = options.slice(0, limit);
	if (selected >= limit) result.push(options[selected]);
	return result;
}

function error(result) { return result && (result.detail || result.message || result.code) || _('请求失败'); }
function redraw() { let root = document.getElementById('omnia-panel-root'); if (root) root.replaceWith(renderPanel()); }
function refresh() {
	return Promise.all(backend === 'singbox' ? [nativeList(), nativeMode()] : [list(), getMode()]).then(function(results) { let r = results[0], m = results[1]; if (!r || !r.ok) throw new Error(error(r)); groups = r.data.selectors || []; if (m && m.ok) { mode = m.data.mode; modes = m.data.modes || []; status = ''; } else status = _('模式读取失败：%s').format(error(m)); redraw(); })
		.catch(function(e) { status = e.message || String(e); redraw(); });
}
function switchNode(group, name) {
	if (busy || !group.controllable || group.now === name) return;
	busy = true; status = _('正在切换…'); redraw();
	return (backend === 'singbox' ? nativeSelect(group.name, name) : select(group.name, name)).then(function(r) { if (!r || !r.ok) throw new Error(error(r)); group.now = name; status = _('节点已切换'); })
		.catch(function(e) { status = e.message || String(e); }).finally(function() { busy = false; redraw(); });
}
async function testNodes(names) {
	if (busy) return;
	busy = true;
	let nodes = Array.from(new Set(names)), next = 0, done = 0, failed = 0;
	async function worker() {
		while (next < nodes.length && document.getElementById('omnia-panel-root')) {
			let name = nodes[next++];
			testingNodes[name] = true;
			status = _('测速中：%s / %s').format(done, nodes.length); redraw();
			try { let r = await (backend === 'singbox' ? nativeTest(name) : test(name)); if (r && r.ok && r.data && r.data.pending) delete delays[name]; else delays[name] = r && r.ok && r.data && r.data.delay != null ? r.data.delay : null; }
			catch (e) { delays[name] = null; }
			delete testingNodes[name];
			if (Object.prototype.hasOwnProperty.call(delays, name) && delays[name] == null) failed++;
			done++;
		}
	}
	await Promise.all(Array.from({ length: Math.min(TEST_CONCURRENCY, nodes.length) }, worker));
	busy = false; status = backend === 'singbox' ? _('已发起 %s 项测速，稍后刷新查看结果；失败 %s 项').format(done, failed) : _('测速结束：%s / %s 项，失败 %s 项').format(done, nodes.length, failed); redraw();
}

function changeBackend(value) {
	if (busy || availableApis.indexOf(value) < 0 || value === backend) return;
	let previous = backend;
	backend = value; busy = true; status = _('正在连接接口…'); redraw();
	let fetches = value === 'singbox' ? [nativeList(), nativeMode()] : [list(), getMode()];
	return Promise.all(fetches).then(function(results) {
		if (!results[0] || !results[0].ok) throw new Error(error(results[0]));
		if (!results[1] || !results[1].ok) throw new Error(error(results[1]));
		groups = results[0].data.selectors || []; mode = results[1].data.mode; modes = results[1].data.modes || [];
		delays = Object.create(null); expanded = Object.create(null); limits = Object.create(null); status = '';
	}).catch(function(e) { backend = previous; status = _('接口切换失败：%s').format(e.message || String(e)); }).finally(function() { busy = false; redraw(); });
}
function renderPanel() {
	let root = E('div', { id: 'omnia-panel-root', class: 'cbi-map omnia-proxy' });
	root.appendChild(E('style', {}, '.omnia-proxy{max-width:1400px;margin:auto}.omnia-tools,.omnia-head,.omnia-tabs{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap}.omnia-tools,.omnia-tabs{margin-bottom:1rem}.omnia-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.8rem;align-items:start}.omnia-group{border:1px solid var(--border-color-medium,#e3e7ed);border-radius:14px;background:var(--background-color-high,#fff)}.omnia-head{padding:.9rem 1rem}.omnia-title{flex:1;text-align:left;border:0;background:none;color:inherit;cursor:pointer}.omnia-sub{opacity:.65;font-size:.85rem;margin-top:.25rem;overflow-wrap:anywhere}.omnia-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:.6rem;padding:0 1rem 1rem}.omnia-node{border:1px solid var(--border-color-medium,#e3e7ed);border-radius:10px;padding:.75rem;display:flex;gap:.4rem;align-items:center;min-width:0}.omnia-node.selected{border-color:#6c8cf5;background:rgba(108,140,245,.12)}.omnia-name{flex:1;min-width:0;overflow-wrap:anywhere;border:0;background:none;text-align:left;color:inherit;cursor:pointer}.omnia-delay{border:0;background:none;cursor:pointer;white-space:nowrap}.omnia-status{margin:.6rem 0;overflow-wrap:anywhere}@media(max-width:700px){.omnia-groups{grid-template-columns:1fr}.omnia-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.omnia-node{flex-wrap:wrap}}'));
	let modeOptions = ['rule', 'direct', 'global'].map(function(key) { let available = modes.find(function(item) { return String(item).toLowerCase() === key; }); return E('option', { value: available || key, selected: String(mode).toLowerCase() === key ? 'selected' : null, disabled: disabled(!available) }, key === 'direct' ? _('直连') : key === 'rule' ? _('规则') : _('全局')); });
	if (!mode) modeOptions.unshift(E('option', { value: '', selected: 'selected', disabled: 'disabled' }, _('模式不可用')));
	let modeSelect = E('select', { class: 'cbi-input-select', disabled: disabled(busy || !mode), 'aria-label': _('运行模式'), change: function(ev) { return changeMode(ev.target.value); } }, modeOptions);
	let apiSelect = availableApis.length > 1 ? E('select', { class: 'cbi-input-select', disabled: disabled(busy), 'aria-label': _('控制接口'), change: function(ev) { return changeBackend(ev.target.value); } }, availableApis.map(function(api) { return E('option', { value: api, selected: api === backend ? 'selected' : null }, api === 'singbox' ? 'sing-box API' : 'Clash API'); })) : '';
	let anyExpanded = groups.some(function(group) { return expanded[group.name] === true; });
	let expandLabel = anyExpanded ? _('全部收起') : _('全部展开');
	root.appendChild(E('div', { class: 'omnia-tools' }, [ E('h2', {}, _('代理')), modeSelect, apiSelect, E('div', { style: 'display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin-left:auto' }, [ E('button', { class: 'btn cbi-button', disabled: disabled(busy), click: refresh, title: _('刷新'), 'aria-label': _('刷新') }, '↻'), E('button', { class: 'btn cbi-button', click: function() { setAllExpanded(!anyExpanded); }, title: expandLabel, 'aria-label': expandLabel }, anyExpanded ? '⌃' : '⌄'), E('button', { class: 'btn cbi-button', disabled: disabled(busy), click: function() { return testNodes(groups.reduce(function(a, g) { return a.concat(g.all || []); }, [])); }, title: _('全部测速'), 'aria-label': _('全部测速') }, '⚡') ]) ]));
	root.appendChild(E('div', { class: 'omnia-tabs' }, [ ['all', _('全部')], ['policy', _('策略组')], ['node', _('节点组')] ].map(function(tab) { return E('button', { class: 'btn cbi-button' + (activeTab === tab[0] ? ' cbi-button-apply' : ''), click: function() { activeTab = tab[0]; redraw(); } }, tab[1]); })));
	if (status) root.appendChild(E('div', { class: 'omnia-status', role: 'status' }, status));
	if (!groups.length && !status) root.appendChild(E('div', {}, _('暂无代理组')));
	let container = E('div', { class: 'omnia-groups' });
	groups.forEach(function(g) {
		if (activeTab !== 'all' && groupCategory(g) !== activeTab) return;
		let options = g.options || [];
		let open = !!expanded[g.name];
		let section = E('section', { class: 'omnia-group', contextmenu: function(ev) { ev.preventDefault(); return testNodes(g.all || []); } }, [ E('div', { class: 'omnia-head' }, [ E('button', { class: 'omnia-title', 'aria-expanded': open, click: function() { expanded[g.name] = !open; redraw(); } }, [ E('strong', {}, g.name), E('div', { class: 'omnia-sub' }, '%s · %s · %s · %s'.format(g.type || '-', (g.all || []).length, g.now || '-', open ? '▴' : '▾')) ]), E('button', { class: 'btn cbi-button', disabled: disabled(busy), click: function() { return testNodes(g.all || []); }, title: _('组测速'), 'aria-label': _('组测速') }, '⚡') ]) ]);
		let shown = visibleOptions(g, options);
		if (open) section.appendChild(E('div', { class: 'omnia-grid' }, shown.map(function(o) {
			let measured = Object.prototype.hasOwnProperty.call(delays, o.name), value = measured ? delays[o.name] : o.delay;
			let label = testingNodes[o.name] ? _('测速中') : (value == null ? (measured ? _('失败') : '-') : value + ' ms');
			let tone = value == null ? '#788394' : (value < 300 ? '#299260' : (value < 800 ? '#c78916' : '#d55252'));
			return E('div', { class: 'omnia-node' + (g.now === o.name ? ' selected' : ''), contextmenu: function(ev) { ev.preventDefault(); ev.stopPropagation(); return testNodes([o.name]); } }, [ E('button', { class: 'omnia-name', disabled: disabled(busy || !g.controllable), click: function() { return switchNode(g, o.name); }, title: o.name, 'aria-pressed': g.controllable ? String(g.now === o.name) : null }, [ E('span', {}, flagForName(o.name) + o.name), E('div', { class: 'omnia-sub' }, o.type || '') ]), E('button', { class: 'omnia-delay', style: 'color:' + tone, disabled: disabled(busy), title: _('测试延迟'), 'aria-label': _('测试 %s 的延迟').format(o.name), click: function() { return testNodes([o.name]); } }, label) ]);
		})));
		if (open && shown.length < options.length) section.appendChild(E('div', { style: 'padding:0 1rem 1rem;text-align:center' }, [ E('button', { class: 'btn cbi-button', click: function() { limits[g.name] = (limits[g.name] || PAGE_SIZE) + PAGE_SIZE; redraw(); } }, _('显示更多（%s / %s）').format(shown.length, options.length)) ]));
		container.appendChild(section);
	});
	root.appendChild(container);
	return root;
}
return view.extend({
	load: function() { return Promise.all([list(), getMode(), nativeList(), nativeMode()].map(function(p) { return p.catch(function(e) { return { ok: false, detail: e.message || String(e) }; }); })); },
	render: function(results) {
		let clashReady = results[0] && results[0].ok && results[1] && results[1].ok;
		let nativeReady = results[2] && results[2].ok && results[3] && results[3].ok;
		availableApis = []; if (clashReady) availableApis.push('clash'); if (nativeReady) availableApis.push('singbox');
		backend = nativeReady ? 'singbox' : 'clash';
		let r = results[backend === 'clash' ? 0 : 2], m = results[backend === 'clash' ? 1 : 3];
		groups = r && r.ok ? r.data.selectors || [] : []; mode = m && m.ok ? m.data.mode : ''; modes = m && m.ok ? m.data.modes || [] : [];
		status = !r || !r.ok ? error(r) : (!m || !m.ok ? _('模式读取失败：%s').format(error(m)) : '');
		return renderPanel();
	},
	handleSaveApply: null, handleSave: null, handleReset: null
});
