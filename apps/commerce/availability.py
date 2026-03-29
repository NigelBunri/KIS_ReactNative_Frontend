from __future__ import annotations

import json
from typing import Any, Dict, Iterable, Mapping

from django.utils import timezone as dj_timezone

DAY_KEYS = (
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
)

DEFAULT_SLOT_DURATION_MINUTES = 60


def _get_default_timezone() -> str:
    try:
        return dj_timezone.get_current_timezone_name()
    except Exception:
        return "UTC"


def _normalize_time_token(token: str) -> str:
    cleaned = str(token or "").strip()
    if not cleaned:
        return ""
    parts = cleaned.split(":")
    if len(parts) != 2:
        return ""
    try:
        hour = int(parts[0])
        minute = int(parts[1])
    except ValueError:
        return ""
    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        return ""
    return f"{hour:02d}:{minute:02d}"


def _normalize_time_list(tokens: Iterable[str]) -> list[str]:
    normalized = {_normalize_time_token(token) for token in tokens}
    normalized.discard("")
    return sorted(normalized)


def _ensure_day_config(value: Mapping[str, Any] | None = None) -> dict:
    day = {
        "enabled": True,
        "all_day": True,
        "times": [],
    }
    if not value:
        return day
    day["enabled"] = bool(value.get("enabled", day["enabled"]))
    day["all_day"] = bool(value.get("all_day", day["all_day"]))
    raw_times = value.get("times", [])
    if isinstance(raw_times, str):
        raw_times = raw_times.split(",")
    if isinstance(raw_times, Iterable):
        normalized_times = _normalize_time_list(raw_times)
        day["times"] = normalized_times
        if normalized_times:
            day["all_day"] = False
    return day


def _build_days(value: Mapping[str, Any] | None = None) -> dict[str, dict]:
    days = {day: _ensure_day_config() for day in DAY_KEYS}
    if not value:
        return days
    for key, config in value.items():
        normalized_key = str(key).lower()
        if normalized_key in DAY_KEYS:
            days[normalized_key] = _ensure_day_config(config if isinstance(config, Mapping) else {})
    return days


def _build_specific_dates(value: Mapping[str, Any] | None = None) -> dict[str, dict]:
    specific = {}
    if not value:
        return specific
    for raw_date, config in value.items():
        date_key = str(raw_date).strip()
        if not date_key:
            continue
        specific[date_key] = _ensure_day_config(config if isinstance(config, Mapping) else {})
    return specific


def _parse_json(value: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value or "{}")
        except json.JSONDecodeError:
            return {}
    return value or {}


def create_default_availability(**overrides: Any) -> dict:
    timezone_value = overrides.get("timezone") or _get_default_timezone()
    slot_duration = overrides.get("slot_duration_minutes") or DEFAULT_SLOT_DURATION_MINUTES
    return {
        "timezone": timezone_value,
        "slot_duration_minutes": int(slot_duration) if slot_duration else DEFAULT_SLOT_DURATION_MINUTES,
        "days": _build_days(overrides.get("days")),
        "specific_dates": _build_specific_dates(overrides.get("specific_dates")),
    }


def normalize_availability_payload(raw: Any = None) -> dict:
    """
    Normalize any incoming availability payload into the structured format
    used by services and the booking flow.
    """
    payload = _parse_json(raw)
    if not isinstance(payload, Mapping):
        return create_default_availability()
    timezone_value = payload.get("timezone") or _get_default_timezone()
    slot_duration = payload.get("slot_duration_minutes") or DEFAULT_SLOT_DURATION_MINUTES

    return {
        "timezone": timezone_value,
        "slot_duration_minutes": int(slot_duration) if isinstance(slot_duration, (int, float)) and slot_duration > 0 else DEFAULT_SLOT_DURATION_MINUTES,
        "days": _build_days(payload.get("days")),
        "specific_dates": _build_specific_dates(payload.get("specific_dates")),
    }
