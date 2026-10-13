# tests/tenant_config/test_settings.py
from __future__ import annotations

from pathlib import Path

import pytest

from receptionist.tenant_config.settings import (
    PlatformSettings,
    PlatformSettingsError,
    validate_platform_url,
)

BASE = {
    "RECEPTIONIST_PLATFORM_URL": "https://platform.example.com/",
    "RECEPTIONIST_PLATFORM_TOKEN": "t" * 40,
}


def test_unset_env_disables_platform_for_everyone():
    s = PlatformSettings.from_env({})
    assert not s.enabled_for("acme")


def test_url_and_token_alone_do_not_opt_anyone_in():
    s = PlatformSettings.from_env(dict(BASE))
    assert not s.enabled_for("acme")


def test_tenants_are_opted_in_one_at_a_time():
    s = PlatformSettings.from_env({**BASE, "RECEPTIONIST_PLATFORM_TENANTS": "acme, bobs-plumbing"})
    assert s.enabled_for("acme")
    assert s.enabled_for("bobs-plumbing")
    assert not s.enabled_for("other")
    assert s.url == "https://platform.example.com"


def test_star_opts_in_every_tenant():
    s = PlatformSettings.from_env({**BASE, "RECEPTIONIST_PLATFORM_TENANTS": "*"})
    assert s.enabled_for("anything")


def test_tenants_without_url_or_token_is_an_error():
    with pytest.raises(PlatformSettingsError):
        PlatformSettings.from_env({"RECEPTIONIST_PLATFORM_TENANTS": "acme"})


def test_invalid_slug_in_tenant_list_is_rejected():
    with pytest.raises(PlatformSettingsError):
        PlatformSettings.from_env({**BASE, "RECEPTIONIST_PLATFORM_TENANTS": "../etc"})


@pytest.mark.parametrize("raw", ["abc", "0", "-1", "31"])
def test_timeout_must_be_a_sane_number(raw):
    with pytest.raises(PlatformSettingsError):
        PlatformSettings.from_env({**BASE, "RECEPTIONIST_PLATFORM_TIMEOUT_SECONDS": raw})


def test_timeout_and_cache_dir_overrides():
    s = PlatformSettings.from_env({
        **BASE,
        "RECEPTIONIST_PLATFORM_TIMEOUT_SECONDS": "0.5",
        "RECEPTIONIST_PLATFORM_CACHE_DIR": "/var/cache/rx",
    })
    assert s.timeout_seconds == 0.5
    assert s.cache_dir == Path("/var/cache/rx")


@pytest.mark.parametrize("url", [
    "https://platform.example.com",
    "http://127.0.0.1:8787",
    "http://localhost:8787",
    "http://[::1]:8787",
])
def test_allowed_urls(url):
    assert validate_platform_url(url) == url


@pytest.mark.parametrize("url", [
    "http://platform.example.com",
    "http://10.0.0.5:8787",
    "ftp://platform.example.com",
    "https://",
])
def test_rejected_urls(url):
    with pytest.raises(PlatformSettingsError):
        validate_platform_url(url)
