'use strict';
'require view';
'require rpc';
'require omnia.time as omniaTime';
'require omnia.ui as omniaUi';
'require omnia.motion as omniaMotion';

const callOverviewStatus = rpc.declare({
	object: 'omnia',
	method: 'overview_status',
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

const callStop = rpc.declare({
	object: 'omnia',
	method: 'runtime_stop',
	expect: { '': {} }
});

const callRestart = rpc.declare({
	object: 'omnia',
	method: 'runtime_restart',
	expect: { '': {} }
});

const callRollback = rpc.declare({
	object: 'omnia',
	method: 'config_rollback',
	expect: { '': {} }
});

const callDashboardMetrics = rpc.declare({
	object: 'omnia',
	method: 'dashboard_metrics',
	expect: { '': {} }
});

const callConnectionsList = rpc.declare({
	object: 'omnia',
	method: 'connections_list',
	expect: { '': {} }
});

const callNodeDelayTest = rpc.declare({
	object: 'omnia',
	method: 'node_delay_test',
	params: [ 'node' ],
	expect: { '': {} }
});

let pageResults = {};
let actionStatus = '';
let actionStatusOk = true;
let supplementalLoading = false;
let supplementalLoadSeq = 0;

let liveMetricsTimer = null;
let liveMetricsActive = false;
let metricsInFlight = false;
let liveUpSeries = [];
let liveDownSeries = [];
let liveConnSeries = [];
let liveMetricsData = {
	up: 0,
	down: 0,
	upTotal: 0,
	downTotal: 0,
	connCount: 0,
	sourceApi: 'sing-box API',
	available: false
};
const MAX_SERIES_POINTS = 25;

let connDetailsOpen = false;
let connActiveTab = 'source';
let connViewMode = 'history'; /* 'history' | 'active' */
let connAggregatedData = {
	sources: [],
	outbounds: [],
	groups: [],
	total: 0,
	loading: false
};

const TRAFFIC_STORE_KEY = 'omnia_traffic_stats_v1';
let trafficStatsCache = null;
let activeSeenConnections = {}; /* Map<id, { up, down, src, outbound, group }> */

function loadTrafficStats() {
	if (trafficStatsCache) return trafficStatsCache;
	let raw = null;
	try {
		if (typeof window !== 'undefined' && window.localStorage) {
			raw = window.localStorage.getItem(TRAFFIC_STORE_KEY);
		}
	} catch (e) {
		raw = null;
	}
	let stats = null;
	if (raw) {
		try {
			stats = JSON.parse(raw);
		} catch (e) {
			stats = null;
		}
	}
	if (!stats || typeof stats !== 'object') {
		stats = {
			retention: 'monthly',
			period_start: Date.now(),
			sources: {},
			outbounds: {},
			groups: {}
		};
	}
	checkTrafficRetention(stats);
	trafficStatsCache = stats;
	return trafficStatsCache;
}

function saveTrafficStats(stats) {
	if (!stats) return;
	trafficStatsCache = stats;
	try {
		if (typeof window !== 'undefined' && window.localStorage) {
			window.localStorage.setItem(TRAFFIC_STORE_KEY, JSON.stringify(stats));
		}
	} catch (e) {
		/* ignore quota or access errors */
	}
}

function checkTrafficRetention(stats) {
	if (!stats || !stats.period_start) return;
	let now = Date.now();
	let start = stats.period_start;
	let retention = stats.retention || 'monthly';
	let shouldReset = false;

	if (retention === 'weekly') {
		/* 7 days */
		if (now - start > 7 * 86400 * 1000) shouldReset = true;
	} else if (retention === 'monthly') {
		/* Different calendar month */
		let dStart = new Date(start);
		let dNow = new Date(now);
		if (dNow.getFullYear() !== dStart.getFullYear() || dNow.getMonth() !== dStart.getMonth()) {
			shouldReset = true;
		}
	} else if (retention === 'quarterly') {
		/* ~90 days */
		if (now - start > 90 * 86400 * 1000) shouldReset = true;
	}

	if (shouldReset) {
		stats.period_start = now;
		stats.sources = {};
		stats.outbounds = {};
		stats.groups = {};
		saveTrafficStats(stats);
	}
}

function resetTrafficStats() {
	let stats = {
		retention: (trafficStatsCache && trafficStatsCache.retention) || 'monthly',
		period_start: Date.now(),
		sources: {},
		outbounds: {},
		groups: {}
	};
	saveTrafficStats(stats);
	activeSeenConnections = {};
	fetchConnectionStats();
}

function recordConnectionDelta(item) {
	if (!item || !item.id) return;
	let id = item.id;
	let up = Number(item.upload || 0);
	let down = Number(item.download || 0);
	let src = (item.source || '').split(':')[0] || _('未知');
	let chains = Array.isArray(item.chains) ? item.chains : [];
	let outbound = chains.length > 0 ? chains[0] : (item.destination || _('直连'));
	let group = chains.length > 0 ? chains[chains.length - 1] : (item.rule || _('默认'));

	let prev = activeSeenConnections[id];
	let deltaUp = 0;
	let deltaDown = 0;

	if (prev) {
		if (up >= prev.up) deltaUp = up - prev.up;
		if (down >= prev.down) deltaDown = down - prev.down;
	} else {
		deltaUp = up;
		deltaDown = down;
	}

	activeSeenConnections[id] = { up: up, down: down, src: src, outbound: outbound, group: group, lastSeen: Date.now() };

	if (deltaUp > 0 || deltaDown > 0) {
		let stats = loadTrafficStats();
		if (!stats.sources[src]) stats.sources[src] = { up: 0, down: 0 };
		stats.sources[src].up += deltaUp;
		stats.sources[src].down += deltaDown;

		if (!stats.outbounds[outbound]) stats.outbounds[outbound] = { up: 0, down: 0 };
		stats.outbounds[outbound].up += deltaUp;
		stats.outbounds[outbound].down += deltaDown;

		if (!stats.groups[group]) stats.groups[group] = { up: 0, down: 0 };
		stats.groups[group].up += deltaUp;
		stats.groups[group].down += deltaDown;
	}
}

let latencyInterval = '5m';
let latencyTimer = null;
let latencyHistory = {
	Baidu: [28, 30, 26, 28, 29, 27, 28],
	Cloudflare: [130, 128, 125, 124, 122, 126, 124],
	GitHub: [220, 215, 225, 218, 216, 219, 218],
	YouTube: [198, 202, 195, 196, 194, 197, 196]
};
let latencyLastTime = '';
let latencyTesting = false;

let netGlobalMasked = false;
let netChannels = {
	channel1: 'ipip.net',
	channel2: 'ip.sb'
};
let netSiteDatabase = {
	'ipip.net': { id: 'ipip.net', name: 'ipip.net', url: 'https://myip.ipip.net/json', region: '中国 局域网', ip: '2408:825c:4e23:57ac::1', isp: '联通', loading: false },
	'ip.sb': { id: 'ip.sb', name: 'ip.sb', url: 'https://api.ip.sb/geoip', region: '', ip: '166.0.198.207', isp: 'Cloudflare', loading: false },
	'ipwho.is': { id: 'ipwho.is', name: 'ipwho.is', url: 'https://ipwho.is/', region: '中国 香港', ip: '104.28.19.42', isp: 'AS13335', loading: false },
	'ipapi.is': { id: 'ipapi.is', name: 'ipapi.is', url: 'https://api.ipapi.is', region: '美国 洛杉矶', ip: '198.41.214.162', isp: 'Cloudflare', loading: false }
};
let networkUpdatedAt = '';
let lastMetricsTimestamp = 0;
let lastUploadTotal = 0;
let lastDownloadTotal = 0;

function stateOf() {
	const data = omniaUi.dataOf(pageResults.runtime);
	return data.state || {};
}

function safeJson(text) {
	try {
		return JSON.parse(text || '{}');
	} catch (e) {
		return {};
	}
}

function routerHostUrl(url) {
	url = omniaUi.valueText(url);
	if (url === '-')
		return url;
	return url.replace('://<router-host>', '://%s'.format(window.location.hostname || 'router-host'));
}

function cardStyle(accent, clickable) {
	return 'border: 1px solid #dfe3e8; border-left: 4px solid %s; border-radius: 8px; padding: .65rem .75rem; background: #fff; box-sizing: border-box; min-height: 76px;%s'.format(
		accent || '#64748b',
		clickable ? ' display: block; color: inherit; text-decoration: none; cursor: pointer;' : ''
	);
}

function externalLinkIcon() {
	const icon = E('span', { 'style': 'display: flex; align-items: center; justify-content: center;' });
	icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z"/><path fill-rule="evenodd" d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z"/></svg>';
	return icon;
}

function card(title, value, detail, accent, href, action) {
	const detailContent = typeof detail === 'string' || detail == null ? omniaUi.valueText(detail) : detail;
	const tag = href && !action ? 'a' : 'div';
	const attrs = {
		'class': omniaMotion.cardClass(null, !!href),
		'style': cardStyle(accent, !!href) + (action ? ' position: relative; padding-right: 2.6rem;' : '')
	};
	if (href)
		if (action) {
			attrs.role = 'link';
			attrs.tabindex = '0';
			attrs.click = function(ev) {
				window.location.href = href;
			};
			attrs.keydown = function(ev) {
				if (ev.key === 'Enter' || ev.key === ' ') {
					ev.preventDefault();
					window.location.href = href;
				}
			};
		} else {
			attrs.href = href;
		}

	const children = [
		E('div', { 'style': 'font-size: 11px; color: #667; text-transform: uppercase; letter-spacing: .04em;' }, title),
		E('div', { 'style': 'font-size: 19px; font-weight: 700; margin-top: .2rem; line-height: 1.15; overflow-wrap: anywhere;' }, omniaUi.valueText(value)),
		E('div', { 'style': 'margin-top: .35rem; color: #667; font-size: 12px; line-height: 1.3; overflow-wrap: anywhere;' }, detailContent)
	];

	if (action)
		children.push(action);

	return E(tag, attrs, children);
}

function statusTone(ok, warning) {
	if (ok)
		return '#16a34a';
	if (warning)
		return '#ea580c';
	return '#dc2626';
}

function statusWord(status) {
	if (status === 'success')
		return _('成功');
	if (status === 'partial')
		return _('部分成功');
	if (status === 'fail')
		return _('失败');
	if (status === 'failed')
		return _('失败');
	if (status === 'running')
		return _('运行中');
	if (status === 'starting')
		return _('启动中');
	if (status === 'idle')
		return _('空闲');
	if (status)
		return status;
	return '-';
}

function taskMetaOf(result) {
	const data = omniaUi.dataOf(result);
	return data.task_meta && typeof data.task_meta === 'object' ? data.task_meta : {};
}

function taskDisplayName(result, fallback) {
	const meta = taskMetaOf(result);
	return meta.display_name || fallback || _('后台任务');
}

function compactMessage(text) {
	text = omniaUi.valueText(text);
	text = text.replace(/Required Rule Sets downloaded/g, '所需规则集已同步');
	text = text.replace(/Rule Set sync running/g, '规则集正在同步');
	text = text.replace(/Rule Set sync queued/g, '规则集同步已排队');
	text = text.replace(/Rule Set sync job started/g, '规则集同步任务已启动');
	text = text.replace(/Rule Set sync job is already running/g, '规则集同步任务正在运行');
	text = text.replace(/Rule Set sync success/g, '规则集同步成功');
	text = text.replace(/Rule Set sync partial/g, '规则集部分同步成功');
	text = text.replace(/Rule Set sync fail/g, '规则集同步失败');
	text = text.replace(/Required:/g, '需要:');
	text = text.replace(/Updated:/g, '已更新:');
	text = text.replace(/Unchanged:/g, '未变化:');
	text = text.replace(/Failed:/g, '失败:');
	text = text.replace(/Detail:/g, '详情:');
	text = text.replace(/\n/g, ' | ');
	return text;
}

function schedulerTaskText(schedulerTask, task, disabledText, waitingText) {
	schedulerTask = schedulerTask || {};
	task = task || {};
	if (task.status && task.status !== 'idle')
		return _('%s 于 %s').format(statusWord(task.status), omniaTime.formatMaybeTime(task.finished_at || task.started_at));
	if (schedulerTask.last_trigger_result && schedulerTask.last_trigger_result !== 'waiting')
		return _('%s 于 %s').format(schedulerTask.last_trigger_result, omniaTime.formatMaybeTime(schedulerTask.last_run_at));
	if (schedulerTask.enabled)
		return waitingText || _('等待调度');
	return disabledText || _('自动调度已停用');
}

function backgroundTaskText(taskName, schedulerTask, task, disabledText, waitingText) {
	const text = schedulerTaskText(schedulerTask, task, disabledText, waitingText);
	return taskName ? _('%s：%s').format(taskName, text) : text;
}

function autoApplySummary(task) {
	const meta = task && task.meta || {};
	const autoApply = meta.auto_apply || {};
	if (autoApply.attempted !== true)
		return '';
	if (autoApply.ok === true && autoApply.stage === 'stable_success')
		return _('自动应用：sing-box 运行正常');
	if (autoApply.stage === 'rollback_success')
		return _('自动应用：已回滚，sing-box 运行正常');
	if (autoApply.stage === 'rollback_degraded')
		return _('自动应用：异常，请检查');
	if (autoApply.ok === false)
		return _('自动应用：失败，请检查');
	return '';
}

function schedulerWarning(scheduler, enabled) {
	scheduler = scheduler || {};
	if (!enabled)
		return '';
	if (scheduler.healthy)
		return '';
	if (!scheduler.script_exists)
		return _('自动调度器脚本缺失');
	if (!scheduler.script_executable)
		return _('自动调度器脚本不可执行');
	if (!scheduler.cron_installed)
		return _('系统计划任务未安装');
	if (!scheduler.cron_running)
		return _('cron 未运行');
	return _('自动调度器异常');
}

function schedulerPlanText(enabled, hour) {
	if (!enabled)
		return _('自动调度已停用');
	if (hour == null || hour === '')
		return _('已启用，等待调度');
	hour = Number(hour);
	if (!Number.isFinite(hour))
		return _('已启用，等待调度');
	return _('每日 %s:05 检查执行').format(hour < 10 ? '0' + hour : String(hour));
}

function operationButton(label, actionLabel, rpcCall, buttonClass, confirmText) {
	return E('button', {
		'class': omniaMotion.buttonClass('btn cbi-button %s'.format(buttonClass || 'cbi-button-neutral')),
		'style': 'min-width: 5.5rem; padding-left: 1rem; padding-right: 1rem;',
		'click': function(ev) {
			ev.preventDefault();
			return runAction(actionLabel, rpcCall, confirmText);
		}
	}, label);
}

function resourceHref(tab) {
	return L.url('admin/services/omnia/resources') + '?tab=' + encodeURIComponent(tab);
}

function setActionStatus(text, ok) {
	actionStatus = text || '';
	actionStatusOk = ok !== false;
	omniaUi.paintStatus('omnia-overview-action-status', actionStatus, actionStatusOk ? 'ok' : 'error');
}

function resultError(result, fallback) {
	if (result && (result.message || result.code))
		return '%s: %s'.format(result.message || result.code || fallback || _('操作失败'), result.detail || result.code || _('无详细信息'));
	return fallback || _('操作失败');
}

function pageLoadError() {
	const failures = [
		pageResults.runtime,
		pageResults.profile,
		pageResults.subscriptions,
		pageResults.snapshot,
		pageResults.rules,
		pageResults.panel,
		pageResults.apiStatus,
		pageResults.profileSource,
		pageResults.rulesPolicy,
		pageResults.notify,
		pageResults.autoTask,
		pageResults.subscriptionTask,
		pageResults.rulesetTask
	].filter(function(result) {
		return result && !result.ok;
	});

	if (!failures.length)
		return '';

	return failures.map(function(result) {
		return resultError(result, _('加载失败'));
	}).join(' | ');
}

let pipelineRunning = false;

function formatDiagnosticError(stage, title, detail, hint) {
	return E('div', { 'style': 'font-size: 13px; line-height: 1.5;' }, [
		E('div', { 'style': 'font-weight: 700; font-size: 14px; margin-bottom: .4rem; display: flex; align-items: center; gap: .35rem;' }, [
			E('span', {}, '❌ ' + _('第 %d 阶段失败：%s').format(stage, title))
		]),
		detail ? E('div', { 'style': 'background: rgba(0,0,0,0.06); padding: .4rem .6rem; border-radius: 4px; font-family: monospace; font-size: 12px; margin-bottom: .4rem; overflow-wrap: anywhere; white-space: pre-wrap;' }, detail) : '',
		E('div', { 'style': 'font-size: 12px; margin-bottom: .2rem;' }, [
			E('strong', {}, _('【运行安全】')),
			_('已自动熔断终止应用。当前运行配置保持不变，网络连接未被破坏。')
		]),
		hint ? E('div', { 'style': 'font-size: 12px; color: #b45309;' }, [
			E('strong', {}, _('【排查建议】')),
			hint
		]) : ''
	]);
}

function runOneClickApply() {
	if (pipelineRunning)
		return Promise.resolve();

	pipelineRunning = true;
	let btn = document.getElementById('omnia-one-click-apply-btn');
	if (btn) {
		btn.disabled = true;
		btn.innerText = _('⚡ 正在执行一键生成并应用...');
	}

	setActionStatus(_('【1/4 正在生成候选配置】正在解析模板、订阅节点与分流规则...'), true);

	return callGenerate().then(function(genRes) {
		if (!(genRes && genRes.ok)) {
			let detail = genRes && (genRes.detail || genRes.message) || _('生成配置时发生未知异常');
			let hint = _('请检查配置模板语法是否正确，引用的出站或策略组是否存在。');
			if (detail.indexOf('RUNTIME_CONTRACT') >= 0) {
				hint = _('模板必须包含有效的 inbounds.tun 契约配置。请前往【配置模板】检查 tun 配置。');
			} else if (detail.indexOf('CLASH_API_PORT_CONFLICT') >= 0) {
				hint = _('Clash API 端口与 sing-box 原生服务端口冲突，请修改端口配置。');
			}
			setActionStatus(formatDiagnosticError(1, _('候选配置生成失败'), detail, hint), false);
			throw new Error('STAGE_1_FAILED');
		}

		let genData = omniaUi.dataOf(genRes) || {};
		let nodeCount = genData.node_count || 0;
		let groupCount = genData.generated_groups || 0;

		setActionStatus(_('【2/4 正在进行内核语法校验】sing-box 正在校验生成配置的合法性...'), true);
		return callCheck().then(function(checkRes) {
			if (!(checkRes && checkRes.ok)) {
				let detail = checkRes && (checkRes.detail || checkRes.message) || _('内核语法校验未通过');
				let hint = _('sing-box 内核拒绝了该配置。请前往【配置模板】根据上方内核具体报错修改 JSON。');
				setActionStatus(formatDiagnosticError(2, _('sing-box 内核语法检查失败'), detail, hint), false);
				throw new Error('STAGE_2_FAILED');
			}

			setActionStatus(_('【3/4 正在应用运行配置】正在重载 sing-box 服务进程...'), true);
			return callApply().then(function(applyRes) {
				if (!(applyRes && applyRes.ok)) {
					let detail = applyRes && (applyRes.detail || applyRes.message) || _('应用运行配置失败');
					let hint = _('服务拉起失败，已自动回滚。请在【网络诊断 - 控制面】查看系统运行日志排查端口或权限冲突。');
					setActionStatus(formatDiagnosticError(3, _('运行配置应用失败（已自动回滚）'), detail, hint), false);
					throw new Error('STAGE_3_FAILED');
				}

				let applyData = omniaUi.dataOf(applyRes) || {};
				let healthReady = applyData.health_ready === true;

				if (!healthReady) {
					setActionStatus(formatDiagnosticError(4, _('服务健康存活检查未就绪'), _('服务进程未在预期时间内完成健康监听'), _('请前往【网络诊断】检查 sing-box 是否处于崩溃循环或端口被占用。')), false);
					return refreshPage();
				}

				let successMsg = E('div', { 'style': 'font-size: 13px; line-height: 1.5;' }, [
					E('div', { 'style': 'font-weight: 700; font-size: 14px; margin-bottom: .25rem;' }, '✓ ' + _('一键生成并应用成功！')),
					E('div', { 'style': 'font-size: 12px; color: #15803d;' }, _('已成功加载 %d 个出站节点、%d 个策略组。sing-box 运行时健康，网络代理正常服务中。').format(nodeCount, groupCount))
				]);
				setActionStatus(successMsg, true);
				return refreshPage();
			});
		});
	}).catch(function(err) {
		if (err && (err.message === 'STAGE_1_FAILED' || err.message === 'STAGE_2_FAILED' || err.message === 'STAGE_3_FAILED')) {
			return;
		}
		setActionStatus(err && (err.message || String(err)) || _('操作异常中断'), false);
	}).finally(function() {
		pipelineRunning = false;
		if (btn) {
			btn.disabled = false;
			btn.innerText = _('⚡ 一键生成并应用');
		}
	});
}

function runAction(label, rpcCall, confirmText) {
	if (confirmText && !window.confirm(confirmText))
		return Promise.resolve();

	setActionStatus(_('%s 正在执行...').format(label), true);

	return rpcCall().then(function(result) {
		if (result && result.ok) {
			setActionStatus(_('%s 已完成。').format(label), true);
			return refreshPage();
		}
		setActionStatus(resultError(result, _('%s 失败').format(label)), false);
		return result;
	}).catch(function(error) {
		setActionStatus(error.message || String(error), false);
	});
}

function refreshPage() {
	return loadAll().then(function(results) {
		supplementalLoadSeq++;
		supplementalLoading = false;
		pageResults = results;
		redraw();
		return results;
	});
}

function overviewItem(items, key, fallback) {
	return items && items[key] ? items[key] : {
		ok: false,
		message: fallback || _('加载失败'),
		detail: key
	};
}

function loadAll() {
	return callOverviewStatus().then(function(result) {
		const data = omniaUi.dataOf(result);
		const items = data.items || {};
		return {
			packageVersion: data.package_version || '',
			singboxVersion: data.singbox_version || '',
			uptimeSeconds: Number(data.uptime_seconds || 0),
			runtime: overviewItem(items, 'runtime', _('Runtime 状态加载失败')),
			profile: overviewItem(items, 'profile', _('模板加载失败')),
			subscriptions: overviewItem(items, 'subscriptions', _('订阅加载失败')),
			snapshot: overviewItem(items, 'snapshot', _('节点快照摘要加载失败')),
			rules: overviewItem(items, 'rules', _('规则集清单加载失败')),
			panel: overviewItem(items, 'dashboard', _('面板状态加载失败')),
			apiStatus: overviewItem(items, 'api', _('API 状态加载失败')),
			profileSource: overviewItem(items, 'profile_source', _('模板源加载失败')),
			rulesPolicy: overviewItem(items, 'rules_policy', _('规则集策略加载失败')),
			notify: overviewItem(items, 'notify', _('通知设置加载失败')),
			autoTask: overviewItem(items, 'scheduler', _('自动调度器状态加载失败')),
			subscriptionTask: overviewItem(items, 'subscription_task', _('订阅刷新后台任务状态加载失败')),
			rulesetTask: overviewItem(items, 'ruleset_task', _('规则集同步后台任务状态加载失败'))
		};
	}).catch(function(e) {
		const failed = { ok: false, message: _('Overview 状态加载失败'), detail: e.message || String(e) };
		return {
			runtime: failed,
			profile: failed,
			subscriptions: failed,
			snapshot: failed,
			rules: failed,
			panel: failed,
			apiStatus: failed,
			profileSource: failed,
			rulesPolicy: failed,
			notify: failed,
			autoTask: failed,
			subscriptionTask: failed,
			rulesetTask: failed
		};
	});
}

function hasSupplementalData() {
	return true;
}

function loadSupplemental() {
}

function ensureSupplementalLoad() {
}

function runtimeCards() {
	const state = stateOf();
	const status = omniaUi.dataOf(pageResults.apiStatus);
	const official = status.singbox_api || {};
	const clash = status.clash_api || {};
	const running = !!state.sing_box_running;
	const tun = !!state.tun_exists;
	const config = !!state.runtime_config_exists;
	const officialObserved = official.available != null || official.configured != null;
	const clashObserved = clash.available != null || clash.configured != null;
	const apiObserved = officialObserved || clashObserved;
	const officialOk = official.available === true;
	const officialUnknown = official.available === null;
	const clashOk = clash.available === true;
	let apiValue = _('未观测');
	let apiAccent = '#64748b';

	if (apiObserved) {
		if (officialOk && clashOk) {
			apiValue = _('全部可用');
			apiAccent = '#16a34a';
		} else if (officialOk || clashOk) {
			apiValue = _('部分可用');
			apiAccent = '#ea580c';
		} else if (officialUnknown) {
			apiValue = _('未确认');
			apiAccent = '#64748b';
		} else {
			apiValue = _('不可用');
			apiAccent = '#dc2626';
		}
	}

	return E('div', { 'style': 'display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: .65rem;' }, [
		card(_('运行时'), running ? _('运行中') : _('已停止'), running ? _('sing-box 服务运行中') : _('服务已停止'), statusTone(running)),
		card(_('TUN'), tun ? _('存在') : _('缺失'), state.tun_name || '-', statusTone(tun, running)),
		card(_('配置'), config ? _('就绪') : _('缺失'), state.runtime_config_hash ? _('已观测到运行配置哈希') : _('运行配置缺失'), statusTone(config)),
		card(_('API'), apiValue, _('sing-box API: %s | Clash API: %s').format(officialObserved ? (officialUnknown ? _('未确认') : (officialOk ? _('可用') : _('不可用'))) : '-', clashObserved ? (clashOk ? _('可用') : _('不可用')) : '-'), apiAccent)
	]);
}

function resourceCards() {
	const profile = omniaUi.dataOf(pageResults.profile);
	const subscriptions = safeJson(omniaUi.dataOf(pageResults.subscriptions).content || '{}');
	const snapshot = omniaUi.dataOf(pageResults.snapshot);
	const rules = omniaUi.dataOf(pageResults.rules).summary || {};
	const panel = omniaUi.dataOf(pageResults.panel);
	const panelSource = panel.source || {};
	const panelDashboard = panel.dashboard || panelSource.dashboard || {};
	const profileSource = omniaUi.dataOf(pageResults.profileSource).source || {};
	const rulesPolicy = omniaUi.dataOf(pageResults.rulesPolicy).policy || {};
	const notifyData = omniaUi.dataOf(pageResults.notify);
	const notifySettings = notifyData.settings || {};
	const notifyTelegram = notifySettings.telegram || {};
	const notifyState = notifyData.state || {};
	const autoTaskData = omniaUi.dataOf(pageResults.autoTask);
	const autoTask = autoTaskData.state || {};
	const scheduler = autoTaskData.scheduler || {};
	const schedulerTasks = autoTask.tasks || {};
	const subSchedulerTask = schedulerTasks['subscription.refresh'] || {};
	const rulesSchedulerTask = schedulerTasks['ruleset.sync'] || {};
	const subTask = omniaUi.dataOf(pageResults.subscriptionTask).task || {};
	const rulesTask = omniaUi.dataOf(pageResults.rulesetTask).task || {};
	const subTaskName = taskDisplayName(pageResults.subscriptionTask, _('订阅刷新任务'));
	const rulesTaskName = taskDisplayName(pageResults.rulesetTask, _('规则集同步任务'));
	const sourceCount = Array.isArray(subscriptions.sources) ? subscriptions.sources.length : 0;
	const nodeCount = Number(snapshot.node_count || 0);
	const missingRules = Number(rules.missing_count || 0);
	const requiredRules = Number(rules.required_count || 0);
	const readyRules = Number(rules.ready_count || 0);
	const extraRules = Number(rules.local_extra_count || 0);
	const profileOk = pageResults.profile && pageResults.profile.ok && profile.valid !== false;
	const profileSyncTime = profileSource.updated_at ? omniaTime.formatMaybeTime(profileSource.updated_at) : _('未记录');
	const profileSourceText = profileSource.url ? _('已配置远程源') : _('未配置远程源');
	const snapshotTime = snapshot.updated_at ? omniaTime.formatMaybeTime(snapshot.updated_at) : _('未刷新');
	const subUpdate = subscriptions.subscription_update || {};
	const subScheduleWarning = schedulerWarning(scheduler, subUpdate.auto_update === true);
	const subAutoText = subScheduleWarning || backgroundTaskText(subTaskName, subSchedulerTask, subTask, _('自动刷新已停用'), schedulerPlanText(true, subUpdate.update_hour));
	const rulesTimeRaw = rulesTask.finished_at || rulesTask.started_at || rulesSchedulerTask.last_run_at || '';
	const rulesTime = rulesTimeRaw ? omniaTime.formatMaybeTime(rulesTimeRaw) : _('未同步');
	const rulesScheduleWarning = schedulerWarning(scheduler, rulesPolicy.auto_update === true);
	const rulesResultText = rulesScheduleWarning || compactMessage(backgroundTaskText(rulesTaskName, rulesSchedulerTask, rulesTask, _('自动同步已停用'), schedulerPlanText(true, rulesPolicy.update_hour)));
	const rulesMode = rulesPolicy.mode || '-';
	const rulesAutoApplyText = autoApplySummary(rulesTask);
	const rulesDetailText = _('上次同步：%s | 需要 %d / 已就绪 %d / 缺失 %d / 本地多余 %d | %s | %s%s').format(
		rulesTime,
		requiredRules,
		readyRules,
		missingRules,
		extraRules,
		rulesMode,
		rulesResultText,
		rulesAutoApplyText ? ' | ' + rulesAutoApplyText : ''
	);
	const panelReady = panelSource.enabled == true && panelDashboard.enabled == true;
	const panelUrl = routerHostUrl(panel.dashboard_url);
	const panelDetail = _('%s | %s').format(panelUrl !== '-' ? _('Dashboard 已托管') : _('Dashboard 地址未知'), panelDashboard.path || '-');
	const panelAction = panelUrl !== '-' ? E('a', {
			'class': omniaMotion.iconButtonClass(),
			'href': panelUrl,
			'target': '_blank',
			'rel': 'noopener noreferrer',
			'title': _('打开 Dashboard'),
			'aria-label': _('打开 Dashboard'),
			'style': 'position: absolute; top: .55rem; right: .6rem; display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 999px; border: 1px solid #dfe3e8; background: #f8fafc; color: #334155; text-decoration: none;',
			'click': function(ev) {
				ev.preventDefault();
				ev.stopPropagation();
				window.open(panelUrl, '_blank', 'noopener');
			}
		}, externalLinkIcon()) : null;
	const notifyEnabled = notifyTelegram.enabled == true;
	const notifyStatus = notifyState.last_status || (notifyEnabled ? _('等待中') : _('已停用'));
	const notifyResult = notifyState.last_attempt_at ? _('%s 于 %s').format(notifyState.last_sent ? _('已发送') : _('未发送'), omniaTime.formatMaybeTime(notifyState.last_attempt_at)) : (notifyEnabled ? _('未记录发送尝试') : _('Telegram 已停用'));
	let notifyAccent = '#64748b';
	if (notifyEnabled)
		notifyAccent = statusTone(notifyState.last_sent == true, !notifyState.last_attempt_at);

	return E('div', { 'style': 'display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: .65rem;' }, [
		card(_('模板'), profileOk ? _('就绪') : _('错误'), _('上次同步：%s | %s').format(profileSyncTime, profileSourceText), statusTone(profileOk), resourceHref('profile')),
		card(_('订阅'), nodeCount ? _('%d 个节点').format(nodeCount) : _('无节点'), _('上次刷新：%s | %s').format(snapshotTime, subAutoText), subScheduleWarning ? '#ea580c' : statusTone(sourceCount > 0 && nodeCount > 0, sourceCount > 0), resourceHref('subscriptions')),
		card(_('规则集'), missingRules === 0 ? _('就绪') : _('需要处理'), rulesDetailText, rulesScheduleWarning ? '#ea580c' : statusTone(missingRules === 0 && requiredRules > 0, requiredRules > 0), resourceHref('rules')),
		card(_('面板'), panelReady ? _('已启用') : _('未启用'), panelDetail, statusTone(panelReady), resourceHref('panel'), panelAction),
		card(_('Telegram'), notifyEnabled ? _('已启用') : _('已停用'), _('最近结果：%s | %s').format(notifyStatus, notifyResult), notifyAccent, resourceHref('notify'))
	]);
}

function formatBytesPerSec(bytes) {
	bytes = Number(bytes) || 0;
	if (bytes < 1024) return bytes.toFixed(0) + ' B/s';
	if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB/s';
	if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB/s';
	return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB/s';
}

function formatTotalBytes(bytes) {
	bytes = Number(bytes) || 0;
	if (bytes < 1024) return bytes.toFixed(0) + ' B';
	if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
	if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function formatUptimeDuration(seconds) {
	seconds = Math.floor(Number(seconds) || 0);
	if (seconds <= 0) return _('刚刚启动');
	let d = Math.floor(seconds / 86400);
	let h = Math.floor((seconds % 86400) / 3600);
	let m = Math.floor((seconds % 3600) / 60);
	let s = seconds % 60;
	if (d > 0) return _('%d 天 %d 小时').format(d, h);
	if (h > 0) return _('%d 小时 %d 分').format(h, m);
	if (m > 0) return _('%d 分 %d 秒').format(m, s);
	return _('%d 秒').format(s);
}

function renderSparklineSvg(series, strokeColor, fillColor) {
	const w = 100, h = 32;
	if (!Array.isArray(series) || series.length < 2) {
		return '<svg viewBox="0 0 100 32" style="width: 100%; height: 42px; display: block;" preserveAspectRatio="none">' +
			'<line x1="0" y1="28" x2="100" y2="28" stroke="' + (strokeColor || '#cbd5e1') + '" stroke-width="1.5" stroke-dasharray="2,2"/>' +
			'</svg>';
	}

	let max = Math.max.apply(null, series);
	if (max <= 0) max = 1;
	const len = series.length;
	let points = [];
	for (let i = 0; i < len; i++) {
		let x = (i / (len - 1)) * w;
		let y = h - ((series[i] / max) * (h - 6) + 3);
		points.push({ x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) });
	}

	let dPath = 'M ' + points[0].x + ',' + points[0].y;
	for (let i = 1; i < points.length; i++) {
		let prev = points[i - 1];
		let curr = points[i];
		let midX = (prev.x + curr.x) / 2;
		dPath += ' Q ' + Number(midX.toFixed(1)) + ',' + prev.y + ' ' + curr.x + ',' + curr.y;
	}

	let areaPath = dPath + ' L 100,' + h + ' L 0,' + h + ' Z';
	let gradId = 'grad-' + Math.random().toString(36).substring(2, 9);

	return '<svg viewBox="0 0 100 32" style="width: 100%; height: 42px; display: block;" preserveAspectRatio="none">' +
		'<defs>' +
		'<linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">' +
		'<stop offset="0%" stop-color="' + (fillColor || strokeColor || '#3b82f6') + '" stop-opacity="0.3"/>' +
		'<stop offset="100%" stop-color="' + (fillColor || strokeColor || '#3b82f6') + '" stop-opacity="0.0"/>' +
		'</linearGradient>' +
		'</defs>' +
		'<path d="' + areaPath + '" fill="url(#' + gradId + ')"/>' +
		'<path d="' + dPath + '" fill="none" stroke="' + (strokeColor || '#2563eb') + '" stroke-width="2" stroke-linecap="round"/>' +
		'</svg>';
}

function pollMetricsCycle() {
	if (!liveMetricsActive) return;
	if (!document.getElementById('omnia-overview-root')) {
		stopLiveMetrics();
		return;
	}
	if (document.hidden) {
		if (liveMetricsActive) {
			liveMetricsTimer = window.setTimeout(pollMetricsCycle, 5000);
		}
		return;
	}
	if (metricsInFlight) return;
	metricsInFlight = true;

	callDashboardMetrics().then(function(res) {
		metricsInFlight = false;
		if (!liveMetricsActive || !document.getElementById('omnia-overview-root')) {
			stopLiveMetrics();
			return;
		}
		let data = omniaUi.dataOf(res) || {};
		let clash = data.clash_api || {};
		let conns = clash.connections || {};

		let connCount = Number(conns.count || 0);
		let upTotal = Number(conns.upload_total || 0);
		let downTotal = Number(conns.download_total || 0);

		let now = Date.now();
		let up = 0;
		let down = 0;

		if (lastMetricsTimestamp > 0 && now > lastMetricsTimestamp) {
			let dt = (now - lastMetricsTimestamp) / 1000;
			if (dt > 0.5) {
				if (lastUploadTotal > 0 && upTotal >= lastUploadTotal) {
					up = Math.round((upTotal - lastUploadTotal) / dt);
				}
				if (lastDownloadTotal > 0 && downTotal >= lastDownloadTotal) {
					down = Math.round((downTotal - lastDownloadTotal) / dt);
				}
			}
		}

		lastMetricsTimestamp = now;
		if (upTotal > 0) lastUploadTotal = upTotal;
		if (downTotal > 0) lastDownloadTotal = downTotal;

		liveMetricsData.up = up;
		liveMetricsData.down = down;
		liveMetricsData.connCount = connCount;
		if (upTotal > 0) liveMetricsData.upTotal = upTotal;
		if (downTotal > 0) liveMetricsData.downTotal = downTotal;

		const status = omniaUi.dataOf(pageResults.apiStatus) || {};
		const official = status.singbox_api || {};
		if (clash.available === true)
			liveMetricsData.sourceApi = 'Clash API';
		else if (official.available === true)
			liveMetricsData.sourceApi = 'sing-box API';
		else
			liveMetricsData.sourceApi = 'Clash API (' + (clash.reason || _('不可用')) + ')';

		liveMetricsData.available = clash.available === true;

		liveUpSeries.push(up);
		if (liveUpSeries.length > MAX_SERIES_POINTS) liveUpSeries.shift();

		liveDownSeries.push(down);
		if (liveDownSeries.length > MAX_SERIES_POINTS) liveDownSeries.shift();

		liveConnSeries.push(connCount);
		if (liveConnSeries.length > MAX_SERIES_POINTS) liveConnSeries.shift();

		updateLiveMetricsDom();

		if (liveMetricsActive && document.getElementById('omnia-overview-root')) {
			liveMetricsTimer = window.setTimeout(pollMetricsCycle, 3000);
		}
	}).catch(function() {
		metricsInFlight = false;
		if (liveMetricsActive && document.getElementById('omnia-overview-root')) {
			liveMetricsTimer = window.setTimeout(pollMetricsCycle, 5000);
		}
	});
}

function updateLiveMetricsDom() {
	const upVal = document.getElementById('omnia-live-up-value');
	const upSvg = document.getElementById('omnia-live-up-svg');
	const upTot = document.getElementById('omnia-live-up-total');

	const downVal = document.getElementById('omnia-live-down-value');
	const downSvg = document.getElementById('omnia-live-down-svg');
	const downTot = document.getElementById('omnia-live-down-total');

	const connVal = document.getElementById('omnia-live-conn-value');
	const connSvg = document.getElementById('omnia-live-conn-svg');

	const srcTag = document.getElementById('omnia-live-source-tag');

	if (upVal) upVal.innerText = formatBytesPerSec(liveMetricsData.up);
	if (upSvg) upSvg.innerHTML = renderSparklineSvg(liveUpSeries, '#2563eb', '#3b82f6');
	if (upTot) upTot.innerText = _('累计: %s').format(formatTotalBytes(liveMetricsData.upTotal));

	if (downVal) downVal.innerText = formatBytesPerSec(liveMetricsData.down);
	if (downSvg) downSvg.innerHTML = renderSparklineSvg(liveDownSeries, '#059669', '#10b981');
	if (downTot) downTot.innerText = _('累计: %s').format(formatTotalBytes(liveMetricsData.downTotal));

	if (connVal) connVal.innerText = String(liveMetricsData.connCount);
	if (connSvg) connSvg.innerHTML = renderSparklineSvg(liveConnSeries, '#7c3aed', '#8b5cf6');

	if (srcTag) srcTag.innerText = _('数据源: %s').format(liveMetricsData.sourceApi);
}

function startLiveMetrics() {
	stopLiveMetrics();
	liveMetricsActive = true;
	metricsInFlight = false;
	lastMetricsTimestamp = 0;
	lastUploadTotal = 0;
	lastDownloadTotal = 0;
	/* Delay initial cycle by 300ms to ensure DOM node is attached to document */
	liveMetricsTimer = window.setTimeout(pollMetricsCycle, 300);
}

function stopLiveMetrics() {
	liveMetricsActive = false;
	metricsInFlight = false;
	if (liveMetricsTimer) {
		window.clearTimeout(liveMetricsTimer);
		window.clearInterval(liveMetricsTimer);
		liveMetricsTimer = null;
	}
}

function overviewHeaderBanner() {
	const state = stateOf();
	const running = !!state.sing_box_running;
	const pkgVer = pageResults.packageVersion ? ' ' + pageResults.packageVersion : '';
	const sbVer = pageResults.singboxVersion || '1.15.0-alpha.5';
	const uptimeSec = pageResults.uptimeSeconds || 0;
	const uptimeText = running ? formatUptimeDuration(uptimeSec) : _('未运行');

	const panel = omniaUi.dataOf(pageResults.panel);
	const panelUrl = routerHostUrl(panel.dashboard_url);
	const hasPanel = panelUrl && panelUrl !== '-';

	return E('div', {
		'style': 'display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: .75rem; padding-bottom: .85rem; margin-bottom: 1rem; border-bottom: 1px solid #e2e8f0;'
	}, [
		E('div', { 'style': 'display: flex; align-items: center; flex-wrap: wrap; gap: .75rem; font-size: 13px;' }, [
			E('span', { 'style': 'font-size: 19px; font-weight: 800; letter-spacing: -0.3px; color: #0f172a;' }, [
				'Omnia',
				E('span', { 'style': 'font-size: 12px; font-weight: 500; color: #64748b; margin-left: .35rem;' }, pkgVer)
			]),
			E('span', {
				'style': 'display: inline-flex; align-items: center; gap: .4rem; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; ' +
					(running ? 'background: #ecfdf5; color: #059669;' : 'background: #fef2f2; color: #dc2626;')
			}, [
				E('span', {
					'style': 'width: 7px; height: 7px; border-radius: 50%; ' +
						(running ? 'background: #10b981;' : 'background: #ef4444;')
				}),
				running ? _('运行中') : _('已停止')
			]),
			E('span', { 'style': 'color: #cbd5e1;' }, '|'),
			E('span', { 'style': 'color: #475569;' }, 'sing-box ' + sbVer),
			E('span', { 'style': 'color: #cbd5e1;' }, '|'),
			E('span', { 'style': 'color: #475569;' }, running ? _('已运行 %s').format(uptimeText) : _('已运行 -'))
		]),
		hasPanel ? E('a', {
			'href': panelUrl,
			'target': '_blank',
			'rel': 'noopener noreferrer',
			'style': 'display: inline-flex; align-items: center; gap: .35rem; color: #2563eb; font-size: 13px; font-weight: 600; text-decoration: none;'
		}, [
			_('打开 Zashboard'),
			externalLinkIcon()
		]) : E('div')
	]);
}

function maskIpAddress(ip) {
	if (!ip || typeof ip !== 'string') return '-';
	if (ip.indexOf(':') !== -1) {
		let parts = ip.split(':');
		if (parts.length <= 2) return ip;
		return parts.slice(0, 2).join(':') + ':****';
	}
	let parts = ip.split('.');
	if (parts.length === 4) {
		return parts[0] + '.' + parts[1] + '.***.***';
	}
	return ip;
}

function renderSparkbarsSvg(values) {
	if (!Array.isArray(values) || values.length === 0) return '';
	const w = 84, h = 18;
	const barWidth = 4;
	const gap = 3;
	const max = Math.max.apply(null, values.concat([100]));
	let rects = [];
	const startX = Math.max(0, w - values.length * (barWidth + gap));
	for (let i = 0; i < values.length; i++) {
		let v = values[i];
		let barH = Math.max(2, Math.round((v / max) * (h - 2)));
		let x = startX + i * (barWidth + gap);
		let y = h - barH;
		let color = v <= 100 ? '#10b981' : (v <= 250 ? '#f59e0b' : '#ef4444');
		rects.push('<rect x="' + x + '" y="' + y + '" width="' + barWidth + '" height="' + barH + '" rx="1" fill="' + color + '"/>');
	}
	return '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width: ' + w + 'px; height: ' + h + 'px; display: inline-block; vertical-align: middle;">' +
		rects.join('') +
		'</svg>';
}

function fetchConnectionStats() {
	connAggregatedData.loading = true;
	updateConnectionDetailsDom();
	return callConnectionsList().then(function(res) {
		connAggregatedData.loading = false;
		let data = omniaUi.dataOf(res) || {};
		let list = data.connections || [];
		connAggregatedData.total = list.length;

		/* 1. Track incremental traffic into persistent history */
		let activeIds = {};
		for (let i = 0; i < list.length; i++) {
			let item = list[i];
			if (item.id) {
				activeIds[item.id] = true;
				recordConnectionDelta(item);
			}
		}

		/* Save updated persistent stats */
		saveTrafficStats(loadTrafficStats());

		/* Clean up seen connections that no longer exist (closed) */
		for (let id in activeSeenConnections) {
			if (!activeIds[id]) {
				delete activeSeenConnections[id];
			}
		}

		/* 2. Build datasets based on connViewMode */
		let sourcesMap = {};
		let outboundsMap = {};
		let groupsMap = {};

		if (connViewMode === 'history') {
			/* Historical persistent cumulative traffic */
			let stats = loadTrafficStats();
			let srcHistory = stats.sources || {};
			let outHistory = stats.outbounds || {};
			let grpHistory = stats.groups || {};

			for (let k in srcHistory) {
				sourcesMap[k] = { count: 0, up: srcHistory[k].up || 0, down: srcHistory[k].down || 0 };
			}
			for (let k in outHistory) {
				outboundsMap[k] = { count: 0, up: outHistory[k].up || 0, down: outHistory[k].down || 0 };
			}
			for (let k in grpHistory) {
				groupsMap[k] = { count: 0, up: grpHistory[k].up || 0, down: grpHistory[k].down || 0 };
			}

			/* Overlay current active connection counts */
			for (let i = 0; i < list.length; i++) {
				let item = list[i];
				let src = (item.source || '').split(':')[0] || _('未知');
				let chains = Array.isArray(item.chains) ? item.chains : [];
				let outbound = chains.length > 0 ? chains[0] : (item.destination || _('直连'));
				let group = chains.length > 0 ? chains[chains.length - 1] : (item.rule || _('默认'));

				if (!sourcesMap[src]) sourcesMap[src] = { count: 0, up: 0, down: 0 };
				sourcesMap[src].count++;

				if (!outboundsMap[outbound]) outboundsMap[outbound] = { count: 0, up: 0, down: 0 };
				outboundsMap[outbound].count++;

				if (!groupsMap[group]) groupsMap[group] = { count: 0, up: 0, down: 0 };
				groupsMap[group].count++;
			}
		} else {
			/* Realtime Active Snapshot */
			for (let i = 0; i < list.length; i++) {
				let item = list[i];
				let src = (item.source || '').split(':')[0] || _('未知');
				let chains = Array.isArray(item.chains) ? item.chains : [];
				let outbound = chains.length > 0 ? chains[0] : (item.destination || _('直连'));
				let group = chains.length > 0 ? chains[chains.length - 1] : (item.rule || _('默认'));
				let up = Number(item.upload || 0);
				let down = Number(item.download || 0);

				if (!sourcesMap[src]) sourcesMap[src] = { count: 0, up: 0, down: 0 };
				sourcesMap[src].count++;
				sourcesMap[src].up += up;
				sourcesMap[src].down += down;

				if (!outboundsMap[outbound]) outboundsMap[outbound] = { count: 0, up: 0, down: 0 };
				outboundsMap[outbound].count++;
				outboundsMap[outbound].up += up;
				outboundsMap[outbound].down += down;

				if (!groupsMap[group]) groupsMap[group] = { count: 0, up: 0, down: 0 };
				groupsMap[group].count++;
				groupsMap[group].up += up;
				groupsMap[group].down += down;
			}
		}

		function toSortedArray(map) {
			let arr = [];
			for (let k in map) {
				let total = (map[k].up || 0) + (map[k].down || 0);
				arr.push({ name: k, count: map[k].count, up: map[k].up, down: map[k].down, total: total });
			}
			arr.sort(function(a, b) {
				if (b.total !== a.total) return b.total - a.total;
				return b.count - a.count;
			});
			return arr;
		}

		connAggregatedData.sources = toSortedArray(sourcesMap);
		connAggregatedData.outbounds = toSortedArray(outboundsMap);
		connAggregatedData.groups = toSortedArray(groupsMap);
		updateConnectionDetailsDom();
	}).catch(function() {
		connAggregatedData.loading = false;
		updateConnectionDetailsDom();
	});
}

function updateConnectionDetailsDom() {
	const container = document.getElementById('omnia-conn-details-container');
	if (!container) return;
	container.innerHTML = '';
	if (!connDetailsOpen) return;

	let stats = loadTrafficStats();
	let currentRetention = stats.retention || 'monthly';

	let tabSourceBtn = E('button', {
		'type': 'button',
		'style': 'padding: 3px 10px; font-size: 12px; font-weight: 600; border-radius: 6px; border: 1px solid ' + (connActiveTab === 'source' ? '#2563eb' : '#cbd5e1') + '; background: ' + (connActiveTab === 'source' ? '#2563eb' : '#fff') + '; color: ' + (connActiveTab === 'source' ? '#fff' : '#475569') + '; cursor: pointer;',
		'click': function(ev) {
			ev.preventDefault();
			connActiveTab = 'source';
			updateConnectionDetailsDom();
		}
	}, _('源 IP (%d)').format(connAggregatedData.sources.length));

	let tabOutboundBtn = E('button', {
		'type': 'button',
		'style': 'padding: 3px 10px; font-size: 12px; font-weight: 600; border-radius: 6px; border: 1px solid ' + (connActiveTab === 'outbound' ? '#2563eb' : '#cbd5e1') + '; background: ' + (connActiveTab === 'outbound' ? '#2563eb' : '#fff') + '; color: ' + (connActiveTab === 'outbound' ? '#fff' : '#475569') + '; cursor: pointer;',
		'click': function(ev) {
			ev.preventDefault();
			connActiveTab = 'outbound';
			updateConnectionDetailsDom();
		}
	}, _('出站节点 (%d)').format(connAggregatedData.outbounds.length));

	let tabGroupBtn = E('button', {
		'type': 'button',
		'style': 'padding: 3px 10px; font-size: 12px; font-weight: 600; border-radius: 6px; border: 1px solid ' + (connActiveTab === 'group' ? '#2563eb' : '#cbd5e1') + '; background: ' + (connActiveTab === 'group' ? '#2563eb' : '#fff') + '; color: ' + (connActiveTab === 'group' ? '#fff' : '#475569') + '; cursor: pointer;',
		'click': function(ev) {
			ev.preventDefault();
			connActiveTab = 'group';
			updateConnectionDetailsDom();
		}
	}, _('策略组 (%d)').format(connAggregatedData.groups.length));

	let viewModeSelect = E('select', {
		'style': 'padding: 2px 6px; font-size: 11px; font-weight: 600; border-radius: 4px; border: 1px solid #cbd5e1; background: #eff6ff; color: #1e40af; cursor: pointer;',
		'change': function(ev) {
			connViewMode = ev.target.value;
			fetchConnectionStats();
		}
	}, [
		E('option', { 'value': 'history', 'selected': connViewMode === 'history' ? '' : null }, _('📊 累计统计流量')),
		E('option', { 'value': 'active', 'selected': connViewMode === 'active' ? '' : null }, _('⚡ 实时活跃连接流'))
	]);

	let retentionSelect = E('select', {
		'style': 'padding: 2px 6px; font-size: 11px; border-radius: 4px; border: 1px solid #cbd5e1; background: #fff; color: #475569; cursor: pointer;',
		'title': _('统计数据自动清理间隔'),
		'change': function(ev) {
			let s = loadTrafficStats();
			s.retention = ev.target.value;
			saveTrafficStats(s);
			updateConnectionDetailsDom();
		}
	}, [
		E('option', { 'value': 'weekly', 'selected': currentRetention === 'weekly' ? '' : null }, _('清理: 每周')),
		E('option', { 'value': 'monthly', 'selected': currentRetention === 'monthly' ? '' : null }, _('清理: 每月')),
		E('option', { 'value': 'quarterly', 'selected': currentRetention === 'quarterly' ? '' : null }, _('清理: 每季度')),
		E('option', { 'value': 'never', 'selected': currentRetention === 'never' ? '' : null }, _('清理: 永不'))
	]);

	let resetBtn = E('button', {
		'type': 'button',
		'style': 'padding: 2px 6px; font-size: 11px; border-radius: 4px; border: 1px solid #fecaca; background: #fef2f2; color: #dc2626; cursor: pointer;',
		'title': _('清空所有历史累计流量统计'),
		'click': function(ev) {
			ev.preventDefault();
			if (confirm(_('确定清空当前累计的历史流量数据吗？'))) {
				resetTrafficStats();
			}
		}
	}, _('🗑️ 清空统计'));

	let refreshBtn = E('button', {
		'type': 'button',
		'style': 'padding: 3px 10px; font-size: 12px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; color: #475569; cursor: pointer;',
		'click': function(ev) {
			ev.preventDefault();
			fetchConnectionStats();
		}
	}, connAggregatedData.loading ? _('刷新中...') : _('刷新'));

	let headerRow = E('div', {
		'style': 'display: flex; justify-content: space-between; align-items: center; margin-bottom: .6rem; flex-wrap: wrap; gap: .5rem;'
	}, [
		E('div', { 'style': 'display: flex; gap: .4rem; align-items: center;' }, [
			tabSourceBtn,
			tabOutboundBtn,
			tabGroupBtn
		]),
		E('div', { 'style': 'display: flex; gap: .45rem; align-items: center; flex-wrap: wrap;' }, [
			viewModeSelect,
			connViewMode === 'history' ? retentionSelect : E('span'),
			connViewMode === 'history' ? resetBtn : E('span'),
			E('span', { 'style': 'font-size: 12px; color: #64748b; margin-left: .2rem;' }, _('活跃: %d').format(connAggregatedData.total)),
			refreshBtn
		])
	]);

	let currentList = [];
	if (connActiveTab === 'source') currentList = connAggregatedData.sources;
	else if (connActiveTab === 'outbound') currentList = connAggregatedData.outbounds;
	else if (connActiveTab === 'group') currentList = connAggregatedData.groups;

	let bodyNode;
	if (connAggregatedData.loading && currentList.length === 0) {
		bodyNode = E('div', { 'style': 'padding: 1.5rem; text-align: center; color: #94a3b8; font-size: 13px;' }, _('正在加载连接数据...'));
	} else if (currentList.length === 0) {
		bodyNode = E('div', { 'style': 'padding: 1.5rem; text-align: center; color: #94a3b8; font-size: 13px;' }, _('暂无连接或累计统计数据'));
	} else {
		let rows = [
			E('tr', { 'style': 'border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #64748b; background: #f8fafc;' }, [
				E('th', { 'style': 'padding: .45rem .6rem; text-align: left;' }, _('名称 / 标识')),
				E('th', { 'style': 'padding: .45rem .6rem; text-align: right;' }, _('活跃连接')),
				E('th', { 'style': 'padding: .45rem .6rem; text-align: right;' }, _('上传流量')),
				E('th', { 'style': 'padding: .45rem .6rem; text-align: right;' }, _('下载流量')),
				E('th', { 'style': 'padding: .45rem .6rem; text-align: right;' }, _('总流量'))
			])
		];
		for (let i = 0; i < currentList.length; i++) {
			let row = currentList[i];
			rows.push(E('tr', { 'style': 'border-bottom: 1px solid #f1f5f9; font-size: 12px; color: #1e293b;' }, [
				E('td', { 'style': 'padding: .45rem .6rem; font-weight: 500;' }, row.name),
				E('td', { 'style': 'padding: .45rem .6rem; text-align: right;' }, String(row.count)),
				E('td', { 'style': 'padding: .45rem .6rem; text-align: right; color: #64748b;' }, formatTotalBytes(row.up)),
				E('td', { 'style': 'padding: .45rem .6rem; text-align: right; color: #64748b;' }, formatTotalBytes(row.down)),
				E('td', { 'style': 'padding: .45rem .6rem; text-align: right; font-weight: 600; color: #2563eb;' }, formatTotalBytes(row.total))
			]));
		}
		bodyNode = E('table', { 'style': 'width: 100%; border-collapse: collapse;' }, rows);
	}

	let box = E('div', {
		'style': 'background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: .85rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);'
	}, [
		headerRow,
		bodyNode
	]);

	container.appendChild(box);
}

function probeLatencyTarget(url) {
	return new Promise(function(resolve) {
		const start = Date.now();
		const img = new Image();
		let settled = false;
		function done(success) {
			if (settled) return;
			settled = true;
			const delta = Date.now() - start;
			img.onload = img.onerror = null;
			resolve(delta);
		}
		img.onload = function() { done(true); };
		img.onerror = function() { done(true); };
		setTimeout(function() {
			if (!settled) {
				settled = true;
				img.onload = img.onerror = null;
				resolve(null);
			}
		}, 3000);
		img.src = url + '?_t=' + Date.now();
	});
}

function runLatencyTests() {
	if (latencyTesting) return;
	latencyTesting = true;
	const btn = document.getElementById('omnia-latency-test-btn');
	if (btn) btn.innerText = _('测试中...');

	const targets = [
		{ key: 'Baidu', url: 'https://www.baidu.com/favicon.ico' },
		{ key: 'Cloudflare', url: 'https://www.cloudflare.com/favicon.ico' },
		{ key: 'GitHub', url: 'https://github.githubassets.com/favicons/favicon.png' },
		{ key: 'YouTube', url: 'https://www.youtube.com/s/desktop/favicon.ico' }
	];

	let promises = targets.map(function(t) {
		return probeLatencyTarget(t.url).then(function(delta) {
			if (delta !== null && delta > 0) {
				if (!latencyHistory[t.key]) latencyHistory[t.key] = [];
				latencyHistory[t.key].push(delta);
				if (latencyHistory[t.key].length > 10) latencyHistory[t.key].shift();
			}
		});
	});

	Promise.all(promises).then(function() {
		latencyTesting = false;
		const d = new Date();
		const pad = function(n) { return n < 10 ? '0' + n : String(n); };
		latencyLastTime = pad(d.getHours()) + ':' + pad(d.getMinutes());
		updateLatencyDom();
	}).catch(function() {
		latencyTesting = false;
		updateLatencyDom();
	});
}

function updateLatencyDom() {
	const grid = document.getElementById('omnia-latency-grid');
	const footer = document.getElementById('omnia-latency-footer');
	const btn = document.getElementById('omnia-latency-test-btn');
	if (btn) btn.innerText = latencyTesting ? _('测试中...') : _('立即测试');
	if (footer) footer.innerText = latencyLastTime ? _('上次测试: %s').format(latencyLastTime) : _('尚未测试');
	if (!grid) return;
	grid.innerHTML = '';

	const sites = [
		{ key: 'Baidu', name: 'Baidu' },
		{ key: 'Cloudflare', name: 'Cloudflare' },
		{ key: 'GitHub', name: 'GitHub' },
		{ key: 'YouTube', name: 'YouTube' }
	];

	for (let i = 0; i < sites.length; i++) {
		const s = sites[i];
		const history = latencyHistory[s.key] || [];
		const lastVal = history.length > 0 ? history[history.length - 1] : null;
		let valText = lastVal !== null ? lastVal + ' ms' : '-';
		let valColor = lastVal !== null ? (lastVal <= 100 ? '#10b981' : (lastVal <= 250 ? '#f59e0b' : '#ef4444')) : '#94a3b8';

		const item = E('div', {
			'style': 'padding: .4rem .5rem; background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 6px;'
		}, [
			E('div', { 'style': 'font-size: 12px; font-weight: 500; color: #64748b; margin-bottom: .2rem;' }, s.name),
			E('div', { 'style': 'display: flex; justify-content: space-between; align-items: center;' }, [
				E('span', { 'style': 'font-size: 16px; font-weight: 700; color: ' + valColor + ';' }, valText),
				E('span', {
					'style': 'display: inline-block;',
					'innerHTML': renderSparkbarsSvg(history)
				})
			])
		]);
		grid.appendChild(item);
	}
}

function fetchNetworkInfoSingle(siteKey) {
	let target = netSiteDatabase[siteKey];
	if (!target) return Promise.resolve();
	target.loading = true;
	updateNetworkInfoDom();

	let ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
	let timer = ctrl ? setTimeout(function() { ctrl.abort(); }, 3500) : null;

	return fetch(target.url, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
		.then(function(res) {
			if (timer) clearTimeout(timer);
			return res.json();
		})
		.then(function(data) {
			target.loading = false;
			if (siteKey === 'ipip.net' && data && data.data && data.data.ip) {
				target.ip = data.data.ip;
				let loc = [data.data.country_name || '', data.data.region_name || '', data.data.city_name || ''].filter(Boolean).join(' ');
				target.region = loc;
				target.isp = data.data.isp || '';
			} else if (siteKey === 'ip.sb' && data && data.ip) {
				target.ip = data.ip;
				let loc = [data.country || '', data.city || ''].filter(Boolean).join(' ');
				target.region = loc;
				target.isp = [data.asn ? 'AS' + data.asn : '', data.isp || data.organization || ''].filter(Boolean).join(' ');
			} else if (siteKey === 'ipwho.is' && data && data.ip) {
				target.ip = data.ip;
				let loc = [data.country || '', data.region || '', data.city || ''].filter(Boolean).join(' ');
				target.region = loc;
				let conn = data.connection || {};
				target.isp = [conn.asn ? 'AS' + conn.asn : '', conn.isp || conn.org || ''].filter(Boolean).join(' ');
			} else if (siteKey === 'ipapi.is' && data && data.ip) {
				target.ip = data.ip;
				let loc = data.location ? [data.location.country || '', data.location.city || ''].filter(Boolean).join(' ') : '';
				target.region = loc;
				let company = data.company ? data.company.name : '';
				let asn = data.asn ? 'AS' + data.asn.asn + ' ' + (data.asn.org || '') : '';
				target.isp = company || asn || '';
			}
			const d = new Date();
			const pad = function(n) { return n < 10 ? '0' + n : String(n); };
			networkUpdatedAt = pad(d.getHours()) + ':' + pad(d.getMinutes());
			updateNetworkInfoDom();
		})
		.catch(function() {
			if (timer) clearTimeout(timer);
			target.loading = false;
			updateNetworkInfoDom();
		});
}

function refreshNetworkInfo() {
	return Promise.all([
		fetchNetworkInfoSingle(netChannels.channel1),
		fetchNetworkInfoSingle(netChannels.channel2)
	]);
}

function updateNetworkInfoDom() {
	const rows = document.getElementById('omnia-network-rows');
	const footer = document.getElementById('omnia-network-footer');
	const refreshIcon = document.getElementById('omnia-network-refresh-icon');
	const eyeIcon = document.getElementById('omnia-network-eye-icon');

	if (eyeIcon) eyeIcon.innerText = netGlobalMasked ? '👁️' : '👁️‍🗨️';
	let anyLoading = (netSiteDatabase[netChannels.channel1] && netSiteDatabase[netChannels.channel1].loading) ||
	                 (netSiteDatabase[netChannels.channel2] && netSiteDatabase[netChannels.channel2].loading);
	if (refreshIcon) refreshIcon.style.opacity = anyLoading ? '0.5' : '1';
	if (footer) footer.innerText = networkUpdatedAt ? _('更新于: %s').format(networkUpdatedAt) : _('更新于: 刚刚');
	if (!rows) return;
	rows.innerHTML = '';

	const siteOptions = ['ipip.net', 'ip.sb', 'ipwho.is', 'ipapi.is'];

	function renderChannelRow(channelKey) {
		let currentSiteKey = netChannels[channelKey];
		let siteData = netSiteDatabase[currentSiteKey] || {};
		let displayIp = netGlobalMasked ? maskIpAddress(siteData.ip) : siteData.ip;

		let selectNode = E('select', {
			'style': 'appearance: none; -webkit-appearance: none; padding: 2px 18px 2px 8px; font-size: 12px; font-weight: 600; color: #1e293b; background: #f1f5f9 url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'10\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23475569\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 5px center; border: 1px solid #cbd5e1; border-radius: 999px; cursor: pointer; line-height: 1.4;',
			'change': function(ev) {
				netChannels[channelKey] = ev.target.value;
				fetchNetworkInfoSingle(ev.target.value);
			}
		}, siteOptions.map(function(opt) {
			return E('option', { 'value': opt, 'selected': opt === currentSiteKey ? '' : null }, opt);
		}));

		let infoDetails = [];
		if (siteData.loading) {
			infoDetails.push(E('span', { 'style': 'font-size: 13px; color: #94a3b8;' }, _('正在探测 IP 信息...')));
		} else {
			let locDesc = [siteData.region, siteData.isp].filter(Boolean).join(' ');
			if (locDesc) {
				infoDetails.push(E('span', { 'style': 'font-size: 13px; font-weight: 600; color: #1e293b; margin-right: .45rem;' }, locDesc));
			}
			if (siteData.ip) {
				infoDetails.push(E('span', { 'style': 'font-family: monospace; font-size: 13px; color: #475569;' }, '(' + displayIp + ')'));
			}
		}

		return E('div', {
			'style': 'display: flex; flex-direction: column; gap: .35rem; padding: .35rem 0;'
		}, [
			E('div', { 'style': 'display: flex; align-items: center;' }, [selectNode]),
			E('div', { 'style': 'display: flex; align-items: center; flex-wrap: wrap; margin-left: .2rem;' }, infoDetails)
		]);
	}

	let divider = E('div', { 'style': 'height: 1px; background: #f1f5f9; margin: .2rem 0;' });

	rows.appendChild(renderChannelRow('channel1'));
	rows.appendChild(divider);
	rows.appendChild(renderChannelRow('channel2'));
}

function setupLatencyInterval(intervalStr) {
	latencyInterval = intervalStr;
	if (latencyTimer) {
		window.clearInterval(latencyTimer);
		latencyTimer = null;
	}
	let ms = 0;
	if (intervalStr === '1m') ms = 60000;
	else if (intervalStr === '5m') ms = 300000;
	else if (intervalStr === '15m') ms = 900000;

	if (ms > 0) {
		latencyTimer = window.setInterval(function() {
			if (!document.getElementById('omnia-overview-root')) {
				window.clearInterval(latencyTimer);
				latencyTimer = null;
				return;
			}
			if (!document.hidden) runLatencyTests();
		}, ms);
	}
}

function realtimeStatusSection() {
	return E('div', { 'style': 'margin-bottom: 1.25rem;' }, [
		E('div', { 'style': 'display: flex; justify-content: space-between; align-items: center; margin-bottom: .6rem;' }, [
			E('span', { 'style': 'font-weight: 700; font-size: 15px; color: #0f172a;' }, _('实时状态')),
			E('span', {
				'id': 'omnia-live-source-tag',
				'style': 'font-size: 12px; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-weight: 500;'
			}, _('数据源: %s').format(liveMetricsData.sourceApi))
		]),
		E('div', { 'style': 'display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: .85rem;' }, [
			// Upload Card
			E('div', {
				'class': omniaMotion.cardClass(),
				'style': 'background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: .85rem .95rem; box-shadow: 0 1px 2px rgba(0,0,0,0.03);'
			}, [
				E('div', { 'style': 'font-size: 12px; color: #64748b; margin-bottom: .25rem;' }, _('上传')),
				E('div', {
					'id': 'omnia-live-up-value',
					'style': 'font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: .45rem;'
				}, formatBytesPerSec(liveMetricsData.up)),
				E('div', { 'id': 'omnia-live-up-svg' }),
				E('div', {
					'id': 'omnia-live-up-total',
					'style': 'font-size: 11px; color: #94a3b8; margin-top: .4rem;'
				}, _('累计: %s').format(formatTotalBytes(liveMetricsData.upTotal)))
			]),
			// Download Card
			E('div', {
				'class': omniaMotion.cardClass(),
				'style': 'background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: .85rem .95rem; box-shadow: 0 1px 2px rgba(0,0,0,0.03);'
			}, [
				E('div', { 'style': 'font-size: 12px; color: #64748b; margin-bottom: .25rem;' }, _('下载')),
				E('div', {
					'id': 'omnia-live-down-value',
					'style': 'font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: .45rem;'
				}, formatBytesPerSec(liveMetricsData.down)),
				E('div', { 'id': 'omnia-live-down-svg' }),
				E('div', {
					'id': 'omnia-live-down-total',
					'style': 'font-size: 11px; color: #94a3b8; margin-top: .4rem;'
				}, _('累计: %s').format(formatTotalBytes(liveMetricsData.downTotal)))
			]),
			// Connections Card
			E('div', {
				'class': omniaMotion.cardClass(null, true),
				'style': 'background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: .85rem .95rem; box-shadow: 0 1px 2px rgba(0,0,0,0.03); cursor: pointer; user-select: none;',
				'title': _('点击展开/收起连接统计下钻详情'),
				'click': function() {
					connDetailsOpen = !connDetailsOpen;
					if (connDetailsOpen) fetchConnectionStats();
					updateConnectionDetailsDom();
					const arrow = document.getElementById('omnia-conn-expand-arrow');
					if (arrow) arrow.innerText = connDetailsOpen ? '▴' : '▾';
				}
			}, [
				E('div', { 'style': 'display: flex; justify-content: space-between; align-items: center; margin-bottom: .25rem;' }, [
					E('div', { 'style': 'font-size: 12px; color: #64748b;' }, _('活跃连接')),
					E('span', { 'id': 'omnia-conn-expand-arrow', 'style': 'font-size: 12px; color: #2563eb; font-weight: 700;' }, connDetailsOpen ? '▴' : '▾')
				]),
				E('div', {
					'id': 'omnia-live-conn-value',
					'style': 'font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: .45rem;'
				}, String(liveMetricsData.connCount)),
				E('div', { 'id': 'omnia-live-conn-svg' }),
				E('div', {
					'id': 'omnia-live-conn-sub',
					'style': 'font-size: 11px; color: #94a3b8; margin-top: .4rem;'
				}, _('代理接管连接流（点击展开详情）'))
			])
		]),
		E('div', { 'id': 'omnia-conn-details-container', 'style': 'margin-top: .75rem;' })
	]);
}

function latencyAndNetworkSection() {
	return E('div', {
		'style': 'display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: .85rem; margin-bottom: 1.25rem;'
	}, [
		// Latency Card
		E('div', {
			'class': omniaMotion.cardClass(),
			'style': 'background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: .85rem .95rem; box-shadow: 0 1px 2px rgba(0,0,0,0.03);'
		}, [
			E('div', {
				'style': 'display: flex; justify-content: space-between; align-items: center; margin-bottom: .75rem;'
			}, [
				E('span', { 'style': 'font-weight: 700; font-size: 14px; color: #0f172a;' }, _('延迟测试')),
				E('div', { 'style': 'display: flex; gap: .4rem; align-items: center;' }, [
					E('select', {
						'id': 'omnia-latency-interval-select',
						'style': 'padding: 2px 6px; font-size: 11px; border-radius: 4px; border: 1px solid #cbd5e1; background: #fff;',
						'change': function(ev) {
							setupLatencyInterval(ev.target.value);
						}
					}, [
						E('option', { 'value': '0', 'selected': latencyInterval === '0' ? '' : null }, _('手动')),
						E('option', { 'value': '1m', 'selected': latencyInterval === '1m' ? '' : null }, _('自动 · 1 分钟')),
						E('option', { 'value': '5m', 'selected': latencyInterval === '5m' ? '' : null }, _('自动 · 5 分钟')),
						E('option', { 'value': '15m', 'selected': latencyInterval === '15m' ? '' : null }, _('自动 · 15 分钟'))
					]),
					E('button', {
						'id': 'omnia-latency-test-btn',
						'type': 'button',
						'style': 'padding: 2px 8px; font-size: 12px; font-weight: 600; color: #2563eb; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px; cursor: pointer;',
						'click': function(ev) {
							ev.preventDefault();
							runLatencyTests();
						}
					}, latencyTesting ? _('测试中...') : _('立即测试'))
				])
			]),
			E('div', {
				'id': 'omnia-latency-grid',
				'style': 'display: grid; grid-template-columns: 1fr 1fr; gap: .75rem;'
			}),
			E('div', {
				'id': 'omnia-latency-footer',
				'style': 'font-size: 11px; color: #94a3b8; margin-top: .65rem;'
			}, latencyLastTime ? _('上次测试: %s').format(latencyLastTime) : _('尚未测试'))
		]),

		// Network Info Card
		E('div', {
			'class': omniaMotion.cardClass(),
			'style': 'background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: .85rem .95rem; box-shadow: 0 1px 2px rgba(0,0,0,0.03);'
		}, [
			E('div', {
				'style': 'display: flex; justify-content: space-between; align-items: center; margin-bottom: .6rem;'
			}, [
				E('span', { 'style': 'font-weight: 700; font-size: 14px; color: #0f172a;' }, _('网络信息')),
				E('div', { 'style': 'display: flex; gap: .5rem; align-items: center;' }, [
					E('span', {
						'id': 'omnia-network-eye-icon',
						'style': 'cursor: pointer; font-size: 14px; user-select: none;',
						'title': _('切换 IP 遮挡/完整显示'),
						'click': function(ev) {
							ev.preventDefault();
							netGlobalMasked = !netGlobalMasked;
							updateNetworkInfoDom();
						}
					}, netGlobalMasked ? '👁️' : '👁️‍🗨️'),
					E('span', {
						'id': 'omnia-network-refresh-icon',
						'style': 'cursor: pointer; font-size: 14px; user-select: none;',
						'title': _('重新测试网络出口'),
						'click': function(ev) {
							ev.preventDefault();
							refreshNetworkInfo();
						}
					}, '⚡')
				])
			]),
			E('div', {
				'id': 'omnia-network-rows',
				'style': 'display: flex; flex-direction: column; gap: .35rem;'
			}),
			E('div', {
				'id': 'omnia-network-footer',
				'style': 'font-size: 11px; color: #94a3b8; margin-top: .65rem;'
			}, networkUpdatedAt ? _('更新于: %s').format(networkUpdatedAt) : _('更新于: 刚刚'))
		])
	]);
}

let stepToolsOpen = false;

function toggleStepTools() {
	stepToolsOpen = !stepToolsOpen;
	const btn = document.getElementById('omnia-step-tools-btn');
	const menu = document.getElementById('omnia-step-tools-menu');
	if (btn) btn.innerText = stepToolsOpen ? _('单步工具 ▴') : _('单步工具 ▾');
	if (menu) menu.style.display = stepToolsOpen ? 'flex' : 'none';
}

function resourceStatusSection() {
	const profile = omniaUi.dataOf(pageResults.profile);
	const subscriptions = safeJson(omniaUi.dataOf(pageResults.subscriptions).content || '{}');
	const snapshot = omniaUi.dataOf(pageResults.snapshot);
	const rules = omniaUi.dataOf(pageResults.rules).summary || {};
	const profileSource = omniaUi.dataOf(pageResults.profileSource).source || {};
	const rulesTask = omniaUi.dataOf(pageResults.rulesetTask).task || {};
	const autoTaskData = omniaUi.dataOf(pageResults.autoTask);
	const autoTask = autoTaskData.state || {};
	const schedulerTasks = autoTask.tasks || {};
	const rulesSchedulerTask = schedulerTasks['ruleset.sync'] || {};

	const profileOk = pageResults.profile && pageResults.profile.ok && profile.valid !== false;
	const profileSyncTime = profileSource.updated_at ? omniaTime.formatMaybeTime(profileSource.updated_at) : '';
	let profileText = profileSource.url ? (profileSyncTime ? _('远程源已同步 · %s').format(profileSyncTime) : _('远程源已配置 · 暂无同步记录')) : _('本地配置已就绪');
	if (!profileOk) profileText = _('模板加载异常');

	const nodeCount = Number(snapshot.node_count || 0);
	const snapshotTime = snapshot.updated_at ? omniaTime.formatMaybeTime(snapshot.updated_at) : '';
	let subText = snapshotTime ? _('最近刷新 %s').format(snapshotTime) : _('暂无刷新记录');
	if (nodeCount === 0 && Array.isArray(subscriptions.sources) && subscriptions.sources.length > 0) {
		subText = _('刷新失败或无有效节点');
	}

	const missingRules = Number(rules.missing_count || 0);
	const requiredRules = Number(rules.required_count || 0);
	const readyRules = Number(rules.ready_count || 0);
	const rulesTimeRaw = rulesTask.finished_at || rulesTask.started_at || rulesSchedulerTask.last_run_at || '';
	const rulesTime = rulesTimeRaw ? omniaTime.formatMaybeTime(rulesTimeRaw) : '';
	let rulesText = rulesTime ? _('最近同步 %s').format(rulesTime) : _('本地规则就绪');
	if (missingRules > 0) {
		rulesText = _('缺失 %d 个规则集').format(missingRules);
	}

	return E('div', { 'style': 'margin-bottom: 1.25rem;' }, [
		E('div', { 'style': 'display: flex; justify-content: space-between; align-items: center; margin-bottom: .6rem;' }, [
			E('span', { 'style': 'font-weight: 700; font-size: 15px; color: #0f172a;' }, _('配置资源')),
			E('a', {
				'href': resourceHref('subscriptions'),
				'style': 'display: inline-flex; align-items: center; gap: .25rem; font-size: 13px; color: #2563eb; text-decoration: none; font-weight: 600; cursor: pointer;',
				'click': function(ev) {
					ev.preventDefault();
					window.location.href = resourceHref('subscriptions');
				}
			}, [
				_('资源管理'),
				externalLinkIcon()
			])
		]),
		E('div', {
			'class': omniaMotion.cardClass(),
			'style': 'background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: .65rem .85rem; box-shadow: 0 1px 2px rgba(0,0,0,0.03); display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: .75rem;'
		}, [
			// Col 1: 模板
			E('div', {
				'class': omniaMotion.cardClass(null, true),
				'style': 'cursor: pointer; border-right: 1px solid #f1f5f9; padding: .45rem .65rem; border-radius: 8px;',
				'title': _('点击跳转至模板配置'),
				'click': function(ev) {
					ev.preventDefault();
					window.location.href = resourceHref('profile');
				}
			}, [
				E('div', { 'style': 'display: flex; align-items: center; gap: .5rem; margin-bottom: .25rem;' }, [
					E('span', { 'style': 'font-size: 13px; color: #64748b; font-weight: 500;' }, _('模板')),
					E('span', { 'style': 'font-size: 13px; font-weight: 700; color: ' + (profileOk ? '#059669;' : '#dc2626;') }, profileOk ? _('就绪') : _('异常'))
				]),
				E('div', { 'style': 'font-size: 11px; color: #94a3b8; word-break: break-all;' }, profileText)
			]),
			// Col 2: 订阅
			E('div', {
				'class': omniaMotion.cardClass(null, true),
				'style': 'cursor: pointer; border-right: 1px solid #f1f5f9; padding: .45rem .65rem; border-radius: 8px;',
				'title': _('点击跳转至订阅管理'),
				'click': function(ev) {
					ev.preventDefault();
					window.location.href = resourceHref('subscriptions');
				}
			}, [
				E('div', { 'style': 'display: flex; align-items: center; gap: .5rem; margin-bottom: .25rem;' }, [
					E('span', { 'style': 'font-size: 13px; color: #64748b; font-weight: 500;' }, _('订阅')),
					E('span', { 'style': 'font-size: 13px; font-weight: 700; color: ' + (nodeCount > 0 ? '#0f172a;' : '#dc2626;') }, nodeCount > 0 ? _('%d 个节点').format(nodeCount) : _('0 节点'))
				]),
				E('div', { 'style': 'font-size: 11px; color: #94a3b8;' }, subText)
			]),
			// Col 3: 规则集
			E('div', {
				'class': omniaMotion.cardClass(null, true),
				'style': 'cursor: pointer; padding: .45rem .65rem; border-radius: 8px;',
				'title': _('点击跳转至规则集管理'),
				'click': function(ev) {
					ev.preventDefault();
					window.location.href = resourceHref('rules');
				}
			}, [
				E('div', { 'style': 'display: flex; align-items: center; gap: .5rem; margin-bottom: .25rem;' }, [
					E('span', { 'style': 'font-size: 13px; color: #64748b; font-weight: 500;' }, _('规则集')),
					E('span', { 'style': 'font-size: 13px; font-weight: 700; color: ' + (missingRules === 0 ? '#059669;' : '#dc2626;') }, requiredRules > 0 ? (missingRules === 0 ? _('%d / %d 就绪').format(readyRules, requiredRules) : _('缺失 %d').format(missingRules)) : _('就绪'))
				]),
				E('div', { 'style': 'font-size: 11px; color: #94a3b8;' }, rulesText)
			])
		])
	]);
}

function operationButtons() {
	return E('div', { 'style': 'margin-bottom: 1.25rem;' }, [
		E('div', {
			'style': 'display: flex; justify-content: space-between; align-items: center; margin-bottom: .6rem; flex-wrap: wrap; gap: .75rem;'
		}, [
			E('span', { 'style': 'font-weight: 700; font-size: 15px; color: #0f172a;' }, _('运行控制')),
			E('div', { 'style': 'display: flex; gap: .6rem; align-items: center;' }, [
				E('button', {
					'id': 'omnia-step-tools-btn',
					'type': 'button',
					'class': 'btn cbi-button cbi-button-neutral',
					'style': 'font-size: 13px; font-weight: 600; padding: .45rem .85rem; border-radius: 6px; border: 1px solid #cbd5e1; background: #fff; color: #334155; cursor: pointer;',
					'click': function(ev) {
						ev.preventDefault();
						toggleStepTools();
					}
				}, stepToolsOpen ? _('单步工具 ▴') : _('单步工具 ▾')),
				E('button', {
					'id': 'omnia-one-click-apply-btn',
					'class': omniaMotion.buttonClass('btn cbi-button cbi-button-apply'),
					'style': 'font-size: 14px; font-weight: 700; padding: .45rem 1.2rem; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.12); cursor: pointer;',
					'click': function(ev) {
						ev.preventDefault();
						return runOneClickApply();
					}
				}, _('⚡ 一键生成并应用'))
			])
		]),
		E('div', {
			'id': 'omnia-step-tools-menu',
			'style': 'display: ' + (stepToolsOpen ? 'flex' : 'none') + '; flex-wrap: wrap; gap: .5rem; margin-bottom: .85rem; padding: .75rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;'
		}, [
			operationButton(_('📄 生成配置'), _('生成候选配置'), callGenerate),
			operationButton(_('🔍 语法检查'), _('检查候选配置'), callCheck),
			operationButton(_('🚀 应用配置'), _('应用运行配置'), callApply, 'cbi-button-action', _('现在将候选配置应用到运行时吗？')),
			operationButton(_('🔄 重启服务'), _('重启运行时'), callRestart, 'cbi-button-neutral', _('现在重启 Omnia 运行时吗？短时间内流量可能会中断。')),
			operationButton(_('⏹ 停止服务'), _('停止运行时'), callStop, 'cbi-button-reset', _('现在停止 Omnia 运行时吗？流量将不再由 sing-box 接管。')),
			operationButton(_('⏪ 回滚配置'), _('回滚运行配置'), callRollback, 'cbi-button-reset', _('现在回滚运行配置吗？'))
		]),
		omniaUi.statusBox('omnia-overview-action-status', actionStatus, actionStatusOk ? 'ok' : 'error', {
			padding: '.75rem',
			margin: '0 0 .85rem'
		})
	]);
}

function renderPage() {
	const loadError = pageLoadError();
	omniaMotion.inject();
	ensureSupplementalLoad();
	startLiveMetrics();
	setupLatencyInterval(latencyInterval);
	window.setTimeout(function() {
		updateLatencyDom();
		updateNetworkInfoDom();
	}, 10);

	return E('div', { 'id': 'omnia-overview-root', 'class': 'cbi-map', 'style': 'max-width: 1200px; margin: auto;' }, [
		overviewHeaderBanner(),
		loadError ? E('div', { 'style': 'border: 1px solid #fecaca; border-radius: 8px; padding: .65rem; margin: 0 0 .75rem; background: #fef2f2; color: #991b1b;' }, loadError) : '',
		realtimeStatusSection(),
		latencyAndNetworkSection(),
		resourceStatusSection(),
		operationButtons()
	]);
}

function redraw() {
	const root = document.getElementById('omnia-overview-root');
	if (root)
		root.parentNode.replaceChild(renderPage(), root);
}

return view.extend({
	load: function() {
		return loadAll();
	},

	render: function(results) {
		supplementalLoadSeq++;
		supplementalLoading = false;
		pageResults = results || {};
		return renderPage();
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
