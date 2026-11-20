'use strict';
'require view';
'require rpc';
'require omnia.ui as omniaUi';
'require omnia.motion as omniaMotion';

const callProfileGet = rpc.declare({
	object: 'omnia',
	method: 'profile_get',
	expect: { '': {} }
});

const callProfileSave = rpc.declare({
	object: 'omnia',
	method: 'profile_save',
	params: [ 'content' ],
	expect: { '': {} }
});

const callProfileValidate = rpc.declare({
	object: 'omnia',
	method: 'profile_validate',
	params: [ 'content' ],
	expect: { '': {} }
});

const callProfileSourceGet = rpc.declare({
	object: 'omnia',
	method: 'profile_source_get',
	expect: { '': {} }
});

const callProfileSourceSave = rpc.declare({
	object: 'omnia',
	method: 'profile_source_save',
	params: [ 'content' ],
	expect: { '': {} }
});

const callProfileSyncRemote = rpc.declare({
	object: 'omnia',
	method: 'profile_sync_remote',
	expect: { '': {} }
});

const callProfileRestoreDefault = rpc.declare({
	object: 'omnia',
	method: 'profile_restore_default',
	expect: { '': {} }
});

const callProfileRollback = rpc.declare({
	object: 'omnia',
	method: 'profile_rollback',
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

const callTemplateSelectorsGet = rpc.declare({
	object: 'omnia',
	method: 'template_selectors_get',
	expect: { '': {} }
});

const callTemplateSelectorsSave = rpc.declare({
	object: 'omnia',
	method: 'template_selectors_save',
	params: [ 'content' ],
	expect: { '': {} }
});

const OFFICIAL_SCHEMA_URL = 'https://sing-box.sagernet.org/schema.json';
const DEFAULT_TEMPLATE_URL = 'https://testingcf.jsdelivr.net/gh/miozen/Omnia@master/profiles/main-profile.json';

let profileResult = null;
let sourceResult = null;
let selectorsResult = null;
let selectorConfigState = {};
let candidatePool = { regions: [], system: [], selectors: [] };
let cachedSchema = null;
let editorDirty = false;
let actionStatus = '';
let actionStatusOk = true;
let selectorActionStatus = '';
let selectorActionStatusOk = true;

function dataOf(result) {
	if (result && result.ok && result.data)
		return result.data;
	return {};
}

function profileContent(result) {
	return result && result.ok && result.data && typeof result.data.content === 'string' ? result.data.content : '';
}

function sourceData() {
	const data = dataOf(sourceResult);
	return data.source || {};
}

function sourceInputUrl() {
	return sourceData().url || DEFAULT_TEMPLATE_URL;
}

function sourceFetchStrategy() {
	return sourceData().fetch_strategy === 'proxy' ? 'proxy' : 'direct';
}

function actionStatusBox() {
	return omniaUi.statusBox('omnia-profile-action-status', actionStatus, actionStatusOk ? 'ok' : 'error', {
		padding: '.75rem',
		margin: '.85rem 0 0'
	});
}

function setStatus(text, ok) {
	actionStatus = text || '';
	actionStatusOk = ok !== false;
	omniaUi.paintStatus('omnia-profile-action-status', actionStatus, actionStatusOk ? 'ok' : 'error');
}

function resultError(result, fallback) {
	if (result && (result.message || result.code))
		return '%s: %s'.format(result.message || result.code || fallback || _('操作失败'), result.detail || result.code || _('无详细信息'));
	return fallback || _('操作失败');
}

function loadSingboxSchema() {
	if (cachedSchema)
		return Promise.resolve(cachedSchema);

	const url = (typeof L !== 'undefined' && typeof L.resource === 'function')
		? L.resource('omnia/sing-box-schema.json')
		: '/luci-static/resources/omnia/sing-box-schema.json';

	if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
		return window.fetch(url).then(function(res) {
			if (!res.ok)
				throw new Error('HTTP ' + res.status);
			return res.json();
		}).then(function(schema) {
			cachedSchema = schema;
			return schema;
		}).catch(function(err) {
			console.warn('Failed to load local sing-box schema:', err);
			return null;
		});
	}
	return Promise.resolve(null);
}

function stripOmniaExtensions(val) {
	if (Array.isArray(val))
		return val.map(stripOmniaExtensions);
	if (val && typeof val === 'object') {
		const res = {};
		for (const k of Object.keys(val)) {
			if (!k.startsWith('x_'))
				res[k] = stripOmniaExtensions(val[k]);
		}
		return res;
	}
	return val;
}

function resolveRef(root, ref) {
	if (typeof ref === 'string' && ref.startsWith('#/$defs/')) {
		const key = ref.slice(8);
		return root && root.$defs && root.$defs[key];
	}
	return null;
}

function validateSchema(data, subSchema, root, path) {
	if (!subSchema || typeof subSchema !== 'object')
		return null;

	if (subSchema.$ref) {
		const target = resolveRef(root, subSchema.$ref);
		if (!target)
			return (path || 'root') + ': 无法解析的 Schema 引用 ' + subSchema.$ref;
		return validateSchema(data, target, root, path);
	}

	if (subSchema.allOf) {
		for (let i = 0; i < subSchema.allOf.length; i++) {
			const err = validateSchema(data, subSchema.allOf[i], root, path);
			if (err) return err;
		}
	}

	if (subSchema.anyOf) {
		let matched = false;
		let lastErr = null;
		for (let i = 0; i < subSchema.anyOf.length; i++) {
			const err = validateSchema(data, subSchema.anyOf[i], root, path);
			if (!err) {
				matched = true;
				break;
			}
			lastErr = err;
		}
		if (!matched)
			return (path || 'root') + ': 不符合规范定义 (' + (lastErr || '无匹配分支') + ')';
	}

	if (subSchema.oneOf) {
		let matchCount = 0;
		let lastErr = null;
		for (let i = 0; i < subSchema.oneOf.length; i++) {
			const err = validateSchema(data, subSchema.oneOf[i], root, path);
			if (!err) matchCount++;
			else lastErr = err;
		}
		if (matchCount !== 1)
			return (path || 'root') + ': 期望严格匹配 1 个分支，实际匹配 ' + matchCount + (lastErr ? ' (' + lastErr + ')' : '');
	}

	if (subSchema.const !== undefined) {
		if (data !== subSchema.const)
			return (path || 'root') + ': 期望为 ' + JSON.stringify(subSchema.const) + '，实际为 ' + JSON.stringify(data);
	}

	if (subSchema.enum !== undefined) {
		if (!Array.isArray(subSchema.enum) || subSchema.enum.indexOf(data) === -1)
			return (path || 'root') + ': 属性值 ' + JSON.stringify(data) + ' 不在允许的可选列表中';
	}

	if (subSchema.type) {
		const types = Array.isArray(subSchema.type) ? subSchema.type : [ subSchema.type ];
		let typeOk = false;
		for (let i = 0; i < types.length; i++) {
			const t = types[i];
			if (t === 'null' && data === null) typeOk = true;
			else if (t === 'string' && typeof data === 'string') typeOk = true;
			else if (t === 'boolean' && typeof data === 'boolean') typeOk = true;
			else if (t === 'number' && typeof data === 'number' && !isNaN(data)) typeOk = true;
			else if (t === 'integer' && typeof data === 'number' && Number.isInteger(data)) typeOk = true;
			else if (t === 'array' && Array.isArray(data)) typeOk = true;
			else if (t === 'object' && data && typeof data === 'object' && !Array.isArray(data)) typeOk = true;
		}
		if (!typeOk)
			return (path || 'root') + ': 期望类型 ' + types.join('|') + '，实际为 ' + (data === null ? 'null' : typeof data);
	}

	if (typeof data === 'number') {
		if (subSchema.minimum !== undefined && data < subSchema.minimum)
			return (path || 'root') + ': 数值 ' + data + ' 小于最小值 ' + subSchema.minimum;
		if (subSchema.maximum !== undefined && data > subSchema.maximum)
			return (path || 'root') + ': 数值 ' + data + ' 大于最大值 ' + subSchema.maximum;
	}

	if (typeof data === 'string' && subSchema.pattern) {
		try {
			const reg = new RegExp(subSchema.pattern);
			if (!reg.test(data))
				return (path || 'root') + ': 字符串格式不匹配规则 ' + subSchema.pattern;
		} catch (e) {}
	}

	if (Array.isArray(data)) {
		if (subSchema.items) {
			for (let i = 0; i < data.length; i++) {
				const err = validateSchema(data[i], subSchema.items, root, (path || 'root') + '[' + i + ']');
				if (err) return err;
			}
		}
	}

	if (data && typeof data === 'object' && !Array.isArray(data)) {
		if (subSchema.required && Array.isArray(subSchema.required)) {
			for (let i = 0; i < subSchema.required.length; i++) {
				const req = subSchema.required[i];
				if (!(req in data))
					return (path || 'root') + ': 缺少必填属性 "' + req + '"';
			}
		}
		if (subSchema.properties) {
			const keys = Object.keys(data);
			for (let i = 0; i < keys.length; i++) {
				const key = keys[i];
				if (subSchema.properties[key]) {
					const err = validateSchema(data[key], subSchema.properties[key], root, (path ? path + '.' : '') + key);
					if (err) return err;
				}
			}
		}
		if (subSchema.additionalProperties === false) {
			const keys = Object.keys(data);
			for (let i = 0; i < keys.length; i++) {
				const key = keys[i];
				if (!key.startsWith('x_') && key !== '$schema' && (!subSchema.properties || !(key in subSchema.properties))) {
					return (path || 'root') + ': 存在未定义的属性 "' + key + '"';
				}
			}
		}
	}

	return null;
}

function ensureSchema(rawConfig) {
	if (typeof rawConfig !== 'string')
		return rawConfig;
	try {
		const obj = JSON.parse(rawConfig);
		if (!obj || typeof obj !== 'object' || Array.isArray(obj))
			return rawConfig;
		const ordered = { '$schema': OFFICIAL_SCHEMA_URL };
		const keys = Object.keys(obj);
		for (let i = 0; i < keys.length; i++) {
			const k = keys[i];
			if (k !== '$schema')
				ordered[k] = obj[k];
		}
		return JSON.stringify(ordered, null, 2) + '\n';
	} catch (e) {
		return rawConfig;
	}
}

function doValidateProfile(content) {
	let parsed;
	try {
		parsed = JSON.parse(content);
	} catch (e) {
		return Promise.reject(new Error(_('JSON 语法错误') + ': ' + e.message));
	}

	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		return Promise.reject(new Error(_('模板内容必须是合法的 JSON 对象')));
	}

	return loadSingboxSchema().then(function(schema) {
		if (schema) {
			const cleaned = stripOmniaExtensions(parsed);
			const schemaErr = validateSchema(cleaned, schema, schema, 'root');
			if (schemaErr)
				throw new Error(_('sing-box Schema 校验未通过') + ': ' + schemaErr);
		}

		return callProfileValidate(content).then(function(res) {
			if (!res || !res.ok)
				throw new Error(resultError(res, _('Omnia 基础结构校验失败')));
			return { ok: true, parsed: parsed };
		});
	});
}

