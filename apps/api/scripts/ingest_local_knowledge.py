from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.db.session import create_tables
from app.db.seed import seed_demo_state
from app.services.file_parsing_service import file_parsing_service
from app.services.ingestion_service import IngestionService


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: py -3.11 scripts/ingest_local_knowledge.py <path-to-product-file>")
        return 1

    source = Path(sys.argv[1])
    if not source.exists():
        print(f"File not found: {source}")
        return 1

    create_tables()
    seed_demo_state()
    count = IngestionService()._store_products_with_chunks(file_parsing_service.parse_products_file(source.name, source.read_bytes()))  # type: ignore[attr-defined]
    print(f"Ingested {count} product records from {source}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
