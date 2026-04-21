from pathlib import Path
from uuid import uuid4

from app.core.config import settings


class StorageService:
    def __init__(self) -> None:
        self.base_dir = Path(settings.raw_storage_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def save_upload(self, filename: str, content: bytes, category: str) -> str:
        target_dir = self.base_dir / category
        target_dir.mkdir(parents=True, exist_ok=True)
        safe_name = f"{uuid4()}-{Path(filename).name}"
        target = target_dir / safe_name
        target.write_bytes(content)
        return str(target)


storage_service = StorageService()
