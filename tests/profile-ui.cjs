const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const schema = JSON.parse(fs.readFileSync('luci-app-omnia/htdocs/luci-static/resources/omnia/sing-box-schema.json', 'utf8'));
const profile = JSON.parse(fs.readFileSync('profiles/main-profile.json', 'utf8'));

let savedContent = null;
let profileValidateCalled = false;
let statusMessage = '';
let statusOk = true;

const responses = {
	profile_get: async () => ({ ok: true, data: { content: JSON.stringify(profile, null, 2) } }),
	profile_source_get: async () => ({ ok: true, data: { source: { url: 'https://example.com/profile.json', fetch_strategy: 'direct' } } }),
	profile_save: async (content) => { savedContent = content; return { ok: true, data: { path: '/etc/omnia/profiles/main-profile.json' } }; },
	profile_validate: async (content) => { profileValidateCalled = true; return { ok: true, data: { valid: true } }; },
	profile_source_save: async () => ({ ok: true, data: {} }),
	profile_sync_remote: async () => ({ ok: true, data: {} }),
	profile_restore_default: async () => ({ ok: true, data: {} }),
	profile_rollback: async () => ({ ok: true, data: {} })
};

const domElements = {};

function createElement(tag, attrs, children) {
	const el = {
		tag,
		attrs: attrs || {},
		children: children || [],
		value: attrs && attrs.value !== undefined ? attrs.value : (typeof children === 'string' ? children : ''),
		className: attrs && attrs.class || '',
		textContent: (typeof children === 'string') ? children : '',
		selectionStart: 0,
		selectionEnd: 0,
		style: attrs && attrs.style || {},
		addEventListener() {},
		appendChild(c) {
			if (Array.isArray(children)) children.push(c);
		}
	};
	if (attrs && attrs.id) {
		domElements[attrs.id] = el;
	}
	return el;
}

const context = vm.createContext({
	console,
	setTimeout,
	window: {
		confirm: () => true,
		fetch: async () => ({ ok: true, json: async () => schema })
	},
	document: {
		getElementById: (id) => domElements[id] || null
	},
	L: {
		resource: (p) => p
	},
	rpc: {
		declare: spec => (content) => responses[spec.method](content)
	},
	view: {
		extend: value => value
	},
	_: value => value,
	E: createElement
});

vm.runInContext("String.prototype.format = function() { let args = arguments, i = 0; return this.replace(/%s/g, () => args[i++]); };", context);

const mockOmniaUi = {
	sectionStyle: () => 'section;',
	sectionTitle: t => createElement('h3', {}, t),
	sectionDescription: d => createElement('p', {}, d),
	fieldLabel: l => createElement('label', {}, l),
	actionRow: children => createElement('div', { class: 'action-row' }, children),
	statusBox: (id, text, type) => createElement('div', { id }),
	paintStatus: (id, text, type) => {
		statusMessage = text;
		statusOk = (type === 'ok');
		if (domElements[id]) domElements[id].textContent = text;
	},
	pageHeader: (t, d) => createElement('div', {}, [t, d]),
	pill: (text, tone, options) => {
		options = options || {};
		return createElement('span', { id: options.id || null, class: 'pill-' + (tone || 'neutral') }, text);
	},
	pillClass: t => 'pill-' + t,
	paintPill: (id, text, type) => {
		let node = typeof id === 'string' ? domElements[id] : id;
		if (node) {
			if (text != null) node.textContent = text;
			node.className = 'pill-' + (type || 'neutral');
		}
	}
};

const mockOmniaMotion = {
	buttonClass: c => c,
	inject: () => {}
};

const source = fs.readFileSync('luci-app-omnia/htdocs/luci-static/resources/view/omnia/profile.js', 'utf8');

