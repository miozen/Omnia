'use strict';
'require view';
'require rpc';
'require omnia.time as omniaTime';
'require omnia.ui as omniaUi';
'require omnia.motion as omniaMotion';

const callLogsGet = rpc.declare({
	object: 'omnia',
	method: 'logs_get',
	expect: { '': {} }
});

const callLastErrorGet = rpc.declare({
	object: 'omnia',
	method: 'last_error_get',
	expect: { '': {} }
});

const callDiagnosticsGet = rpc.declare({
	object: 'omnia',
	method: 'diagnostics_get',
	expect: { '': {} }
});

const callTaskLocksGet = rpc.declare({
	object: 'omnia',
	method: 'task_locks_get',
	expect: { '': {} }
});

const callTaskLockRecover = rpc.declare({
	object: 'omnia',
	method: 'task_lock_recover',
	params: [ 'task_type' ],
	expect: { '': {} }
});

const callConnectivityProbe = rpc.declare({
	object: 'omnia',
	method: 'connectivity_probe',
	expect: { '': {} }
});

const callApiStatus = rpc.declare({
	object: 'omnia',
	method: 'api_status',
	expect: { '': {} }
});

const callRuntimeConfigGet = rpc.declare({
	object: 'omnia',
	method: 'runtime_config_get',
	expect: { '': {} }
});

let activeTab = 'config';
let pageResults = {};
let logsLoading = false;
let connectivityLoading = false;
let runtimeConfigLoading = false;

function yesNo(value) {
	return value ? _('是') : _('否');
}

function checkRow(label, ok, detail, warn) {
	return E('div', { 'class': omniaMotion.softRowClass(), 'style': 'display: grid; grid-template-columns: minmax(180px, 1fr) 90px minmax(0, 2fr); gap: .75rem; align-items: center; padding: .55rem 0; border-bottom: 1px solid #eef0f3;' }, [
		E('div', { 'style': 'font-weight: 600;' }, label),
		E('div', {}, omniaUi.pill(yesNo(ok), ok ? 'ok' : warn ? 'warning' : 'error')),
		E('div', { 'style': omniaUi.mutedStyle() }, omniaUi.valueText(detail))
	]);
}

function field(label, value) {
	return E('div', { 'class': omniaMotion.softRowClass(), 'style': 'display: grid; grid-template-columns: minmax(160px, 1fr) minmax(0, 2fr); gap: .75rem; padding: .45rem 0; border-bottom: 1px solid #eef0f3;' }, [
		E('div', { 'style': 'color: #667;' }, label),
		E('div', { 'style': 'overflow-wrap: anywhere;' }, omniaUi.valueText(value))
	]);
}

function commandBlock(label, result) {
	result = result || {};

	const text = [
		'$ ' + label,
		result.stdout || '',
		result.stderr ? 'stderr: ' + result.stderr : ''
	].filter(function(line) {
		return line !== '';
	}).join('\n');

	return E('div', { 'style': 'margin-bottom: .75rem;' }, [
		E('div', { 'style': 'font-weight: 600; margin-bottom: .25rem;' }, label),
		E('pre', { 'style': 'white-space: pre-wrap; overflow-wrap: anywhere; max-height: 180px; overflow-y: auto; background: #f8fafc; border: 1px solid #eef0f3; border-radius: 6px; padding: .65rem;' }, text)
	]);
}

function loadErrorPanel() {
	const errors = [];

	[
		pageResults.diagnostics,
		pageResults.connectivity,
		pageResults.apiStatus,
		pageResults.lastError,
		pageResults.taskLocks,
		pageResults.logs
	].forEach(function(result) {
		if (result && !result.ok)
			errors.push('%s: %s'.format(result.message || result.code || _('加载失败'), result.detail || result.code || _('无详细信息')));
	});

	if (!errors.length)
		return null;

	return E('div', {
		'style': 'border: 1px solid #fecaca; border-left: 4px solid #dc2626; border-radius: 8px; padding: .85rem; margin-bottom: 1rem; background: #fef2f2; color: #7f1d1d;'
	}, [
		E('div', { 'style': 'font-weight: 700; margin-bottom: .35rem;' }, _('诊断加载异常')),
		E('pre', { 'style': 'white-space: pre-wrap; overflow-wrap: anywhere; margin: 0;' }, errors.join('\n'))
	]);
}

