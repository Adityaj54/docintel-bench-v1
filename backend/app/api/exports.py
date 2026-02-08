from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Response

from app.auth.dependencies import AuthenticatedUser, Database
from app.exports.service import export_records, render

router = APIRouter(tags=["exports"])


@router.get("/runs/{run_id}/export")
def download(run_id: UUID, db: Database, user: AuthenticatedUser,
             format: Literal["json", "jsonl", "csv"] = "json"):
    content, media = render(list(export_records(db, user, run_id)), format)
    return Response(content, media_type=media, headers={
        "Content-Disposition": f'attachment; filename="run-{run_id}.{format}"',
        "Cache-Control": "private, no-store",
    })
