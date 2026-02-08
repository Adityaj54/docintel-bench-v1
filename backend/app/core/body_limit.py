from starlette.types import ASGIApp, Receive, Scope, Send
from starlette.requests import ClientDisconnect

from app.core.config import get_settings
from app.core.errors import error_response


class BodyLimitMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = dict(scope.get("headers", []))
        multipart = headers.get(b"content-type", b"").startswith(b"multipart/form-data")
        limit = get_settings().max_upload_bytes + 65536 if multipart else 1024 * 1024
        try:
            length = int(headers.get(b"content-length", b"0"))
        except ValueError:
            return await error_response("INVALID_REQUEST", "Invalid content length.", 400)(
                scope, receive, send
            )
        if length < 0 or length > limit:
            return await error_response("BODY_TOO_LARGE", "Request body exceeds the limit.", 413)(
                scope, receive, send
            )
        consumed = 0
        exceeded = False
        started = False

        async def bounded_receive():
            nonlocal consumed, exceeded
            message = await receive()
            if message["type"] == "http.request":
                consumed += len(message.get("body", b""))
                if consumed > limit:
                    exceeded = True
                    raise ClientDisconnect()
            return message

        async def guarded_send(message):
            nonlocal started
            if exceeded:
                return
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, bounded_receive, guarded_send)
        except ClientDisconnect:
            if not exceeded:
                raise
        if exceeded and not started:
            await error_response("BODY_TOO_LARGE", "Request body exceeds the limit.", 413)(
                scope, receive, send
            )