function updateEditorBadge() {
	const badge = document.getElementById('omnia-profile-editor-badge');
	if (!badge) return;
	if (typeof omniaUi.paintPill === 'function') {
		omniaUi.paintPill(badge, editorDirty ? _('未保存修改') : _('已同步落盘'), editorDirty ? 'warning' : 'ok');
	} else {
		badge.className = typeof omniaUi.pillClass === 'function' ? omniaUi.pillClass(editorDirty ? 'warning' : 'ok') : '';
		badge.textContent = editorDirty ? _('未保存修改') : _('已同步落盘');
	}
}

function formatEditorJson() {
	const textarea = document.getElementById('omnia-profile-editor');
	if (!textarea) return;
	const text = textarea.value.trim();
	if (!text) {
		setStatus(_('模板内容为空，无需格式化'), false);
		return;
	}

	try {
		const formatted = ensureSchema(text);
		textarea.value = formatted;
		editorDirty = true;
		updateEditorBadge();
		updateProfileLineNumbers();
		setStatus(_('JSON 已按 2 空格缩进格式化，并已确保官方 $schema。'), true);
	} catch (e) {
		setStatus(_('JSON 语法错误，无法格式化') + ': ' + e.message, false);
	}
}

function validateEditorJson() {
	const textarea = document.getElementById('omnia-profile-editor');
	if (!textarea) return Promise.resolve();
	const content = textarea.value;

	setStatus(_('正在校验模板结构与 sing-box 官方 JSON Schema...'), true);

	return doValidateProfile(content).then(function() {
		setStatus(_('校验通过：JSON 语法有效，符合 sing-box 官方规范及 Omnia 基础结构。'), true);
	}).catch(function(err) {
		setStatus(err.message || String(err), false);
	});
}

