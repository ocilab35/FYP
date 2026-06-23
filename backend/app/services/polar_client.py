"""Polar Payment API client (sandbox/production)."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class PolarAPIError(Exception):
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


class PolarClient:
    def __init__(self) -> None:
        self._base = settings.polar_api_base
        self._headers = {
            "Authorization": f"Bearer {settings.POLAR_API_KEY}",
            "Content-Type": "application/json",
        }

    async def create_checkout(
        self,
        *,
        product_id: str,
        amount_paisa: int,
        customer_email: str,
        customer_name: str,
        external_customer_id: str,
        success_url: str,
        metadata: dict[str, Any],
        currency: str = "PKR",
    ) -> dict[str, Any]:
        if not settings.polar_enabled:
            raise PolarAPIError("Polar payment is not configured")

        payload: dict[str, Any] = {
            "products": [product_id],
            "amount": amount_paisa,
            "currency": currency,
            "customer_email": customer_email,
            "customer_name": customer_name,
            "external_customer_id": external_customer_id,
            "success_url": success_url,
            "metadata": metadata,
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self._base}/checkouts/",
                headers=self._headers,
                json=payload,
            )

        if response.status_code >= 400:
            logger.error("Polar checkout failed: %s", response.text)
            raise PolarAPIError(
                f"Failed to create checkout: {response.text}",
                status_code=response.status_code,
            )

        return response.json()

    async def get_checkout(self, checkout_id: str) -> dict[str, Any]:
        if not settings.polar_enabled:
            raise PolarAPIError("Polar payment is not configured")

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self._base}/checkouts/{checkout_id}",
                headers=self._headers,
            )

        if response.status_code >= 400:
            raise PolarAPIError(
                f"Failed to fetch checkout: {response.text}",
                status_code=response.status_code,
            )

        return response.json()


polar_client = PolarClient()
