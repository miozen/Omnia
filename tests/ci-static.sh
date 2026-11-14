#!/usr/bin/env bash

set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
	if [ -d "${HOME}/.nvm/versions/node" ]; then
		NVM_NODE="$(find "${HOME}/.nvm/versions/node" -maxdepth 2 -type d -name bin 2>/dev/null | sort -V | tail -n 1)"
		if [ -n "$NVM_NODE" ]; then
			export PATH="$NVM_NODE:$PATH"
		fi
	fi
fi

if git rev-parse --verify HEAD^ >/dev/null 2>&1; then
	git diff --check HEAD^ HEAD
fi

jq empty luci-app-omnia/root/usr/share/rpcd/acl.d/luci-app-omnia.json
jq empty luci-app-omnia/root/usr/share/omnia/defaults/dashboard.json
jq empty luci-app-omnia/root/usr/share/omnia/defaults/ruleset-policy.json

if ! cmp -s profiles/main-profile.json luci-app-omnia/root/usr/share/omnia/profiles/main-profile.json; then
	echo 'The development Profile and packaged default Profile must be identical' >&2
	exit 1
fi

for profile in profiles/main-profile.json luci-app-omnia/root/usr/share/omnia/profiles/main-profile.json; do
	jq empty "$profile"
	JQ_SCHEMA=$(jq -r '."$schema" // empty' "$profile")
	if [ "$JQ_SCHEMA" != 'https://sing-box.sagernet.org/schema.json' ]; then
		echo "$profile must declare the official sing-box JSON Schema" >&2
		exit 1
	fi
	if jq -e '.inbounds[]? | select(.type == "tun") | has("stack")' "$profile" >/dev/null; then
		echo "$profile must not retain the deprecated TUN stack field" >&2
		exit 1
	fi
done

if [ "$(jq -r '.mode // empty' luci-app-omnia/root/usr/share/omnia/defaults/ruleset-policy.json)" != 'auto' ]; then
	echo 'The default Rule Set policy must retain auto mode' >&2
	exit 1
fi

if rg -q 'validate_tun_contract|tun\.stack|auto_detect_interface must be true' luci-app-omnia/root/usr/share/ucode/omnia/generator_validate.uc; then
	echo 'The runtime contract must not validate sing-box version-specific TUN fields' >&2
	exit 1
fi

python3 tests/validate-profile-schema.py \
	profiles/main-profile.json \
	luci-app-omnia/root/usr/share/omnia/profiles/main-profile.json

python3 - <<'PY'
import pathlib
import yaml

for path in pathlib.Path('.github/workflows').glob('*.yml'):
    yaml.safe_load(path.read_text(encoding='utf-8'))
PY

while IFS= read -r -d '' file; do
	node --check "$file"
done < <(find luci-app-omnia/htdocs -type f -name '*.js' -print0)

node tests/panel-behavior.cjs
node tests/subscription-ui.cjs
bash tests/release-version.sh
python3 tests/release-workflow.py
