/**
 * Omnia | convert/operators/engine.uc
 * Ordered Operator Pipeline Engine for proxy subscriptions.
 *
 * Supported Operators:
 * 1. regex_filter: Filter nodes by name using POSIX ERE pattern (with inverse support).
 * 2. type_filter: Filter nodes by protocol type.
 * 3. conditional_filter: Filter by arbitrary node fields (EQUALS, CONTAINS, IN, EXISTS).
 * 4. regex_rename: Search and replace or delete matching substrings in node names.
 * 5. quick_setting: Batch modify attributes (udp, skip_cert_verify, etc.).
 * 6. handle_duplicate: Deduplicate by deleting duplicate items or renaming them with index.
 * 7. sort: Sort nodes by alphabetical name or regional keyword priority list.
 * 8. flag: Add or remove national flag emojis.
 */

'use strict';

import { trim } from 'omnia.convert.utils';
import { add_flag_to_name, remove_flag_from_name } from 'omnia.convert.operators.flags';

/**
 * Safely converts string or regex pattern to a ucode regexp object.
 */
function to_regexp(pattern) {
	if (type(pattern) == 'regexp')
		return pattern;
	if (type(pattern) != 'string' || pattern == '')
		return null;

	if (substr(pattern, 0, 1) == '/') {
		let len = length(pattern);
		let last_slash = -1;
		for (let i = len - 1; i > 0; i--) {
			if (substr(pattern, i, 1) == '/') {
				last_slash = i;
				break;
			}
		}
		if (last_slash > 0) {
			let p_str = substr(pattern, 1, last_slash - 1);
			let flags = substr(pattern, last_slash + 1);
			try {
				return regexp(p_str, flags);
			} catch (e) {}
		}
	}

	try {
		return regexp(pattern);
	} catch (e) {
		return null;
	}
}

/**
 * Regex Filter Operator
 */
function op_regex_filter(nodes, op) {
	let re = to_regexp(op.pattern);
	if (re == null)
		return nodes;

	let inverse = op.inverse == true;
	let result = [];

	for (let node in nodes) {
		let name = type(node.name) == 'string' ? node.name : '';
		let is_match = match(name, re) != null;
		if ((is_match && !inverse) || (!is_match && inverse)) {
			push(result, node);
		}
	}
	return result;
}

/**
 * Type Filter Operator
 */
function op_type_filter(nodes, op) {
	let target_types = {};
	if (type(op.types) == 'array') {
		for (let t in op.types) {
			target_types[lc(trim(t))] = true;
		}
	}
	let inverse = op.inverse == true;
	let result = [];

	for (let node in nodes) {
		let proto = lc(type(node.type) == 'string' ? node.type : '');
		let in_list = target_types[proto] == true;
		if ((in_list && !inverse) || (!in_list && inverse)) {
			push(result, node);
		}
	}
	return result;
}

/**
 * Evaluates a single condition against a node object.
 */
function eval_single_condition(node, cond) {
	let field = cond.field;
	let op = cond.op || 'EQUALS';
	let expected = cond.value;
	let actual = node[field];

	if (op == 'EXISTS') {
		return actual != null && actual != '';
	}
	if (op == 'NOT_EXISTS') {
		return actual == null || actual == '';
	}
	if (op == 'EQUALS') {
		return "" + actual == "" + expected;
	}
	if (op == 'NOT_EQUALS') {
		return "" + actual != "" + expected;
	}
	if (op == 'CONTAINS') {
		return type(actual) == 'string' && index(actual, "" + expected) >= 0;
	}
	if (op == 'NOT_CONTAINS') {
		return type(actual) != 'string' || index(actual, "" + expected) < 0;
	}
	if (op == 'IN') {
		if (type(expected) == 'array') {
			for (let v in expected) {
				if ("" + actual == "" + v) return true;
			}
			return false;
		}
		return false;
	}

	return false;
}

/**
 * Conditional Filter Operator
 */
function op_conditional_filter(nodes, op) {
	let conditions = type(op.conditions) == 'array' ? op.conditions : [];
	if (length(conditions) == 0)
		return nodes;

	let logic = op.logic || 'AND';
	let inverse = op.inverse == true;
	let result = [];

	for (let node in nodes) {
		let passed = logic == 'AND';
		for (let cond in conditions) {
			let cond_res = eval_single_condition(node, cond);
			if (logic == 'AND') {
				if (!cond_res) {
					passed = false;
					break;
				}
			} else { // OR
				if (cond_res) {
					passed = true;
					break;
				}
			}
		}

		if ((passed && !inverse) || (!passed && inverse)) {
			push(result, node);
		}
	}
	return result;
}

/**
 * Regex Rename / Delete Operator
 */
function op_regex_rename(nodes, op) {
	let pattern = op.pattern;
	let replacement = op.replacement != null ? op.replacement : '';
	if (pattern == null || pattern == '')
		return nodes;

	let re = to_regexp(pattern);
	let matcher = re != null ? re : pattern;

	for (let node in nodes) {
		let name = type(node.name) == 'string' ? node.name : '';
		let new_name = replace(name, matcher, replacement);
		node.name = new_name;
		node.tag = new_name;
	}
	return nodes;
}

/**
 * Quick Setting Operator
 */