function saveProfile() {
	const textarea = document.getElementById('omnia-profile-editor');
	if (!textarea) return Promise.resolve();
	let content = textarea.value;

	setStatus(_('正在校验模板...'), true);

	return doValidateProfile(content).then(function() {
		setStatus(_('校验通过，正在保存模板...'), true);
		const preparedContent = ensureSchema(content);
		if (preparedContent !== content) {
			content = preparedContent;
			textarea.value = content;
		}
		return callProfileSave(content).then(function(result) {
			if (result && result.ok) {
				editorDirty = false;
				updateEditorBadge();
				setStatus(_('模板已成功保存至 main-profile.json（备份已就绪）。准备使用新模板时，请至控制面板生成候选配置。'), true);
				return refreshPage();
			}
			setStatus(resultError(result, _('保存模板失败')), false);
			return result;
		});
	}).catch(function(err) {
		setStatus(err.message || String(err), false);
	});
}

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

function saveAndApplyProfile() {
	const textarea = document.getElementById('omnia-profile-editor');
	if (!textarea) return Promise.resolve();
	let content = textarea.value;

	const btn = document.getElementById('omnia-profile-save-apply-btn');
	if (btn) {
		btn.disabled = true;
		btn.innerText = _('⚡ 正在保存并应用...');
	}

	setStatus(_('正在校验模板 Schema...'), true);

	return doValidateProfile(content).then(function() {
		setStatus(_('Schema 校验通过，正在保存模板...'), true);
		const preparedContent = ensureSchema(content);
		if (preparedContent !== content) {
			content = preparedContent;
			textarea.value = content;
		}
		return callProfileSave(content).then(function(saveRes) {
			if (!(saveRes && saveRes.ok)) {
				setStatus(resultError(saveRes, _('保存模板失败')), false);
				return saveRes;
			}
			editorDirty = false;
			updateEditorBadge();

			setStatus(_('【1/3 生成配置】正在根据新模板生成候选配置...'), true);
			return callGenerate().then(function(genRes) {
				if (!(genRes && genRes.ok)) {
					let detail = genRes && (genRes.detail || genRes.message) || _('生成配置失败');
					let hint = _('模板已保存，但未能生成有效候选配置。请检查出站策略组等依赖。');
					setStatus(formatDiagnosticError(1, _('候选配置生成失败'), detail, hint), false);
					return genRes;
				}

				let genData = omniaUi.dataOf(genRes) || {};
				let nodeCount = genData.node_count || 0;
				let groupCount = genData.generated_groups || 0;

				setStatus(_('【2/3 内核校验】sing-box 正在校验生成配置语法...'), true);
				return callCheck().then(function(checkRes) {
					if (!(checkRes && checkRes.ok)) {
						let detail = checkRes && (checkRes.detail || checkRes.message) || _('语法校验未通过');
						let hint = _('sing-box 内核拒绝了该配置。当前运行中的网络保持原配置未中断，请根据报错修改模板。');
						setStatus(formatDiagnosticError(2, _('sing-box 内核校验未通过'), detail, hint), false);
						return checkRes;
					}

					setStatus(_('【3/3 应用配置】正在重载 sing-box 运行时...'), true);
					return callApply().then(function(applyRes) {
						if (!(applyRes && applyRes.ok)) {
							let detail = applyRes && (applyRes.detail || applyRes.message) || _('应用失败');
							let hint = _('服务拉起异常已自动回滚。请前往【网络诊断】查看日志。');
							setStatus(formatDiagnosticError(3, _('运行配置应用失败（已回滚）'), detail, hint), false);
							return applyRes;
						}

						let applyData = omniaUi.dataOf(applyRes) || {};
						if (applyData.health_ready === false) {
							setStatus(formatDiagnosticError(4, _('健康检查未就绪'), _('服务未能在预期时间内就绪'), _('请前往【网络诊断】排查。')), false);
							return refreshPage();
						}

						let successMsg = E('div', { 'style': 'font-size: 13px; line-height: 1.5;' }, [
							E('div', { 'style': 'font-weight: 700; font-size: 14px; margin-bottom: .25rem;' }, '✓ ' + _('模板已保存并成功应用到运行时！')),
							E('div', { 'style': 'font-size: 12px; color: #15803d;' }, _('已加载 %d 个出站节点、%d 个策略组，sing-box 运行正常。').format(nodeCount, groupCount))
						]);
						setStatus(successMsg, true);
						return refreshPage();
					});
				});
			});
		});
	}).catch(function(err) {
		setStatus(err.message || String(err), false);
	}).finally(function() {
		if (btn) {
			btn.disabled = false;
			btn.innerText = _('⚡ 保存并立即应用');
		}
	});
}

function refreshPage() {
	return Promise.all([
		callProfileGet(),
		callProfileSourceGet(),
		callTemplateSelectorsGet().catch(function() { return {}; })
	]).then(function(results) {
		profileResult = results && results[0] ? results[0] : {};
		sourceResult = results && results[1] ? results[1] : {};
		selectorsResult = results && results[2] ? results[2] : {};
		initSelectorState(dataOf(selectorsResult));
		editorDirty = false;
		redraw();
		return results;
	}).catch(function(error) {
		setStatus(error.message || String(error), false);
	});
}

