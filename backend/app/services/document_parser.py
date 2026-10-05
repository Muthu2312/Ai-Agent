import os
import re
import logging
from typing import List, Dict, Any, Tuple

logger = logging.getLogger(__name__)


class ParsedChunk:
    def __init__(
        self,
        content: str,
        chunk_index: int,
        page_number: int | None = None,
        sheet_name: str | None = None,
        section_title: str | None = None,
        metadata: Dict[str, Any] | None = None,
    ):
        self.content = content
        self.chunk_index = chunk_index
        self.page_number = page_number
        self.sheet_name = sheet_name
        self.section_title = section_title
        self.metadata = metadata or {}


class DocumentParserService:
    """Multi-format Document Parser supporting PDF (PyMuPDF), DOCX (python-docx), and XLSX (openpyxl)."""

    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 150):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def parse_document(self, file_path: str, file_type: str) -> Tuple[List[ParsedChunk], Dict[str, Any]]:
        """Parses a document based on its extension/type and returns chunked content + document metadata."""
        file_type = file_type.lower().strip().replace(".", "")
        if file_type == "pdf":
            return self._parse_pdf(file_path)
        elif file_type in ["docx", "doc"]:
            return self._parse_docx(file_path)
        elif file_type in ["xlsx", "xls", "csv"]:
            return self._parse_xlsx(file_path)
        else:
            raise ValueError(f"Unsupported file format: {file_type}. Supported: PDF, DOCX, XLSX")

    def _split_text_into_chunks(
        self,
        text: str,
        page_number: int | None = None,
        sheet_name: str | None = None,
        section_title: str | None = None,
        start_index: int = 0,
        extra_meta: Dict[str, Any] | None = None,
    ) -> List[ParsedChunk]:
        """Splits text into overlapping chunks while preserving sentence boundaries when possible."""
        text = text.strip()
        if not text:
            return []

        chunks: List[ParsedChunk] = []
        words = text.split()
        
        # Approximate characters per word is ~5-6
        words_per_chunk = max(30, self.chunk_size // 6)
        words_overlap = max(5, self.chunk_overlap // 6)

        current_idx = start_index
        i = 0
        while i < len(words):
            chunk_words = words[i : i + words_per_chunk]
            chunk_text = " ".join(chunk_words)
            
            chunks.append(
                ParsedChunk(
                    content=chunk_text,
                    chunk_index=current_idx,
                    page_number=page_number,
                    sheet_name=sheet_name,
                    section_title=section_title,
                    metadata=extra_meta or {},
                )
            )
            current_idx += 1
            i += (words_per_chunk - words_overlap)

        return chunks

    def _parse_pdf(self, file_path: str) -> Tuple[List[ParsedChunk], Dict[str, Any]]:
        """PyMuPDF (fitz) parser for PDFs."""
        import fitz  # PyMuPDF

        chunks: List[ParsedChunk] = []
        doc = fitz.open(file_path)
        total_pages = len(doc)
        total_text_length = 0
        chunk_idx = 0

        metadata = {
            "format": "PDF",
            "page_count": total_pages,
            "title": doc.metadata.get("title") or os.path.basename(file_path),
            "author": doc.metadata.get("author", "Unknown"),
            "creation_date": doc.metadata.get("creationDate", ""),
        }

        for page_idx in range(total_pages):
            page = doc[page_idx]
            page_text = page.get_text("text")
            total_text_length += len(page_text)

            page_chunks = self._split_text_into_chunks(
                text=page_text,
                page_number=page_idx + 1,
                start_index=chunk_idx,
                extra_meta={"page": page_idx + 1, "total_pages": total_pages},
            )
            chunks.extend(page_chunks)
            chunk_idx += len(page_chunks)

        doc.close()
        metadata["total_extracted_chunks"] = len(chunks)
        metadata["total_characters"] = total_text_length
        return chunks, metadata

    def _parse_docx(self, file_path: str) -> Tuple[List[ParsedChunk], Dict[str, Any]]:
        """python-docx parser for Word documents."""
        import docx

        doc = docx.Document(file_path)
        chunks: List[ParsedChunk] = []
        chunk_idx = 0
        total_paragraphs = len(doc.paragraphs)
        total_tables = len(doc.tables)

        current_heading = "General"
        running_text = []

        # Process paragraphs
        for p in doc.paragraphs:
            text = p.text.strip()
            if not text:
                continue

            if p.style and p.style.name.startswith("Heading"):
                # Save previous accumulated text
                if running_text:
                    section_chunks = self._split_text_into_chunks(
                        text="\n".join(running_text),
                        section_title=current_heading,
                        start_index=chunk_idx,
                        extra_meta={"section": current_heading},
                    )
                    chunks.extend(section_chunks)
                    chunk_idx += len(section_chunks)
                    running_text = []
                current_heading = text
            else:
                running_text.append(text)

        if running_text:
            section_chunks = self._split_text_into_chunks(
                text="\n".join(running_text),
                section_title=current_heading,
                start_index=chunk_idx,
                extra_meta={"section": current_heading},
            )
            chunks.extend(section_chunks)
            chunk_idx += len(section_chunks)

        # Process tables
        for t_idx, table in enumerate(doc.tables):
            table_rows = []
            for row in table.rows:
                row_cells = [cell.text.strip() for cell in row.cells]
                table_rows.append(" | ".join(row_cells))
            table_text = f"[Table {t_idx + 1}]\n" + "\n".join(table_rows)
            table_chunks = self._split_text_into_chunks(
                text=table_text,
                section_title=f"Table {t_idx + 1}",
                start_index=chunk_idx,
                extra_meta={"type": "table", "table_index": t_idx + 1},
            )
            chunks.extend(table_chunks)
            chunk_idx += len(table_chunks)

        metadata = {
            "format": "DOCX",
            "paragraph_count": total_paragraphs,
            "table_count": total_tables,
            "total_extracted_chunks": len(chunks),
        }
        return chunks, metadata

    def _parse_xlsx(self, file_path: str) -> Tuple[List[ParsedChunk], Dict[str, Any]]:
        """openpyxl parser for Excel workbooks."""
        import openpyxl

        wb = openpyxl.load_workbook(file_path, data_only=True)
        chunks: List[ParsedChunk] = []
        chunk_idx = 0
        sheet_summaries = {}

        for sheet_name in wb.sheetnames:
            sheet = wb[sheet_name]
            max_row = sheet.max_row
            max_col = sheet.max_column
            sheet_summaries[sheet_name] = {"rows": max_row, "columns": max_col}

            # Extract header
            headers = []
            first_row = list(sheet.iter_rows(min_row=1, max_row=1, values_only=True))
            if first_row and any(first_row[0]):
                headers = [str(cell) if cell is not None else f"Col{idx+1}" for idx, cell in enumerate(first_row[0])]

            # Group rows into manageable tabular batches
            row_batch = []
            batch_size = 25  # rows per chunk for excel
            for r_idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
                if not any(row):
                    continue
                row_str = " | ".join([f"{headers[i] if i < len(headers) else f'Col{i+1}'}: {val}" for i, val in enumerate(row) if val is not None])
                row_batch.append(f"Row {r_idx}: {row_str}")

                if len(row_batch) >= batch_size:
                    batch_text = f"Sheet: {sheet_name} (Rows {r_idx - len(row_batch) + 1} to {r_idx})\n" + "\n".join(row_batch)
                    chunk = ParsedChunk(
                        content=batch_text,
                        chunk_index=chunk_idx,
                        sheet_name=sheet_name,
                        section_title=f"Sheet {sheet_name} tabular data",
                        metadata={"sheet": sheet_name, "start_row": r_idx - len(row_batch) + 1, "end_row": r_idx},
                    )
                    chunks.append(chunk)
                    chunk_idx += 1
                    row_batch = []

            if row_batch:
                batch_text = f"Sheet: {sheet_name}\n" + "\n".join(row_batch)
                chunk = ParsedChunk(
                    content=batch_text,
                    chunk_index=chunk_idx,
                    sheet_name=sheet_name,
                    section_title=f"Sheet {sheet_name} tabular data",
                    metadata={"sheet": sheet_name},
                )
                chunks.append(chunk)
                chunk_idx += 1

        wb.close()
        metadata = {
            "format": "XLSX",
            "sheet_count": len(wb.sheetnames),
            "sheets": sheet_summaries,
            "total_extracted_chunks": len(chunks),
        }
        return chunks, metadata


parser_service = DocumentParserService()
