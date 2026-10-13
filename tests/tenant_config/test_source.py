# tests/tenant_config/test_source.py
from __future__ import annotations

import json
import logging
from pathlib import Path

import httpx
import pytest
import respx
import yaml

from receptionist.tenant_config.settings import PlatformSettings
from receptionist.tenant_config.source import resolve_business_config

URL = "https://platform.example.com"
TOKEN = "w" * 40
CONFIG_URL = f"{URL}/v1/tenants/acme/components/ai_secretary"


@pytest.fixture
def config_dir(tmp_path: Path, v2_yaml: str) -> Path:
    d = tmp_path / "businesses"
    d.mkdir()
    (d / "acme.yaml").write_text(v2_yaml, encoding="utf-8")
    return d


@pytest.fixture
def platform_doc(v2_yaml: str) -> dict:
    doc = yaml.safe_load(v2_yaml)
    doc["business"]["name"] = "Acme From Platform"
    return doc


def _settings(tmp_path: Path, tenants: str = "acme") -> PlatformSettings:
    return PlatformSettings.from_env({
        "RECEPTIONIST_PLATFORM_URL": URL,
        "RECEPTIONIST_PLATFORM_TOKEN": TOKEN,
        "RECEPTIONIST_PLATFORM_TENANTS": tenants,
        "RECEPTIONIST_PLATFORM_CACHE_DIR": str(tmp_path / "cache"),
    })


@pytest.mark.asyncio
@respx.mock
async def test_tenant_not_opted_in_never_calls_platform(tmp_path, config_dir):
    route = respx.get(CONFIG_URL)
    loaded = await resolve_business_config("acme", config_dir, _settings(tmp_path, tenants="other"))
    assert loaded.source == "yaml"
    assert loaded.config.business.name == "Test Dental"
    assert not route.called


@pytest.mark.asyncio
async def test_unset_env_loads_yaml(monkeypatch, config_dir):
    for var in ("RECEPTIONIST_PLATFORM_URL", "RECEPTIONIST_PLATFORM_TOKEN", "RECEPTIONIST_PLATFORM_TENANTS"):
        monkeypatch.delenv(var, raising=False)
    loaded = await resolve_business_config("acme", config_dir)
    assert loaded.source == "yaml"


@pytest.mark.asyncio
async def test_invalid_platform_env_falls_back_to_yaml(monkeypatch, config_dir, caplog):
    monkeypatch.setenv("RECEPTIONIST_PLATFORM_TENANTS", "acme")
    monkeypatch.delenv("RECEPTIONIST_PLATFORM_URL", raising=False)
    with caplog.at_level(logging.ERROR, logger="receptionist"):
        loaded = await resolve_business_config("acme", config_dir)
    assert loaded.source == "yaml"
    assert "platform settings invalid" in caplog.text


@pytest.mark.asyncio
@respx.mock
async def test_platform_config_is_served_and_cached(tmp_path, config_dir, platform_doc):
    route = respx.get(CONFIG_URL).mock(
        return_value=httpx.Response(200, json={"config": platform_doc, "version": 4})
    )
    loaded = await resolve_business_config("acme", config_dir, _settings(tmp_path))
    assert loaded.source == "platform"
    assert loaded.version == 4
    assert loaded.config.business.name == "Acme From Platform"
    assert route.calls.last.request.headers["Authorization"] == f"Bearer {TOKEN}"

    cached = json.loads((tmp_path / "cache" / "acme.json").read_text(encoding="utf-8"))
    assert cached["version"] == 4
    assert cached["config"] == platform_doc
    assert not list((tmp_path / "cache").glob("*.tmp"))


