# receptionist/tenant_config/client.py
from __future__ import annotations

from typing import Any

import httpx

from receptionist.tenant_config.settings import SLUG_RE

COMPONENT = "ai_secretary"


class PlatformError(Exception):
    """A platform request failed. The message is safe to log (no token, no body)."""


class PlatformNotFound(PlatformError):
    pass


def _config_path(slug: str) -> str:
    if not SLUG_RE.match(slug):
        raise ValueError(f"Invalid config name: {slug!r}")
    return f"/v1/tenants/{slug}/components/{COMPONENT}"


def _check(resp: httpx.Response, what: str) -> dict[str, Any]:
    if resp.status_code == 404:
        raise PlatformNotFound(f"{what}: not found")
    if resp.status_code >= 400:
        raise PlatformError(f"{what}: HTTP {resp.status_code}")
    try:
        body = resp.json()
    except ValueError as e:
        raise PlatformError(f"{what}: response is not JSON") from e
    if not isinstance(body, dict):
        raise PlatformError(f"{what}: unexpected response shape")
    return body


def _parse_config_body(body: dict[str, Any]) -> tuple[dict[str, Any], int]:
    config = body.get("config")
    version = body.get("version")
    if not isinstance(config, dict) or not isinstance(version, int):
        raise PlatformError("config fetch: unexpected response shape")
    return config, version


async def fetch_ai_secretary_config(
    base_url: str, token: str, slug: str, timeout_seconds: float
) -> tuple[dict[str, Any], int]:
    """Return ``(raw_config, version)`` for a tenant. Raises PlatformError."""
    path = _config_path(slug)
    try:
        async with httpx.AsyncClient(base_url=base_url, timeout=timeout_seconds) as client:
            resp = await client.get(path, headers={"Authorization": f"Bearer {token}"})
    except httpx.HTTPError as e:
        raise PlatformError(f"config fetch: {type(e).__name__}") from e
    return _parse_config_body(_check(resp, "config fetch"))


class AdminClient:
    """Synchronous admin client for the import/diff CLI (not used on calls)."""

    def __init__(self, base_url: str, token: str, actor: str | None = None, timeout: float = 15.0):
        headers = {"Authorization": f"Bearer {token}"}
        if actor:
            headers["X-Actor"] = actor
        self._client = httpx.Client(base_url=base_url, timeout=timeout, headers=headers)

    def __enter__(self) -> AdminClient:
        return self

    def __exit__(self, *exc: object) -> None:
        self._client.close()

    def _request(self, method: str, path: str, what: str, **kwargs: Any) -> dict[str, Any]:
        try:
            resp = self._client.request(method, path, **kwargs)
        except httpx.HTTPError as e:
            raise PlatformError(f"{what}: {type(e).__name__}") from e
        if resp.status_code == 409:
            raise PlatformError(f"{what}: version conflict (someone else changed it; re-run)")
        return _check(resp, what)

    def upsert_tenant(self, slug: str, name: str) -> dict[str, Any]:
        if not SLUG_RE.match(slug):
            raise ValueError(f"Invalid config name: {slug!r}")
        return self._request("PUT", f"/v1/tenants/{slug}", "tenant upsert", json={"name": name})

    def get_config(self, slug: str) -> tuple[dict[str, Any], int]:
        return _parse_config_body(self._request("GET", _config_path(slug), "config fetch"))

    def put_config(self, slug: str, config: dict[str, Any], note: str | None = None) -> dict[str, Any]:
        payload: dict[str, Any] = {"config": config}
        if note:
            payload["note"] = note
        return self._request("PUT", _config_path(slug), "config write", json=payload)
