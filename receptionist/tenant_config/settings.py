# receptionist/tenant_config/settings.py
from __future__ import annotations

import ipaddress
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse

SLUG_RE = re.compile(r"^[a-zA-Z0-9_-]+$")

DEFAULT_TIMEOUT_SECONDS = 2.0
DEFAULT_CACHE_DIR = Path("config/platform-cache")


class PlatformSettingsError(ValueError):
    """Raised when the RECEPTIONIST_PLATFORM_* environment is inconsistent."""


def _is_loopback(host: str) -> bool:
    if host == "localhost":
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def validate_platform_url(url: str) -> str:
    """Require https, except plain http to a loopback address on the same host.

    The bearer token travels in every request, so it must never cross the
    network in clear text.
    """
    parsed = urlparse(url)
    host = parsed.hostname or ""
    if not host:
        raise PlatformSettingsError("RECEPTIONIST_PLATFORM_URL has no host")
    if parsed.scheme == "https":
        return url.rstrip("/")
    if parsed.scheme == "http" and _is_loopback(host):
        return url.rstrip("/")
    raise PlatformSettingsError(
        "RECEPTIONIST_PLATFORM_URL must use https (plain http is only allowed to localhost)"
    )


@dataclass(frozen=True)
class PlatformSettings:
    """Which tenants read their config from the platform, and how to reach it.

    Tenants are opted in one at a time through RECEPTIONIST_PLATFORM_TENANTS
    (comma-separated slugs, or ``*`` for all). With the variable unset every
    tenant loads from YAML exactly as before.
    """

    url: str | None = None
    token: str | None = None
    tenants: frozenset[str] = field(default_factory=frozenset)
    all_tenants: bool = False
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS
    cache_dir: Path = DEFAULT_CACHE_DIR

    @classmethod
    def from_env(cls, env: dict[str, str] | None = None) -> PlatformSettings:
        env = dict(os.environ) if env is None else env
        raw_tenants = env.get("RECEPTIONIST_PLATFORM_TENANTS", "").strip()
        all_tenants = raw_tenants == "*"
        tenants: set[str] = set()
        if raw_tenants and not all_tenants:
            for slug in (s.strip() for s in raw_tenants.split(",")):
                if not slug:
                    continue
                if not SLUG_RE.match(slug):
                    raise PlatformSettingsError(
                        f"RECEPTIONIST_PLATFORM_TENANTS has an invalid slug: {slug!r}"
                    )
                tenants.add(slug)

        url = env.get("RECEPTIONIST_PLATFORM_URL", "").strip() or None
        token = env.get("RECEPTIONIST_PLATFORM_TOKEN", "").strip() or None
        if (tenants or all_tenants) and not (url and token):
            raise PlatformSettingsError(
                "RECEPTIONIST_PLATFORM_TENANTS is set but RECEPTIONIST_PLATFORM_URL "
                "or RECEPTIONIST_PLATFORM_TOKEN is missing"
            )
        if url:
            url = validate_platform_url(url)

        timeout = DEFAULT_TIMEOUT_SECONDS
        raw_timeout = env.get("RECEPTIONIST_PLATFORM_TIMEOUT_SECONDS", "").strip()
        if raw_timeout:
            try:
                timeout = float(raw_timeout)
            except ValueError as e:
                raise PlatformSettingsError(
                    "RECEPTIONIST_PLATFORM_TIMEOUT_SECONDS must be a number"
                ) from e
            if not 0 < timeout <= 30:
                raise PlatformSettingsError(
                    "RECEPTIONIST_PLATFORM_TIMEOUT_SECONDS must be between 0 and 30"
                )

        cache_dir = Path(env.get("RECEPTIONIST_PLATFORM_CACHE_DIR", "").strip() or DEFAULT_CACHE_DIR)
        return cls(
            url=url,
            token=token,
            tenants=frozenset(tenants),
            all_tenants=all_tenants,
            timeout_seconds=timeout,
            cache_dir=cache_dir,
        )

    def enabled_for(self, slug: str) -> bool:
        if not (self.url and self.token):
            return False
        return self.all_tenants or slug in self.tenants
