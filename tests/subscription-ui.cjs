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
	omniaUi: {
		paintStatus: (id, msg, tone) => {
			currentStatus = { msg, ok: tone === 'ok' };
		},
		checkboxInput: (attrs) => ({ tag: 'input', attrs: Object.assign({ type: 'checkbox' }, attrs) })
	},
	omniaMotion: {
		inject: () => {},
		buttonClass: cls => cls,
		cardClass: () => '',
		softRowClass: () => ''
	},
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
vm.runInContext('(function(){' + source.replace('return view.extend({', 'globalThis.refreshTest = { refreshResultText, refreshFinishedText, formatTrafficBytes, formatTrafficExpire, formatTrafficBadge, saveSourceEditor, removeSource, addRegion, deleteRegion, restoreDefaultRegions, policyDetails, updatePolicyDetails, waitRefresh, getCountryMetadata, isoToFlagEmoji, normalizePolicy, regionKeys, setStatus: (msg, ok) => { currentStatus = { msg, ok }; } }; return view.extend({') + '\n})()', context);
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

			// 6. National flags and ISO algorithmic fallback tests
			assert.equal(context.refreshTest.isoToFlagEmoji('NG'), '🇳🇬');
			assert.equal(context.refreshTest.isoToFlagEmoji('UA'), '🇺🇦');
			assert.equal(context.refreshTest.isoToFlagEmoji('EG'), '🇪🇬');
			assert.equal(context.refreshTest.isoToFlagEmoji('PK'), '🇵🇰');
			assert.equal(context.refreshTest.isoToFlagEmoji('TR'), '🇹🇷');
			assert.equal(context.refreshTest.isoToFlagEmoji('AR'), '🇦🇷');
			assert.equal(context.refreshTest.isoToFlagEmoji('DE'), '🇩🇪');
			assert.equal(context.refreshTest.isoToFlagEmoji('FR'), '🇫🇷');
			assert.equal(context.refreshTest.isoToFlagEmoji('INVALID'), '');

			const ngMeta = context.refreshTest.getCountryMetadata('NG');
			assert.equal(ngMeta.flag, '🇳🇬');
			assert.equal(ngMeta.name, '尼日利亚');
			assert.ok(ngMeta.keywords.includes('Nigeria'));
			assert.ok(ngMeta.keywords.includes('拉各斯'));

			const uaMeta = context.refreshTest.getCountryMetadata('UA');
			assert.equal(uaMeta.flag, '🇺🇦');
			assert.equal(uaMeta.name, '乌克兰');
			assert.ok(uaMeta.keywords.includes('Ukraine'));
			assert.ok(uaMeta.keywords.includes('基辅'));

			const egMeta = context.refreshTest.getCountryMetadata('EG');
			assert.equal(egMeta.flag, '🇪🇬');
			assert.equal(egMeta.name, '埃及');
			assert.ok(egMeta.keywords.includes('Egypt'));

			const pkMeta = context.refreshTest.getCountryMetadata('PK');
			assert.equal(pkMeta.flag, '🇵🇰');
			assert.equal(pkMeta.name, '巴基斯坦');
			assert.ok(pkMeta.keywords.includes('Pakistan'));

			const customMeta = context.refreshTest.getCountryMetadata('ZZ');
			assert.equal(customMeta.code, 'ZZ');
			assert.equal(customMeta.flag, context.refreshTest.isoToFlagEmoji('ZZ'));
			console.log('national flags & metadata OK');

			// 7. Dynamic regions policy normalization & deletion/addition tests
			// 7a. Normalization strictly respects user custom dictionary without force-injecting deleted presets
			const customPolicy = context.refreshTest.normalizePolicy({
				region_keywords: {
					JP: [ 'Japan', '日本' ],
					US: [ 'USA', '美国' ],
					NG: [ 'Nigeria', '尼日利亚' ]
				},
				sources: [
					{ name: 'S1', allowed_regions: [ 'HK', 'JP', 'NG' ] }
				],
				rate_filter: {
					matched_regions: [ 'HK', 'US', 'NG' ]
				}
			});
			const keys = context.refreshTest.regionKeys(customPolicy);
			assert.equal(keys.sort().join(','), 'JP,NG,US', 'HK, TW, SG should not be re-injected');
			assert.equal(customPolicy.sources[0].allowed_regions.join(','), 'JP,NG', 'Deleted HK filtered from allowed_regions');
			assert.equal(customPolicy.rate_filter.matched_regions.join(','), 'US,NG', 'Deleted HK filtered from rate_filter');

			// 7b. deleteRegion removes region and cascades to sources and rate_filter
			let testPol = {
				region_keywords: {
					HK: [ 'Hong Kong' ],
					US: [ 'USA' ],
					NG: [ 'Nigeria' ]
				},
				sources: [
					{ name: 'S1', allowed_regions: [ 'HK', 'US', 'NG' ] }
				],
				rate_filter: {
					matched_regions: [ 'HK', 'US', 'NG' ]
				}
			};
			testPol = context.refreshTest.deleteRegion('HK', testPol);
			assert.equal(testPol.region_keywords.HK, undefined, 'HK removed from region_keywords');
			assert.equal(testPol.sources[0].allowed_regions.join(','), 'US,NG', 'HK cascaded from sources allowed_regions');
			assert.equal(testPol.rate_filter.matched_regions.join(','), 'US,NG', 'HK cascaded from rate_filter matched_regions');

			// 7c. addRegion adds custom region with auto-prefilled keywords and rate_filter update
			testPol = context.refreshTest.addRegion('UA', null, testPol);
			assert.ok(testPol.region_keywords.UA != null, 'UA added to region_keywords');
			assert.ok(testPol.region_keywords.UA.includes('乌克兰'), 'UA has prefilled keywords');
			assert.ok(testPol.rate_filter.matched_regions.includes('UA'), 'UA added to rate_filter matched_regions');

			// 7d. restoreDefaultRegions resets to factory 5 regions
			testPol = context.refreshTest.restoreDefaultRegions(testPol);
			const restoredKeys = context.refreshTest.regionKeys(testPol).sort();
			assert.equal(restoredKeys.join(','), 'HK,JP,SG,TW,US', 'Default 5 regions restored');
			assert.equal(testPol.rate_filter.matched_regions.sort().join(','), 'HK,JP,SG,TW,US', 'Default rate_filter matched regions restored');
			console.log('custom regions addition, deletion & restore OK');

			// 7e. policyDetails DOM linkage & updatePolicyDetails tests
			let replacedPolicyDetails = null;
			mockElements['omnia-subscriptions-policy-details'] = {
				open: true,
				hasAttribute: (a) => a === 'open',
				parentNode: {
					replaceChild: (newEl) => {
						replacedPolicyDetails = newEl;
						mockElements['omnia-subscriptions-policy-details'] = newEl;
					}
				}
			};

			testPol = context.refreshTest.normalizePolicy(testPol);
			const detailsEl = context.refreshTest.policyDetails(testPol, true);
			assert.equal(detailsEl.tag, 'details');
			assert.equal(detailsEl.attrs.id, 'omnia-subscriptions-policy-details');
			assert.equal(detailsEl.attrs.open, 'open');

			// Trigger addRegion to verify updatePolicyDetails replaces the DOM element
			testPol = context.refreshTest.addRegion('KR', null, testPol);
			assert.ok(replacedPolicyDetails != null, 'updatePolicyDetails should replace child in DOM');
			assert.equal(replacedPolicyDetails.attrs.id, 'omnia-subscriptions-policy-details');
			assert.equal(replacedPolicyDetails.attrs.open, 'open', 'Preserves open accordion state');
			console.log('policyDetails DOM linkage OK');

			// 7f. waitRefresh timeout check (MAX_REFRESH_POLL_ATTEMPTS = 120)
			context.refreshTest.waitRefresh('run-test-timeout', 120);
			assert.equal(currentStatus.ok, false, 'Status should be marked error on poll timeout');
			assert.match(currentStatus.msg, /轮询超时/, 'Message should indicate polling timeout');
			console.log('subscription waitRefresh timeout OK');
		});
	});
}).catch(e => {
	console.error(e);
	process.exit(1);
});

console.log('subscription UI OK');