function saveSource() {
	const input = document.getElementById('omnia-profile-source-url');
	const strategy = document.getElementById('omnia-profile-fetch-strategy');
	const source = {
		schema_version: 1,
		url: input ? input.value.trim() : '',
		fetch_strategy: strategy && strategy.value === 'proxy' ? 'proxy' : 'direct'
	};

	setStatus(_('正在保存在线模板源设置...'), true);

	return callProfileSourceSave(JSON.stringify(source)).then(function(result) {
		if (result && result.ok) {
			sourceResult = {
				ok: true,
				data: dataOf(result)
			};
			setStatus(_('在线模板源设置已保存。在线模板仅供按需拉取，修改本地模板不会反向同步或上传到远程。'), true);
			redraw();
		} else {
			setStatus(resultError(result, _('保存失败')), false);
		}
		return result;
	}).catch(function(error) {
		setStatus(error.message || String(error), false);
	});
}

function syncRemote() {
	if (editorDirty) {
		if (!window.confirm(_('当前编辑器中有未保存的修改。从在线拉取将覆盖编辑区内容，确定继续吗？')))
			return Promise.resolve();
	}

	setStatus(_('正在从在线源拉取最新模板...'), true);

	return callProfileSyncRemote().then(function(result) {
		if (result && result.ok) {
			editorDirty = false;
			setStatus(_('模板已从在线源拉取并更新。准备使用新模板时，请生成候选配置。'), true);
			return refreshPage();
		}

		setStatus(resultError(result, _('拉取失败')), false);
		return result;
	}).catch(function(error) {
		setStatus(error.message || String(error), false);
	});
}

function rollbackProfile() {
	if (!window.confirm(_('回滚到上一个模板备份吗？运行配置不会改变。')))
		return Promise.resolve();

	setStatus(_('正在回滚模板...'), true);

	return callProfileRollback().then(function(result) {
		if (result && result.ok) {
			editorDirty = false;
			setStatus(_('模板已回滚。准备使用时，请生成候选配置。'), true);
			return refreshPage();
		}
		setStatus(resultError(result, _('回滚失败')), false);
		return result;
	}).catch(function(error) {
		setStatus(error.message || String(error), false);
	});
}

function restoreDefault() {
	if (!window.confirm(_('恢复内置模板吗？当前模板会被备份。')))
		return Promise.resolve();

	setStatus(_('正在恢复内置模板...'), true);

	return callProfileRestoreDefault().then(function(result) {
		if (result && result.ok) {
			editorDirty = false;
			setStatus(_('内置模板已恢复。准备使用时，请生成候选配置。'), true);
			return refreshPage();
		}
		setStatus(resultError(result, _('恢复失败')), false);
		return result;
	}).catch(function(error) {
		setStatus(error.message || String(error), false);
	});
}

function updateProfileLineNumbers() {
	const textarea = document.getElementById('omnia-profile-editor');
	const gutter = document.getElementById('omnia-profile-editor-gutter');
	if (!textarea || !gutter) return;
	const count = (textarea.value || '').split('\n').length;
	let str = '';
	for (let i = 1; i <= count; i++) {
		str += i + '\n';
	}
	gutter.textContent = str;
}

function handleEditorKeydown(ev) {
	if (ev.key === 'Tab') {
		ev.preventDefault();
		const textarea = ev.target;
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const val = textarea.value;
		textarea.value = val.substring(0, start) + '  ' + val.substring(end);
		textarea.selectionStart = textarea.selectionEnd = start + 2;
		editorDirty = true;
		updateEditorBadge();
		updateProfileLineNumbers();
	} else if ((ev.ctrlKey || ev.metaKey) && (ev.key === 's' || ev.key === 'S')) {
		ev.preventDefault();
		saveProfile();
	}
}

function handleEditorInput() {
	if (!editorDirty) {
		editorDirty = true;
		updateEditorBadge();
	}
	updateProfileLineNumbers();
}

function profileEditor() {
	const content = profileContent(profileResult);
	setTimeout(updateProfileLineNumbers, 0);

	return E('div', { 'style': omniaUi.sectionStyle() }, [
		E('div', { 'style': 'display: flex; justify-content: space-between; gap: .75rem; align-items: center; flex-wrap: wrap; margin-bottom: .75rem;' }, [
			E('div', {}, [
				omniaUi.sectionTitle(_('模板编辑器 (main-profile.json)')),
				omniaUi.sectionDescription(_('直接编辑本地模板。支持快捷键：Tab 插入 2 空格，Ctrl+S 保存；点击「⚡ 保存并立即应用」一步生效。'))
			]),
			omniaUi.pill(editorDirty ? _('未保存修改') : _('已同步落盘'), editorDirty ? 'warning' : 'ok', {
				id: 'omnia-profile-editor-badge'
			})
		]),
		omniaUi.actionRow([
			E('button', {
				'type': 'button',
				'id': 'omnia-profile-save-apply-btn',
				'class': omniaMotion.buttonClass('btn cbi-button cbi-button-action'),
				'click': function(ev) { ev.preventDefault(); return saveAndApplyProfile(); }
			}, _('⚡ 保存并立即应用')),
			E('button', {
				'type': 'button',
				'class': omniaMotion.buttonClass('btn cbi-button cbi-button-save'),
				'click': function(ev) { ev.preventDefault(); return saveProfile(); }
			}, _('💾 保存模板')),
			E('button', {
				'type': 'button',
				'class': omniaMotion.buttonClass('btn cbi-button cbi-button-neutral'),
				'click': function(ev) { ev.preventDefault(); return validateEditorJson(); }
			}, _('🔍 校验 Schema')),
			E('button', {
				'type': 'button',
				'class': omniaMotion.buttonClass('btn cbi-button cbi-button-neutral'),
				'click': function(ev) { ev.preventDefault(); return formatEditorJson(); }
			}, _('✨ 格式化 JSON')),
			E('button', {
				'type': 'button',
				'class': omniaMotion.buttonClass('btn cbi-button cbi-button-apply'),
				'click': function(ev) { ev.preventDefault(); return syncRemote(); }
			}, _('🔄 从在线拉取最新')),
			E('button', {
				'type': 'button',
				'class': omniaMotion.buttonClass('btn cbi-button cbi-button-neutral'),
				'click': function(ev) { ev.preventDefault(); return rollbackProfile(); }
			}, _('↩️ 回滚')),
			E('button', {
				'type': 'button',
				'class': omniaMotion.buttonClass('btn cbi-button cbi-button-remove'),
				'click': function(ev) { ev.preventDefault(); return restoreDefault(); }
			}, _('⚠️ 恢复内置模板'))
		]),
		actionStatusBox(),
		E('div', {
			'style': 'margin-top: .85rem; display: flex; background: #0f172a; border: 1px solid #334155; border-radius: 8px; overflow: hidden; min-height: 32rem; height: 38rem;'
		}, [
			E('div', {
				'id': 'omnia-profile-editor-gutter',
				'style': 'box-sizing: border-box; padding: 1rem .5rem 1rem .75rem; background: #090d16; color: #475569; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 13px; line-height: 1.5; text-align: right; user-select: none; border-right: 1px solid #1e293b; overflow: hidden; min-width: 3.5rem; white-space: pre;'
			}),
			E('textarea', {
				'id': 'omnia-profile-editor',
				'class': 'cbi-input-textarea',
				'style': 'flex: 1; height: 100%; border: none; box-sizing: border-box; background: transparent; color: #f8fafc; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 13px; line-height: 1.5; padding: 1rem; resize: none; outline: none; tab-size: 2; white-space: pre; overflow: auto;',
				'wrap': 'off',
				'spellcheck': 'false',
				'autocomplete': 'off',
				'autocorrect': 'off',
				'autocapitalize': 'off',
				'keydown': handleEditorKeydown,
				'input': handleEditorInput,
				'scroll': function(ev) {
					const gutter = document.getElementById('omnia-profile-editor-gutter');
					if (gutter) gutter.scrollTop = ev.target.scrollTop;
				}
			}, content)
		])
	]);
}

