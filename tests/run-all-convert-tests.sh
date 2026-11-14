#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== Running M1 & M2 Pure-Function & Integration Tests ==="

docker run --rm -v "${ROOT_DIR}:/work" openwrt/rootfs:latest sh -c '
set -e
mkdir -p /var/run/omnia /tmp/run

echo "1. Step 1 base & IR..."
ucode -L /work/luci-app-omnia/root/usr/share/ucode /work/tests/convert-step1.uc

echo "2. Step 2 URI parser..."
ucode -L /work/luci-app-omnia/root/usr/share/ucode /work/tests/convert-step2-uri.uc

echo "3. Step 3 sing-box JSON parser..."
ucode -L /work/luci-app-omnia/root/usr/share/ucode /work/tests/convert-step3-singbox.uc

echo "4. Step 4 sing-box producer..."
ucode -L /work/luci-app-omnia/root/usr/share/ucode /work/tests/convert-step4-producer.uc

echo "5. Step 5 pipeline..."
ucode -L /work/luci-app-omnia/root/usr/share/ucode /work/tests/convert-step5-pipeline.uc

echo "6. Step 6-7 snapshot integration..."
ucode -L /work/luci-app-omnia/root/usr/share/ucode /work/tests/convert-step6-7-integration.uc

echo "7. M1 fallback & security regression..."
ucode -L /work/luci-app-omnia/root/usr/share/ucode /work/tests/subscription-fallback-security.uc

echo "8. M2 Clash YAML parser..."
ucode -L /work/luci-app-omnia/root/usr/share/ucode /work/tests/convert-step-m2-clash.uc

echo "9. M2 Ordered operators pipeline..."
ucode -L /work/luci-app-omnia/root/usr/share/ucode /work/tests/convert-step-m2-operators.uc

echo "10. M2 Traffic & expiration headers..."
ucode -L /work/luci-app-omnia/root/usr/share/ucode /work/tests/convert-step-m2-traffic.uc

echo "11. M2 Integration & cross-format consistency..."
ucode -L /work/luci-app-omnia/root/usr/share/ucode /work/tests/convert-step-m2-integration.uc

echo "12. M3 Declarative dedicated DNS..."
ucode -L /work/luci-app-omnia/root/usr/share/ucode /work/tests/generator-dedicated-dns.uc

echo "13. M4 Local nodes & sandboxed ucode scripts..."
ucode -L /work/luci-app-omnia/root/usr/share/ucode /work/tests/convert-step-m4-local-and-script.uc

echo "14. Compiling all ucode modules (-c,module)..."
find /work/luci-app-omnia/root/usr/share/ucode -type f -name "*.uc" | while read -r f; do
	ucode -L /work/luci-app-omnia/root/usr/share/ucode -c,module -o /tmp/check "$f" || exit 1
done

echo "=== All 13 Unit/Integration Tests & Module Compilation Passed! ==="
'
