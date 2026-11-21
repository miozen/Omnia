'use strict';
'require baseclass';

function mergeStyle(base, extra) {
	if (!extra)
		return base;
	return base + (base.slice(-1) === ';' ? ' ' : '; ') + extra;
}

function dataOf(result) {
	if (result && result.ok && result.data)
		return result.data;
	return {};
}

function valueText(value) {
	if (value == null || value === '')
		return '-';
	return String(value);
}

function sectionStyle(extra) {
	return mergeStyle('border: 1px solid var(--border-color, #dfe3e8); border-radius: 8px; padding: .75rem 1rem; margin: 0 0 .75rem; background: var(--card-background, var(--background-color, #fff)); color: var(--text-color, inherit);', extra);
}

function mutedStyle(extra) {
	return mergeStyle('color: var(--text-color-muted, #667); line-height: 1.35; overflow-wrap: anywhere;', extra);
}

function section(children, options) {
	options = options || {};
	return E('div', {
		'id': options.id || null,
		'class': options.class || null,
		'style': sectionStyle(options.style)
	}, children || []);
}

function pageHeader(title, description) {
	return section([
		E('h2', { 'style': 'margin: 0 0 .35rem; line-height: 1.25;' }, title),
		E('p', { 'style': mutedStyle('margin: 0;') }, description)
	]);
}

function sectionTitle(title) {
	return E('h3', { 'style': 'margin: 0 0 .45rem; line-height: 1.25;' }, title);
}

function sectionDescription(text) {
	return E('div', { 'style': mutedStyle('margin: 0 0 .6rem;') }, text);
}

function fieldLabel(text) {
	return E('div', { 'style': 'font-size: 12px; color: var(--text-color-muted, #667); font-weight: 700; margin: 0 0 .25rem; line-height: 1.25;' }, text);
}

function formField(label, input, help, options) {
	options = options || {};
	return E('label', {
		'style': mergeStyle('display: block; margin-bottom: .75rem;', options.style)
	}, [
		fieldLabel(label),
		input,
		help ? E('div', { 'style': mutedStyle('font-size: 12px; margin-top: .25rem;') }, help) : ''
	]);
}

function actionRow(children, options) {
	options = options || {};
	return E('div', {
		'id': options.id || null,
		'class': options.class || null,
		'style': mergeStyle('display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; margin-top: .7rem;', options.style)
	}, children || []);
}

function toneColors(tone) {
	if (tone === 'ok' || tone === true)
		return { border: '#bbf7d0', bg: '#f0fdf4', color: '#166534' };
	if (tone === 'warning')
		return { border: '#f59e0b', bg: '#fffbeb', color: '#92400e' };
	if (tone === 'info')
		return { border: '#bfdbfe', bg: '#eff6ff', color: '#1e40af' };
	if (tone === 'error' || tone === false)
		return { border: '#fecaca', bg: '#fef2f2', color: '#991b1b' };
	return { border: '#dfe3e8', bg: '#f8fafc', color: '#475569' };
}

function statusBox(id, text, tone, options) {
	options = options || {};
	let colors = toneColors(tone);
	return E('div', {
		'id': id || null,
		'class': options.class || null,
		'style': mergeStyle('display: %s; border: 1px solid %s; border-radius: 8px; padding: %s; margin: %s; background: %s; color: %s; overflow-wrap: anywhere;'.format(
			text ? 'block' : 'none',
			colors.border,
			options.padding || '.65rem',
			options.margin || '0 0 .75rem',
			colors.bg,
			colors.color
		), options.style)
	}, text || '');
}

function paintStatus(nodeOrId, text, tone) {
	let node = typeof nodeOrId === 'string' ? document.getElementById(nodeOrId) : nodeOrId;
	if (!node)
		return;

	let colors = toneColors(tone);
	let isDom = typeof text === 'object' && text !== null && (text.nodeType || text instanceof Node || Array.isArray(text));
	if (isDom) {
		while (node.firstChild)
			node.removeChild(node.firstChild);
		if (Array.isArray(text)) {
			for (let i = 0; i < text.length; i++)
				if (text[i]) node.appendChild(typeof text[i] === 'string' ? document.createTextNode(text[i]) : text[i]);
		} else {
			node.appendChild(text);
		}
		node.style.display = 'block';
	} else {
		node.textContent = text || '';
		node.style.display = text ? 'block' : 'none';
	}
	node.style.borderColor = colors.border;
	node.style.background = colors.bg;
	node.style.color = colors.color;
}

function resultMessage(result, fallback) {
	if (result && result.ok)
		return fallback || result.message || _('Done');
	if (result && (result.message || result.code))
		return '%s: %s'.format(result.message || result.code || _('Unknown error'), result.detail || result.code || _('No detail'));
	return fallback || _('Operation failed');
}