// Inject mocked omniaUi and omniaMotion
const wrapped = `
(function() {
	const omniaUi = ${JSON.stringify(mockOmniaUi)};
	omniaUi.sectionStyle = () => 'section;';
	omniaUi.sectionTitle = t => E('h3', {}, t);
	omniaUi.sectionDescription = d => E('p', {}, d);
	omniaUi.fieldLabel = l => E('label', {}, l);
	omniaUi.actionRow = children => E('div', { class: 'action-row' }, children);
	omniaUi.statusBox = (id, text, type) => E('div', { id });
	omniaUi.paintStatus = (id, text, type) => {
		globalThis.statusMessage = text;
		globalThis.statusOk = (type === 'ok');
	};
	omniaUi.pageHeader = (t, d) => E('div', {}, [t, d]);
	omniaUi.pill = (text, tone, options) => {
		options = options || {};
		return E('span', { id: options.id || null, class: 'pill-' + (tone || 'neutral') }, text);
	};
	omniaUi.pillClass = t => 'pill-' + t;
	omniaUi.paintPill = (id, text, type) => {
		let node = typeof id === 'string' ? domElements[id] : id;
		if (node) {
			if (text != null) node.textContent = text;
			node.className = 'pill-' + (type || 'neutral');
		}
	};

	const omniaMotion = {
		buttonClass: c => c,
		inject: () => {}
	};

	${source
		.replace(/'require omnia.ui as omniaUi';/, '')
		.replace(/'require omnia.motion as omniaMotion';/, '')
		.replace('return view.extend({', `
			globalThis.profileModule = {
				doValidateProfile,
				formatEditorJson,
				validateEditorJson,
				saveProfile,
				handleEditorKeydown,
				handleEditorInput,
				syncRemote,
				rollbackProfile,
				restoreDefault,
				saveSource,
				loadSingboxSchema,
				stripOmniaExtensions,
				validateSchema
			};
			return view.extend({
		`)}
})()
`;

const viewObj = vm.runInContext(wrapped, context);

(async () => {
	// Initialize view
	const data = await viewObj.load();
	const rendered = viewObj.render(data);
	assert.ok(rendered, 'View renders DOM elements');
	assert.ok(domElements['omnia-profile-editor'], 'Editor textarea rendered');
	assert.ok(domElements['omnia-profile-remote-accordion'], 'Remote source accordion rendered');

	const mod = context.profileModule;
	const editor = domElements['omnia-profile-editor'];

	// 1. Validate real profile passes schema
	const validResult = await mod.doValidateProfile(editor.value);
	assert.ok(validResult.ok, 'Real profile passes validation');

	// 2. Validate syntax error rejection
	await assert.rejects(
		async () => await mod.doValidateProfile('{ invalid json }'),
		/JSON 语法错误/,
		'Rejects malformed JSON syntax'
	);

	// 3. Validate missing $schema rejection
	const noSchema = JSON.parse(editor.value);
	delete noSchema.$schema;
	await assert.rejects(
		async () => await mod.doValidateProfile(JSON.stringify(noSchema)),
		/缺少或错误的 \$schema 声明/,
		'Rejects missing official $schema'
	);

	// 4. Validate schema violation rejection
	const invalidSchemaProfile = JSON.parse(editor.value);
	invalidSchemaProfile.dns.invalid_property_xyz = true;
	await assert.rejects(
		async () => await mod.doValidateProfile(JSON.stringify(invalidSchemaProfile)),
		/sing-box Schema 校验未通过/,
		'Rejects schema-violating unknown properties'
	);

	// 5. Test JSON Formatting
	editor.value = '{"b":2,"a":1}';
	mod.formatEditorJson();
	assert.ok(editor.value.startsWith('{\n  "$schema": "https://sing-box.sagernet.org/schema.json"'), 'Formatter ensures $schema is declared first');
	assert.ok(editor.value.includes('  "b": 2'), 'Formatted with 2 space indentation');

	// 6. Test Tab key insertion
	editor.value = 'abc';
	editor.selectionStart = 1;
	editor.selectionEnd = 1;
	let defaultPrevented = false;
	mod.handleEditorKeydown({
		target: editor,
		key: 'Tab',
		preventDefault: () => { defaultPrevented = true; }
	});
	assert.ok(defaultPrevented, 'Tab default prevented');
	assert.equal(editor.value, 'a  bc', 'Tab inserts 2 spaces');
	assert.equal(editor.selectionStart, 3, 'Cursor placed after spaces');

	// 7. Test Save Flow
	editor.value = JSON.stringify(profile, null, 2);
	profileValidateCalled = false;
	await mod.saveProfile();
	assert.ok(profileValidateCalled, 'profile_validate backend RPC invoked');
	assert.ok(savedContent, 'profile_save saved content');

	console.log('All profile-ui tests passed successfully!');
})().catch(err => {
	console.error('Test failed:', err);
	process.exit(1);
});
