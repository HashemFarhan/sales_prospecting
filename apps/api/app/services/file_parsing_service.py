from __future__ import annotations

import csv
import io
import json
import re
from pathlib import Path
from uuid import uuid4

from pypdf import PdfReader

from app.models.entities import CRMRecord, Product, Provider


class FileParsingService:
    def parse_providers_csv(self, filename: str, content: bytes) -> list[Provider]:
        rows = self._read_csv(content)
        providers: list[Provider] = []
        for row in rows:
            providers.append(
                Provider(
                    id=row.get("id") or f"provider-{uuid4()}",
                    doctor_name=row.get("doctor_name") or row.get("dr_name") or row.get("name") or "Unknown Doctor",
                    clinic_or_hospital=row.get("clinic_or_hospital") or row.get("clinic") or row.get("hospital_name") or "Unknown Clinic",
                    region=row.get("region") or row.get("territory") or "Unassigned",
                    size=int(row.get("size") or row.get("estimated_patient_volume") or row.get("patient_volume") or 0),
                    specialty=row.get("specialty") or "Unknown Specialty",
                    created_at=self._now(),
                )
            )
        return providers

    def parse_crm_file(self, filename: str, content: bytes) -> list[CRMRecord]:
        suffix = Path(filename).suffix.lower()
        if suffix == ".csv":
            rows = self._read_csv(content)
            return [
                CRMRecord(
                    id=row.get("id") or f"crm-{uuid4()}",
                    provider_id=row["provider_id"],
                    concern=row.get("concern") or row.get("concern_type") or "general",
                    interest_text=row.get("interest_text") or row.get("interests") or row.get("note_text") or "",
                    note_text=row.get("note_text") or row.get("interest_text") or "",
                    note_date=self._parse_date(row.get("note_date")),
                    created_at=self._now(),
                )
                for row in rows
            ]

        text = content.decode("utf-8", errors="ignore")
        blocks = [block.strip() for block in re.split(r"\n\s*\n", text) if block.strip()]
        records: list[CRMRecord] = []
        for block in blocks:
            lines = [line.strip() for line in block.splitlines() if line.strip()]
            provider_id = self._extract_prefixed_value(lines, "provider_id") or self._extract_prefixed_value(lines, "provider")
            if not provider_id:
                continue
            records.append(
                CRMRecord(
                    id=f"crm-{uuid4()}",
                    provider_id=provider_id,
                    concern=self._extract_prefixed_value(lines, "concern") or self._extract_prefixed_value(lines, "concern_type") or "general",
                    interest_text=self._extract_prefixed_value(lines, "interest_text") or self._extract_prefixed_value(lines, "interests") or "",
                    note_text=self._extract_prefixed_value(lines, "note_text") or block,
                    note_date=self._parse_date(self._extract_prefixed_value(lines, "note_date")),
                    created_at=self._now(),
                )
            )
        return records

    def parse_products_file(self, filename: str, content: bytes) -> list[Product]:
        suffix = Path(filename).suffix.lower()
        if suffix == ".csv":
            rows = self._read_csv(content)
            return [
                Product(
                    id=row.get("id") or f"product-{uuid4()}",
                    product_name=row.get("product_name") or row.get("name") or "Unnamed Product",
                    description=row.get("description") or "",
                    details=row.get("details") or row.get("description") or "",
                    source_document=row.get("source_document") or filename,
                    created_at=self._now(),
                    updated_at=self._now(),
                )
                for row in rows
            ]
        if suffix == ".json":
            payload = json.loads(content.decode("utf-8", errors="ignore"))
            items = payload if isinstance(payload, list) else payload.get("products", [])
            return [
                Product(
                    id=item.get("id") or f"product-{uuid4()}",
                    product_name=item.get("product_name") or item.get("name") or "Unnamed Product",
                    description=item.get("description") or "",
                    details=item.get("details") or item.get("description") or "",
                    source_document=item.get("source_document") or filename,
                    created_at=self._now(),
                    updated_at=self._now(),
                )
                for item in items
            ]

        text = self._extract_text(filename, content)
        product_name = self._extract_markdown_heading(text) or Path(filename).stem.replace("-", " ").title()
        description = " ".join(text.split())[:220].strip()
        return [
            Product(
                id=f"product-{uuid4()}",
                product_name=product_name,
                description=description,
                details=text,
                source_document=filename,
                created_at=self._now(),
                updated_at=self._now(),
            )
        ]

    def _read_csv(self, content: bytes) -> list[dict[str, str]]:
        text = content.decode("utf-8-sig", errors="ignore")
        return list(csv.DictReader(io.StringIO(text)))

    def _extract_text(self, filename: str, content: bytes) -> str:
        if Path(filename).suffix.lower() == ".pdf":
            reader = PdfReader(io.BytesIO(content))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        return content.decode("utf-8", errors="ignore")

    def _extract_markdown_heading(self, text: str) -> str | None:
        match = re.search(r"^\s*#\s+(.+)$", text, re.MULTILINE)
        return match.group(1).strip() if match else None

    def _extract_prefixed_value(self, lines: list[str], key: str) -> str | None:
        prefix = f"{key.lower()}:"
        for line in lines:
            if line.lower().startswith(prefix):
                return line.split(":", 1)[1].strip()
        return None

    def _parse_date(self, raw: str | None):
        from datetime import date

        if not raw:
            return date.today()
        try:
            return date.fromisoformat(raw)
        except ValueError:
            return date.today()

    def _now(self):
        from datetime import datetime

        return datetime.utcnow()


file_parsing_service = FileParsingService()
