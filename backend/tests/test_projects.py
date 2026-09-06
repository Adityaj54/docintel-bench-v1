def test_create_and_read_a_project(client):
    created = client.post("/projects", json={"name": "Receipts", "description": "Expense receipts"})
    assert created.status_code == 201
    body = created.json()
    assert body["name"] == "Receipts"
    assert body["archived"] is False

    fetched = client.get(f"/projects/{body['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["id"] == body["id"]


def test_project_name_is_required(client):
    assert client.post("/projects", json={"name": "", "description": ""}).status_code == 422


def test_update_changes_name_and_description(client, project):
    response = client.put(f"/projects/{project['id']}", json={
        "name": "Supplier invoices", "description": "EU suppliers", "archived": False,
    })
    assert response.status_code == 200
    assert response.json()["name"] == "Supplier invoices"


def test_archiving_blocks_further_changes(client, project):
    archived = client.put(f"/projects/{project['id']}", json={
        "name": project["name"], "description": "", "archived": True,
    })
    assert archived.status_code == 200
    assert archived.json()["archived"] is True

    blocked = client.post(f"/projects/{project['id']}/datasets", json={
        "name": "Late batch", "description": "",
    })
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "PROJECT_ARCHIVED"


def test_archived_projects_can_be_restored(client, project):
    client.put(f"/projects/{project['id']}", json={
        "name": project["name"], "description": "", "archived": True,
    })
    restored = client.put(f"/projects/{project['id']}", json={
        "name": project["name"], "description": "", "archived": False,
    })
    assert restored.json()["archived"] is False
    assert client.post(f"/projects/{project['id']}/datasets", json={
        "name": "Batch", "description": "",
    }).status_code == 201


def test_browse_filters_by_archived_state(client, project):
    client.post("/projects", json={"name": "Second", "description": ""})
    client.put(f"/projects/{project['id']}", json={
        "name": project["name"], "description": "", "archived": True,
    })

    active = client.get("/projects?archived=false").json()
    assert [item["name"] for item in active["items"]] == ["Second"]

    archived = client.get("/projects?archived=true").json()
    assert [item["name"] for item in archived["items"]] == [project["name"]]


def test_browse_searches_by_name(client, project):
    client.post("/projects", json={"name": "Passport scans", "description": ""})
    found = client.get("/projects?search=passport").json()
    assert [item["name"] for item in found["items"]] == ["Passport scans"]


def test_another_account_cannot_read_the_project(other_client, project):
    response = other_client.get(f"/projects/{project['id']}")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_another_account_cannot_update_the_project(other_client, project):
    response = other_client.put(f"/projects/{project['id']}", json={
        "name": "Hijacked", "description": "", "archived": False,
    })
    assert response.status_code == 404


def test_projects_are_scoped_to_their_owner(other_client, project):
    assert other_client.get("/projects").json()["items"] == []
