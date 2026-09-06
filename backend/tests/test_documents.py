from tests.conftest import jpeg_bytes, pdf_bytes, png_bytes, upload


def test_png_upload_records_metadata(client, dataset):
    response = upload(client, dataset["id"], "invoice.png", png_bytes(), "image/png")
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["original_filename"] == "invoice.png"
    assert body["mime_type"] == "image/png"
    assert body["size_bytes"] > 0
    assert len(body["sha256"]) == 64


def test_jpeg_and_pdf_uploads_are_accepted(client, dataset):
    assert upload(client, dataset["id"], "scan.jpg", jpeg_bytes(),
                  "image/jpeg").status_code == 201
    assert upload(client, dataset["id"], "invoice.pdf", pdf_bytes(2),
                  "application/pdf").status_code == 201


def test_pdf_page_count_is_recorded(client, dataset):
    body = upload(client, dataset["id"], "three.pdf", pdf_bytes(3), "application/pdf").json()
    assert body["page_count"] == 3


def test_unsupported_file_types_are_rejected(client, dataset):
    response = upload(client, dataset["id"], "notes.txt", b"plain text", "text/plain")
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "UNSUPPORTED_FILE"


def test_an_empty_file_is_rejected(client, dataset):
    response = upload(client, dataset["id"], "empty.png", b"", "image/png")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "EMPTY_FILE"


def test_a_declared_type_that_contradicts_the_bytes_is_rejected(client, dataset):
    response = upload(client, dataset["id"], "fake.pdf", png_bytes(), "application/pdf")
    assert response.status_code == 400
    assert response.json()["error"]["code"] in {"MIME_MISMATCH", "INVALID_PDF"}


def test_identical_content_is_rejected_within_a_dataset(client, dataset):
    content = png_bytes(colour=(10, 20, 30))
    assert upload(client, dataset["id"], "first.png", content, "image/png").status_code == 201

    duplicate = upload(client, dataset["id"], "second.png", content, "image/png")
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "DUPLICATE_DOCUMENT"


def test_identical_content_is_allowed_in_a_different_dataset(client, project, dataset):
    content = png_bytes(colour=(40, 50, 60))
    upload(client, dataset["id"], "first.png", content, "image/png")

    second = client.post(f"/projects/{project['id']}/datasets", json={
        "name": "February batch", "description": "",
    }).json()
    assert upload(client, second["id"], "first.png", content, "image/png").status_code == 201


def test_a_traversing_filename_cannot_escape_storage(client, dataset):
    response = upload(client, dataset["id"], "../../etc/passwd.png", png_bytes(), "image/png")
    if response.status_code == 201:
        stored = response.json()
        assert ".." not in stored["original_filename"]
        assert "/" not in stored["original_filename"]
    else:
        assert response.json()["error"]["code"] == "INVALID_FILENAME"


def test_documents_can_be_listed_and_searched(client, dataset):
    upload(client, dataset["id"], "alpha.png", png_bytes(colour=(1, 2, 3)), "image/png")
    upload(client, dataset["id"], "beta.png", png_bytes(colour=(4, 5, 6)), "image/png")

    everything = client.get(f"/datasets/{dataset['id']}/documents").json()
    assert everything["total"] == 2

    filtered = client.get(f"/datasets/{dataset['id']}/documents?search=alpha").json()
    assert [item["original_filename"] for item in filtered["items"]] == ["alpha.png"]


def test_a_document_can_be_deleted(client, dataset):
    document = upload(client, dataset["id"], "gone.png", png_bytes(colour=(7, 8, 9)),
                      "image/png").json()
    assert client.delete(f"/documents/{document['id']}").status_code == 200
    assert client.get(f"/documents/{document['id']}").status_code == 404


def test_deleting_frees_the_content_hash_for_reupload(client, dataset):
    content = png_bytes(colour=(11, 12, 13))
    document = upload(client, dataset["id"], "again.png", content, "image/png").json()
    client.delete(f"/documents/{document['id']}")
    assert upload(client, dataset["id"], "again.png", content, "image/png").status_code == 201


def test_another_account_cannot_read_the_document(other_client, client, dataset):
    document = upload(client, dataset["id"], "private.png", png_bytes(colour=(21, 22, 23)),
                      "image/png").json()
    assert other_client.get(f"/documents/{document['id']}").status_code == 404


def test_another_account_cannot_upload_into_the_dataset(other_client, dataset):
    response = upload(other_client, dataset["id"], "intrusion.png", png_bytes(), "image/png")
    assert response.status_code == 404
