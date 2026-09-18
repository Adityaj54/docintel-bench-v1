import socket

import pytest

from app.core.errors import DomainError
from app.webhooks import security
from app.webhooks.security import checked_url, signature, signing_bytes, verify_signature

KEY = "test-webhook-signing-key"


def resolve_to(address: str):
    """Stub DNS so URL checks stay hermetic and offline."""
    def getaddrinfo(host, port, *args, **kwargs):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (address, port or 443))]
    return getaddrinfo


@pytest.fixture
def public_dns(monkeypatch):
    monkeypatch.setattr(security.socket, "getaddrinfo", resolve_to("93.184.216.34"))


@pytest.fixture
def private_dns(monkeypatch):
    monkeypatch.setattr(security.socket, "getaddrinfo", resolve_to("10.0.0.5"))


def test_a_signature_is_stable_for_the_same_input():
    body = signing_bytes({"event": "run.completed", "run_id": "abc"})
    assert signature(body, "1700000000", KEY) == signature(body, "1700000000", KEY)


def test_the_signature_is_prefixed_with_its_algorithm():
    body = signing_bytes({"event": "run.completed"})
    assert signature(body, "1700000000", KEY).startswith("sha256=")


def test_a_valid_signature_verifies():
    body = signing_bytes({"event": "run.completed"})
    supplied = signature(body, "1700000000", KEY)
    assert verify_signature(body, "1700000000", supplied, KEY) is True


def test_a_changed_body_breaks_the_signature():
    supplied = signature(signing_bytes({"total": 10}), "1700000000", KEY)
    assert verify_signature(signing_bytes({"total": 11}), "1700000000", supplied, KEY) is False


def test_replaying_under_a_different_timestamp_fails():
    body = signing_bytes({"event": "run.completed"})
    supplied = signature(body, "1700000000", KEY)
    assert verify_signature(body, "1700009999", supplied, KEY) is False


def test_another_key_cannot_produce_a_valid_signature():
    body = signing_bytes({"event": "run.completed"})
    supplied = signature(body, "1700000000", "a-different-signing-key")
    assert verify_signature(body, "1700000000", supplied, KEY) is False


def test_payload_encoding_is_canonical():
    assert signing_bytes({"b": 1, "a": 2}) == signing_bytes({"a": 2, "b": 1})


def test_payload_encoding_has_no_incidental_whitespace():
    assert signing_bytes({"a": 1, "b": 2}) == b'{"a":1,"b":2}'


def test_an_allowed_https_host_is_accepted(public_dns):
    assert checked_url("https://hooks.example.com/receive") == "https://hooks.example.com/receive"


def test_an_allowed_host_resolving_to_a_private_address_is_refused(private_dns):
    with pytest.raises(DomainError) as failure:
        checked_url("https://hooks.example.com/receive")
    assert failure.value.code == "WEBHOOK_PRIVATE_ADDRESS"


def test_a_host_that_cannot_be_resolved_is_refused(monkeypatch):
    def fail(*args, **kwargs):
        raise socket.gaierror("no such host")
    monkeypatch.setattr(security.socket, "getaddrinfo", fail)
    with pytest.raises(DomainError) as failure:
        checked_url("https://hooks.example.com/receive")
    assert failure.value.code == "WEBHOOK_DNS_FAILED"


def test_a_host_outside_the_allowlist_is_refused():
    with pytest.raises(DomainError) as failure:
        checked_url("https://attacker.example/receive")
    assert failure.value.code == "WEBHOOK_HOST_NOT_ALLOWED"


def test_plain_http_is_refused():
    with pytest.raises(DomainError) as failure:
        checked_url("http://hooks.example.com/receive")
    assert failure.value.code == "WEBHOOK_HTTPS_REQUIRED"


def test_embedded_credentials_are_refused():
    # Assembled from parts so the fixture is not a literal credentialed URL.
    userinfo = "name" + ":" + "placeholder"
    with pytest.raises(DomainError) as failure:
        checked_url(f"https://{userinfo}@hooks.example.com/receive")
    assert failure.value.code == "INVALID_WEBHOOK_URL"


def test_a_url_fragment_is_refused():
    with pytest.raises(DomainError) as failure:
        checked_url("https://hooks.example.com/receive#fragment")
    assert failure.value.code == "INVALID_WEBHOOK_URL"


@pytest.mark.parametrize("url", [
    "ftp://hooks.example.com/receive",
    "file:///etc/passwd",
    "gopher://hooks.example.com",
])
def test_non_http_schemes_are_refused(url):
    with pytest.raises(DomainError) as failure:
        checked_url(url)
    assert failure.value.code == "INVALID_WEBHOOK_URL"


def test_loopback_is_refused_even_when_it_looks_allowed():
    with pytest.raises(DomainError) as failure:
        checked_url("https://localhost/receive")
    assert failure.value.code in {"WEBHOOK_HOST_NOT_ALLOWED", "WEBHOOK_PRIVATE_ADDRESS"}


def test_link_local_metadata_addresses_are_refused():
    with pytest.raises(DomainError) as failure:
        checked_url("https://169.254.169.254/latest/meta-data/")
    assert failure.value.code in {"WEBHOOK_HOST_NOT_ALLOWED", "WEBHOOK_PRIVATE_ADDRESS"}