function remoteSourceAccordion() {
	return E('div', {
		'id': 'omnia-profile-remote-accordion',
		'style': omniaUi.sectionStyle()
	}, [
		omniaUi.sectionTitle(_('在线模板与拉取设置')),
		omniaUi.sectionDescription(_('配置远程 sing-box 基础模板 URL 与拉取网络策略。通过“从在线拉取最新”按钮即可按需下载覆盖本地模板。本地修改仅在设备本地生效，绝不向远程同步。')),
		E('div', { 'style': 'display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: .75rem; margin-top: .75rem;' }, [
			E('div', {}, [
				omniaUi.fieldLabel(_('模板地址')),
				E('input', {
					'id': 'omnia-profile-source-url',
					'class': 'cbi-input-text',
					'style': 'width: 100%; box-sizing: border-box;',
					'placeholder': DEFAULT_TEMPLATE_URL,
					'value': sourceInputUrl()
				})
			]),
			E('div', {}, [
				omniaUi.fieldLabel(_('下载策略')),
				E('select', {
					'id': 'omnia-profile-fetch-strategy',
					'class': 'cbi-input-select',
					'style': 'width: 100%; box-sizing: border-box;'
				}, [
					E('option', { 'value': 'direct', 'selected': sourceFetchStrategy() === 'direct' ? 'selected' : null }, _('直连')),
					E('option', { 'value': 'proxy', 'selected': sourceFetchStrategy() === 'proxy' ? 'selected' : null }, _('代理'))
				])
			])
		]),
		omniaUi.actionRow([
			E('button', {
				'type': 'button',
				'class': omniaMotion.buttonClass('btn cbi-button cbi-button-save'),
				'click': function(ev) { ev.preventDefault(); return saveSource(); }
			}, _('保存在线设置'))
		])
	]);
}

function initSelectorState(data) {
	candidatePool = (data && typeof data === 'object') ? data : { regions: [], system: [], selectors: [] };
	selectorConfigState = {};
	const list = candidatePool.selectors || [];
	for (let i = 0; i < list.length; i++) {
		const s = list[i];
		if (s && s.tag) {
			selectorConfigState[s.tag] = Array.isArray(s.configured_members) ? s.configured_members.slice() : [];
		}
	}
}

function selectorStatusBox() {
	return omniaUi.statusBox('omnia-selectors-action-status', selectorActionStatus, selectorActionStatusOk ? 'ok' : 'error', {
		padding: '.65rem .85rem',
		margin: '.75rem 0 0'
	});
}

function setSelectorStatus(text, ok) {
	selectorActionStatus = text || '';
	selectorActionStatusOk = ok !== false;
	omniaUi.paintStatus('omnia-selectors-action-status', selectorActionStatus, selectorActionStatusOk ? 'ok' : 'error');
}

function candidateLabel(id) {
	if (id === 'main') return '🗽 节点选择';
	if (id === 'direct') return '🎯 全球直连';
	if (id === 'manual') return '🍭 手动选择';
	if (id === 'HK') return '🇭🇰 香港';
	if (id === 'TW') return '🇹🇼 台湾';
	if (id === 'SG') return '🇸🇬 新加坡';
	if (id === 'JP') return '🇯🇵 日本';
	if (id === 'US') return '🇺🇸 美国';
	if (candidatePool && Array.isArray(candidatePool.regions)) {
		for (let i = 0; i < candidatePool.regions.length; i++) {
			if (candidatePool.regions[i].id === id)
				return candidatePool.regions[i].label || id;
		}
	}
	return id;
}

function addMember(tag, memberId) {
	if (!selectorConfigState[tag])
		selectorConfigState[tag] = [];
	if (selectorConfigState[tag].indexOf(memberId) === -1) {
		selectorConfigState[tag].push(memberId);
		updateSelectorCardsView();
	}
}

function removeMember(tag, memberId) {
	if (!selectorConfigState[tag])
		return;
	const idx = selectorConfigState[tag].indexOf(memberId);
	if (idx !== -1) {
		selectorConfigState[tag].splice(idx, 1);
		updateSelectorCardsView();
	}
}

