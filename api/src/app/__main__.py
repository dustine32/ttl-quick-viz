from __future__ import annotations

import uvicorn

from app.api.app import create_app
from app.config import get_settings


def run() -> None:
    settings = get_settings()
    uvicorn.run(create_app(settings), host=settings.host, port=settings.port)


if __name__ == "__main__":
    run()
