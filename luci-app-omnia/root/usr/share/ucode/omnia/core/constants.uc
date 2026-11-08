/**
 * Omnia | core/constants.uc | v1.0
 */

'use strict';

const PATH = {
	PROFILE: "/etc/omnia/main-profile.json",
	PROFILE_BAK: "/etc/omnia/main-profile.json.bak",
	PROFILE_DEFAULT: "/usr/share/omnia/profiles/main-profile.json",
	PROFILE_SOURCE: "/etc/omnia/profile-source.json",
	NOTIFY: "/etc/omnia/notify.json",
	NOTIFY_STATE: "/var/run/omnia/notify.state.json",
	DASHBOARD_SOURCE: "/etc/omnia/dashboard.json",
	DASHBOARD_DIR: "/www/omnia/dashboard",
	SUBSCRIPTIONS: "/etc/omnia/subscriptions.json",
	RULESET_POLICY: "/etc/omnia/ruleset-policy.json",
	NODE_SNAPSHOT: "/etc/omnia/node-snapshot.json",
	RUNTIME_CONFIG: "/etc/omnia/runtime/config.json",
	RUNTIME_CONFIG_BAK: "/etc/omnia/runtime/config.json.bak",
	CANDIDATE_CONFIG: "/var/run/omnia/config.candidate.json",
	RUNTIME_STATE: "/var/run/omnia/runtime.state.json",
	AUTO_TASK_SCRIPT: "/usr/libexec/omnia-auto-task",
	CRON_ROOT: "/etc/crontabs/root",
	TASK_DIR: "/var/run/omnia/tasks",
	RUNNER_DIR: "/var/run/omnia/runner",
	AUTO_APPLY_STATE: "/var/run/omnia/auto-apply.state.json",
	SCHEDULER_DIR: "/var/run/omnia/scheduler",
	SCHEDULER_STATE: "/var/run/omnia/scheduler/state.json",
	LAST_APPLY_RESULT: "/var/run/omnia/last-apply-result",
	LAST_ERROR: "/var/run/omnia/last-error.log",
	RULE_DIR: "/etc/omnia/rules",
	RULE_DEFAULT_DIR: "/usr/share/omnia/rules",
	RUN_DIR: "/var/run/omnia",
	LOCK_DIR: "/var/run/omnia/locks"
};

const BIN = {
	SING_BOX: "sing-box",
	INIT: "/etc/init.d/omnia",
	TIMEOUT: "timeout",
	WGET: "wget"
};

const CLASH_API = {
	DEFAULT_EXTERNAL_CONTROLLER: "0.0.0.0:20123"
};

const CONTROL_PLANE_PROXY = {
	TAG: "omnia-control-proxy",
	LISTEN: "127.0.0.1",
	PORT: 20124,
	URL: "http://127.0.0.1:20124"
};

const AUTO_TASK = {
	CRON_ENTRY: "5 * * * * /usr/libexec/omnia-auto-task >/dev/null 2>&1"
};

export { PATH, BIN, CLASH_API, CONTROL_PLANE_PROXY, AUTO_TASK };
