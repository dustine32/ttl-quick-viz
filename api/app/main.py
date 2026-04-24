import logging
import sys

from fastapi import FastAPI

from app.config import get_settings
from app.routes import router

logger = logging.getLogger(__name__)

app = FastAPI(title="TTL Quick Viz API")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(router)


@app.on_event("startup")
def _verify_graphs_dir() -> None:
    settings = get_settings()
    if not settings.graphs_dir.is_dir():
        logger.error(
            "GRAPHS_DIR does not exist or is not a directory: %s",
            settings.graphs_dir,
        )
        sys.exit(1)
    logger.info("serving graphs from: %s", settings.graphs_dir)
