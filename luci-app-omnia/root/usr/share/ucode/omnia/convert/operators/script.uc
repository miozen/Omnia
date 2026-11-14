/**
 * Omnia | convert/operators/script.uc
 * Sandboxed ucode script engine for node manipulation.
 *
 * Supports:
 * - Batch mode ("batch"): function(nodes, context, utils) -> returns nodes array
 * - Single node mode ("single"): function(node, context, utils) -> returns modified node or null/false
 */

'use strict';

import { add_flag_to_name, remove_flag_from_name, detect_flag_for_name } from 'omnia.convert.operators.flags';
import { trim } from 'omnia.convert.utils';

function is_ipv4(host) {
	if (type(host) != 'string')
		return false;
	let parts = split(host, '.');
	if (length(parts) != 4)
		return false;
	for (let part in parts) {
		let num = int(part);
		if (num < 0 || num > 255)
			return false;
		if (part != '' + num)
			return false;
	}
	return true;
}

function is_ipv6(host) {
	if (type(host) != 'string')
		return false;
	return index(host, ':') >= 0;
}

function is_ip(host) {
	return is_ipv4(host) || is_ipv6(host);
}

function create_script_utils() {
	return {
		flags: {
			add: add_flag_to_name,
			remove: remove_flag_from_name,
			get: detect_flag_for_name
		},
		is_ip: is_ip,
		is_ipv4: is_ipv4,
		is_ipv6: is_ipv6,
		trim: trim,
		starts_with: function(str, prefix) {
			if (type(str) != 'string' || type(prefix) != 'string') return false;
			return index(str, prefix) == 0;
		},
		ends_with: function(str, suffix) {
			if (type(str) != 'string' || type(suffix) != 'string') return false;
			let idx = length(str) - length(suffix);
			return idx >= 0 && substr(str, idx) == suffix;
		},
		match: function(str, re_pattern) {
			if (type(str) != 'string') return null;
			let r = type(re_pattern) == 'regexp' ? re_pattern : regexp(re_pattern);
			return match(str, r);
		},
		replace: function(str, re_pattern, repl) {
			if (type(str) != 'string') return '';
			let r = type(re_pattern) == 'regexp' ? re_pattern : regexp(re_pattern);
			return replace(str, r, repl);
		}
	};
}

function execute_script_operator(nodes, op) {
	if (type(op) != 'object' || op == null)
		return nodes;

	let script_code = type(op.script) == 'string' ? trim(op.script) : '';
	if (script_code == '')
		return nodes;

	let mode = type(op.mode) == 'string' && lc(op.mode) == 'single' ? 'single' : 'batch';
	let params = type(op.params) == 'object' && op.params != null ? op.params : {};
	let context = {
		params: params,
		mode: mode,
		total_nodes: length(nodes)
	};
	let utils = create_script_utils();

	let wrapped = '';
	if (mode == 'single') {
		wrapped = 'return function(node, context, utils) {\n' + script_code + '\n};';
	} else {
		wrapped = 'return function(nodes, context, utils) {\n' + script_code + '\n};';
	}

	let chunk = null;
	try {
		chunk = loadstring(wrapped);
	} catch (e) {
		die('Script compilation error (' + mode + '): ' + e);
	}

	if (type(chunk) != 'function')
		die('Script failed to compile into a function (' + mode + ')');

	let script_fn = null;
	try {
		script_fn = chunk();
	} catch (e) {
		die('Script initialization error (' + mode + '): ' + e);
	}

	if (type(script_fn) != 'function')
		die('Script chunk must return a function');

	if (mode == 'single') {
		let result = [];
		for (let i = 0; i < length(nodes); i++) {
			let node = nodes[i];
			context.index = i;
			let res = null;
			try {
				res = script_fn(node, context, utils);
			} catch (e) {
				die('Script runtime error in single mode on node ' + (node.name || i) + ': ' + e);
			}
			if (type(res) == 'object' && res != null) {
				push(result, res);
			}
			// If null, false, or undefined: node filtered out
		}
		return result;
	} else {
		let res = null;
		try {
			res = script_fn(nodes, context, utils);
		} catch (e) {
			die('Script runtime error in batch mode: ' + e);
		}
		if (type(res) != 'array')
			die('Script in batch mode must return an array of nodes, got ' + type(res));
		return res;
	}
}

export {
	execute_script_operator,
	create_script_utils,
	is_ip,
	is_ipv4,
	is_ipv6
};
