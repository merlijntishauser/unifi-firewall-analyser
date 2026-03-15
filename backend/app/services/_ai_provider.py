"""Shared AI provider calling utilities.

Used by ai_analyzer (firewall zone pair analysis) and site_health (cross-domain analysis).
"""

from __future__ import annotations

import httpx


def call_openai(
    base_url: str, api_key: str, model: str, system_prompt: str, user_prompt: str
) -> str:
    """Call an OpenAI-compatible API."""
    url = f"{base_url}/chat/completions"
    resp = httpx.post(
        url,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
        },
        timeout=60.0,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]  # type: ignore[no-any-return]


def call_anthropic(
    base_url: str, api_key: str, model: str, system_prompt: str, user_prompt: str
) -> str:
    """Call the Anthropic API."""
    url = f"{base_url}/messages"
    resp = httpx.post(
        url,
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "max_tokens": 4096,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
        },
        timeout=60.0,
    )
    resp.raise_for_status()
    return resp.json()["content"][0]["text"]  # type: ignore[no-any-return]
