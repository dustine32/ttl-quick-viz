from __future__ import annotations

from fastapi import Depends

from app.config import Settings, get_settings
from app.repositories.filesystem import FilesystemGraphRepository
from app.services.conversion_service import ConversionService
from app.services.diff_service import DiffService
from app.services.git_history_service import GitHistoryService
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


def get_git_history_service(
    settings: Settings = Depends(get_settings),
) -> GitHistoryService:
    return GitHistoryService(settings.models_git_repo, settings.models_git_subdir)


def get_diff_service(
    git: GitHistoryService = Depends(get_git_history_service),
) -> DiffService:
    return DiffService(git)
