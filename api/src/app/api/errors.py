from __future__ import annotations

import logging
from json import JSONDecodeError

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.repositories.base import GraphNotFound
from app.services.conversion_service import (
    InputDirNotConfigured,
    TtlNotFound,
)
from app.services.conversion_service import (
    InvalidGraphId as ConversionInvalidGraphId,
)
from app.services.git_history_service import (
    GitCommandFailed,
    GitFileNotFound,
    GitRepoNotConfigured,
)
from app.services.git_history_service import (
    InvalidGraphId as GitInvalidGraphId,
)
from app.services.graph_service import InvalidGraphId

logger = logging.getLogger(__name__)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(GraphNotFound)
    async def _graph_not_found(_: Request, exc: GraphNotFound) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": "graph not found"})

    @app.exception_handler(TtlNotFound)
    async def _ttl_not_found(_: Request, exc: TtlNotFound) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": "source ttl not found"})

    @app.exception_handler(InvalidGraphId)
    async def _invalid_id(_: Request, exc: InvalidGraphId) -> JSONResponse:
        return JSONResponse(status_code=400, content={"detail": "invalid graph id"})

    @app.exception_handler(ConversionInvalidGraphId)
    async def _invalid_id_conv(_: Request, exc: ConversionInvalidGraphId) -> JSONResponse:
        return JSONResponse(status_code=400, content={"detail": "invalid graph id"})

    @app.exception_handler(InputDirNotConfigured)
    async def _input_dir(_: Request, exc: InputDirNotConfigured) -> JSONResponse:
        logger.warning("conversion requested but INPUT_DIR not configured: %s", exc)
        return JSONResponse(
            status_code=503,
            content={"detail": "conversion unavailable: INPUT_DIR not configured"},
        )

    @app.exception_handler(GitRepoNotConfigured)
    async def _git_not_configured(_: Request, exc: GitRepoNotConfigured) -> JSONResponse:
        logger.warning("git history requested but MODELS_GIT_REPO not configured: %s", exc)
        return JSONResponse(
            status_code=503,
            content={"detail": "history unavailable: MODELS_GIT_REPO not configured"},
        )

    @app.exception_handler(GitFileNotFound)
    async def _git_file_not_found(_: Request, exc: GitFileNotFound) -> JSONResponse:
        return JSONResponse(
            status_code=404,
            content={"detail": "no history for this graph in MODELS_GIT_REPO"},
        )

    @app.exception_handler(GitInvalidGraphId)
    async def _invalid_id_git(_: Request, exc: GitInvalidGraphId) -> JSONResponse:
        return JSONResponse(status_code=400, content={"detail": "invalid graph id"})

    @app.exception_handler(GitCommandFailed)
    async def _git_failed(_: Request, exc: GitCommandFailed) -> JSONResponse:
        logger.exception("git command failed")
        return JSONResponse(
            status_code=500,
            content={"detail": "git command failed"},
        )

    @app.exception_handler(JSONDecodeError)
    async def _json_decode(_: Request, exc: JSONDecodeError) -> JSONResponse:
        logger.exception("JSON parse failed")
        return JSONResponse(
            status_code=500,
            content={"detail": "failed to read graph"},
        )

    @app.exception_handler(ValueError)
    async def _value_error(_: Request, exc: ValueError) -> JSONResponse:
        logger.exception("translator or validation failed")
        return JSONResponse(
            status_code=500,
            content={"detail": "failed to read graph"},
        )
