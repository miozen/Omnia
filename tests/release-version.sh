#!/usr/bin/env bash
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT
git -C "$temp_dir" init -q
git -C "$temp_dir" -c user.name=Test -c user.email=test@example.invalid commit -q --allow-empty -m initial
cd "$temp_dir"
version() { bash "$repo/scripts/release-version.sh" "$@"; }
expect_failure() { if version "$@" >/dev/null 2>&1; then echo "Expected version selection to fail: $*" >&2; exit 1; fi; }
[ "$(version)" = '0.1.0' ]
[ "$(version 2.0.0)" = '2.0.0' ]
expect_failure 01.0.0
git tag v0.1.0
expect_failure
expect_failure 0.1.0
expect_failure 0.0.9
git -c user.name=Test -c user.email=test@example.invalid commit -q --allow-empty -m next
[ "$(version)" = '0.1.1' ]
git tag v0.9.9
git tag v0.10.0
git -c user.name=Test -c user.email=test@example.invalid commit -q --allow-empty -m next
[ "$(version)" = '0.10.1' ]
[ "$(version v1.0.0)" = '1.0.0' ]
expect_failure 0.9.99
echo 'release version selection OK'
