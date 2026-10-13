# receptionist/tenant_config/__init__.py
"""Tenant config sources: the platform API, its last-good cache, and YAML."""
from __future__ import annotations

from receptionist.tenant_config.settings import PlatformSettings
from receptionist.tenant_config.source import LoadedConfig, resolve_business_config

__all__ = ["LoadedConfig", "PlatformSettings", "resolve_business_config"]
