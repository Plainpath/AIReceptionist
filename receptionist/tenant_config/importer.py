# receptionist/tenant_config/importer.py
"""Turn a tenant YAML file into the document the platform stores.

The stored document is the parsed YAML with ${ENV_VAR} placeholders left in
place. Before anything is uploaded we prove two things:

1. No secret is written inline (it would end up in the database).
2. The JSON form validates to exactly the same BusinessConfig as the YAML,
   so a tenant switched to the platform behaves identically on calls.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import yaml
from pydantic import ValidationError

from receptionist.config import BusinessConfig

_SECRET_KEY_RE = re.compile(r"(password|secret|token|api[_-]?key|authorization|credential)", re.IGNORECASE)
# Keys that *name* where a secret lives rather than holding it.
_SECRET_KEY_EXEMPT_SUFFIXES = ("_env", "_file", "_path")
_PLACEHOLDER_ONLY_RE = re.compile(r"^\$\{[A-Z_][A-Z0-9_]*\}$")


class TenantImportError(Exception):
    """Raised when a YAML file cannot be imported safely. Message is log-safe."""


def _is_secret_key(key: str) -> bool:
    lowered = key.lower()
    if lowered.endswith(_SECRET_KEY_EXEMPT_SUFFIXES):
        return False
    return bool(_SECRET_KEY_RE.search(lowered))


def find_inline_secrets(node: Any, path: str = "") -> list[str]:
    """Dotted paths of secret-looking values that are not ${ENV_VAR} placeholders.

    Every value under a ``headers`` mapping counts, since webhook headers
    usually carry credentials.
    """
    found: list[str] = []
    if isinstance(node, dict):
        for key, value in node.items():
            child = f"{path}.{key}" if path else str(key)
            in_headers = path.split(".")[-1] == "headers" if path else False
            if isinstance(value, str) and (in_headers or _is_secret_key(str(key))):
                if value and not _PLACEHOLDER_ONLY_RE.match(value):
                    found.append(child)
            else:
                found.extend(find_inline_secrets(value, child))
    elif isinstance(node, list):
        for i, value in enumerate(node):
            found.extend(find_inline_secrets(value, f"{path}[{i}]"))
    return found


def to_json_document(raw: Any) -> dict[str, Any]:
    """JSON round-trip, which is what the database will hand back."""
    if not isinstance(raw, dict):
        raise TenantImportError("config YAML must be a mapping at the top level")
    return json.loads(json.dumps(raw, default=str))


def effective(config: BusinessConfig) -> dict[str, Any]:
    return config.model_dump(mode="json")


def prepare_import(yaml_path: Path, allow_inline_secrets: bool = False) -> tuple[dict[str, Any], BusinessConfig]:
    """Read, check and convert a tenant YAML. Returns ``(document, config)``."""
    text = yaml_path.read_text(encoding="utf-8")
    try:
        raw = yaml.safe_load(text)
    except yaml.YAMLError as e:
        raise TenantImportError(f"{yaml_path.name} is not valid YAML") from e

    secrets = find_inline_secrets(raw)
    if secrets and not allow_inline_secrets:
        raise TenantImportError(
            "inline secret values would be stored in the platform database at: "
            + ", ".join(secrets)
            + ". Move each into an environment variable and reference it as ${NAME}."
        )

    document = to_json_document(raw)
    try:
        from_yaml = BusinessConfig.from_raw(raw)
        from_document = BusinessConfig.from_raw(document)
    except ValidationError as e:
        # Field locations only: pydantic's messages echo input values, which
        # can include interpolated secrets.
        locations = sorted({".".join(str(p) for p in err["loc"]) for err in e.errors()})
        raise TenantImportError("config does not validate; check: " + ", ".join(locations)) from e
    except ValueError as e:
        # Raised by ${ENV_VAR} interpolation; names the variable, not a value.
        raise TenantImportError(str(e)) from e
    if effective(from_yaml) != effective(from_document):
        raise TenantImportError(
            "the stored form would not behave identically to the YAML "
            "(a value does not survive JSON). Quote dates, times and numeric keys in the YAML."
        )
    return document, from_yaml


def diff_paths(a: Any, b: Any, path: str = "") -> list[str]:
    """Dotted paths where two documents differ. Values are never returned."""
    if isinstance(a, dict) and isinstance(b, dict):
        out: list[str] = []
        for key in sorted(set(a) | set(b), key=str):
            child = f"{path}.{key}" if path else str(key)
            if key not in a or key not in b:
                out.append(child)
            else:
                out.extend(diff_paths(a[key], b[key], child))
        return out
    if isinstance(a, list) and isinstance(b, list) and len(a) == len(b):
        out = []
        for i, (x, y) in enumerate(zip(a, b)):
            out.extend(diff_paths(x, y, f"{path}[{i}]"))
        return out
    return [] if a == b else [path or "<root>"]
