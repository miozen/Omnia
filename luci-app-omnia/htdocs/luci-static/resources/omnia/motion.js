'use strict';
'require baseclass';

const STYLE_ID = 'omnia-motion-style';

function joinClass() {
	let result = [];

	for (let i = 0; i < arguments.length; i++) {
		let value = arguments[i];
		if (typeof value !== 'string' || value === '')
			continue;
		result.push(value);
	}

	return result.join(' ');
}

function inject() {
	if (document.getElementById(STYLE_ID))
		return;

	const style = document.createElement('style');
	style.id = STYLE_ID;
	style.textContent = [
		'.omnia-motion-card {',
		'  transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease, background .16s ease, filter .16s ease;',
		'  will-change: transform;',
		'}',
		'.omnia-motion-card:hover {',
		'  transform: translateY(-2px);',
		'  border-color: #cbd5e1;',
		'  box-shadow: 0 10px 22px rgba(15, 23, 42, .08);',
		'  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);',
		'}',
		'.omnia-motion-card:active {',
		'  transform: translateY(0);',
		'  box-shadow: 0 4px 10px rgba(15, 23, 42, .06);',
		'}',
		'.omnia-motion-button {',
		'  transition: transform .16s ease, box-shadow .16s ease, filter .16s ease;',
		'}',
		'.omnia-motion-button:hover {',
		'  transform: translateY(-2px);',
		'  box-shadow: 0 8px 18px rgba(15, 23, 42, .14);',
		'  filter: brightness(1.03);',
		'}',
		'.omnia-motion-button:active {',
		'  transform: translateY(0);',
		'  box-shadow: 0 3px 8px rgba(15, 23, 42, .10);',
		'}',
		'.omnia-motion-row {',
		'  transition: background .16s ease, border-color .16s ease;',
		'}',
		'.omnia-motion-row:hover {',
		'  background: #f8fafc;',
		'  border-color: #dfe3e8;',
		'}',
		'.omnia-motion-icon-button {',
		'  transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease, background .16s ease, color .16s ease;',
		'}',
		'.omnia-motion-icon-button:hover {',
		'  transform: translateY(-1px);',
		'  border-color: #bfdbfe;',
		'  background: #eff6ff;',
		'  color: #1d4ed8;',
		'  box-shadow: 0 6px 14px rgba(37, 99, 235, .12);',
		'}',
		'.omnia-motion-icon-button:active {',
		'  transform: translateY(0);',
		'  box-shadow: none;',
		'}',
		'.omnia-motion-card-clickable:focus-visible, .omnia-motion-button:focus-visible, .omnia-motion-row:focus-visible, .omnia-motion-icon-button:focus-visible {',
		'  outline: 2px solid #5b6ee1;',
		'  outline-offset: 2px;',
		'}',
		'@media (prefers-reduced-motion: reduce) {',
		'  .omnia-motion-card, .omnia-motion-button, .omnia-motion-row, .omnia-motion-icon-button {',
		'    transition: none;',
		'    will-change: auto;',
		'  }',
		'  .omnia-motion-card:hover, .omnia-motion-card:active, .omnia-motion-button:hover, .omnia-motion-button:active, .omnia-motion-icon-button:hover, .omnia-motion-icon-button:active {',
		'    transform: none;',
		'  }',
		'}'
	].join('\n');

	document.head.appendChild(style);
}

function cardClass(extra, clickable) {
	return joinClass('omnia-motion-card', clickable ? 'omnia-motion-card-clickable' : '', extra || '');
}

function buttonClass(extra) {
	return joinClass('omnia-motion-button', extra || '');
}

function softRowClass(extra) {
	return joinClass('omnia-motion-row', extra || '');
}

function iconButtonClass(extra) {
	return joinClass('omnia-motion-icon-button', extra || '');
}

return baseclass.extend({
	inject: inject,
	cardClass: cardClass,
	buttonClass: buttonClass,
	softRowClass: softRowClass,
	iconButtonClass: iconButtonClass
});