function addAllRegions(tag) {
	if (!selectorConfigState[tag])
		selectorConfigState[tag] = [];
	const regionIds = ['HK', 'TW', 'SG', 'JP', 'US'];
	if (candidatePool && Array.isArray(candidatePool.regions) && candidatePool.regions.length > 0) {
		for (let i = 0; i < candidatePool.regions.length; i++) {
			const rId = candidatePool.regions[i].id;
			if (selectorConfigState[tag].indexOf(rId) === -1)
				selectorConfigState[tag].push(rId);
		}
	} else {
		for (let i = 0; i < regionIds.length; i++) {
			if (selectorConfigState[tag].indexOf(regionIds[i]) === -1)
				selectorConfigState[tag].push(regionIds[i]);
		}
	}
	updateSelectorCardsView();
}

function resetSelector(tag) {
	selectorConfigState[tag] = [];
	updateSelectorCardsView();
}

function resetAllSelectors() {
	const list = candidatePool.selectors || [];
	for (let i = 0; i < list.length; i++) {
		if (list[i] && list[i].tag)
			selectorConfigState[list[i].tag] = [];
	}
	updateSelectorCardsView();
}

function saveSelectors() {
	const btn = document.getElementById('omnia-selectors-save-btn');
	if (btn) btn.disabled = true;
	setSelectorStatus(_('正在保存分流 Selector 出站分配...'), true);

	return callTemplateSelectorsSave(JSON.stringify(selectorConfigState)).then(function(res) {
		if (res && res.ok) {
			setSelectorStatus(_('✓ 分流 Selector 出站分配已成功保存！配置重新生成或应用时立即生效。'), true);
			return callTemplateSelectorsGet().then(function(dataRes) {
				selectorsResult = dataRes;
				initSelectorState(dataOf(selectorsResult));
				updateSelectorCardsView();
			});
		} else {
			setSelectorStatus(resultError(res, _('保存分流配置失败')), false);
		}
	}).catch(function(err) {
		setSelectorStatus(err.message || String(err), false);
	}).finally(function() {
		if (btn) btn.disabled = false;
	});
}

function generateSelectorPreview(item) {
	const currentMembers = selectorConfigState[item.tag] || [];
	const isCustom = currentMembers.length > 0;

	if (!isCustom && item.preview_object)
		return item.preview_object;

	let outbounds = [];
	if (isCustom) {
		for (let i = 0; i < currentMembers.length; i++) {
			const m = currentMembers[i];
			if (m === 'main') outbounds.push('🗽 节点选择');
			else if (m === 'direct') outbounds.push('🎯 全球直连');
			else if (m === 'manual') outbounds.push('🍭 手动选择');
			else {
				let label = candidateLabel(m);
				if (label && label !== m) {
					outbounds.push(label + '测速组');
				} else {
					outbounds.push(m);
				}
			}
		}
		if (outbounds.length === 0)
			outbounds.push('🗽 节点选择');
	} else {
		outbounds = (item.preview_outbounds && item.preview_outbounds.length > 0)
			? item.preview_outbounds.slice()
			: [ '🗽 节点选择' ];
	}

	let obj = {
		type: 'selector',
		tag: item.tag,
		outbounds: outbounds
	};
	if (item.preview_object && item.preview_object.interrupt_exist_connections !== undefined)
		obj.interrupt_exist_connections = item.preview_object.interrupt_exist_connections;
	return obj;
}

function openPreviewModal(item) {
	const currentMembers = selectorConfigState[item.tag] || [];
	const isCustom = currentMembers.length > 0;
	const previewObj = generateSelectorPreview(item);

	const modal = document.getElementById('omnia-selector-preview-modal');
	const modalTitle = document.getElementById('omnia-modal-title');
	const modalSub = document.getElementById('omnia-modal-sub');
	const modalJson = document.getElementById('omnia-modal-json');

	if (modalTitle) modalTitle.textContent = item.tag + ' ' + _('出站配置预览');
	if (modalSub) {
		modalSub.textContent = isCustom
			? _('当前模式: 自定义分配 | 展开包含 %d 个测速组/出站').format(previewObj.outbounds.length)
			: _('当前模式: 继承模板 (%s) | 展开包含 %d 个出站').format(item.x_rule || '原生 outbounds', previewObj.outbounds.length);
	}
	const jsonStr = JSON.stringify(previewObj, null, 2);
	if (modalJson) modalJson.textContent = jsonStr;

	if (modal) modal.style.display = 'flex';
}

function closePreviewModal() {
	const modal = document.getElementById('omnia-selector-preview-modal');
	if (modal) modal.style.display = 'none';
}

function copyModalJson() {
	const modalJson = document.getElementById('omnia-modal-json');
	const btn = document.getElementById('omnia-modal-copy-btn');
	if (!modalJson) return;
	const text = modalJson.textContent || '';
	if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
		navigator.clipboard.writeText(text).then(function() {
			if (btn) {
				btn.textContent = '✓ ' + _('已复制！');
				setTimeout(function() { btn.textContent = '📄 ' + _('复制 JSON'); }, 1500);
			}
		});
	}
}

