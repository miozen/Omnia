'use strict';
'require view';
'require rpc';
'require omnia.ui as omniaUi';
'require omnia.motion as omniaMotion';

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

let selectorsResult = null;
let selectorConfigState = {};
let selectedMainSelector = '';
let candidatePool = { main_selector: '', all_selectors: [], regions: [], system: [], selectors: [] };
let selectorActionStatus = '';
let selectorActionStatusOk = true;

function dataOf(result) {
	if (result && result.ok && result.data)
		return result.data;
	return {};
}

function resultError(result, fallback) {
	if (result && (result.message || result.code))
		return '%s: %s'.format(result.message || result.code || fallback || _('操作失败'), result.detail || result.code || _('无详细信息'));
	return fallback || _('操作失败');
}

function initSelectorState(data) {
	candidatePool = (data && typeof data === 'object') ? data : { main_selector: '', all_selectors: [], regions: [], system: [], selectors: [] };
	selectedMainSelector = candidatePool.main_selector || '';
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
	if (id === 'main') {
		return selectedMainSelector ? selectedMainSelector + ' (根主池)' : '👑 根主池';
	}
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

function onMainSelectorChange(newTag) {
	if (typeof newTag === 'string' && newTag !== '') {
		selectedMainSelector = newTag;
		updateMainSelectorView();
		updateSelectorCardsView();
	}
}

function saveSelectors() {
	const btn = document.getElementById('omnia-selectors-save-btn');
	if (btn) btn.disabled = true;
	setSelectorStatus(_('正在保存分流 Selector 出站分配与根主池配置...'), true);

	const payload = {
		selectors: selectorConfigState,
		main_selector: selectedMainSelector
	};

	return callTemplateSelectorsSave(JSON.stringify(payload)).then(function(res) {
		if (res && res.ok) {
			setSelectorStatus(_('✓ 分流 Selector 出站分配已成功保存！配置重新生成或应用时立即生效。'), true);
			return callTemplateSelectorsGet().then(function(dataRes) {
				selectorsResult = dataRes;
				initSelectorState(dataOf(selectorsResult));
				updateMainSelectorView();
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

function saveAndApplySelectors() {
	const btn = document.getElementById('omnia-selectors-save-apply-btn');
	if (btn) btn.disabled = true;
	setSelectorStatus(_('正在保存分流策略并重新生成应用配置...'), true);

	const payload = {
		selectors: selectorConfigState,
		main_selector: selectedMainSelector
	};

	return callTemplateSelectorsSave(JSON.stringify(payload)).then(function(saveRes) {
		if (!saveRes || !saveRes.ok)
			throw new Error(resultError(saveRes, _('保存分流配置失败')));
		setSelectorStatus(_('正在根据新策略生成 sing-box 配置...'), true);
		return callGenerate();
	}).then(function(genRes) {
		if (!genRes || !genRes.ok)
			throw new Error(resultError(genRes, _('配置生成失败')));
		setSelectorStatus(_('正在校验 Candidate 配置语法...'), true);
		return callCheck();
	}).then(function(checkRes) {
		if (!checkRes || !checkRes.ok)
			throw new Error(resultError(checkRes, _('候选配置校验失败')));
		setSelectorStatus(_('正在原子切换并启动 sing-box 服务...'), true);
		return callApply();
	}).then(function(applyRes) {
		if (!applyRes || !applyRes.ok)
			throw new Error(resultError(applyRes, _('配置应用失败')));
		let applyData = dataOf(applyRes);
		if (applyData.health_ready === false) {
			setSelectorStatus(_('分流配置已保存并应用，但服务健康检查未就绪。请前往【网络诊断】检查 sing-box 是否处于崩溃循环或端口被占用。'), false);
			return callTemplateSelectorsGet().then(function(dataRes) {
				selectorsResult = dataRes;
				initSelectorState(dataOf(selectorsResult));
				updateMainSelectorView();
				updateSelectorCardsView();
			});
		}
		setSelectorStatus(_('✓ 分流配置已成功保存并立即应用！新节点与策略已生效。'), true);
		return callTemplateSelectorsGet().then(function(dataRes) {
			selectorsResult = dataRes;
			initSelectorState(dataOf(selectorsResult));
			updateMainSelectorView();
			updateSelectorCardsView();
		});
	}).catch(function(err) {
		setSelectorStatus(err.message || String(err), false);
	}).finally(function() {
		if (btn) btn.disabled = false;
	});
}

function generateSelectorPreview(item) {
	const isMain = (item.tag === selectedMainSelector || item.is_main);
	if (isMain) {
		let outbounds = (item.preview_outbounds && item.preview_outbounds.length > 0)
			? item.preview_outbounds.slice()
			: [ '（各地区测速组及未匹配节点自动聚合）' ];
		let obj = {
			type: 'selector',
			tag: item.tag,
			outbounds: outbounds
		};
		if (item.preview_object && item.preview_object.interrupt_exist_connections !== undefined)
			obj.interrupt_exist_connections = item.preview_object.interrupt_exist_connections;
		return obj;
	}

	const currentMembers = selectorConfigState[item.tag] || [];
	const isCustom = currentMembers.length > 0;

	if (!isCustom && item.preview_object)
		return item.preview_object;

	let outbounds = [];
	if (isCustom) {
		for (let i = 0; i < currentMembers.length; i++) {
			const m = currentMembers[i];
			if (m === 'main') outbounds.push(selectedMainSelector || '🗽 节点选择');
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
			outbounds.push(selectedMainSelector || '🗽 节点选择');
	} else {
		outbounds = (item.preview_outbounds && item.preview_outbounds.length > 0)
			? item.preview_outbounds.slice()
			: [ selectedMainSelector || '🗽 节点选择' ];
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
	const isMain = (item.tag === selectedMainSelector || item.is_main);
	const currentMembers = selectorConfigState[item.tag] || [];
	const isCustom = currentMembers.length > 0;
	const previewObj = generateSelectorPreview(item);

	const modal = document.getElementById('omnia-selector-preview-modal');
	const modalTitle = document.getElementById('omnia-modal-title');
	const modalSub = document.getElementById('omnia-modal-sub');
	const modalJson = document.getElementById('omnia-modal-json');

	if (modalTitle) modalTitle.textContent = item.tag + ' ' + _('出站配置预览');
	if (modalSub) {
		if (isMain) {
			modalSub.textContent = _('👑 系统根主池 | 自动聚合 %d 个测速组与节点').format(previewObj.outbounds.length);
		} else {
			modalSub.textContent = isCustom
				? _('当前模式: 自定义分配 | 展开包含 %d 个测速组/出站').format(previewObj.outbounds.length)
				: _('当前模式: 继承模板 (%s) | 展开包含 %d 个出站').format(item.x_rule || '原生 outbounds', previewObj.outbounds.length);
		}
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
		{ id: 'main', label: selectedMainSelector ? selectedMainSelector + ' (根主池)' : '👑 根主池', color: '#c084fc', border: 'rgba(192, 132, 252, 0.3)' },
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

function updateMainSelectorView() {
	const container = document.getElementById('omnia-main-selector-container');
	if (!container) return;
	container.innerHTML = '';

	const allSelectors = (candidatePool && Array.isArray(candidatePool.all_selectors)) ? candidatePool.all_selectors : [];
	const currentTag = selectedMainSelector || (allSelectors.length > 0 ? allSelectors[0].tag : '节点选择');

	const options = [];
	for (let i = 0; i < allSelectors.length; i++) {
		const item = allSelectors[i];
		options.push(E('option', {
			'value': item.tag,
			'selected': (item.tag === currentTag) ? 'selected' : null
		}, item.tag + (item.is_main ? ' [默认根主池]' : '')));
	}

	let mainItem = null;
	const selectors = (candidatePool && Array.isArray(candidatePool.selectors)) ? candidatePool.selectors : [];
	for (let i = 0; i < selectors.length; i++) {
		if (selectors[i].tag === currentTag) {
			mainItem = selectors[i];
			break;
		}
	}
	if (!mainItem) {
		mainItem = {
			tag: currentTag,
			is_main: true,
			preview_outbounds: []
		};
	}

	const pickerRow = E('div', {
		'style': 'display: flex; align-items: center; justify-content: space-between; gap: .75rem; flex-wrap: wrap;'
	}, [
		E('div', { 'style': 'display: flex; align-items: center; gap: .5rem; flex-wrap: wrap;' }, [
			E('label', { 'style': 'font-size: 13px; font-weight: 600; color: #1e3a8a;' }, _('🎯 选择系统根主池:')),
			E('select', {
				'id': 'omnia-main-selector-select',
				'class': 'cbi-input-select',
				'style': 'min-width: 14rem; font-weight: 500;',
				'change': function(ev) {
					onMainSelectorChange(this.value);
				}
			}, options),
			E('button', {
				'type': 'button',
				'title': _('点击弹窗预览根主池生成出站 JSON'),
				'style': 'cursor: pointer; background: #dbeafe; border: 1px solid #93c5fd; border-radius: 6px; padding: 3px 8px; font-size: 12px; color: #1d4ed8; font-weight: 500; display: inline-flex; align-items: center; gap: 4px;',
				'click': function(ev) { ev.preventDefault(); openPreviewModal(mainItem); }
			}, [ '🔍 ' + _('预览主池出站') ])
		]),
		omniaUi.pill('👑 全局根出口与兜底', 'primary')
	]);

	const descRow = E('div', {
		'style': 'margin-top: .5rem; font-size: 12px; color: #475569; line-height: 1.5;'
	}, _('系统自动聚合所有订阅的测速组与未匹配节点至此主池中。作为全局网络流量默认出口与规则兜底，其成员由引擎全自动维护。'));

	container.appendChild(pickerRow);
	container.appendChild(descRow);
}

function updateSelectorCardsView() {
	const container = document.getElementById('omnia-selector-cards-container');
	if (!container) return;
	container.innerHTML = '';

	const selectors = (candidatePool && Array.isArray(candidatePool.selectors)) ? candidatePool.selectors : [];
	let count = 0;
	for (let i = 0; i < selectors.length; i++) {
		const s = selectors[i];
		if (s.tag === selectedMainSelector) continue;
		container.appendChild(renderSelectorCard(s));
		count++;
	}

	if (count === 0) {
		container.appendChild(E('div', {
			'style': 'padding: 1.5rem; text-align: center; color: #64748b; font-size: 13px;'
		}, _('模板中未检测到其他业务 Selector。')));
	}
}

function selectorAllocatorSection() {
	const mainCard = E('div', {
		'id': 'omnia-main-selector-container',
		'style': 'padding: .85rem 1rem; border-radius: 10px; background: #eff6ff; border: 1px solid #bfdbfe; margin-bottom: 1rem;'
	});

	const cardsContainer = E('div', {
		'id': 'omnia-selector-cards-container'
	});

	const actionsRow = omniaUi.actionRow([
		E('button', {
			'id': 'omnia-selectors-save-apply-btn',
			'type': 'button',
			'class': omniaMotion.buttonClass('btn cbi-button cbi-button-action'),
			'click': function(ev) { ev.preventDefault(); return saveAndApplySelectors(); }
		}, _('⚡ 保存并立即应用')),
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

	setTimeout(function() {
		updateMainSelectorView();
		updateSelectorCardsView();
	}, 0);

	return E('div', { 'style': omniaUi.sectionStyle() }, [
		E('div', { 'style': 'display: flex; justify-content: space-between; gap: .75rem; align-items: center; flex-wrap: wrap; margin-bottom: .75rem;' }, [
			E('div', {}, [
				omniaUi.sectionTitle(_('🔀 分流 Selector 出站分配')),
				omniaUi.sectionDescription(_('配置全局根主池及各业务分流组的出站成员。勾选具体地区或核心出站；留空继承模板原有规则；所选地区无节点时由根主池自动兜底。点击 🔍 即可弹窗预览最终 outbound JSON。'))
			]),
			omniaUi.pill('Omnia 配置优先', 'ok')
		]),
		actionsRow,
		selectorStatusBox(),
		E('div', { 'style': 'margin-top: .85rem;' }, [
			mainCard,
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

function renderPage() {
	omniaMotion.inject();

	return E('div', { 'id': 'omnia-selectors-root', 'class': 'cbi-map' }, [
		omniaUi.pageHeader(
			_('分流策略'),
			_('配置全局根主池及各业务分流组（Selector）的出站成员分配。可指定地区节点测速组、直连或主池兜底，支持 🔍 弹窗预览生成功效。')
		),
		selectorAllocatorSection(),
		selectorPreviewModal()
	]);
}

return view.extend({
	load: function() {
		return callTemplateSelectorsGet().catch(function() { return {}; });
	},

	render: function(result) {
		selectorsResult = result || {};
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
