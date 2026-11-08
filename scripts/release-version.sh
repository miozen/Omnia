#!/usr/bin/env bash
set -euo pipefail

requested="${1:-}"
stable_pattern='^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
tags="$(git tag --list 'v*')"
latest="$(printf '%s\n' "$tags" | grep -E "$stable_pattern" | sort -V | tail -n 1 || true)"

if [ -n "$requested" ]; then
	version="${requested#v}"
	if ! [[ "v$version" =~ $stable_pattern ]]; then
		echo 'Version must be a stable semantic version such as 2.0.0' >&2
		exit 1
	fi
	if [ -n "$latest" ] && [ "$(printf '%s\n%s\n' "$latest" "v$version" | sort -V | tail -n 1)" != "v$version" ]; then
		echo "Version must be newer than $latest" >&2
		exit 1
	fi
	if git rev-parse --verify --quiet "refs/tags/v$version" >/dev/null; then
		echo "Tag v$version already exists" >&2
		exit 1
	fi
else
	if git tag --points-at HEAD | grep -Eq "$stable_pattern"; then
		echo 'This commit already has a release tag; use an explicit version if needed' >&2
		exit 1
	fi
	if [ -z "$latest" ]; then
		version='0.1.0'
	else
		IFS=. read -r major minor patch <<< "${latest#v}"
		version="$major.$minor.$((patch + 1))"
	fi
fi

printf '%s\n' "$version"
