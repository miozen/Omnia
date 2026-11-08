#!/usr/bin/env python3

"""Validate sing-box portions of Omnia profile templates against their schema."""

import json
import sys
from pathlib import Path
from urllib.request import urlopen

from jsonschema import Draft202012Validator


OFFICIAL_SCHEMA_URL = "https://sing-box.sagernet.org/schema.json"


def strip_omnia_extensions(value):
    if isinstance(value, list):
        return [strip_omnia_extensions(item) for item in value]
    if not isinstance(value, dict):
        return value
    return {
        key: strip_omnia_extensions(item)
        for key, item in value.items()
        if not key.startswith("x_")
    }


def load_schema():
    with urlopen(OFFICIAL_SCHEMA_URL, timeout=20) as response:
        return json.load(response)


def validate_profile(path, validator):
    profile = json.loads(path.read_text(encoding="utf-8"))
    if profile.get("$schema") != OFFICIAL_SCHEMA_URL:
        raise ValueError(f"{path} must declare {OFFICIAL_SCHEMA_URL}")
    validator.validate(strip_omnia_extensions(profile))


def main():
    schema = load_schema()
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema)
    for raw_path in sys.argv[1:]:
        validate_profile(Path(raw_path), validator)


if __name__ == "__main__":
    main()
