from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.errors import register_exception_handlers
from app.api.routes import graphs, health
from app.config import Settings, get_settings
from app.logging import configure_logging
from app.services.watcher import ConversionWatcher

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    if not settings.graphs_dir.is_dir():
        raise RuntimeError(
            f"GRAPHS_DIR does not exist or is not a directory: {settings.graphs_dir}"
        )

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        watcher: ConversionWatcher | None = None
        if settings.enable_watcher:
            if settings.input_dir is None:
                logger.warning("ENABLE_WATCHER=true but INPUT_DIR is unset; watcher disabled")
            else:
                try:
                    watcher = ConversionWatcher(
                        settings.input_dir,
                        settings.graphs_dir,
                        debounce_ms=settings.watcher_debounce_ms,
                    )
                    watcher.start()
                except Exception:
                    logger.exception("failed to start file watcher; continuing without it")
                    watcher = None
        try:
            yield
        finally:
            if watcher is not None:
                watcher.stop()

    app = FastAPI(title="TTL Quick Viz API", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)
    app.include_router(health.router, prefix="/api")
    app.include_router(graphs.router, prefix="/api")
    return app
