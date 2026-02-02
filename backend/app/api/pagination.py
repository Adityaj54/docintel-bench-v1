from typing import Annotated

from fastapi import Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]


def page(db: Session, query, limit: int, offset: int, serialize=None) -> dict:
    total = db.scalar(select(func.count()).select_from(query.order_by(None).subquery())) or 0
    rows = db.scalars(query.limit(limit).offset(offset)).all()
    return {
        "items": [serialize(row) for row in rows] if serialize else rows,
        "total": total,
        "offset": offset,
        "limit": limit,
    }