function tabButton(id, label) {
	const active = activeTab === id;
	return E('button', {
		'type': 'button',
		'class': omniaMotion.buttonClass('btn cbi-button %s'.format(active ? 'cbi-button-apply' : 'cbi-button-neutral')),
		'style': 'margin-right: .5rem; margin-bottom: .75rem;',
		'click': function(ev) {
			ev.preventDefault();
			activeTab = id;
			redraw();
		}
	}, label);
}

function logsText(lines, filter) {
	if (!Array.isArray(lines) || !lines.length)
		return _('未观测到日志。');

	const selected = lines.filter(function(line) {
		if (!filter)
			return true;
		return filter(line);
	});

	if (!selected.length)
		return _('未观测到匹配日志。');

	return selected.join('\n');
}

function dataplaneLogs(line) {
	line = String(line || '').toLowerCase();
	return line.indexOf('sing-box') >= 0 || line.indexOf('tun') >= 0 || line.indexOf('clash') >= 0;
}

function controlplaneLogs(line) {
	line = String(line || '').toLowerCase();
	return line.indexOf('omnia') >= 0 || line.indexOf('rpcd') >= 0 || line.indexOf('uhttpd') >= 0;
}

function loadLogsLazy() {
	if (pageResults.logs || logsLoading)
		return;

	logsLoading = true;
	callLogsGet().catch(function(e) {
		return { ok: false, message: _('日志加载失败'), detail: e.message || String(e) };
	}).then(function(result) {
		pageResults.logs = result;
		logsLoading = false;
		redraw();
	}).catch(function() {
		logsLoading = false;
	});
}

function loadConnectivityLazy() {
	if (pageResults.connectivity || connectivityLoading)
		return;

	connectivityLoading = true;
	callConnectivityProbe().catch(function(e) {
		return { ok: false, message: _('数据面诊断加载失败'), detail: e.message || String(e) };
	}).then(function(result) {
		pageResults.connectivity = result;
		connectivityLoading = false;
		redraw();
	}).catch(function() {
		connectivityLoading = false;
	});
}

function loadRuntimeConfigLazy(force) {
	if ((pageResults.runtimeConfig && !force) || runtimeConfigLoading)
		return Promise.resolve();

	runtimeConfigLoading = true;
	return callRuntimeConfigGet().catch(function(e) {
		return { ok: false, message: _('运行配置加载失败'), detail: e.message || String(e) };
	}).then(function(result) {
		pageResults.runtimeConfig = result;
		runtimeConfigLoading = false;
		redraw();
	}).catch(function() {
		runtimeConfigLoading = false;
	});
}

function ensureLazyLoads() {
	setTimeout(function() {
		if (activeTab === 'config') {
			loadRuntimeConfigLazy();
		} else if (activeTab === 'dataplane') {
			loadLogsLazy();
			loadConnectivityLazy();
		} else if (activeTab === 'controlplane') {
			loadLogsLazy();
		}
	}, 0);
}

function updateConfigLineNumbers() {
	const textarea = document.getElementById('omnia-runtime-config-viewer');
	const gutter = document.getElementById('omnia-runtime-config-gutter');
	if (!textarea || !gutter) return;
	const lineCount = (textarea.value || '').split('\n').length;
	let numbers = '';
	for (let i = 1; i <= lineCount; i++) {
		numbers += i + '\n';
	}
	gutter.textContent = numbers;
}

function formattedConfigContent(content) {
	if (!content || typeof content !== 'string')
		return '';
	try {
		const obj = JSON.parse(content);
		return JSON.stringify(obj, null, 2);
	} catch (e) {
		return content;
	}
}

