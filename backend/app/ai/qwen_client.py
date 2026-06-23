"""Async Qwen API client (OpenAI-compatible chat completions)."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class QwenAPIError(Exception):
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


class QwenClient:
    def __init__(self) -> None:
        self._base_url = settings.QWEN_BASE_URL.rstrip("/")
        self._api_key = settings.QWEN_API_KEY
        self._timeout = settings.QWEN_TIMEOUT

    @property
    def is_configured(self) -> bool:
        return bool(self._api_key and self._base_url)

    async def chat_completion(
        self,
        messages: list[dict[str, str]],
        *,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        json_mode: bool = True,
    ) -> str:
        if not self.is_configured:
            raise QwenAPIError("Qwen API is not configured. Set QWEN_API_KEY in .env.")

        payload: dict[str, Any] = {
            "model": model or settings.QWEN_MODEL,
            "messages": messages,
            "temperature": temperature if temperature is not None else settings.QWEN_TEMPERATURE,
            "max_tokens": max_tokens or settings.QWEN_MAX_TOKENS,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._base_url}/chat/completions",
                headers=headers,
                json=payload,
            )

        if response.status_code >= 400:
            logger.error("Qwen API error %s: %s", response.status_code, response.text[:500])
            raise QwenAPIError(
                f"Qwen API request failed ({response.status_code})",
                status_code=response.status_code,
            )

        data = response.json()
        choices = data.get("choices") or []
        if not choices:
            raise QwenAPIError("Qwen API returned no choices")
        content = choices[0].get("message", {}).get("content", "")
        if not content:
            raise QwenAPIError("Qwen API returned empty content")
        return content


qwen_client = QwenClient()