function renderSelectorCard(item) {
	const members = selectorConfigState[item.tag] || [];
	const isCustom = members.length > 0;

	const headRow = E('div', {
		'style': 'display: flex; align-items: center; justify-content: space-between; gap: .5rem; flex-wrap: wrap; margin-bottom: .6rem;'
	}, [
		E('div', { 'style': 'display: flex; align-items: center; gap: .5rem; flex-wrap: wrap;' }, [
			E('strong', { 'style': 'font-size: 13px; color: #f8fafc;' }, item.tag),
			E('button', {
				'type': 'button',
				'title': _('点击弹窗预览该 Selector 生成出站 JSON'),
				'style': 'cursor: pointer; background: rgba(59, 130, 246, 0.12); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 6px; padding: 2px 7px; font-size: 12px; color: #93c5fd; display: inline-flex; align-items: center; gap: 2px; line-height: 1.2;',
				'click': function(ev) { ev.preventDefault(); openPreviewModal(item); }
			}, [ '🔍' ]),
			isCustom
				? omniaUi.pill(_('自定义 (%d 项)').format(members.length), 'warning')
				: omniaUi.pill(_('继承模板 (%s)').format(item.x_rule || '原生 outbounds'), 'neutral')
		]),
		E('button', {
			'type': 'button',
			'class': 'btn cbi-button cbi-button-neutral',
			'style': 'font-size: 11px; padding: 2px 8px; line-height: 1.3;',
			'click': function(ev) { ev.preventDefault(); resetSelector(item.tag); }
		}, _('↺ 恢复默认'))
	]);

	const chipsContainer = E('div', {
		'style': 'display: flex; flex-wrap: wrap; gap: .35rem; align-items: center; padding: .45rem .65rem; background: #0f172a; border-radius: 6px; border: 1px solid #1e293b; min-height: 2rem; margin-bottom: .6rem;'
	});

	if (members.length > 0) {
		for (let i = 0; i < members.length; i++) {
			const mId = members[i];
			chipsContainer.appendChild(E('span', {
				'style': 'display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 6px; background: #1e293b; border: 1px solid #334155; font-size: 12px; color: #f1f5f9;'
			}, [
				E('span', {}, candidateLabel(mId)),
				E('span', {
					'title': _('移除此成员'),
					'style': 'cursor: pointer; color: #ef4444; font-weight: bold; font-size: 12px; margin-left: 2px;',
					'click': (function(tag, mem) {
						return function(ev) { ev.preventDefault(); removeMember(tag, mem); };
					})(item.tag, mId)
				}, '✕')
			]));
		}
	} else {
		chipsContainer.appendChild(E('span', {
			'style': 'font-size: 12px; color: #64748b; font-style: italic;'
		}, _('（留空，自动沿用模板原有规则）')));
	}

	const addRow = E('div', {
		'style': 'display: flex; flex-wrap: wrap; gap: .35rem; align-items: center;'
	}, [
		E('span', { 'style': 'font-size: 11px; color: #94a3b8; margin-right: 4px;' }, _('添加出站:'))
	]);

	const defaultRegions = [
		{ id: 'HK', label: '🇭🇰 香港' },
		{ id: 'TW', label: '🇹🇼 台湾' },
		{ id: 'SG', label: '🇸🇬 新加坡' },
		{ id: 'JP', label: '🇯🇵 日本' },
		{ id: 'US', label: '🇺🇸 美国' }
	];
	const regionsList = (candidatePool && Array.isArray(candidatePool.regions) && candidatePool.regions.length > 0)
		? candidatePool.regions
		: defaultRegions;

	for (let i = 0; i < regionsList.length; i++) {
		const reg = regionsList[i];
		addRow.appendChild(E('button', {
			'type': 'button',
			'style': 'cursor: pointer; padding: 2px 7px; border-radius: 6px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.25); color: #93c5fd; font-size: 11px; line-height: 1.3;',
			'click': (function(tag, rId) {
				return function(ev) { ev.preventDefault(); addMember(tag, rId); };
			})(item.tag, reg.id)
		}, '+ ' + reg.label));
	}

	addRow.appendChild(E('button', {
		'type': 'button',
		'style': 'cursor: pointer; padding: 2px 7px; border-radius: 6px; background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(59, 130, 246, 0.4); color: #60a5fa; font-weight: 600; font-size: 11px; line-height: 1.3;',
		'click': function(ev) { ev.preventDefault(); addAllRegions(item.tag); }
	}, _('⚡ 全选地区')));

	const sysTargets = [
		{ id: 'main', label: '🗽 节点选择', color: '#c084fc', border: 'rgba(192, 132, 252, 0.3)' },
		{ id: 'direct', label: '🎯 全球直连', color: '#34d399', border: 'rgba(52, 211, 153, 0.3)' },
		{ id: 'manual', label: '🍭 手动选择', color: '#fbbf24', border: 'rgba(251, 191, 36, 0.3)' }
	];

	for (let i = 0; i < sysTargets.length; i++) {
		const sys = sysTargets[i];
		addRow.appendChild(E('button', {
			'type': 'button',
			'style': 'cursor: pointer; padding: 2px 7px; border-radius: 6px; background: rgba(255, 255, 255, 0.05); border: 1px solid ' + sys.border + '; color: ' + sys.color + '; font-size: 11px; line-height: 1.3;',
			'click': (function(tag, sId) {
				return function(ev) { ev.preventDefault(); addMember(tag, sId); };
			})(item.tag, sys.id)
		}, '+ ' + sys.label));
	}

	return E('div', {
		'style': 'padding: .75rem; border-radius: 10px; border: 1px solid #334155; background: #1e293b; margin-bottom: .65rem;'
	}, [
		headRow,
		chipsContainer,
		addRow
	]);
}

function updateSelectorCardsView() {
	const container = document.getElementById('omnia-selector-cards-container');
	if (!container) return;
	container.innerHTML = '';

	const selectors = (candidatePool && Array.isArray(candidatePool.selectors)) ? candidatePool.selectors : [];
	let count = 0;
	for (let i = 0; i < selectors.length; i++) {
		const s = selectors[i];
		if (s.is_main) continue;
		container.appendChild(renderSelectorCard(s));
		count++;
	}

	if (count === 0) {
		container.appendChild(E('div', {
			'style': 'padding: 1rem; text-align: center; color: #64748b; font-size: 12px;'
		}, _('模板中未检测到业务 Selector。')));
	}
}

