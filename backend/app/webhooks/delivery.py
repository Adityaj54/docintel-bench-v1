import time
from uuid import UUID

import httpx
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import DomainError, TransientError
from app.core.time import utcnow
from app.models import WebhookConfiguration, WebhookDelivery
from app.webhooks.security import checked_url, signature, signing_bytes


def deliver(db: Session, identifier: UUID) -> None:
    delivery = db.get(WebhookDelivery, identifier)
    if not delivery or delivery.status in {"delivered", "cancelled"}:
        return
    webhook = db.get(WebhookConfiguration, delivery.webhook_id)
    if not webhook or not webhook.active:
        delivery.status = "cancelled"
        return
    settings = get_settings()
    if not settings.webhook_signing_key:
        raise DomainError("WEBHOOK_NOT_CONFIGURED", "Webhook signing key is unavailable.")
    checked_url(webhook.url)
    body = signing_bytes({
        **delivery.payload,
        "delivery_id": str(delivery.id),
        "created_at": delivery.created_at.isoformat(),
    })
    timestamp = str(int(time.time()))
    delivery.attempts += 1
    try:
        with httpx.Client(timeout=10, follow_redirects=False, trust_env=False) as client:
            response = client.post(
                webhook.url,
                content=body,
                headers={
                    "Content-Type": "application/json",
                    "X-DocIntel-Event": delivery.event,
                    "X-DocIntel-Delivery": str(delivery.id),
                    "X-DocIntel-Timestamp": timestamp,
                    "X-DocIntel-Signature": signature(body, timestamp, settings.webhook_signing_key),
                },
            )
        delivery.last_status_code = response.status_code
        delivery.last_error = None if response.is_success else f"HTTP {response.status_code}"
    except httpx.TransportError:
        delivery.last_status_code = None
        delivery.last_error = "Connection failed or timed out."
    delivery.attempt_history = [
        *delivery.attempt_history,
        {"attempt": delivery.attempts, "at": utcnow().isoformat(),
         "status_code": delivery.last_status_code, "error": delivery.last_error},
    ][-20:]
    if delivery.last_error is None:
        delivery.status = "delivered"
        return
    delivery.status = "retrying"
    db.commit()
    if delivery.last_status_code is None or delivery.last_status_code in {408, 429} or delivery.last_status_code >= 500:
        raise TransientError("Webhook destination is temporarily unavailable.", "WEBHOOK_UNAVAILABLE")
    raise DomainError("WEBHOOK_REJECTED", "Webhook destination rejected the delivery.")
