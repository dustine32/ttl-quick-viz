from __future__ import annotations

from fastapi import Depends

from app.config import Settings, get_settings
from app.repositories.filesystem import FilesystemGraphRepository
from app.services.conversion_service import ConversionService
from app.services.graph_service import GraphService


def get_repository(
    settings: Settings = Depends(get_settings),
) -> FilesystemGraphRepository:
    return FilesystemGraphRepository(settings.graphs_dir)


def get_service(
    repo: FilesystemGraphRepository = Depends(get_repository),
) -> GraphService:
    return GraphService(repo)


def get_conversion_service(
    settings: Settings = Depends(get_settings),
) -> ConversionService:
    return ConversionService(settings.input_dir, settings.graphs_dir)
