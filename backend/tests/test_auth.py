from app.auth.security import COOKIE_NAME


def test_registration_starts_a_session(anonymous):
    user = anonymous.register()
    assert user["email"] == "analyst@example.com"
    assert user["csrf_token"]
    assert anonymous.raw.cookies.get(COOKIE_NAME)


def test_registration_rejects_a_duplicate_email(anonymous, client):
    response = anonymous.raw.post("/api/auth/register", json={
        "email": "analyst@example.com", "password": "another good passphrase",
        "display_name": "Impostor",
    })
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "EMAIL_UNAVAILABLE"


def test_registration_rejects_a_short_password(anonymous):
    response = anonymous.raw.post("/api/auth/register", json={
        "email": "weak@example.com", "password": "short", "display_name": "Weak",
    })
    assert response.status_code == 422


def test_login_rejects_the_wrong_password(client):
    response = client.raw.post("/api/auth/login", json={
        "email": "analyst@example.com", "password": "not the right passphrase",
    })
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_login_does_not_disclose_unknown_accounts(anonymous):
    response = anonymous.raw.post("/api/auth/login", json={
        "email": "nobody@example.com", "password": "correct horse battery staple",
    })
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_password_is_never_returned(client):
    body = client.get("/auth/me").json()
    assert "password" not in body
    assert "password_hash" not in body


def test_me_requires_a_session(anonymous):
    response = anonymous.get("/auth/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHENTICATED"


def test_logout_revokes_the_existing_cookie(client):
    stale = client.raw.cookies.get(COOKIE_NAME)
    assert client.post("/auth/logout").status_code == 200

    client.raw.cookies.set(COOKIE_NAME, stale)
    response = client.get("/auth/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "SESSION_EXPIRED"


def test_state_changing_requests_require_the_csrf_header(client):
    del client.raw.headers["X-CSRF-Token"]
    response = client.post("/projects", json={"name": "No token", "description": ""})
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "CSRF_FAILED"


def test_csrf_header_must_match_the_session(client):
    client.raw.headers["X-CSRF-Token"] = "a-different-token"
    response = client.post("/projects", json={"name": "Wrong token", "description": ""})
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "CSRF_FAILED"


def test_reads_do_not_require_the_csrf_header(client):
    del client.raw.headers["X-CSRF-Token"]
    assert client.get("/projects").status_code == 200


def test_untrusted_origin_is_rejected(client):
    response = client.post("/projects", json={"name": "Cross site", "description": ""},
                           headers={"Origin": "https://malicious.example"})
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "INVALID_ORIGIN"


def test_a_tampered_session_cookie_is_refused(client):
    client.raw.cookies.set(COOKIE_NAME, "not.a.valid.token")
    response = client.get("/auth/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "SESSION_EXPIRED"
