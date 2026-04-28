"""Read historical TTL versions from a git repository via `git log` / `git show`.

Used by the diff feature to compare the currently-rendered graph against the
last N committed versions of the same TTL file. The repo and subdir are
configured by ``MODELS_GIT_REPO`` / ``MODELS_GIT_SUBDIR``.

Invokes the system ``git`` CLI via ``subprocess``. No third-party git
bindings — keeps the dependency footprint small and the failure modes
explicit.
"""

from __future__ import annotations

import logging
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

_ID_RE = re.compile(r"^[A-Za-z0-9_.-]+$")


class GitRepoNotConfigured(Exception):
    """``MODELS_GIT_REPO`` is unset (or set to a non-git directory)."""


class GitFileNotFound(Exception):
    """The requested TTL has no history in the configured repo."""


class GitCommandFailed(Exception):
    """``git`` returned non-zero for a reason that isn't ``not-found``."""


class InvalidGraphId(Exception):
    """Graph id failed validation. Distinct from the other services'
    ``InvalidGraphId`` so error mapping can stay layered."""


@dataclass(frozen=True)
class CommitMeta:
    sha: str
    subject: str
    date: str  # ISO 8601, committer date


class GitHistoryService:
    """Lists commits that touched ``<subdir>/<id>.ttl`` and reads each version."""

    def __init__(self, repo: Path | None, subdir: str = "models") -> None:
        self._repo = Path(repo) if repo is not None else None
        self._subdir = subdir.strip("/").strip("\\")

    def is_enabled(self) -> bool:
        return self._repo is not None and (self._repo / ".git").exists()

    def list_history(self, graph_id: str, n: int) -> list[CommitMeta]:
        """Return the last ``n`` commits that touched ``<subdir>/<id>.ttl``.

        Raises ``GitRepoNotConfigured`` if the repo is unset or not a git
        working tree, ``InvalidGraphId`` for bad ids, ``GitFileNotFound``
        when the file has no history, and ``GitCommandFailed`` for other
        ``git`` errors.
        """
        repo = self._require_repo()
        self._validate_id(graph_id)
        rel_path = self._rel_path(graph_id)

        # %H<TAB>%s<TAB>%cI — sha, subject, committer date (ISO 8601 strict).
        result = subprocess.run(
            [
                "git",
                "-C",
                str(repo),
                "log",
                f"-n{n}",
                "--format=%H%x09%s%x09%cI",
                "--",
                rel_path,
            ],
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        if result.returncode != 0:
            stderr = (result.stderr or "").strip()
            logger.error("git log failed: %s", stderr)
            raise GitCommandFailed(f"git log failed: {stderr}")

        stdout = (result.stdout or "").strip()
        if not stdout:
            raise GitFileNotFound(graph_id)

        commits: list[CommitMeta] = []
        for line in stdout.splitlines():
            parts = line.split("\t")
            if len(parts) != 3:
                logger.warning("unexpected git log line: %r", line)
                continue
            sha, subject, date = parts
            commits.append(CommitMeta(sha=sha, subject=subject, date=date))
        return commits

    def read_ttl_at(self, sha: str, graph_id: str) -> str:
        """Return the TTL contents of ``<subdir>/<id>.ttl`` at ``sha``."""
        repo = self._require_repo()
        self._validate_id(graph_id)
        if not _SHA_RE.match(sha):
            raise InvalidGraphId(sha)
        rel_path = self._rel_path(graph_id)

        result = subprocess.run(
            ["git", "-C", str(repo), "show", f"{sha}:{rel_path}"],
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        if result.returncode != 0:
            stderr = (result.stderr or "").strip()
            # `git show` emits "fatal: path '...' exists on disk, but not in '<sha>'"
            # or "fatal: invalid object name '<sha>'" — both surface as 404 at the
            # api layer; the service classifies them as GitFileNotFound.
            if "exists on disk" in stderr or "does not exist" in stderr or "invalid object" in stderr:
                raise GitFileNotFound(f"{graph_id}@{sha}")
            logger.error("git show failed: %s", stderr)
            raise GitCommandFailed(f"git show failed: {stderr}")
        return result.stdout

    def _rel_path(self, graph_id: str) -> str:
        # Always forward-slash for git, regardless of platform.
        if self._subdir:
            return f"{self._subdir}/{graph_id}.ttl"
        return f"{graph_id}.ttl"

    def _require_repo(self) -> Path:
        if self._repo is None:
            raise GitRepoNotConfigured("MODELS_GIT_REPO is not set")
        if not (self._repo / ".git").exists():
            raise GitRepoNotConfigured(
                f"MODELS_GIT_REPO is not a git working tree: {self._repo}"
            )
        return self._repo

    @staticmethod
    def _validate_id(graph_id: str) -> None:
        if not _ID_RE.match(graph_id) or ".." in graph_id:
            raise InvalidGraphId(graph_id)


# 7–40 hex chars: matches both short and full SHAs, plus references like
# `HEAD~1` are NOT accepted here — we only allow callers to pass back a SHA
# we ourselves emitted from `list_history`. (`HEAD~1` would let the caller
# choose arbitrary refs; right now we only support pinned SHAs to keep the
# attack surface narrow.)
_SHA_RE = re.compile(r"^[0-9a-fA-F]{7,40}$")
