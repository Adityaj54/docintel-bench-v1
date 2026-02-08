import csv
import io
import json
from typing import Any
from uuid import UUID

from fastapi.encoders import jsonable_encoder
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ExtractionResult, User
from app.schemas.runs import ResultRead
from app.services.access import run_for
from app.services.runs import serialize_result


def flatten(value: Any, prefix: str = "") -> dict[str, Any]:
    output = {}
    if isinstance(value, dict) and value:
        for key, item in value.items():
            escaped = key.replace("\\", "\\\\").replace(".", "\\.")
            child = f"{prefix}.{escaped}" if prefix else escaped
            output.update(flatten(item, child))
    elif isinstance(value, list) and value:
        for index, item in enumerate(value):
            output.update(flatten(item, f"{prefix}.{index}" if prefix else str(index)))
    else:
        output[prefix or "$"] = value
    return output


def csv_cell(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list, bool)):
        return json.dumps(value, ensure_ascii=False)
    text = str(value)
    if isinstance(value, str) and text.lstrip().startswith(("=", "+", "-", "@", "\t", "\r")):
        return "'" + text
    return text


def export_records(db: Session, user: User, run_id: UUID):
    run_for(db, run_id, user)
    query = select(ExtractionResult).where(ExtractionResult.run_id == run_id).order_by(
        ExtractionResult.created_at, ExtractionResult.id
    )
    for result in db.scalars(query):
        record = ResultRead.model_validate(serialize_result(db, result))
        yield jsonable_encoder(record)


def render(records: list[dict], format: str) -> tuple[str, str]:
    if format == "json":
        return json.dumps(records, ensure_ascii=False, indent=2), "application/json"
    if format == "jsonl":
        return "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in records), "application/x-ndjson"
    rows = []
    for record in records:
        row = {key: record[key] for key in (
            "id", "document_id", "document_name", "status", "provider", "model",
            "latency_ms", "input_tokens", "output_tokens", "estimated_cost",
        )}
        row.update(flatten(record.get("output"), "output"))
        row["validation.valid"] = (record.get("validation") or {}).get("valid")
        row["evaluation.score"] = (record.get("evaluation") or {}).get("score")
        row["error.code"] = (record.get("error") or {}).get("code")
        rows.append(row)
    headers = list(dict.fromkeys(key for row in rows for key in row))
    stream = io.StringIO(newline="")
    writer = csv.DictWriter(stream, fieldnames=headers)
    writer.writeheader()
    for row in rows:
        writer.writerow({key: csv_cell(value) for key, value in row.items()})
    return stream.getvalue(), "text/csv"
