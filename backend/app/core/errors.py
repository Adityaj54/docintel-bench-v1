from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException


class DomainError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status: int = 400,
        details: dict[str, Any] | None = None,
    ):
        self.code = code
        self.message = message
        self.status = status
        self.details = details or {}
        super().__init__(message)


class TransientError(DomainError):
    def __init__(self, message: str, code: str = "PROVIDER_UNAVAILABLE"):
        super().__init__(code, message, 503)


def error_response(
    code: str,
    message: str,
    status: int,
    details: dict[str, Any] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message, "details": details or {}}},
    )


async def domain_error_handler(request: Request, error: DomainError) -> JSONResponse:
    return error_response(error.code, error.message, error.status, error.details)


async def request_error_handler(request: Request, error: RequestValidationError) -> JSONResponse:
    issues = [
        {"path": ".".join(map(str, item["loc"])), "message": item["msg"], "type": item["type"]}
        for item in error.errors()
    ]
    return error_response("INVALID_REQUEST", "Check the highlighted fields.", 422, {"issues": issues})


async def integrity_error_handler(request: Request, error: IntegrityError) -> JSONResponse:
    return error_response("CONFLICT", "This change conflicts with an existing record.", 409)


async def http_error_handler(request: Request, error: HTTPException) -> JSONResponse:
    code = {404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED"}.get(error.status_code, "HTTP_ERROR")
    return error_response(code, str(error.detail), error.status_code)
