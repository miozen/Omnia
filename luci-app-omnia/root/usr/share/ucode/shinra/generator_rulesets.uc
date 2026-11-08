/**
 * Omnia | generator_rulesets.uc | v1.0
 */

'use strict';

import { stat } from 'fs';
import { PATH } from 'shinra.core.constants';

function local_ruleset_path(tag) {
	return PATH.RULE_DIR + "/" + tag + ".srs";
}

function local_ruleset_exists(tag) {
	let info = stat(local_ruleset_path(tag));
	return type(info) == "object" && info != null && info.size > 0;
}

function local_ruleset_entry(tag, original) {
	let format = "binary";
	if (type(original.format) == "string" && original.format != "")
		format = original.format;

	return {
		type: "local",
		tag: tag,
		format: format,
		path: local_ruleset_path(tag)
	};
}

function ruleset_tags(entry) {
	if (type(entry.tag) == "string" && entry.tag != "")
		return [ entry.tag ];
	if (type(entry.tag) != "array")
		return [];

	let tags = [];
	for (let tag in entry.tag) {
		if (type(tag) != "string" || tag == "")
			die("Rule Set tag array must contain non-empty strings");
		push(tags, tag);
	}
	if (length(tags) == 0)
		die("Rule Set tag array must not be empty");
	return tags;
}

function local_ruleset_group(tags, original) {
	if (length(tags) == 1)
		return local_ruleset_entry(tags[0], original);

	let format = "binary";
	if (type(original.format) == "string" && original.format != "")
		format = original.format;

	return {
		type: "local",
		tag: tags,
		format: format,
		path: PATH.RULE_DIR + "/{tag}.srs"
	};
}

function localize_rulesets(profile, ruleset_policy) {
	let mode = "auto";
	if (type(ruleset_policy) == "object" && ruleset_policy != null && type(ruleset_policy.mode) == "string" && ruleset_policy.mode != "")
		mode = ruleset_policy.mode;

	let result = {
		mode: mode,
		total: 0,
		localized: 0,
		preserved_remote: 0,
		missing: 0
	};

	if (mode != "remote" && mode != "auto" && mode != "local")
		die("Unsupported Rule Set mode: " + mode);

	if (type(profile.route) != "object" || profile.route == null || type(profile.route.rule_set) != "array")
		return result;

	let next = [];
	for (let entry in profile.route.rule_set) {
		if (type(entry) != "object" || entry == null || type(entry) == "array") {
			push(next, entry);
			continue;
		}

		let tags = ruleset_tags(entry);
		if (length(tags) == 0) {
			push(next, entry);
			continue;
		}
		/* Only remote declarations have a Omnia-managed downloadable local form. */
		if (entry.type != "remote") {
			push(next, entry);
			continue;
		}

		result.total = result.total + length(tags);
		if (mode == "remote") {
			push(next, entry);
			if (entry.type == "remote")
				result.preserved_remote = result.preserved_remote + length(tags);
			continue;
		}

		let missing = [];
		for (let tag in tags) {
			if (!local_ruleset_exists(tag))
				push(missing, tag);
		}

		if (length(missing) == 0) {
			push(next, local_ruleset_group(tags, entry));
			result.localized = result.localized + length(tags);
			continue;
		}

		result.missing = result.missing + length(missing);
		if (mode == "local")
			die("Required local Rule Set missing: " + missing[0] + " -> " + local_ruleset_path(missing[0]));

		push(next, entry);
		if (entry.type == "remote")
			result.preserved_remote = result.preserved_remote + length(tags);
	}

	profile.route.rule_set = next;
	return result;
}

export { local_ruleset_path, local_ruleset_exists, local_ruleset_entry, localize_rulesets };
