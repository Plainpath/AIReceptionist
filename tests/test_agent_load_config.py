# tests/test_agent_load_config.py
from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

import receptionist.agent as agent_module


def _ctx(metadata: dict | None):
    return SimpleNamespace(job=SimpleNamespace(metadata=json.dumps(metadata) if metadata else ""))


@pytest.fixture
def config_dir(tmp_path, v2_yaml, monkeypatch):
    (tmp_path / "acme.yaml").write_text(v2_yaml, encoding="utf-8")
    monkeypatch.setattr(agent_module, "DEFAULT_CONFIG_DIR", tmp_path)
    for var in ("RECEPTIONIST_CONFIG", "RECEPTIONIST_PLATFORM_TENANTS"):
        monkeypatch.delenv(var, raising=False)
    return tmp_path


@pytest.mark.asyncio
async def test_named_config_goes_through_tenant_config(config_dir, monkeypatch):
    seen = {}
    real = agent_module.resolve_business_config

    async def spy(slug, directory, settings=None):
        seen["args"] = (slug, directory)
        return await real(slug, directory, settings)

    monkeypatch.setattr(agent_module, "resolve_business_config", spy)
    config = await agent_module.load_business_config(_ctx({"config": "acme"}))
    assert config.business.name == "Test Dental"
    assert seen["args"] == ("acme", config_dir)


@pytest.mark.asyncio
async def test_unnamed_config_uses_first_yaml(config_dir):
    config = await agent_module.load_business_config(_ctx(None))
    assert config.business.name == "Test Dental"


@pytest.mark.asyncio
async def test_unsafe_config_name_is_rejected(config_dir):
    with pytest.raises(ValueError):
        await agent_module.load_business_config(_ctx({"config": "../secrets/x"}))
