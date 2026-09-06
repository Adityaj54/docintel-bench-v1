from tests.conftest import drain, png_bytes, upload


def documents(client, dataset, count=2):
    created = []
    for index in range(count):
        response = upload(client, dataset["id"], f"invoice-{index}.png",
                          png_bytes(colour=(index * 10 + 1, 20, 30)), "image/png")
        assert response.status_code == 201, response.text
        created.append(response.json())
    drain()
    return created


def start_run(client, project, dataset, schema_version, provider, **overrides):
    body = {
        "name": "Baseline run",
        "dataset_id": dataset["id"],
        "schema_id": schema_version["id"],
        "provider_configuration_id": provider["id"],
    }
    body.update(overrides)
    response = client.post(f"/projects/{project['id']}/runs", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def test_preprocessing_marks_documents_ready(client, dataset):
    created = documents(client, dataset, 1)
    document = client.get(f"/documents/{created[0]['id']}").json()
    assert document["status"] == "ready"
    assert document["error"] is None


def test_a_run_starts_queued_with_one_result_per_document(client, project, dataset,
                                                          schema_version, provider):
    documents(client, dataset, 2)
    run = start_run(client, project, dataset, schema_version, provider)
    assert run["status"] == "queued"
    assert run["total_documents"] == 2

    results = client.get(f"/runs/{run['id']}/results").json()
    assert results["total"] == 2


def test_the_mock_provider_completes_a_run_without_credentials(client, project, dataset,
                                                               schema_version, provider):
    documents(client, dataset, 2)
    run = start_run(client, project, dataset, schema_version, provider)
    drain()

    finished = client.get(f"/runs/{run['id']}").json()
    assert finished["status"] == "completed"
    assert finished["completed_documents"] == 2
    assert finished["failed_documents"] == 0


def test_each_result_records_provenance_and_cost(client, project, dataset,
                                                 schema_version, provider):
    documents(client, dataset, 1)
    run = start_run(client, project, dataset, schema_version, provider)
    drain()

    result = client.get(f"/runs/{run['id']}/results").json()["items"][0]
    assert result["status"] == "completed"
    assert result["provider"] == "mock"
    assert result["model"] == "mock-extract-1"
    assert result["latency_ms"] is not None
    assert result["output"] is not None

    detail = client.get(f"/results/{result['id']}").json()
    assert detail["raw_response"] is not None


def test_mock_output_validates_against_the_schema(client, project, dataset,
                                                  schema_version, provider):
    documents(client, dataset, 1)
    run = start_run(client, project, dataset, schema_version, provider)
    drain()

    result = client.get(f"/runs/{run['id']}/results").json()["items"][0]
    assert result["validation"] is not None
    assert result["validation"]["valid"] is True


def test_the_mock_provider_is_deterministic(client, project, dataset, schema_version, provider):
    documents(client, dataset, 1)
    first = start_run(client, project, dataset, schema_version, provider, name="First")
    drain()
    second = start_run(client, project, dataset, schema_version, provider, name="Second")
    drain()

    first_output = client.get(f"/runs/{first['id']}/results").json()["items"][0]["output"]
    second_output = client.get(f"/runs/{second['id']}/results").json()["items"][0]["output"]
    assert first_output == second_output


def test_one_failing_document_does_not_fail_the_whole_run(client, project, dataset,
                                                          schema_version):
    documents(client, dataset, 3)
    flaky = client.post(f"/projects/{project['id']}/providers", json={
        "name": "Flaky mock", "provider": "mock", "model": "mock-extract-1",
        "options": {"failure_every": 2},
    }).json()

    run = start_run(client, project, dataset, schema_version, flaky)
    drain()

    finished = client.get(f"/runs/{run['id']}").json()
    assert finished["status"] == "partially_failed"
    assert finished["failed_documents"] >= 1
    assert finished["completed_documents"] >= 1
    assert finished["completed_documents"] + finished["failed_documents"] == 3

    statuses = {item["status"] for item in client.get(f"/runs/{run['id']}/results").json()["items"]}
    assert statuses == {"completed", "failed"}


def test_a_failed_result_keeps_a_machine_readable_error(client, project, dataset, schema_version):
    documents(client, dataset, 2)
    always = client.post(f"/projects/{project['id']}/providers", json={
        "name": "Broken mock", "provider": "mock", "model": "mock-extract-1",
        "options": {"failure_every": 1},
    }).json()

    run = start_run(client, project, dataset, schema_version, always)
    drain()

    finished = client.get(f"/runs/{run['id']}").json()
    assert finished["status"] == "failed"
    failure = client.get(f"/runs/{run['id']}/results?status=failed").json()["items"][0]
    assert failure["error"]["code"]
    assert failure["error"]["message"]


def test_malformed_provider_json_is_reported_not_discarded(client, project, dataset,
                                                           schema_version):
    documents(client, dataset, 1)
    broken = client.post(f"/projects/{project['id']}/providers", json={
        "name": "Malformed mock", "provider": "mock", "model": "mock-extract-1",
        "options": {"response_format": "malformed"},
    }).json()

    run = start_run(client, project, dataset, schema_version, broken)
    drain()

    result = client.get(f"/runs/{run['id']}/results").json()["items"][0]
    assert result["status"] == "failed"
    assert result["error"]["code"] == "MALFORMED_PROVIDER_JSON"


def test_fenced_output_is_normalised_with_a_warning(client, project, dataset, schema_version):
    documents(client, dataset, 1)
    fenced = client.post(f"/projects/{project['id']}/providers", json={
        "name": "Fenced mock", "provider": "mock", "model": "mock-extract-1",
        "options": {"response_format": "fenced"},
    }).json()

    run = start_run(client, project, dataset, schema_version, fenced)
    drain()

    result = client.get(f"/runs/{run['id']}/results").json()["items"][0]
    assert result["status"] == "completed"
    assert any(warning["code"] == "CODE_FENCE_REMOVED"
               for warning in result["normalization_warnings"])


def test_the_run_snapshots_provider_configuration(client, project, dataset,
                                                  schema_version, provider):
    documents(client, dataset, 1)
    run = start_run(client, project, dataset, schema_version, provider)

    client.put(f"/providers/{provider['id']}", json={
        "name": "Renamed", "provider": "mock", "model": "mock-extract-2", "options": {},
    })

    unchanged = client.get(f"/runs/{run['id']}").json()
    assert unchanged["provider_snapshot"]["model"] == "mock-extract-1"


def test_a_run_needs_at_least_one_document(client, project, dataset, schema_version, provider):
    response = client.post(f"/projects/{project['id']}/runs", json={
        "name": "Empty", "dataset_id": dataset["id"], "schema_id": schema_version["id"],
        "provider_configuration_id": provider["id"],
    })
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "EMPTY_DATASET"


def test_a_run_rejects_both_a_dataset_and_documents(client, project, dataset,
                                                    schema_version, provider):
    created = documents(client, dataset, 1)
    response = client.post(f"/projects/{project['id']}/runs", json={
        "name": "Ambiguous", "dataset_id": dataset["id"],
        "document_ids": [created[0]["id"]],
        "schema_id": schema_version["id"], "provider_configuration_id": provider["id"],
    })
    assert response.status_code == 422


def test_cancelling_stops_outstanding_work(client, project, dataset, schema_version, provider):
    documents(client, dataset, 2)
    run = start_run(client, project, dataset, schema_version, provider)

    cancelled = client.post(f"/runs/{run['id']}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"

    drain()
    assert client.get(f"/runs/{run['id']}").json()["status"] == "cancelled"


def test_another_account_cannot_read_the_run(other_client, client, project, dataset,
                                             schema_version, provider):
    documents(client, dataset, 1)
    run = start_run(client, project, dataset, schema_version, provider)
    assert other_client.get(f"/runs/{run['id']}").status_code == 404
