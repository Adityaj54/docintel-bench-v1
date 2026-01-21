import httpx

from app.core.config import get_settings
from app.core.errors import DomainError, TransientError


def provider_request(url: str, headers: dict, body: dict) -> dict:
    try:
        with httpx.Client(
            timeout=get_settings().provider_timeout_seconds,
            follow_redirects=False,
            trust_env=False,
        ) as client:
            response = client.post(url, headers=headers, json=body)
    except (httpx.TimeoutException, httpx.TransportError) as exc:
        raise TransientError("Provider connection timed out or failed.") from exc
    if response.status_code == 429 or response.status_code >= 500:
        raise TransientError("Provider is temporarily unavailable.", "PROVIDER_RATE_LIMITED"
                             if response.status_code == 429 else "PROVIDER_UNAVAILABLE")
    if response.status_code in {401, 403}:
        raise DomainError("PROVIDER_AUTH_FAILED", "Provider rejected its configured credentials.", 400)
    if response.is_error:
        raise DomainError("PROVIDER_REQUEST_REJECTED", "Provider rejected the model or extraction schema.",
                          details={"status_code": response.status_code})
    try:
        payload = response.json()
    except ValueError as exc:
        raise DomainError("PROVIDER_RESPONSE_INVALID", "Provider returned a non-JSON envelope.") from exc
    if not isinstance(payload, dict):
        raise DomainError("PROVIDER_RESPONSE_INVALID", "Provider returned an invalid response envelope.")
    return payload