function selectorAllocatorSection() {
	const mainNote = E('div', {
		'style': 'display: flex; align-items: center; justify-content: space-between; padding: .65rem .85rem; border-radius: 8px; background: rgba(51, 65, 85, 0.15); border: 1px solid #334155; margin-bottom: .75rem; font-size: 12px; color: #94a3b8; flex-wrap: wrap; gap: .5rem;'
	}, [
		E('div', { 'style': 'display: flex; align-items: center; gap: .5rem; flex-wrap: wrap;' }, [
			E('strong', { 'style': 'color: #f8fafc;' }, '🗽 节点选择 (main)'),
			omniaUi.pill('系统根主池', 'primary'),
			E('span', {}, _('自动聚合各机场测速组与未匹配节点作为全局默认兜底，受系统保护，不作为业务分流组展示。'))
		]),
		E('span', { 'style': 'font-family: monospace; font-size: 10px; opacity: 0.6;' }, 'SYSTEM ROOT')
	]);

	const cardsContainer = E('div', {
		'id': 'omnia-selector-cards-container'
	});

	const actionsRow = omniaUi.actionRow([
		E('button', {
			'id': 'omnia-selectors-save-btn',
			'type': 'button',
			'class': omniaMotion.buttonClass('btn cbi-button cbi-button-save'),
			'click': function(ev) { ev.preventDefault(); return saveSelectors(); }
		}, _('💾 保存分流配置')),
		E('button', {
			'type': 'button',
			'class': omniaMotion.buttonClass('btn cbi-button cbi-button-neutral'),
			'click': function(ev) { ev.preventDefault(); return resetAllSelectors(); }
		}, _('↺ 全部恢复默认'))
	]);

	setTimeout(updateSelectorCardsView, 0);

	return E('div', { 'style': omniaUi.sectionStyle() }, [
		E('div', { 'style': 'display: flex; justify-content: space-between; gap: .75rem; align-items: center; flex-wrap: wrap; margin-bottom: .75rem;' }, [
			E('div', {}, [
				omniaUi.sectionTitle(_('🔀 分流 Selector 出站分配')),
				omniaUi.sectionDescription(_('为各策略组指定出站成员。勾选具体地区或核心出站；留空继承模板原有规则；所选地区无节点时由「节点选择 (main)」自动兜底。点击 🔍 即可弹窗预览。'))
			]),
			omniaUi.pill('Omnia 配置优先', 'ok')
		]),
		actionsRow,
		selectorStatusBox(),
		E('div', { 'style': 'margin-top: .85rem;' }, [
			mainNote,
			cardsContainer
		])
	]);
}

function selectorPreviewModal() {
	return E('div', {
		'id': 'omnia-selector-preview-modal',
		'style': 'display: none; position: fixed; inset: 0; z-index: 1000; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px); align-items: center; justify-content: center; padding: 1rem;',
		'click': function(ev) {
			if (ev.target && ev.target.id === 'omnia-selector-preview-modal')
				closePreviewModal();
		}
	}, [
		E('div', {
			'style': 'background: #1e293b; border: 1px solid #334155; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); max-width: 520px; width: 100%; overflow: hidden; display: flex; flex-direction: column; color: #f8fafc;'
		}, [
			E('div', {
				'style': 'display: flex; align-items: center; justify-content: space-between; padding: .85rem 1rem; border-bottom: 1px solid #334155; background: #0f172a;'
			}, [
				E('div', { 'style': 'display: flex; align-items: center; gap: .5rem;' }, [
					E('span', { 'style': 'font-size: 1.1rem;' }, '🔍'),
					E('div', {}, [
						E('h4', { 'id': 'omnia-modal-title', 'style': 'margin: 0; font-size: 14px; font-weight: 700; color: #f8fafc;' }, _('出站配置预览')),
						E('p', { 'id': 'omnia-modal-sub', 'style': 'margin: 0; font-size: 11px; color: #94a3b8;' })
					])
				]),
				E('button', {
					'type': 'button',
					'style': 'background: transparent; border: none; color: #94a3b8; cursor: pointer; font-size: 16px; padding: 2px 6px; border-radius: 4px;',
					'click': closePreviewModal
				}, '✕')
			]),
			E('div', { 'style': 'padding: 1rem;' }, [
				E('div', { 'style': 'display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #94a3b8; margin-bottom: .5rem;' }, [
					E('span', {}, _('sing-box 最终生效的 outbound 对象：')),
					E('button', {
						'id': 'omnia-modal-copy-btn',
						'type': 'button',
						'style': 'cursor: pointer; background: transparent; border: none; color: #60a5fa; font-size: 12px; font-weight: 600;',
						'click': copyModalJson
					}, '📄 ' + _('复制 JSON'))
				]),
				E('pre', {
					'id': 'omnia-modal-json',
					'style': 'padding: .85rem; background: #090d16; color: #38bdf8; border-radius: 8px; font-size: 12px; font-family: ui-monospace, SFMono-Regular, monospace; line-height: 1.5; overflow-x: auto; max-height: 18rem; margin: 0; white-space: pre;'
				})
			]),
			E('div', {
				'style': 'display: flex; justify-content: flex-end; padding: .75rem 1rem; border-top: 1px solid #334155; background: #0f172a;'
			}, [
				E('button', {
					'type': 'button',
					'class': 'btn cbi-button cbi-button-action',
					'style': 'padding: 4px 16px; font-size: 12px;',
					'click': closePreviewModal
				}, _('关闭'))
			])
		])
	]);
}

function redraw() {
	const root = document.getElementById('omnia-profile-root');
	if (root && root.parentNode)
		root.parentNode.replaceChild(renderPage(), root);
}

function renderPage() {
	omniaMotion.inject();

	return E('div', { 'id': 'omnia-profile-root', 'class': 'cbi-map' }, [
		omniaUi.pageHeader(
			_('模板配置与分流策略'),
			_('编辑 main-profile.json 基础模板并动态分配 Selector 出站成员。支持 Schema 校验与单组 🔍 出站预览。')
		),
		selectorAllocatorSection(),
		profileEditor(),
		remoteSourceAccordion(),
		selectorPreviewModal()
	]);
}

return view.extend({
	load: function() {
		return Promise.all([
			callProfileGet(),
			callProfileSourceGet(),
			callTemplateSelectorsGet().catch(function() { return {}; })
		]);
	},

	render: function(results) {
		profileResult = results && results[0] ? results[0] : {};
		sourceResult = results && results[1] ? results[1] : {};
		selectorsResult = results && results[2] ? results[2] : {};
		initSelectorState(dataOf(selectorsResult));
		if (selectorsResult && selectorsResult.ok === false) {
			let msg = selectorsResult.message || selectorsResult.detail || _('加载分流出站失败');
			window.setTimeout(function() {
				setSelectorStatus(_('加载失败：%s').format(msg), false);
			}, 0);
		}

		return renderPage();
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