function runtimeConfigPanel() {
	if (!pageResults.runtimeConfig && runtimeConfigLoading) {
		return E('div', { 'style': omniaUi.sectionStyle() }, [
			omniaUi.sectionTitle(_('当前运行配置 (sing-box)')),
			omniaUi.sectionDescription(_('正在从设备 /etc/omnia/runtime/config.json 读取运行配置...')),
			E('div', { 'style': omniaUi.mutedStyle() }, _('加载中...'))
		]);
	}

	const data = omniaUi.dataOf(pageResults.runtimeConfig);
	const exists = data.exists === true;
	const rawContent = data.content || '';
	const formatted = exists ? formattedConfigContent(rawContent) : '';
	const lineCount = exists ? formatted.split('\n').length : 0;
	const sizeText = data.size != null && data.size !== '' ? (Number(data.size) > 1024 ? (Number(data.size) / 1024).toFixed(1) + ' KB' : data.size + ' B') : '-';

	setTimeout(updateConfigLineNumbers, 0);

	return E('div', {}, [
		E('div', { 'style': omniaUi.sectionStyle() }, [
			E('div', { 'style': 'display: flex; justify-content: space-between; gap: .75rem; align-items: center; flex-wrap: wrap; margin-bottom: .6rem;' }, [
				E('div', {}, [
					omniaUi.sectionTitle(_('当前运行配置 (sing-box)')),
					omniaUi.sectionDescription(_('当前 sing-box 进程实际加载的运行配置文件 (/etc/omnia/runtime/config.json)。只读预览，便于排查出站节点、分流规则及 DNS 配置。'))
				]),
				E('div', { 'style': 'display: flex; gap: .5rem; align-items: center; flex-wrap: wrap;' }, [
					omniaUi.pill(exists ? _('生效中') : _('未生成'), exists ? 'ok' : 'error'),
					exists ? omniaUi.pill(_('%d 行').format(lineCount), 'neutral') : '',
					data.mtime ? omniaUi.pill(_('修改于: %s').format(omniaTime.formatMaybeTime(data.mtime)), 'neutral') : ''
				])
			]),
			omniaUi.actionRow([
				E('button', {
					'type': 'button',
					'class': omniaMotion.buttonClass('btn cbi-button cbi-button-apply'),
					'disabled': exists ? null : 'disabled',
					'click': function(ev) {
						ev.preventDefault();
						if (!exists || !formatted) return;
						const btn = ev.target;
						if (navigator.clipboard && navigator.clipboard.writeText) {
							navigator.clipboard.writeText(formatted).then(function() {
								btn.textContent = _('✅ 已复制到剪贴板！');
								setTimeout(function() { btn.textContent = _('📋 复制全部配置'); }, 2500);
							});
						} else {
							const ta = document.getElementById('omnia-runtime-config-viewer');
							if (ta) {
								ta.select();
								document.execCommand('copy');
								btn.textContent = _('✅ 已复制！');
								setTimeout(function() { btn.textContent = _('📋 复制全部配置'); }, 2500);
							}
						}
					}
				}, _('📋 复制全部配置')),
				E('button', {
					'type': 'button',
					'class': omniaMotion.buttonClass('btn cbi-button cbi-button-neutral'),
					'click': function(ev) {
						ev.preventDefault();
						loadRuntimeConfigLazy(true);
					}
				}, _('🔄 重新加载'))
			]),
			E('div', { 'style': 'display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: .75rem; margin-top: .75rem; padding-top: .75rem; border-top: 1px solid #eef0f3; color: #667; font-size: 12px;' }, [
				E('div', {}, [ E('strong', {}, _('配置文件路径：')), E('span', {}, ' ' + (data.path || '/etc/omnia/runtime/config.json')) ]),
				E('div', {}, [ E('strong', {}, _('配置总行数：')), E('span', {}, ' ' + (exists ? _('%d 行').format(lineCount) : '-')) ]),
				E('div', {}, [ E('strong', {}, _('文件大小：')), E('span', {}, ' ' + sizeText) ]),
				E('div', {}, [ E('strong', {}, _('最后生成时间：')), E('span', {}, ' ' + (data.mtime ? omniaTime.formatMaybeTime(data.mtime) : '-')) ])
			]),
			E('div', {
				'style': 'margin-top: .85rem; display: flex; background: #0f172a; border: 1px solid #334155; border-radius: 8px; overflow: hidden; min-height: 28rem; height: 38rem;'
			}, [
				E('div', {
					'id': 'omnia-runtime-config-gutter',
					'style': 'box-sizing: border-box; padding: 1rem .5rem 1rem .75rem; background: #090d16; color: #475569; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 13px; line-height: 1.5; text-align: right; user-select: none; border-right: 1px solid #1e293b; overflow: hidden; min-width: 3.5rem; white-space: pre;'
				}),
				E('textarea', {
					'id': 'omnia-runtime-config-viewer',
					'class': 'cbi-input-textarea',
					'readonly': 'readonly',
					'style': 'flex: 1; height: 100%; border: none; box-sizing: border-box; background: transparent; color: #f8fafc; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 13px; line-height: 1.5; padding: 1rem; resize: none; outline: none; tab-size: 2; white-space: pre; overflow: auto;',
					'wrap': 'off',
					'spellcheck': 'false',
					'scroll': function(ev) {
						const gutter = document.getElementById('omnia-runtime-config-gutter');
						if (gutter) gutter.scrollTop = ev.target.scrollTop;
					}
				}, exists ? formatted : (rawContent || _('// 运行配置尚未生成，请在控制面板生成并应用配置后查看。')))
			])
		])
	]);
}

