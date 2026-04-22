from __future__ import annotations

import csv
import io
import json
import re
from datetime import datetime
from pathlib import Path
from typing import TypedDict

from app.schemas.provider import SourceFileDetail, SourceFileSummary
from app.services.storage_service import storage_service


class SourceEntry(TypedDict):
    path: Path
    category: str
    source: str


class SourceService:
    def list_sources(self, category: str | None = None) -> list[SourceFileSummary]:
        entries = self._active_entries(category)
        if category:
            entries = [entry for entry in entries if entry["category"] == category]
        entries.sort(key=lambda entry: entry["path"].stat().st_mtime, reverse=True)
        return [self._build_summary(entry["path"], entry["category"], entry["source"]) for entry in entries]

    def get_source_detail(self, source_id: str) -> SourceFileDetail | None:
        resolved = self._resolve_source_id(source_id)
        if resolved is None:
            return None

        path, category, source = resolved
        if not path.exists() or not path.is_file():
            return None

        summary = self._build_summary(path, category, source)
        suffix = path.suffix.lower()
        content = path.read_bytes()
        try:
            if suffix in {".csv", ".tsv"}:
                delimiter = "\t" if suffix == ".tsv" else ","
                headers, rows = self._read_delimited(content, delimiter)
                return SourceFileDetail(
                    **summary.model_dump(),
                    view_type="table",
                    headers=headers,
                    rows=rows,
                )

            if suffix == ".json":
                text = self._format_json(content)
                return SourceFileDetail(
                    **summary.model_dump(),
                    view_type="json",
                    text_content=text,
                )

            if suffix == ".md":
                return SourceFileDetail(
                    **summary.model_dump(),
                    view_type="markdown",
                    text_content=content.decode("utf-8", errors="ignore"),
                )

            if suffix == ".pdf":
                text, page_count = self._extract_pdf_text(content)
                return SourceFileDetail(
                    **summary.model_dump(),
                    view_type="pdf",
                    text_content=text,
                    page_count=page_count,
                )

            return SourceFileDetail(
                **summary.model_dump(),
                view_type="text",
                text_content=content.decode("utf-8", errors="ignore"),
            )
        except Exception as exc:
            return SourceFileDetail(
                **summary.model_dump(),
                view_type="text",
                text_content=self._fallback_text_content(path, exc),
            )

    @property
    def _mock_base_dir(self) -> Path:
        return Path(__file__).resolve().parents[4] / "mock_uploads"

    def _list_storage_entries(self) -> list[SourceEntry]:
        base_dir = storage_service.base_dir
        if not base_dir.exists():
            return []

        return [
            {
                "path": path,
                "category": path.parent.name,
                "source": "stored",
            }
            for path in base_dir.rglob("*")
            if path.is_file()
        ]

    def _list_mock_entries(self) -> list[SourceEntry]:
        base_dir = self._mock_base_dir
        if not base_dir.exists():
            return []

        entries: list[SourceEntry] = []
        for path in base_dir.iterdir():
            if not path.is_file():
                continue
            category = self._mock_category_for_path(path)
            if category is None:
                continue
            entries.append(
                {
                    "path": path,
                    "category": category,
                    "source": "mock",
                }
            )
        return entries

    def _active_entries(self, category: str | None = None) -> list[SourceEntry]:
        storage_entries = self._list_storage_entries()
        mock_entries = self._list_mock_entries()
        if category:
            storage_for_category = [entry for entry in storage_entries if entry["category"] == category]
            if storage_for_category:
                return storage_for_category
            return [entry for entry in mock_entries if entry["category"] == category]

        storage_categories = {entry["category"] for entry in storage_entries}
        return storage_entries + [entry for entry in mock_entries if entry["category"] not in storage_categories]

    def _resolve_source_id(self, source_id: str) -> tuple[Path, str, str] | None:
        if ":" not in source_id:
            return self._resolve_from_base(storage_service.base_dir.resolve(), source_id, "stored")

        source, relative_id = source_id.split(":", 1)
        if source == "stored":
            return self._resolve_from_base(storage_service.base_dir.resolve(), relative_id, source)
        if source == "mock":
            resolved = self._resolve_from_base(self._mock_base_dir.resolve(), relative_id, source)
            if resolved is None:
                return None
            path, _, entry_source = resolved
            category = self._mock_category_for_path(path)
            if category is None:
                return None
            return path, category, entry_source
        return None

    def _resolve_from_base(self, base: Path, relative_id: str, source: str) -> tuple[Path, str, str] | None:
        target = (base / Path(relative_id)).resolve()
        try:
            target.relative_to(base)
        except ValueError:
            return None
        return target, target.parent.name, source

    def _build_summary(self, path: Path, category: str, source: str) -> SourceFileSummary:
        base_dir = storage_service.base_dir if source == "stored" else self._mock_base_dir
        relative = path.relative_to(base_dir).as_posix()
        stat = path.stat()
        return SourceFileSummary(
            id=f"{source}:{relative}",
            category=category,
            filename=path.name,
            display_name=self._display_name(path.name),
            extension=path.suffix.lower().lstrip("."),
            size_bytes=stat.st_size,
            updated_at=datetime.fromtimestamp(stat.st_mtime),
        )

    def _mock_category_for_path(self, path: Path) -> str | None:
        name = path.name.lower()
        if "provider" in name or "market_intelligence" in name:
            return "providers"
        if "crm" in name:
            return "crm"
        if "product" in name:
            return "products"
        if "knowledge" in name or name == "readme.md":
            return "knowledge"
        return None

    def _display_name(self, filename: str) -> str:
        match = re.match(r"^[0-9a-fA-F-]{36}-(.+)$", filename)
        return match.group(1) if match else filename

    def _read_delimited(self, content: bytes, delimiter: str) -> tuple[list[str], list[list[str]]]:
        text = content.decode("utf-8-sig", errors="ignore")
        reader = csv.reader(io.StringIO(text), delimiter=delimiter)
        rows = list(reader)
        if not rows:
            return [], []
        headers = [str(cell) for cell in rows[0]]
        body = [[str(cell) for cell in row] for row in rows[1:]]
        return headers, body

    def _format_json(self, content: bytes) -> str:
        try:
            payload = json.loads(content.decode("utf-8", errors="ignore"))
            return json.dumps(payload, indent=2)
        except json.JSONDecodeError:
            return content.decode("utf-8", errors="ignore")

    def _extract_pdf_text(self, content: bytes) -> tuple[str, int]:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(content))
        text = "\n\n".join(page.extract_text() or "" for page in reader.pages)
        return text, len(reader.pages)

    def _fallback_text_content(self, path: Path, exc: Exception) -> str:
        return (
            f"Preview unavailable for {path.name}.\n\n"
            f"The file was saved successfully, but the server could not render a preview for this format.\n"
            f"Reason: {exc.__class__.__name__}: {exc}"
        )


source_service = SourceService()
