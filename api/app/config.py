from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


_DEFAULT_GRAPHS_DIR = (Path(__file__).resolve().parent.parent.parent
                       / "conversion" / "downloads" / "output")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="", extra="ignore")

    graphs_dir: Path = Field(default=_DEFAULT_GRAPHS_DIR)


@lru_cache
def get_settings() -> Settings:
    return Settings()
