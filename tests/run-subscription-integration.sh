#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v node >/dev/null 2>&1; then
	if [ -d "$HOME/.nvm/versions/node" ]; then
		NVM_NODE="$(find "$HOME/.nvm/versions/node" -maxdepth 2 -type d -name bin 2>/dev/null | sort -V | tail -n 1)"
		if [ -n "$NVM_NODE" ]; then
			export PATH="$NVM_NODE:$PATH"
		fi
	fi
fi

node "${ROOT_DIR}/tests/subscription-fixture.cjs" &
FIXTURE_PID=$!

cleanup() {
	kill -9 "$FIXTURE_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

sleep 1

docker run --rm --net=host -v "${ROOT_DIR}:/work" openwrt/rootfs:latest sh -c '
mkdir -p /etc/omnia /var/run/omnia/locks /var/run/omnia/tasks
ucode -L /work/luci-app-omnia/root/usr/share/ucode /work/tests/subscription-refresh-integration.uc
'
echo "ALL_INTEGRATION_PASSED"
