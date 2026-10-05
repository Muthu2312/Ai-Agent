from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel


class DocumentChunkResponse(BaseModel):
    id: UUID
    chunk_index: int
    content: str
    page_number: Optional[int] = None
    sheet_name: Optional[str] = None
    section_title: Optional[str] = None
    metadata_json: Dict[str, Any] = {}

    class Config:
        from_attributes = True


class DocumentResponse(BaseModel):
    id: UUID
    filename: str
    file_type: str
    file_size_bytes: int
    status: str
    error_message: Optional[str] = None
    metadata_json: Dict[str, Any] = {}
    created_at: datetime
    updated_at: datetime
    total_chunks: Optional[int] = 0

    class Config:
        from_attributes = True


class DocumentDetailResponse(DocumentResponse):
    chunks: List[DocumentChunkResponse] = []
