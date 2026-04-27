from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="",
        extra="ignore",
    )

    graphs_dir: Path
    input_dir: Path | None = Field(default=None)
    enable_watcher: bool = Field(default=False)
    watcher_debounce_ms: int = Field(default=2000)
    host: str
    port: int
    log_level: str = Field(default="INFO")


@lru_cache
def get_settings() -> Settings:
    return Settings()
