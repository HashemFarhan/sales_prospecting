from pathlib import Path
from uuid import uuid4

from app.core.config import settings


class StorageService:
    def __init__(self) -> None:
        self.base_dir = Path(settings.raw_storage_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def save_upload(self, filename: str, content: bytes, category: str) -> str:
        target_dir = self._category_dir(category)
        target_dir.mkdir(parents=True, exist_ok=True)
        safe_name = f"{uuid4()}-{Path(filename).name}"
        target = target_dir / safe_name
        target.write_bytes(content)
        return str(target)

    def replace_upload(self, filename: str, content: bytes, category: str) -> str:
        target_dir = self._category_dir(category)
        if target_dir.exists():
            for existing in target_dir.iterdir():
                if existing.is_file():
                    existing.unlink()
                elif existing.is_dir():
                    for nested in existing.rglob("*"):
                        if nested.is_file():
                            nested.unlink()
                    for nested_dir in sorted([path for path in existing.rglob("*") if path.is_dir()], reverse=True):
                        nested_dir.rmdir()
                    existing.rmdir()
        return self.save_upload(filename, content, category)

    def _category_dir(self, category: str) -> Path:
        return self.base_dir / category


storage_service = StorageService()