function op_quick_setting(nodes, op) {
	for (let node in nodes) {
		if (op.udp != null)
			node.udp = op.udp == true;
		if (op.skip_cert_verify != null)
			node.skip_cert_verify = op.skip_cert_verify == true;
		if (op.tls != null)
			node.tls = op.tls == true;
	}
	return nodes;
}

/**
 * Handle Duplicate Operator (delete duplicate items or rename them)
 */
function op_handle_duplicate(nodes, op) {
	let action = op.action || 'rename';
	let seen = {};
	let result = [];

	for (let node in nodes) {
		let key = type(node.name) == 'string' && node.name != '' ? node.name : (node.type + ':' + node.server + ':' + node.port);
		if (!seen[key]) {
			seen[key] = 1;
			push(result, node);
		} else {
			let count = seen[key];
			seen[key] = count + 1;
			if (action == 'delete') {
				// Drop duplicate
				continue;
			} else {
				// Rename duplicate
				let new_name = key + ' #' + count;
				node.name = new_name;
				node.tag = new_name;
				push(result, node);
			}
		}
	}
	return result;
}

/**
 * Sort Operator (alphabetical name sort or regional keywords priority sort)
 */
function op_sort(nodes, op) {
	let mode = op.mode || 'name';
	let order = op.order || 'asc';
	let keywords = type(op.keywords) == 'array' ? op.keywords : [];

	let count = length(nodes);
	if (count <= 1)
		return nodes;

	// Calculate sorting weight for each node
	for (let node in nodes) {
		let name = type(node.name) == 'string' ? node.name : '';
		if (mode == 'keywords' && length(keywords) > 0) {
			let weight = 999999;
			let lower_name = lc(name);
			for (let idx = 0; idx < length(keywords); idx++) {
				let kw = lc(trim(keywords[idx]));
				if (kw != '' && index(lower_name, kw) >= 0) {
					weight = idx;
					break;
				}
			}
			node._sort_weight = weight;
		} else {
			node._sort_weight = name;
		}
	}

	// Simple stable insertion sort
	for (let i = 1; i < count; i++) {
		let current = nodes[i];
		let j = i - 1;
		while (j >= 0) {
			let prev = nodes[j];
			let cmp = 0;
			if (mode == 'keywords') {
				if (prev._sort_weight < current._sort_weight) cmp = -1;
				else if (prev._sort_weight > current._sort_weight) cmp = 1;
				else cmp = prev.name < current.name ? -1 : (prev.name > current.name ? 1 : 0);
			} else {
				cmp = prev._sort_weight < current._sort_weight ? -1 : (prev._sort_weight > current._sort_weight ? 1 : 0);
			}

			if ((order == 'asc' && cmp > 0) || (order == 'desc' && cmp < 0)) {
				nodes[j + 1] = nodes[j];
				j--;
			} else {
				break;
			}
		}
		nodes[j + 1] = current;
	}

	// Clean up internal sort weight
	for (let node in nodes) {
		delete node._sort_weight;
	}

	return nodes;
}

/**
 * Flag Operator
 */
function op_flag(nodes, op) {
	let action = op.action || 'add';

	for (let node in nodes) {
		let name = type(node.name) == 'string' ? node.name : '';
		let new_name = action == 'remove' ? remove_flag_from_name(name) : add_flag_to_name(name);
		node.name = new_name;
		node.tag = new_name;
	}
	return nodes;
}

/**
 * Master operator execution function.
 * Evaluates an ordered list of operators on Unified IR nodes.
 * @param {array} ir_nodes - Input Unified IR nodes
 * @param {array} operator_list - Ordered list of operator configurations
 * @returns {array} Transformed Unified IR nodes
 */
function apply_operators(ir_nodes, operator_list) {
	if (type(ir_nodes) != 'array' || length(ir_nodes) == 0)
		return [];
	if (type(operator_list) != 'array' || length(operator_list) == 0)
		return ir_nodes;

	let current_nodes = ir_nodes;

	for (let op in operator_list) {
		if (type(op) != 'object' || op == null)
			continue;
		if (op.enabled == false)
			continue;

		let op_type = op.type;
		if (op_type == 'regex_filter') {
			current_nodes = op_regex_filter(current_nodes, op);
		} else if (op_type == 'type_filter') {
			current_nodes = op_type_filter(current_nodes, op);
		} else if (op_type == 'conditional_filter') {
			current_nodes = op_conditional_filter(current_nodes, op);
		} else if (op_type == 'regex_rename') {
			current_nodes = op_regex_rename(current_nodes, op);
		} else if (op_type == 'quick_setting') {
			current_nodes = op_quick_setting(current_nodes, op);
		} else if (op_type == 'handle_duplicate') {
			current_nodes = op_handle_duplicate(current_nodes, op);
		} else if (op_type == 'sort') {
			current_nodes = op_sort(current_nodes, op);
		} else if (op_type == 'flag') {
			current_nodes = op_flag(current_nodes, op);
		}
	}

	return current_nodes;
}

export {
	apply_operators,
	op_regex_filter,
	op_type_filter,
	op_conditional_filter,
	op_regex_rename,
	op_quick_setting,
	op_handle_duplicate,
	op_sort,
	op_flag
};
