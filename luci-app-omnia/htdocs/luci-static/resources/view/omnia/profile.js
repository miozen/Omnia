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

const OFFICIAL_SCHEMA_URL = 'https://sing-box.sagernet.org/schema.json';
const DEFAULT_TEMPLATE_URL = 'https://testingcf.jsdelivr.net/gh/miozen/Omnia@master/profiles/main-profile.json';

let profileResult = null;
let sourceResult = null;
let cachedSchema = null;
let editorDirty = false;
let actionStatus = '';
let actionStatusOk = true;

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

	if (parsed.$schema !== OFFICIAL_SCHEMA_URL) {
		return Promise.reject(new Error(_('缺少或错误的 $schema 声明，必须为: ') + OFFICIAL_SCHEMA_URL));
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
		const obj = JSON.parse(text);
		if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
			setStatus(_('格式化失败：内容不是 JSON 对象'), false);
			return;
		}

		const ordered = { '$schema': OFFICIAL_SCHEMA_URL };
		const keys = Object.keys(obj);
		for (let i = 0; i < keys.length; i++) {
			const k = keys[i];
			if (k !== '$schema')
				ordered[k] = obj[k];
		}

		textarea.value = JSON.stringify(ordered, null, 2) + '\n';
		editorDirty = true;
		updateEditorBadge();
		setStatus(_('JSON 已按 2 空格缩进格式化，并已确保声明 official $schema。'), true);
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
		setStatus(_('校验通过：JSON 语法、official $schema 及 Omnia 基础结构完整有效。'), true);
	}).catch(function(err) {
		setStatus(err.message || String(err), false);
	});
}

function saveProfile() {
	const textarea = document.getElementById('omnia-profile-editor');
	if (!textarea) return Promise.resolve();
	const content = textarea.value;

	setStatus(_('正在校验模板...'), true);

	return doValidateProfile(content).then(function() {
		setStatus(_('校验通过，正在保存模板...'), true);
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

function refreshPage() {
	return Promise.all([
		callProfileGet(),
		callProfileSourceGet()
	]).then(function(results) {
		profileResult = results && results[0] ? results[0] : {};
		sourceResult = results && results[1] ? results[1] : {};
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
}

function profileEditor() {
	const content = profileContent(profileResult);

	return E('div', { 'style': omniaUi.sectionStyle() }, [
		E('div', { 'style': 'display: flex; justify-content: space-between; gap: .75rem; align-items: center; flex-wrap: wrap; margin-bottom: .75rem;' }, [
			E('div', {}, [
				omniaUi.sectionTitle(_('模板编辑器 (main-profile.json)')),
				omniaUi.sectionDescription(_('直接编辑本地模板。支持快捷键：Tab 插入 2 空格，Ctrl+S 保存。保存前将自动执行 Schema 校验。'))
			]),
			omniaUi.pill(editorDirty ? _('未保存修改') : _('已同步落盘'), editorDirty ? 'warning' : 'ok', {
				id: 'omnia-profile-editor-badge'
			})
		]),
		omniaUi.actionRow([
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
		E('div', { 'style': 'margin-top: .85rem;' }, [
			E('textarea', {
				'id': 'omnia-profile-editor',
				'class': 'cbi-input-textarea',
				'style': 'width: 100%; box-sizing: border-box; min-height: 32rem; height: 38rem; padding: 1rem; border-radius: 8px; background: #0f172a; color: #f8fafc; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 13px; line-height: 1.5; border: 1px solid #334155; resize: vertical; tab-size: 2;',
				'spellcheck': 'false',
				'autocomplete': 'off',
				'autocorrect': 'off',
				'autocapitalize': 'off',
				'keydown': handleEditorKeydown,
				'input': handleEditorInput
			}, content)
		])
	]);
}

function remoteSourceAccordion() {
	return E('details', {
		'id': 'omnia-profile-remote-accordion',
		'style': 'margin-top: 1rem; border: 1px solid #334155; border-radius: 8px; padding: .85rem 1rem; background: rgba(15, 23, 42, 0.4);'
	}, [
		E('summary', {
			'style': 'cursor: pointer; font-weight: 600; font-size: 14px; color: #94a3b8; outline: none; user-select: none; display: flex; align-items: center; justify-content: space-between;'
		}, [
			E('span', {}, _('🌐 在线模板与拉取设置 (点击展开)')),
			E('span', { 'style': 'font-size: 12px; font-weight: normal; color: #64748b;' }, _('按需拉取，修改本地模板不上传远程'))
		]),
		E('div', { 'style': 'margin-top: 1rem; border-top: 1px solid #1e293b; padding-top: .85rem;' }, [
			omniaUi.sectionDescription(_('配置远程 sing-box 基础模板 URL 与拉取网络策略。通过“从在线拉取最新”按钮即可按需下载覆盖本地模板。本地修改仅在设备本地生效，绝不向远程同步。')),
			E('label', { 'style': 'display: block; margin-top: .6rem;' }, [
				omniaUi.fieldLabel(_('模板地址')),
				E('input', {
					'id': 'omnia-profile-source-url',
					'class': 'cbi-input-text',
					'style': 'width: 100%; max-width: 100%; box-sizing: border-box;',
					'placeholder': DEFAULT_TEMPLATE_URL,
					'value': sourceInputUrl()
				})
			]),
			E('label', { 'style': 'display: block; margin-top: .6rem;' }, [
				omniaUi.fieldLabel(_('下载策略')),
				E('select', { 'id': 'omnia-profile-fetch-strategy', 'class': 'cbi-input-select', 'style': 'min-width: 220px;' }, [
					E('option', { 'value': 'direct', 'selected': sourceFetchStrategy() === 'direct' ? 'selected' : null }, _('直连')),
					E('option', { 'value': 'proxy', 'selected': sourceFetchStrategy() === 'proxy' ? 'selected' : null }, _('代理'))
				])
			]),
			omniaUi.actionRow([
				E('button', {
					'type': 'button',
					'class': omniaMotion.buttonClass('btn cbi-button cbi-button-save'),
					'click': function(ev) { ev.preventDefault(); return saveSource(); }
				}, _('保存在线设置'))
			])
		])
	]);
}

function redraw() {
	const root = document.getElementById('omnia-profile-root');
	if (root)
		root.parentNode.replaceChild(renderPage(), root);
}

function renderPage() {
	omniaMotion.inject();

	return E('div', { 'id': 'omnia-profile-root', 'class': 'cbi-map' }, [
		omniaUi.pageHeader(
			_('模板配置'),
			_('编辑 main-profile.json 基础模板，支持 JSON 格式化与 sing-box 官方 JSON Schema 校验。')
		),
		profileEditor(),
		remoteSourceAccordion()
	]);
}

return view.extend({
	load: function() {
		return Promise.all([
			callProfileGet(),
			callProfileSourceGet()
		]);
	},

	render: function(results) {
		profileResult = results && results[0] ? results[0] : {};
		sourceResult = results && results[1] ? results[1] : {};

		return renderPage();
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