function pillColors(tone) {
	if (tone === 'ok' || tone === true)
		return { color: '#166534', bg: '#dcfce7' };
	if (tone === 'warning')
		return { color: '#92400e', bg: '#fef3c7' };
	if (tone === 'error' || tone === false)
		return { color: '#991b1b', bg: '#fee2e2' };
	if (tone === 'info')
		return { color: '#1e40af', bg: '#dbeafe' };
	return { color: '#475569', bg: '#f1f5f9' };
}

function pillClass(tone) {
	let t = tone === true ? 'ok' : (tone === false ? 'error' : (tone || 'neutral'));
	return 'omnia-pill omnia-pill-' + t;
}

function pillStyle(tone, extra) {
	let c = pillColors(tone);
	return mergeStyle('display: inline-flex; align-items: center; min-height: 22px; padding: 0 .55rem; border-radius: 999px; font-size: 12px; font-weight: 700; color: %s; background: %s; white-space: nowrap;'.format(c.color, c.bg), extra);
}

function pill(text, tone, options) {
	options = options || {};
	let cls = pillClass(tone);
	if (options.class)
		cls += ' ' + options.class;

	return E('span', {
		'id': options.id || null,
		'class': cls,
		'style': pillStyle(tone, options.style)
	}, text);
}

function paintPill(nodeOrId, text, tone) {
	let node = typeof nodeOrId === 'string' ? document.getElementById(nodeOrId) : nodeOrId;
	if (!node)
		return;

	let c = pillColors(tone);
	if (text != null)
		node.textContent = text;
	node.style.color = c.color;
	node.style.background = c.bg;
	node.className = pillClass(tone);
}

function statCard(label, value, options) {
	options = options || {};
	return E('div', {
		'class': options.class || null,
		'style': mergeStyle('border: 1px solid var(--border-color, #e5e7eb); border-radius: 8px; padding: .65rem; background: var(--table-hover-color, #f8fafc);', options.style)
	}, [
		E('div', { 'style': 'font-size: 12px; color: var(--text-color-muted, #667); font-weight: 700;' }, label),
		E('div', { 'style': mergeStyle('font-size: 20px; font-weight: 800; margin-top: .25rem; overflow-wrap: anywhere;', options.valueStyle) }, valueText(value))
	]);
}

function checkboxInput(options) {
	options = options || {};
	let attrs = {};
	let box = null;
	let mark = null;
	let input = null;

	Object.keys(options).forEach(function(key) {
		if (key !== 'style')
			attrs[key] = options[key];
	});

	attrs.type = 'checkbox';
	attrs.style = mergeStyle('position: absolute; opacity: 0; width: 24px; height: 24px; margin: 0; pointer-events: none;', options.style);

	function paint() {
		let checked = !!(input && input.checked);
		if (box) {
			box.style.borderColor = checked ? '#2563eb' : '#94a3b8';
			box.style.background = checked ? '#2563eb' : '#fff';
			box.style.boxShadow = checked ? 'inset 0 0 0 1px #2563eb' : 'inset 0 0 0 1px #fff';
		}
		if (mark)
			mark.style.display = checked ? 'block' : 'none';
	}

	let isChecked = !!(options.checked === true || options.checked === 'checked' || options.checked === 'true');
	input = E('input', attrs);
	input.checked = isChecked;
	input.defaultChecked = isChecked;
	box = E('span', {
		'aria-hidden': 'true',
		'style': 'display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; min-width: 18px; box-sizing: border-box; border: 1px solid #94a3b8; border-radius: 4px; background: #fff; color: #fff; font-size: 14px; font-weight: 700; line-height: 1; vertical-align: middle;'
	}, [
		mark = E('span', { 'style': 'display: none; transform: translateY(-1px);' }, '\u2713')
	]);

	let wrapper = E('span', {
		'style': 'position: relative; display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; min-width: 24px; cursor: pointer; touch-action: manipulation; vertical-align: middle;',
		'click': function(ev) {
			ev.preventDefault();
			ev.stopPropagation();
			input.checked = !input.checked;
			paint();
			input.dispatchEvent(new Event('change', { bubbles: true }));
		}
	}, [ input, box ]);

	input.addEventListener('change', paint);
	window.setTimeout(paint, 0);
	return wrapper;
}

function defer(fn) {
	window.setTimeout(fn, 0);
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

return baseclass.extend({
	dataOf: dataOf,
	valueText: valueText,
	sectionStyle: sectionStyle,
	mutedStyle: mutedStyle,
	section: section,
	pageHeader: pageHeader,
	sectionTitle: sectionTitle,
	sectionDescription: sectionDescription,
	fieldLabel: fieldLabel,
	formField: formField,
	actionRow: actionRow,
	statusBox: statusBox,
	paintStatus: paintStatus,
	resultMessage: resultMessage,
	pill: pill,
	pillClass: pillClass,
	pillStyle: pillStyle,
	paintPill: paintPill,
	statCard: statCard,
	checkboxInput: checkboxInput,
	formatDiagnosticError: formatDiagnosticError,
	defer: defer
});
