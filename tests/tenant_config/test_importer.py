# tests/tenant_config/test_importer.py
from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest
import respx
import yaml

from receptionist.tenant_config.__main__ import main
from receptionist.tenant_config.importer import (
    TenantImportError,
    diff_paths,
    find_inline_secrets,
    prepare_import,
)

URL = "https://platform.example.com"
ADMIN = "a" * 40


def _write(tmp_path: Path, text: str) -> Path:
    p = tmp_path / "acme.yaml"
    p.write_text(text, encoding="utf-8")
    return p


def test_find_inline_secrets_flags_literals_but_not_placeholders():
    doc = {
        "email": {"sender": {"smtp": {"username": "u", "password": "hunter2"}}},
        "resend": {"api_key": "${RESEND_API_KEY}"},
        "voice": {"auth": {"type": "oauth_static", "token_env": "OPENAI_TOKEN"}},
        "calendar": {"auth": {"oauth_token_file": "./secrets/x.json"}},
        "messages": {"channels": [{"type": "webhook", "headers": {"X-Api-Key": "abc", "X-Trace": "${TRACE}"}}]},
    }
    assert find_inline_secrets(doc) == [
        "email.sender.smtp.password",
        "messages.channels[0].headers.X-Api-Key",
    ]


def test_prepare_import_accepts_example_yaml(tmp_path, v2_yaml):
    document, config = prepare_import(_write(tmp_path, v2_yaml))
    assert document == yaml.safe_load(v2_yaml)
    assert config.business.name == "Test Dental"


def test_prepare_import_refuses_inline_secret(tmp_path, v2_yaml):
    doc = yaml.safe_load(v2_yaml)
    doc["messages"]["channels"].append({"type": "webhook", "url": "https://hooks.example.com/x", "headers": {"Authorization": "Bearer live"}})
    path = _write(tmp_path, yaml.safe_dump(doc))
    with pytest.raises(TenantImportError) as exc:
        prepare_import(path)
    assert "headers.Authorization" in str(exc.value)
    assert "Bearer live" not in str(exc.value)
    document, _ = prepare_import(path, allow_inline_secrets=True)
    assert document["messages"]["channels"][-1]["headers"]["Authorization"] == "Bearer live"


def test_prepare_import_reports_missing_env_var(tmp_path, v2_yaml, monkeypatch):
    monkeypatch.delenv("ACME_GREETING", raising=False)
    doc = yaml.safe_load(v2_yaml)
    doc["greeting"] = "${ACME_GREETING}"
    with pytest.raises(TenantImportError, match="ACME_GREETING"):
        prepare_import(_write(tmp_path, yaml.safe_dump(doc)))


def test_prepare_import_reports_field_locations_not_values(tmp_path, v2_yaml):
    doc = yaml.safe_load(v2_yaml)
    doc["business"]["timezone"] = "Nowhere/SECRETVALUE"
    with pytest.raises(TenantImportError) as exc:
        prepare_import(_write(tmp_path, yaml.safe_dump(doc)))
    assert "business.timezone" in str(exc.value)
    assert "SECRETVALUE" not in str(exc.value)


def test_prepare_import_refuses_non_json_yaml_value(tmp_path, v2_yaml):
    # An unquoted YAML date is not a JSON value; the import must stop rather
    # than store something the worker would read differently.
    text = v2_yaml.replace('greeting: "Thank you for calling Test Dental."', "greeting: 2026-10-13")
    with pytest.raises(TenantImportError):
        prepare_import(_write(tmp_path, text))


def test_prepare_import_rejects_non_mapping(tmp_path):
    with pytest.raises(TenantImportError):
        prepare_import(_write(tmp_path, "- a\n- b\n"))


def test_diff_paths_names_paths_only():
    a = {"greeting": "hi", "faqs": [{"q": "x"}], "only_a": 1}
    b = {"greeting": "secret-new", "faqs": [{"q": "x"}], "only_b": 2}
    assert diff_paths(a, b) == ["greeting", "only_a", "only_b"]
    assert diff_paths(a, a) == []


@respx.mock
def test_cli_import_upserts_tenant_and_puts_config(tmp_path, v2_yaml, monkeypatch, capsys):
    monkeypatch.setenv("RECEPTIONIST_PLATFORM_URL", URL)
    monkeypatch.setenv("RECEPTIONIST_PLATFORM_ADMIN_TOKEN", ADMIN)
    tenant = respx.put(f"{URL}/v1/tenants/acme").mock(return_value=httpx.Response(200, json={"tenant": {}}))
    put = respx.put(f"{URL}/v1/tenants/acme/components/ai_secretary").mock(
        return_value=httpx.Response(200, json={"version": 1, "changed": True})
    )
    path = _write(tmp_path, v2_yaml)
    assert main(["import", "acme", "--yaml", str(path), "--actor", "chris"]) == 0
    assert tenant.calls.last.request.headers["Authorization"] == f"Bearer {ADMIN}"
    assert tenant.calls.last.request.headers["X-Actor"] == "chris"
    assert json.loads(tenant.calls.last.request.content) == {"name": "Test Dental"}
    sent = json.loads(put.calls.last.request.content)
    assert sent["config"] == yaml.safe_load(v2_yaml)
    assert sent["note"] == "import from acme.yaml"
    assert "version 1" in capsys.readouterr().out


@respx.mock
def test_cli_import_dry_run_sends_nothing(tmp_path, v2_yaml, monkeypatch):
    route = respx.route()
    assert main(["import", "acme", "--yaml", str(_write(tmp_path, v2_yaml)), "--dry-run"]) == 0
    assert not route.called


def test_cli_import_refuses_plain_http_to_remote_host(tmp_path, v2_yaml, monkeypatch, capsys):
    monkeypatch.setenv("RECEPTIONIST_PLATFORM_URL", "http://platform.example.com")
    monkeypatch.setenv("RECEPTIONIST_PLATFORM_ADMIN_TOKEN", ADMIN)
    assert main(["import", "acme", "--yaml", str(_write(tmp_path, v2_yaml))]) == 2
    assert "https" in capsys.readouterr().err


@respx.mock
def test_cli_diff_reports_identical_and_drift(tmp_path, v2_yaml, monkeypatch, capsys):
    monkeypatch.setenv("RECEPTIONIST_PLATFORM_URL", URL)
    monkeypatch.setenv("RECEPTIONIST_PLATFORM_ADMIN_TOKEN", ADMIN)
    doc = yaml.safe_load(v2_yaml)
    route = respx.get(f"{URL}/v1/tenants/acme/components/ai_secretary")
    path = _write(tmp_path, v2_yaml)

    route.mock(return_value=httpx.Response(200, json={"config": doc, "version": 3}))
    assert main(["diff", "acme", "--yaml", str(path)]) == 0
    assert "effective config identical: yes" in capsys.readouterr().out

    drifted = {**doc, "greeting": "Something else"}
    route.mock(return_value=httpx.Response(200, json={"config": drifted, "version": 4}))
    assert main(["diff", "acme", "--yaml", str(path)]) == 1
    out = capsys.readouterr().out
    assert "effective config identical: NO" in out
    assert "greeting" in out
    assert "Something else" not in out


def test_cli_rejects_bad_slug():
    with pytest.raises(SystemExit):
        main(["import", "../etc"])
