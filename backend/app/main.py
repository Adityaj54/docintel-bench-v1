import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException

from app.api import (
    auth,
    datasets,
    documents,
    exports,
    health,
    metrics,
    operations,
    projects,
    runs,
    schemas,
)
from app.auth.security import signing_key
from app.core.body_limit import BodyLimitMiddleware
from app.core.config import get_settings
from app.core.errors import (
    DomainError,
    domain_error_handler,
    error_response,
    http_error_handler,
    integrity_error_handler,
    request_error_handler,
)
from app.core.logging import RequestContextMiddleware, configure_logging

configure_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    signing_key()
    yield


app = FastAPI(title="DocIntel Bench API", version="0.1.0", lifespan=lifespan)
app.add_exception_handler(DomainError, domain_error_handler)
app.add_exception_handler(RequestValidationError, request_error_handler)
app.add_exception_handler(IntegrityError, integrity_error_handler)
app.add_exception_handler(HTTPException, http_error_handler)


@app.exception_handler(Exception)
async def unexpected_error(request: Request, error: Exception):
    logging.getLogger("docintel.http").error("Unhandled request failure: %s", type(error).__name__)
    return error_response("INTERNAL_ERROR", "The request could not be completed.", 500)


for module in (auth, projects, schemas, datasets, documents, runs, metrics, operations, exports, health):
    app.include_router(module.router, prefix="/api")

app.add_middleware(BodyLimitMiddleware)
app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware, allow_origins=sorted(get_settings().origins), allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-CSRF-Token"],
    expose_headers=["X-Request-ID", "Content-Disposition"],
)
