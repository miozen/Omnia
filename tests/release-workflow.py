#!/usr/bin/env python3
from pathlib import Path
import yaml

root = Path(__file__).resolve().parent.parent
with (root / '.github/workflows/build-ipk.yml').open() as stream:
    verify = yaml.load(stream, Loader=yaml.BaseLoader)
with (root / '.github/workflows/release.yml').open() as stream:
    release = yaml.load(stream, Loader=yaml.BaseLoader)

assert 'push' not in verify['on']
assert verify['on']['pull_request']['branches'] == ['master']
assert 'workflow_dispatch' in verify['on']
assert release['on']['pull_request']['types'] == ['closed']
assert release['on']['pull_request']['branches'] == ['master']
assert 'workflow_dispatch' in release['on'] and 'push' not in release['on']
condition = release['jobs']['release']['if']
assert 'merged == true' in condition and '[manual-release]' in condition
print('release workflow triggers OK')
