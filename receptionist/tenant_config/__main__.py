# receptionist/tenant_config/__main__.py
"""Operator CLI for moving tenant config between YAML and the platform.

    python -m receptionist.tenant_config import <slug> [--dry-run]
    python -m receptionist.tenant_config diff <slug>
    python -m receptionist.tenant_config check <slug>

``import`` and ``diff`` need RECEPTIONIST_PLATFORM_URL and
RECEPTIONIST_PLATFORM_ADMIN_TOKEN. ``check`` uses the worker's own settings
and reports where a call would load this tenant's config from right now.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

from receptionist.config import BusinessConfig
from receptionist.tenant_config.client import AdminClient, PlatformError, PlatformNotFound
from receptionist.tenant_config.importer import TenantImportError, diff_paths, effective, prepare_import
from receptionist.tenant_config.settings import SLUG_RE, PlatformSettings, PlatformSettingsError, validate_platform_url
from receptionist.tenant_config.source import resolve_business_config

DEFAULT_CONFIG_DIR = Path("config/businesses")


def _slug(value: str) -> str:
    if not SLUG_RE.match(value):
        raise argparse.ArgumentTypeError(f"invalid slug {value!r} (allowed: letters, digits, _ and -)")
    return value


def _admin_client(actor: str | None) -> AdminClient:
    url = os.environ.get("RECEPTIONIST_PLATFORM_URL", "").strip()
    token = os.environ.get("RECEPTIONIST_PLATFORM_ADMIN_TOKEN", "").strip()
    if not url or not token:
        raise PlatformSettingsError(
            "set RECEPTIONIST_PLATFORM_URL and RECEPTIONIST_PLATFORM_ADMIN_TOKEN"
        )
    return AdminClient(validate_platform_url(url), token, actor=actor)


def _cmd_import(args: argparse.Namespace) -> int:
    yaml_path = args.yaml or DEFAULT_CONFIG_DIR / f"{args.slug}.yaml"
    document, config = prepare_import(yaml_path, allow_inline_secrets=args.allow_inline_secrets)
    print(f"{yaml_path}: valid; stored form behaves identically to the YAML.")
    if args.dry_run:
        print("Dry run: nothing uploaded.")
        return 0
    with _admin_client(args.actor) as client:
        client.upsert_tenant(args.slug, args.name or config.business.name)
        result = client.put_config(args.slug, document, note=args.note or f"import from {yaml_path.name}")
    state = "stored" if result.get("changed") else "unchanged"
    print(f"{args.slug}: ai_secretary config {state}, version {result.get('version')}.")
    return 0


def _cmd_diff(args: argparse.Namespace) -> int:
    yaml_path = args.yaml or DEFAULT_CONFIG_DIR / f"{args.slug}.yaml"
    document, from_yaml = prepare_import(yaml_path, allow_inline_secrets=True)
    with _admin_client(None) as client:
        stored, version = client.get_config(args.slug)
    raw_paths = diff_paths(document, stored)
    same_behaviour = effective(BusinessConfig.from_raw(stored)) == effective(from_yaml)
    print(f"{args.slug}: platform v{version} vs {yaml_path}")
    print(f"  effective config identical: {'yes' if same_behaviour else 'NO'}")
    if raw_paths:
        print("  differing paths:")
        for p in raw_paths:
            print(f"    {p}")
    else:
        print("  documents identical")
    return 0 if same_behaviour and not raw_paths else 1


def _cmd_check(args: argparse.Namespace) -> int:
    settings = PlatformSettings.from_env()
    print(f"{args.slug}: platform {'enabled' if settings.enabled_for(args.slug) else 'not enabled'} for this tenant")
    loaded = asyncio.run(resolve_business_config(args.slug, DEFAULT_CONFIG_DIR, settings))
    version = f" v{loaded.version}" if loaded.version is not None else ""
    print(f"{args.slug}: a call now would load from {loaded.source}{version} ({loaded.config.business.name})")
    return 0


def main(argv: list[str] | None = None) -> int:
    load_dotenv(".env.local")
    load_dotenv(".env")
    parser = argparse.ArgumentParser(
        prog="python -m receptionist.tenant_config",
        description="Move AI secretary tenant config between YAML and the platform database.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    imp = sub.add_parser("import", help="Validate a tenant YAML and store it in the platform.")
    imp.add_argument("slug", type=_slug)
    imp.add_argument("--yaml", type=Path, help="YAML path (default: config/businesses/<slug>.yaml).")
    imp.add_argument("--name", help="Tenant display name (default: business.name from the YAML).")
    imp.add_argument("--note", help="Revision note.")
    imp.add_argument("--actor", help="Who is running the import, recorded on the revision.")
    imp.add_argument("--dry-run", action="store_true", help="Validate only; upload nothing.")
    imp.add_argument(
        "--allow-inline-secrets", action="store_true",
        help="Store secret-looking values that are not ${ENV_VAR} placeholders. Avoid.",
    )

    dif = sub.add_parser("diff", help="Compare the platform's stored config with the YAML.")
    dif.add_argument("slug", type=_slug)
    dif.add_argument("--yaml", type=Path)

    chk = sub.add_parser("check", help="Show where a call would load this tenant's config from.")
    chk.add_argument("slug", type=_slug)

    args = parser.parse_args(argv)
    handlers = {"import": _cmd_import, "diff": _cmd_diff, "check": _cmd_check}
    try:
        return handlers[args.command](args)
    except (TenantImportError, PlatformError, PlatformSettingsError) as e:
        if isinstance(e, PlatformNotFound):
            print(f"error: {e} (import the tenant first)", file=sys.stderr)
        else:
            print(f"error: {e}", file=sys.stderr)
        return 2
    except FileNotFoundError as e:
        print(f"error: file not found: {e.filename}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
