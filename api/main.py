from __future__ import annotations

import uvicorn

from app.api.app import create_app
from app.config import get_settings

app = create_app(get_settings())


def run() -> None:
    settings = get_settings()
    print(
        f"[ttl-viz-api] starting on {settings.host}:{settings.port}  "
        f"log={settings.log_level}  graphs={settings.graphs_dir}"
    )
    uvicorn.run(
        app,
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level.lower(),
    )


if __name__ == "__main__":
    run()
