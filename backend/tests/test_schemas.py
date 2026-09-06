from tests.conftest import INVOICE_SCHEMA


def test_create_starts_at_version_one(client, schema_version):
    assert schema_version["version"] == 1
    assert schema_version["active"] is True


def test_editing_creates_a_new_version_and_preserves_the_original(client, schema_version):
    original_definition = schema_version["definition"]
    updated = dict(INVOICE_SCHEMA, required=["invoice_number", "total", "currency"])

    response = client.post(f"/schemas/{schema_version['id']}/versions", json={
        "description": "Currency is now mandatory", "definition": updated,
    })
    assert response.status_code == 201
    new_version = response.json()
    assert new_version["version"] == 2
    assert new_version["id"] != schema_version["id"]

    previous = client.get(f"/schemas/{schema_version['id']}").json()
    assert previous["version"] == 1
    assert previous["definition"] == original_definition


def test_versions_carry_independent_activation(client, schema_version):
    second = client.post(f"/schemas/{schema_version['id']}/versions", json={
        "description": "", "definition": INVOICE_SCHEMA,
    }).json()

    # Creating a version leaves earlier versions usable; activation is controlled per version.
    assert client.get(f"/schemas/{schema_version['id']}").json()["active"] is True
    assert second["active"] is True

    client.put(f"/schemas/{schema_version['id']}/activation", json={"active": False})
    assert client.get(f"/schemas/{schema_version['id']}").json()["active"] is False
    assert client.get(f"/schemas/{second['id']}").json()["active"] is True


def test_a_version_can_be_deactivated_and_reactivated(client, schema_version):
    off = client.put(f"/schemas/{schema_version['id']}/activation", json={"active": False})
    assert off.status_code == 200
    assert off.json()["active"] is False

    on = client.put(f"/schemas/{schema_version['id']}/activation", json={"active": True})
    assert on.json()["active"] is True


def test_cloning_copies_the_definition_under_a_new_name(client, schema_version):
    response = client.post(f"/schemas/{schema_version['id']}/clone", json={"name": "Invoice EU"})
    assert response.status_code == 201
    clone = response.json()
    assert clone["name"] == "Invoice EU"
    assert clone["version"] == 1
    assert clone["definition"] == schema_version["definition"]
    assert clone["id"] != schema_version["id"]


def test_duplicate_schema_names_are_rejected(client, project, schema_version):
    response = client.post(f"/projects/{project['id']}/schemas", json={
        "name": schema_version["name"], "description": "", "definition": INVOICE_SCHEMA,
    })
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "SCHEMA_NAME_EXISTS"


def test_an_invalid_json_schema_is_rejected(client, project):
    response = client.post(f"/projects/{project['id']}/schemas", json={
        "name": "Broken", "description": "",
        "definition": {"type": "object", "properties": {"total": {"type": "not-a-type"}}},
    })
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_SCHEMA"


def test_external_references_are_refused(client, project):
    response = client.post(f"/projects/{project['id']}/schemas", json={
        "name": "Remote", "description": "",
        "definition": {"type": "object", "properties": {"a": {"$ref": "https://example.com/s.json"}}},
    })
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "EXTERNAL_SCHEMA_REF"


def test_local_references_are_allowed(client, project):
    response = client.post(f"/projects/{project['id']}/schemas", json={
        "name": "Local ref", "description": "",
        "definition": {
            "type": "object",
            "$defs": {"money": {"type": "number"}},
            "properties": {"total": {"$ref": "#/$defs/money"}},
        },
    })
    assert response.status_code == 201


def test_sample_validation_accepts_a_conforming_document(client, schema_version):
    response = client.post(f"/schemas/{schema_version['id']}/validate", json={
        "value": {"invoice_number": "INV-1", "total": 120.5, "currency": "EUR"},
    })
    assert response.status_code == 200
    assert response.json()["valid"] is True
    assert response.json()["errors"] == []


def test_sample_validation_reports_the_failing_path(client, schema_version):
    response = client.post(f"/schemas/{schema_version['id']}/validate", json={
        "value": {"invoice_number": "INV-1", "total": "one hundred"},
    })
    body = response.json()
    assert body["valid"] is False
    error = next(item for item in body["errors"] if item["path"].endswith("total"))
    assert error["validator"] == "type"
    assert error["expected"] == "number"
    assert error["received_type"] == "str"


def test_sample_validation_reports_a_missing_required_field(client, schema_version):
    body = client.post(f"/schemas/{schema_version['id']}/validate", json={
        "value": {"invoice_number": "INV-1"},
    }).json()
    assert body["valid"] is False
    assert any(item["validator"] == "required" for item in body["errors"])


def test_another_account_cannot_read_the_schema(other_client, schema_version):
    assert other_client.get(f"/schemas/{schema_version['id']}").status_code == 404


def test_another_account_cannot_add_a_version(other_client, schema_version):
    response = other_client.post(f"/schemas/{schema_version['id']}/versions", json={
        "description": "", "definition": INVOICE_SCHEMA,
    })
    assert response.status_code == 404