@pytest.mark.asyncio
@respx.mock
async def test_env_placeholders_are_expanded_at_load_not_stored(tmp_path, config_dir, platform_doc, monkeypatch):
    monkeypatch.setenv("ACME_GREETING", "G'day from the env")
    platform_doc["greeting"] = "${ACME_GREETING}"
    respx.get(CONFIG_URL).mock(return_value=httpx.Response(200, json={"config": platform_doc, "version": 1}))
    loaded = await resolve_business_config("acme", config_dir, _settings(tmp_path))
    assert loaded.config.greeting == "G'day from the env"
    cached = json.loads((tmp_path / "cache" / "acme.json").read_text(encoding="utf-8"))
    assert cached["config"]["greeting"] == "${ACME_GREETING}"


@pytest.mark.asyncio
@respx.mock
async def test_platform_down_uses_last_good_cache(tmp_path, config_dir, platform_doc, caplog):
    respx.get(CONFIG_URL).mock(return_value=httpx.Response(200, json={"config": platform_doc, "version": 2}))
    await resolve_business_config("acme", config_dir, _settings(tmp_path))

    respx.get(CONFIG_URL).mock(side_effect=httpx.ConnectError("boom"))
    with caplog.at_level(logging.WARNING, logger="receptionist"):
        loaded = await resolve_business_config("acme", config_dir, _settings(tmp_path))
    assert loaded.source == "platform-cache"
    assert loaded.version == 2
    assert loaded.config.business.name == "Acme From Platform"
    assert "platform load failed for acme (config fetch: ConnectError)" in caplog.text


@pytest.mark.asyncio
@respx.mock
@pytest.mark.parametrize("response", [
    httpx.Response(500),
    httpx.Response(404, json={"error": "not_found"}),
    httpx.Response(401, json={"error": "unauthorized"}),
    httpx.Response(200, text="not json"),
    httpx.Response(200, json={"config": "nope", "version": 1}),
])
async def test_platform_failure_without_cache_falls_back_to_yaml(tmp_path, config_dir, response, caplog):
    respx.get(CONFIG_URL).mock(return_value=response)
    with caplog.at_level(logging.WARNING, logger="receptionist"):
        loaded = await resolve_business_config("acme", config_dir, _settings(tmp_path))
    assert loaded.source == "yaml"
    assert loaded.config.business.name == "Test Dental"
    assert "no platform cache for acme" in caplog.text


@pytest.mark.asyncio
@respx.mock
async def test_invalid_platform_config_falls_back_and_logs_no_values(tmp_path, config_dir, platform_doc, caplog):
    platform_doc["business"]["timezone"] = "Mars/Olympus_Mons_SECRET"
    respx.get(CONFIG_URL).mock(return_value=httpx.Response(200, json={"config": platform_doc, "version": 9}))
    with caplog.at_level(logging.WARNING, logger="receptionist"):
        loaded = await resolve_business_config("acme", config_dir, _settings(tmp_path))
    assert loaded.source == "yaml"
    assert "ValidationError" in caplog.text
    assert "SECRET" not in caplog.text
    assert not (tmp_path / "cache" / "acme.json").exists()


@pytest.mark.asyncio
@respx.mock
async def test_corrupt_cache_falls_back_to_yaml(tmp_path, config_dir, caplog):
    cache = tmp_path / "cache"
    cache.mkdir()
    (cache / "acme.json").write_text("{broken", encoding="utf-8")
    respx.get(CONFIG_URL).mock(side_effect=httpx.ReadTimeout("slow"))
    with caplog.at_level(logging.WARNING, logger="receptionist"):
        loaded = await resolve_business_config("acme", config_dir, _settings(tmp_path))
    assert loaded.source == "yaml"
    assert "platform cache unusable for acme" in caplog.text


@pytest.mark.asyncio
@respx.mock
async def test_everything_failing_raises(tmp_path, config_dir):
    (config_dir / "acme.yaml").unlink()
    respx.get(CONFIG_URL).mock(side_effect=httpx.ConnectError("boom"))
    with pytest.raises(FileNotFoundError):
        await resolve_business_config("acme", config_dir, _settings(tmp_path))


@pytest.mark.asyncio
async def test_rejects_unsafe_slug(tmp_path, config_dir):
    with pytest.raises(ValueError):
        await resolve_business_config("../acme", config_dir, _settings(tmp_path))
