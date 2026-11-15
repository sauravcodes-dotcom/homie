"""Domain errors and their mapping to HTTP responses."""

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("homie")


class HomieError(Exception):
    """Base class for expected, user-facing application errors."""

    status_code = 400
    code = "bad_request"

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class NotFoundError(HomieError):
    status_code = 404
    code = "not_found"


class AIProviderError(HomieError):
    """An upstream LLM / embedding provider failed or returned unusable output."""

    status_code = 502
    code = "ai_provider_error"


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(HomieError)
    async def _homie_error(_: Request, exc: HomieError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.message}},
        )

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error", exc_info=exc)
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "internal_error", "message": "Internal server error"}},
        )
