# receptionist/tenant_config/source.py
from __future__ import annotations

import asyncio
import json
import logging
import os
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from receptionist.config import BusinessConfig, load_config
from receptionist.tenant_config.client import PlatformError, fetch_ai_secretary_config
from receptionist.tenant_config.settings import SLUG_RE, PlatformSettings, PlatformSettingsError

logger = logging.getLogger("receptionist")

ConfigSource = Literal["platform", "platform-cache", "yaml"]


@dataclass(frozen=True)
class LoadedConfig:
    config: BusinessConfig
    source: ConfigSource
    version: int | None = None


def _cache_path(cache_dir: Path, slug: str) -> Path:
    if not SLUG_RE.match(slug):
        raise ValueError(f"Invalid config name: {slug!r}")
    return cache_dir / f"{slug}.json"


def _write_cache(cache_dir: Path, slug: str, raw: dict[str, Any], version: int) -> None:
    """Atomically store the last config that fetched and validated.

    The document still has its ${ENV_VAR} placeholders, so no secret values
    reach the disk.
    """
    cache_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "slug": slug,
        "version": version,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "config": raw,
    }
    fd, tmp = tempfile.mkstemp(dir=cache_dir, prefix=f".{slug}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False)
        os.replace(tmp, _cache_path(cache_dir, slug))
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


def _read_cache(cache_dir: Path, slug: str) -> tuple[dict[str, Any], int]:
    payload = json.loads(_cache_path(cache_dir, slug).read_text(encoding="utf-8"))
    config, version = payload.get("config"), payload.get("version")
    if not isinstance(config, dict) or not isinstance(version, int):
        raise ValueError("cache file has an unexpected shape")
    return config, version


async def _from_platform(slug: str, settings: PlatformSettings) -> LoadedConfig:
    assert settings.url and settings.token
    raw, version = await fetch_ai_secretary_config(
        settings.url, settings.token, slug, settings.timeout_seconds
    )
    config = BusinessConfig.from_raw(raw)
    try:
        await asyncio.to_thread(_write_cache, settings.cache_dir, slug, raw, version)
    except OSError:
        # The call still has a valid config; only the safety net is stale.
        logger.warning(
            "tenant_config: could not write platform cache for %s", slug,
            exc_info=True, extra={"component": "tenant_config", "tenant": slug},
        )
    return LoadedConfig(config=config, source="platform", version=version)


async def _from_cache(slug: str, settings: PlatformSettings) -> LoadedConfig:
    raw, version = await asyncio.to_thread(_read_cache, settings.cache_dir, slug)
    return LoadedConfig(config=BusinessConfig.from_raw(raw), source="platform-cache", version=version)


def _describe(e: BaseException) -> str:
    # PlatformError messages are written to be log-safe. For anything else
    # log the type only: a validation error can echo config values, which may
    # include interpolated secrets.
    if isinstance(e, PlatformError):
        return str(e)
    return type(e).__name__


async def resolve_business_config(
    slug: str,
    config_dir: Path,
    settings: PlatformSettings | None = None,
) -> LoadedConfig:
    """Load one tenant's BusinessConfig.

    Tenants not opted in to the platform load from ``<config_dir>/<slug>.yaml``
    exactly as before. Opted-in tenants try, in order: the platform API, the
    last config the platform served successfully (on-disk cache), then the
    YAML file. A call is only refused when all three fail.
    """
    if not SLUG_RE.match(slug):
        raise ValueError(f"Invalid config name: {slug!r}")
    log_extra = {"component": "tenant_config", "tenant": slug}
    if settings is None:
        try:
            settings = PlatformSettings.from_env()
        except PlatformSettingsError as e:
            # A bad platform setting must not take calls down: serve YAML.
            logger.error(
                "tenant_config: platform settings invalid (%s); using YAML", e, extra=log_extra,
            )
            settings = PlatformSettings()
    yaml_path = config_dir / f"{slug}.yaml"

    if settings.enabled_for(slug):
        try:
            loaded = await _from_platform(slug, settings)
            logger.info(
                "tenant_config: %s loaded from platform v%s", slug, loaded.version,
                extra={**log_extra, "source": "platform", "version": loaded.version},
            )
            return loaded
        except Exception as e:  # noqa: BLE001 - any failure falls back
            logger.warning(
                "tenant_config: platform load failed for %s (%s); trying cache", slug, _describe(e),
                extra={**log_extra, "source": "platform"},
            )
        try:
            loaded = await _from_cache(slug, settings)
            logger.warning(
                "tenant_config: %s loaded from platform cache v%s", slug, loaded.version,
                extra={**log_extra, "source": "platform-cache", "version": loaded.version},
            )
            return loaded
        except FileNotFoundError:
            logger.warning(
                "tenant_config: no platform cache for %s; falling back to YAML", slug,
                extra={**log_extra, "source": "platform-cache"},
            )
        except Exception as e:  # noqa: BLE001
            logger.warning(
                "tenant_config: platform cache unusable for %s (%s); falling back to YAML",
                slug, _describe(e), extra={**log_extra, "source": "platform-cache"},
            )

    config = await asyncio.to_thread(load_config, yaml_path)
    return LoadedConfig(config=config, source="yaml")