function dataplanePanel() {
	const probe = omniaUi.dataOf(pageResults.connectivity);
	const checks = probe.checks || {};
	const readiness = probe.readiness || {};
	const commands = probe.commands || {};
	const runtime = probe.runtime || {};
	const logs = omniaUi.dataOf(pageResults.logs);

	if (!pageResults.connectivity)
		return E('div', {}, [
			E('div', { 'style': omniaUi.sectionStyle() }, [
				omniaUi.sectionTitle(_('数据面观测')),
				omniaUi.sectionDescription(_('数据面探测正在后台运行，控制面信息可以先查看。')),
				E('div', { 'style': omniaUi.mutedStyle() }, _('正在获取 TUN、策略表和路由探测结果...'))
			]),
			E('div', { 'style': omniaUi.sectionStyle() }, [
				omniaUi.sectionTitle(_('数据面日志')),
				E('pre', { 'style': 'white-space: pre-wrap; overflow-wrap: anywhere; max-height: 420px; overflow-y: auto;' }, pageResults.logs ? logsText(logs.lines, dataplaneLogs) : _('日志正在后台加载...'))
			])
		]);

	const ready = readiness.ready === true;
	const routeDiagnostic = checks.route_default_uses_tun || checks.route_target_uses_tun;

	return E('div', {}, [
		E('div', { 'style': omniaUi.sectionStyle() }, [
			omniaUi.sectionTitle(_('数据面观测')),
			omniaUi.sectionDescription(_('用于排查 TUN、auto_redirect、策略表和基础数据面状态。')),
			checkRow(_('数据面就绪'), ready, ready ? _('ready') : (readiness.failed_check || '-')),
			checkRow(_('Runtime 运行中'), !!checks.runtime_running, runtime.service_status || '-'),
			checkRow(_('TUN 存在'), !!checks.tun_present, runtime.tun_name || readiness.tun_name || 'tun0'),
			checkRow(_('TUN 已 UP'), !!checks.tun_up, '-'),
			checkRow(_('表 2022 指向 TUN'), !!checks.table_2022_has_tun, '-'),
			checkRow(_('ip rule 包含表 2022'), !!checks.ip_rule_has_table_2022, '-'),
			checkRow(_('auto_redirect 规则可观测'), !!checks.ip_rule_has_fwmark_redirect, checks.auto_redirect_mode ? _('auto_redirect mode') : '-'),
			checkRow(_('本机 route get 经 TUN'), !!routeDiagnostic, _('auto_redirect 模式下仅作诊断，不参与就绪判断'), true)
		]),
		E('div', { 'style': omniaUi.sectionStyle() }, [
			omniaUi.sectionTitle(_('数据面命令输出')),
			commandBlock('ip link show ' + (runtime.tun_name || readiness.tun_name || 'tun0'), commands.tun_link),
			commandBlock('ip rule', commands.ip_rule),
			commandBlock('ip route show table 2022', commands.table_2022),
			commandBlock('ip route get 1.1.1.1', commands.route_1_1_1_1),
			commandBlock('ip route get ' + (probe.probe_target || '1.1.1.1'), commands.route_target)
		]),
		E('div', { 'style': omniaUi.sectionStyle() }, [
			omniaUi.sectionTitle(_('数据面日志')),
			E('pre', { 'style': 'white-space: pre-wrap; overflow-wrap: anywhere; max-height: 420px; overflow-y: auto;' }, pageResults.logs ? logsText(logs.lines, dataplaneLogs) : _('日志正在后台加载...'))
		])
	]);
}

