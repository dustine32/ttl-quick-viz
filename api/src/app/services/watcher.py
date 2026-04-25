"""File watcher that auto-runs ttl2json when .ttl files in INPUT_DIR change."""

from __future__ import annotations

import logging
import threading
from pathlib import Path

from ttl2json import convert_file
from watchdog.events import FileSystemEvent, FileSystemEventHandler
from watchdog.observers import Observer

logger = logging.getLogger(__name__)


class _Handler(FileSystemEventHandler):
    def __init__(self, on_change) -> None:
        self._on_change = on_change

    def on_created(self, event: FileSystemEvent) -> None:
        if not event.is_directory:
            self._on_change("created", str(event.src_path))

    def on_modified(self, event: FileSystemEvent) -> None:
        if not event.is_directory:
            self._on_change("modified", str(event.src_path))

    def on_deleted(self, event: FileSystemEvent) -> None:
        if not event.is_directory:
            self._on_change("deleted", str(event.src_path))

    def on_moved(self, event) -> None:
        if event.is_directory:
            return
        self._on_change("deleted", str(event.src_path))
        self._on_change("created", str(event.dest_path))


class ConversionWatcher:
    """Watch a directory of .ttl files and re-convert on change (debounced per file)."""

    def __init__(
        self,
        input_dir: Path,
        graphs_dir: Path,
        *,
        debounce_ms: int = 500,
    ) -> None:
        self._input_dir = Path(input_dir)
        self._graphs_dir = Path(graphs_dir)
        self._debounce_s = max(0, debounce_ms) / 1000.0
        self._observer = Observer()
        self._timers: dict[str, threading.Timer] = {}
        self._lock = threading.Lock()
        self._started = False

    def start(self) -> None:
        if self._started:
            return
        if not self._input_dir.is_dir():
            raise FileNotFoundError(f"INPUT_DIR does not exist: {self._input_dir}")
        self._graphs_dir.mkdir(parents=True, exist_ok=True)
        self._observer.schedule(
            _Handler(self._enqueue),
            str(self._input_dir),
            recursive=False,
        )
        self._observer.start()
        self._started = True
        logger.info(
            "conversion watcher started on %s (debounce %dms)",
            self._input_dir,
            int(self._debounce_s * 1000),
        )

    def stop(self) -> None:
        if not self._started:
            return
        self._observer.stop()
        self._observer.join(timeout=5)
        with self._lock:
            for t in self._timers.values():
                t.cancel()
            self._timers.clear()
        self._started = False
        logger.info("conversion watcher stopped")

    def _enqueue(self, event_type: str, path: str) -> None:
        if not path.endswith(".ttl"):
            return
        stem = Path(path).stem
        with self._lock:
            existing = self._timers.pop(stem, None)
            if existing is not None:
                existing.cancel()
            timer = threading.Timer(
                self._debounce_s,
                self._fire,
                args=(event_type, path),
            )
            timer.daemon = True
            self._timers[stem] = timer
            timer.start()

    def _fire(self, event_type: str, path_str: str) -> None:
        path = Path(path_str)
        try:
            if event_type == "deleted":
                self._handle_delete(path)
                return
            if not path.is_file():
                return  # rapid delete after modify
            result = convert_file(path, self._graphs_dir, force=True)
            if result.ok:
                logger.info(
                    "watcher converted %s (%d nodes, %d edges, %.0fms)",
                    path.name,
                    result.node_count or 0,
                    result.edge_count or 0,
                    result.duration_ms or 0,
                )
            else:
                logger.error("watcher conversion failed for %s: %s", path.name, result.error)
        except Exception:
            logger.exception("watcher crashed handling %s", path)

    def _handle_delete(self, path: Path) -> None:
        out_path = self._graphs_dir / f"{path.stem}.json"
        try:
            out_path.unlink(missing_ok=True)
            logger.info("watcher removed %s (source deleted)", out_path.name)
        except OSError:
            logger.exception("watcher failed to remove %s", out_path)
