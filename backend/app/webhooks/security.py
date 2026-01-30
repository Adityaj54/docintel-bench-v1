import hashlib
import hmac
import ipaddress
import json
import socket
from urllib.parse import urlsplit

from app.core.config import get_settings
from app.core.errors import DomainError


def checked_url(url: str) -> str:
    settings = get_settings()
    parsed = urlsplit(url)
    if parsed.scheme not in {"https", "http"} or not parsed.hostname or parsed.username or parsed.password:
        raise DomainError("INVALID_WEBHOOK_URL", "Use an HTTP(S) URL without embedded credentials.")
    if parsed.fragment:
        raise DomainError("INVALID_WEBHOOK_URL", "Webhook URLs cannot contain fragments.")
    if parsed.scheme == "http" and not settings.webhook_allow_private:
        raise DomainError("WEBHOOK_HTTPS_REQUIRED", "Webhooks require HTTPS.")
    if parsed.hostname.lower() not in settings.webhook_hosts:
        raise DomainError("WEBHOOK_HOST_NOT_ALLOWED", "Add this hostname to WEBHOOK_ALLOWED_HOSTS.")
    try:
        addresses = socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80))
    except (socket.gaierror, ValueError) as exc:
        raise DomainError("WEBHOOK_DNS_FAILED", "The webhook host cannot be resolved.") from exc
    if not settings.webhook_allow_private:
        if any(not ipaddress.ip_address(address[4][0]).is_global for address in addresses):
            raise DomainError("WEBHOOK_PRIVATE_ADDRESS", "Webhook destinations must use public addresses.")
    return url


def signing_bytes(payload: dict) -> bytes:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def signature(body: bytes, timestamp: str, key: str) -> str:
    digest = hmac.new(key.encode(), timestamp.encode() + b"." + body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def verify_signature(body: bytes, timestamp: str, supplied: str, key: str) -> bool:
    return hmac.compare_digest(signature(body, timestamp, key), supplied)