function fileRows(files) {
	const order = [
		'profile',
		'subscriptions',
		'node_snapshot',
		'candidate',
		'runtime_config',
		'runtime_backup',
		'runtime_state',
		'auto_apply_state',
		'last_error'
	];
	const rows = [];

	order.forEach(function(key) {
		const item = files && files[key];
		if (!item)
			return;

		rows.push(E('div', { 'class': omniaMotion.softRowClass(), 'style': 'display: grid; grid-template-columns: minmax(130px, .8fr) minmax(0, 2fr) 90px; gap: .75rem; padding: .5rem 0; border-bottom: 1px solid #eef0f3; align-items: center;' }, [
			E('div', { 'style': 'font-weight: 600;' }, key),
			E('div', { 'style': 'overflow-wrap: anywhere;' }, item.path || '-'),
			E('div', { 'style': 'text-align: right;' }, omniaUi.pill(item.exists ? _('存在') : _('缺失'), item.exists ? 'ok' : 'error'))
		]));
	});

	if (!rows.length)
		rows.push(E('div', { 'style': omniaUi.mutedStyle() }, _('未观测到文件状态。')));

	return rows;
}

function commandText() {
	return [
		'/etc/init.d/rpcd restart',
		'sleep 2',
		'rm -rf /tmp/luci-*',
		'/etc/init.d/uhttpd restart',
		'ubus call omnia runtime_healthcheck',
		'ubus call omnia diagnostics_get',
		'ubus call omnia connectivity_probe',
		'ubus call omnia logs_get',
		'ubus call omnia last_error_get',
		'ubus call omnia selector_list | head -c 3000'
	].join('\n');
}

function controlplanePanel() {
	const diagnostics = omniaUi.dataOf(pageResults.diagnostics);
	const runtime = diagnostics.runtime || {};
	const service = diagnostics.service || {};
	const files = diagnostics.files || {};
	const lastError = omniaUi.dataOf(pageResults.lastError);
	const logs = omniaUi.dataOf(pageResults.logs);
	const apiStatus = omniaUi.dataOf(pageResults.apiStatus);
	const official = apiStatus.singbox_api || {};
	const clash = apiStatus.clash_api || {};
	const taskLocks = omniaUi.dataOf(pageResults.taskLocks).locks || [];

	return E('div', {}, [
		E('div', { 'style': omniaUi.sectionStyle() }, [
			omniaUi.sectionTitle(_('API 状态')),
			field(_('sing-box API'), official.available === null || official.available == null ? _('未确认') : (official.available ? _('可用') : _('不可用'))),
			field(_('sing-box API 地址'), official.api_url || '-'),
			field(_('sing-box API 原因'), official.reason || '-'),
			field(_('Clash API'), clash.available ? _('可用') : _('不可用')),
			field(_('Clash API 地址'), clash.external_controller || '-'),
			field(_('Clash API 原因'), clash.reason || '-')
		]),
		E('div', { 'style': omniaUi.sectionStyle() }, [
			omniaUi.sectionTitle(_('控制面状态')),
			field(_('服务状态'), service.stdout || runtime.service_status || '-'),
			field(_('服务状态码'), service.code),
			field(_('Runtime 配置'), runtime.runtime_config_path || '-'),
			field(_('Runtime Hash'), runtime.runtime_config_hash || '-'),
			field(_('最近应用结果'), runtime.last_apply_result || '-'),
			field(_('检查时间'), omniaTime.formatMaybeTime(runtime.checked_at))
		]),
		E('div', { 'style': omniaUi.sectionStyle() }, [
			omniaUi.sectionTitle(_('后台任务锁')),
			E('div', {}, taskLocks.map(function(lock) {
				const detail = lock.exists ? '%s, PID %s, %s'.format(lock.task && lock.task.status || '-', lock.pid || '-', lock.reason || '-') : _('未占用');
				return E('div', { 'style': 'display: grid; grid-template-columns: minmax(160px, 1fr) minmax(0, 2fr) auto; gap: .75rem; align-items: center; padding: .5rem 0; border-bottom: 1px solid #eef0f3;' }, [
					E('div', { 'style': 'font-weight: 600;' }, lock.task_type || '-'),
					E('div', { 'style': omniaUi.mutedStyle() }, detail),
					lock.recoverable ? E('button', {
						'class': omniaMotion.buttonClass('btn cbi-button cbi-button-negative'),
						'click': function(ev) {
							ev.preventDefault();
							callTaskLockRecover(lock.task_type).then(function(result) {
								if (!result || !result.ok)
									return { ok: false, message: result && (result.message || result.code) || _('恢复失败'), detail: result && (result.detail || result.code) || '' };
								return callTaskLocksGet();
							}).then(function(result) {
								pageResults.taskLocks = result && result.ok ? result : {
									ok: false,
									message: result && result.message || _('任务锁恢复失败'),
									detail: result && result.detail || ''
								};
								redraw();
							});
						}
					}, _('释放陈旧锁')) : E('span', {})
				]);
			}))
		]),
		E('div', { 'style': omniaUi.sectionStyle() }, [
			omniaUi.sectionTitle(_('控制面文件')),
			E('div', { 'style': 'display: grid; grid-template-columns: minmax(130px, .8fr) minmax(0, 2fr) 90px; gap: .75rem; color: #667; font-size: 12px; padding-bottom: .4rem; border-bottom: 1px solid #dfe3e8;' }, [
				E('div', {}, _('名称')),
				E('div', {}, _('路径')),
				E('div', { 'style': 'text-align: right;' }, _('状态'))
			]),
			E('div', {}, fileRows(files))
		]),
		E('div', { 'style': omniaUi.sectionStyle() }, [
			omniaUi.sectionTitle(_('最近错误')),
			E('pre', { 'style': 'white-space: pre-wrap; overflow-wrap: anywhere; min-height: 2.5rem;' }, lastError.content || runtime.recent_error || _('无'))
		]),
		E('div', { 'style': omniaUi.sectionStyle() }, [
			omniaUi.sectionTitle(_('验收命令')),
			E('textarea', {
				'readonly': 'readonly',
				'style': 'width: 100%; min-height: 180px; box-sizing: border-box; font-family: monospace; white-space: pre;'
			}, commandText())
		]),
		E('div', { 'style': omniaUi.sectionStyle() }, [
			omniaUi.sectionTitle(_('控制面日志')),
			E('pre', { 'style': 'white-space: pre-wrap; overflow-wrap: anywhere; max-height: 420px; overflow-y: auto;' }, pageResults.logs ? logsText(logs.lines, controlplaneLogs) : _('日志正在后台加载...'))
		])
	]);
}

