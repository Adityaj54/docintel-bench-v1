import os
import tempfile

_root = tempfile.mkdtemp(prefix="docintel-test-")

os.environ["DATABASE_URL"] = f"sqlite:///{_root}/test.db"
os.environ["ENVIRONMENT"] = "test"
os.environ["SECRET_KEY"] = "test-session-signing-key-never-use-in-production"
os.environ["STORAGE_ROOT"] = f"{_root}/documents"
os.environ["SEED_ON_REGISTER"] = "false"
os.environ["WEBHOOK_SIGNING_KEY"] = "test-webhook-signing-key"
os.environ["WEBHOOK_ALLOWED_HOSTS"] = "hooks.example.com"

import io  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from app.db.base import Base  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def schema():
    """Every test starts against an empty database."""
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture
def db():
    with SessionLocal() as session:
        yield session


class Client:
    """TestClient wrapper that carries the session cookie and CSRF header."""

    def __init__(self, client: TestClient):
        self.raw = client
        self.user: dict | None = None

    def register(self, email="analyst@example.com", password="correct horse battery staple",
                 display_name="Analyst"):
        response = self.raw.post("/api/auth/register", json={
            "email": email, "password": password, "display_name": display_name,
        })
        assert response.status_code == 201, response.text
        self.user = response.json()
        self.raw.headers["X-CSRF-Token"] = self.user["csrf_token"]
        return self.user

    def login(self, email="analyst@example.com", password="correct horse battery staple"):
        response = self.raw.post("/api/auth/login", json={"email": email, "password": password})
        if response.status_code == 200:
            self.user = response.json()
            self.raw.headers["X-CSRF-Token"] = self.user["csrf_token"]
        return response

    def get(self, path, **kwargs):
        return self.raw.get("/api" + path, **kwargs)

    def post(self, path, **kwargs):
        return self.raw.post("/api" + path, **kwargs)

    def put(self, path, **kwargs):
        return self.raw.put("/api" + path, **kwargs)

    def delete(self, path, **kwargs):
        return self.raw.delete("/api" + path, **kwargs)


@pytest.fixture
def anonymous():
    with TestClient(app) as raw:
        yield Client(raw)


@pytest.fixture
def client(anonymous):
    anonymous.register()
    return anonymous


@pytest.fixture
def other_client():
    with TestClient(app) as raw:
        client = Client(raw)
        client.register(email="rival@example.com", display_name="Rival")
        yield client


@pytest.fixture
def project(client):
    response = client.post("/projects", json={"name": "Invoices", "description": "Supplier invoices"})
    assert response.status_code == 201, response.text
    return response.json()


INVOICE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["invoice_number", "total"],
    "properties": {
        "invoice_number": {"type": "string"},
        "total": {"type": "number"},
        "currency": {"type": "string"},
        "line_items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "description": {"type": "string"},
                    "amount": {"type": "number"},
                },
            },
        },
    },
}


@pytest.fixture
def schema_version(client, project):
    response = client.post(f"/projects/{project['id']}/schemas", json={
        "name": "Invoice", "description": "Supplier invoice fields", "definition": INVOICE_SCHEMA,
    })
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture
def dataset(client, project):
    response = client.post(f"/projects/{project['id']}/datasets", json={
        "name": "January batch", "description": "Scanned invoices",
    })
    assert response.status_code == 201, response.text
    return response.json()


def png_bytes(width=600, height=800, colour=(255, 255, 255)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), colour).save(buffer, format="PNG")
    return buffer.getvalue()


def jpeg_bytes(width=400, height=500, colour=(200, 200, 200)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), colour).save(buffer, format="JPEG")
    return buffer.getvalue()


def pdf_bytes(pages=1) -> bytes:
    import fitz

    document = fitz.open()
    for index in range(pages):
        page = document.new_page()
        page.insert_text((72, 72), f"Invoice page {index + 1}")
    data = document.tobytes()
    document.close()
    return data


def upload(client, dataset_id, filename, content, content_type):
    return client.post(f"/datasets/{dataset_id}/documents",
                       files={"file": (filename, content, content_type)})
