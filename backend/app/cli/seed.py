import hashlib
from io import BytesIO

import fitz
from PIL import Image, ImageDraw
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit.service import record
from app.db.session import SessionLocal
from app.jobs.queue import enqueue
from app.models import (
    Dataset,
    Document,
    ExtractionResult,
    ExtractionRun,
    ExtractionSchema,
    GroundTruth,
    Project,
    ProviderConfiguration,
    User,
)
from app.providers.mock import mock_value
from app.storage.factory import get_storage

INVOICE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["invoice_number", "vendor", "total", "currency", "items"],
    "properties": {
        "invoice_number": {"type": "string"},
        "vendor": {"type": "string", "examples": ["Northstar Supply"]},
        "total": {"type": "number", "minimum": 0},
        "currency": {"type": "string", "enum": ["USD"]},
        "items": {"type": "array", "items": {
            "type": "object", "required": ["description", "quantity"],
            "properties": {"description": {"type": "string"}, "quantity": {"type": "integer", "minimum": 1}},
            "additionalProperties": False,
        }},
    },
}


def sample_image(index: int) -> bytes:
    image = Image.new("RGB", (800, 1000), "white")
    draw = ImageDraw.Draw(image)
    draw.rectangle((40, 40, 760, 140), fill="#18243b")
    draw.text((65, 70), "NORTHSTAR SUPPLY / INVOICE", fill="white", font_size=28)
    draw.text((65, 200), f"Invoice NS-2026-{index:03d}", fill="#18243b", font_size=26)
    draw.text((65, 280), "Document intelligence evaluation sample", fill="#526079", font_size=20)
    draw.line((65, 350, 735, 350), fill="#ccd3dd", width=2)
    draw.text((65, 395), f"Office supplies        {index + 1} units", fill="#18243b", font_size=24)
    draw.text((65, 490), f"TOTAL                  USD {49 * (index + 1)}.00", fill="#18243b", font_size=26)
    draw.text((65, 880), "Synthetic demonstration document", fill="#526079", font_size=18)
    stream = BytesIO()
    image.save(stream, "PNG")
    return stream.getvalue()


def seed_for_user(db: Session, user: User) -> Project | None:
    if db.scalar(select(Project.id).where(Project.owner_id == user.id, Project.name == "Invoice lab")):
        return None
    project = Project(owner_id=user.id, name="Invoice lab",
                      description="Compare deterministic extraction configurations on sample invoices.")
    db.add(project)
    db.flush()
    dataset = Dataset(project_id=project.id, name="Sample invoices",
                      description="Two images and a PDF, with deterministic mock ground truth.")
    schema = ExtractionSchema(project_id=project.id, name="Invoice", description="Invoice fields",
                              definition=INVOICE_SCHEMA, created_by=user.id)
    baseline = ProviderConfiguration(project_id=project.id, name="Mock baseline",
                                     provider="mock", model="deterministic-v1", options={})
    noisy = ProviderConfiguration(project_id=project.id, name="Mock variation",
                                  provider="mock", model="deterministic-v1",
                                  options={"variant": "noisy", "response_format": "fenced"})
    db.add_all([dataset, schema, baseline, noisy])
    db.flush()
    storage = get_storage()
    documents = []
    for index in range(1, 4):
        content = sample_image(index)
        mime = "image/png"
        filename = f"invoice-{index}.png"
        if index == 3:
            with fitz.open() as pdf:
                pdf.new_page(width=600, height=750).insert_image(fitz.Rect(0, 0, 600, 750), stream=content)
                content = pdf.tobytes()
            mime, filename = "application/pdf", f"invoice-{index}.pdf"
        digest = hashlib.sha256(content).hexdigest()
        key = f"documents/{project.id}/seed/{filename}"
        storage.put(key, content, mime)
        document = Document(
            dataset_id=dataset.id, original_filename=filename, mime_type=mime,
            size_bytes=len(content), sha256=digest, storage_key=key, page_count=1,
            width=800 if mime == "image/png" else None, height=1000 if mime == "image/png" else None,
            uploaded_by=user.id,
        )
        db.add(document)
        db.flush()
        documents.append(document)
        db.add(GroundTruth(document_id=document.id, schema_id=schema.id,
                           value=mock_value(INVOICE_SCHEMA, digest), source="seed", updated_by=user.id))
        enqueue(db, "preprocess", document.id)
    for configuration in (baseline, noisy):
        run = ExtractionRun(
            project_id=project.id, dataset_id=dataset.id, schema_id=schema.id,
            provider_configuration_id=configuration.id, name=configuration.name + " / sample invoices",
            provider_snapshot={"name": configuration.name, "provider": "mock",
                               "model": configuration.model, "options": configuration.options},
            evaluation_options={}, total_documents=len(documents), created_by=user.id,
        )
        db.add(run)
        db.flush()
        for document in documents:
            db.add(ExtractionResult(run_id=run.id, document_id=document.id,
                                    provider="mock", model=configuration.model))
    record(db, project_id=project.id, user_id=user.id, action="project.seeded",
           entity_type="project", entity_id=project.id,
           details={"documents": len(documents), "runs": 2})
    db.flush()
    return project


def main():
    with SessionLocal() as db:
        users = db.scalars(select(User).where(User.disabled.is_(False))).all()
        if not users:
            print("Register an account in the browser first; no shared credentials are created.")
            return
        count = sum(seed_for_user(db, user) is not None for user in users)
        db.commit()
        print(f"Created {count} sample projects.")


if __name__ == "__main__":
    main()