function renderPage() {
	const errorPanel = loadErrorPanel();
	omniaMotion.inject();
	const children = [
		omniaUi.pageHeader(_('网络诊断'), _('用于排查运行配置、控制面任务和数据面接管。高层摘要集中在概览页。')),
		E('div', { 'style': 'display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; margin: 0 0 .75rem;' }, [
			tabButton('config', _('运行配置')),
			tabButton('dataplane', _('数据面')),
			tabButton('controlplane', _('控制面'))
		])
	];

	if (errorPanel)
		children.push(errorPanel);

	if (activeTab === 'config')
		children.push(runtimeConfigPanel());
	else if (activeTab === 'dataplane')
		children.push(dataplanePanel());
	else
		children.push(controlplanePanel());

	ensureLazyLoads();

	return E('div', { 'id': 'omnia-diagnostics-root', 'class': 'cbi-map' }, [
		E('div', {}, children)
	]);
}

function redraw() {
	const root = document.getElementById('omnia-diagnostics-root');
	if (root)
		root.parentNode.replaceChild(renderPage(), root);
}

return view.extend({
	load: function() {
		return Promise.all([
			callRuntimeConfigGet().catch(function(e) { return { ok: false, message: _('运行配置加载失败'), detail: e.message || String(e) }; }),
			callApiStatus().catch(function(e) { return { ok: false, message: _('API 状态加载失败'), detail: e.message || String(e) }; }),
			callDiagnosticsGet().catch(function(e) { return { ok: false, message: _('控制面诊断加载失败'), detail: e.message || String(e) }; }),
			callLastErrorGet().catch(function(e) { return { ok: false, message: _('最近错误加载失败'), detail: e.message || String(e) }; }),
			callTaskLocksGet().catch(function(e) { return { ok: false, message: _('任务锁状态加载失败'), detail: e.message || String(e) }; })
		]).then(function(results) {
			return {
				runtimeConfig: results[0],
				apiStatus: results[1],
				diagnostics: results[2],
				lastError: results[3],
				taskLocks: results[4]
			};
		});
	},

	render: function(results) {
		pageResults = results || {};
		logsLoading = false;
		connectivityLoading = false;
		runtimeConfigLoading = false;
		return renderPage();
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});

