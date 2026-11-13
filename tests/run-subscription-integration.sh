#!/usr/bin/env bash
set -e
export PATH="/home/mio/.nvm/versions/node/v22.23.4/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

node /home/mio/projects/Omnia/tests/subscription-fixture.cjs &
FIXTURE_PID=$!

cleanup() {
    kill -9 "$FIXTURE_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

sleep 1

docker run --rm --net=host -v /home/mio/projects/Omnia:/work openwrt/rootfs:latest sh -c '
mkdir -p /etc/omnia /var/run/omnia/locks /var/run/omnia/tasks
ucode -L /work/luci-app-omnia/root/usr/share/ucode /work/tests/subscription-refresh-integration.uc
'
echo "ALL_INTEGRATION_PASSED"
