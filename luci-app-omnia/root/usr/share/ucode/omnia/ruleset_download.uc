/**
 * Omnia | ruleset_download.uc | v1.0
 */

'use strict';

import { mkdir, readfile, stat, unlink } from 'fs';
import { PATH } from 'omnia.core.constants';
import { file_exists } from 'omnia.core.utils';
import { fetch_file } from 'omnia.resource_fetch';
import { resource_promote_file } from 'omnia.core.resource';

function append_unique(list, value) {
	if (type(value) != "string" || value == "")
		return;

	for (let item in list) {
		if (item == value)
			return;
	}

	push(list, value);
}

function ensure_rule_dirs() {
	if (!file_exists(PATH.RULE_DIR) && !mkdir(PATH.RULE_DIR, 0700))
		die("Failed to create " + PATH.RULE_DIR);
	let tmp_dir = PATH.RULE_DIR + "/.tmp";
	if (!file_exists(PATH.RUN_DIR) && !mkdir(PATH.RUN_DIR, 0700))
		die("Failed to create " + PATH.RUN_DIR);
	if (!file_exists(tmp_dir) && !mkdir(tmp_dir, 0700))
		die("Failed to create " + tmp_dir);
}

function ruleset_urls(entry) {
	let urls = [];
	append_unique(urls, entry.source_url);
	return urls;
}

function direct_fetch_rule(trace_id, url, tmp_path, strategy) {
	unlink(tmp_path);
	strategy = strategy == "proxy" ? "proxy" : "direct";
	let result = fetch_file(trace_id, url, tmp_path, strategy, { timeout_sec: 15, min_bytes: 20 });
	if (!result.ok) {
		unlink(tmp_path);
		return {
			ok: false,
			error: "fetch failed: strategy=" + strategy + " " + result.error + " exit=" + result.exit_code + " stderr=" + result.stderr
		};
	}

	let info = stat(tmp_path);
	if (type(info) != "object" || info == null || info.size <= 0) {
		unlink(tmp_path);
		return {
			ok: false,
			error: "Downloaded file is empty or too small"
		};
	}

	return {
		ok: true,
		size: info.size || 0
	};
}

function same_file_content(left_path, right_path) {
	let left = readfile(left_path);
	let right = readfile(right_path);
	return left != null && right != null && left == right;
}

function atomic_swap_rule(tmp_path, final_path) {
	return resource_promote_file(tmp_path, final_path, {
		stage_suffix: ".stage",
		backup_suffix: ".bak",
		stage_error: "Failed to stage rule file: ",
		backup_error: "Failed to backup rule file: ",
		promote_error: "Failed to deploy rule file: "
	});
}

export { ensure_rule_dirs, ruleset_urls, direct_fetch_rule, same_file_content, atomic_swap_rule };
