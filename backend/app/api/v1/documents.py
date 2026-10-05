import os
import aiofiles
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.config import settings
from app.models.user import User
from app.models.document import Document, DocumentChunk
from app.schemas.document import DocumentResponse, DocumentDetailResponse, DocumentChunkResponse
from app.services.auth_service import get_current_user
from app.services.document_parser import parser_service
from app.services.vector_service import vector_service

router = APIRouter(prefix="/documents", tags=["Documents"])

ALLOWED_EXTENSIONS = {"pdf", "docx", "xlsx", "xls", "doc"}


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Uploads a document (PDF, DOCX, XLSX), parses text and tables, and computes vector embeddings."""
    filename = file.filename or "unknown_document"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Supported types: PDF, DOCX, XLSX.",
        )

    # Ensure uploads directory exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(settings.UPLOAD_DIR, f"{current_user.id}_{filename}")

    # Stream file to disk
    file_size = 0
    async with aiofiles.open(file_path, "wb") as out_file:
        while content := await file.read(1024 * 1024):  # 1MB chunks
            file_size += len(content)
            if file_size > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
                os.remove(file_path)
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"File exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB}MB",
                )
            await out_file.write(content)

    # Create initial document record
    doc_record = Document(
        user_id=current_user.id,
        filename=filename,
        file_type=ext,
        file_size_bytes=file_size,
        storage_path=file_path,
        status="processing",
        metadata_json={"original_filename": filename},
    )
    db.add(doc_record)
    await db.commit()
    await db.refresh(doc_record)

    # Process & Extract with PyMuPDF / python-docx / openpyxl
    try:
        chunks, parsed_meta = parser_service.parse_document(file_path, ext)
        doc_record.metadata_json.update(parsed_meta)

        if chunks:
            # Generate embeddings
            texts_to_embed = [c.content for c in chunks]
            embeddings = await vector_service.generate_embeddings(texts_to_embed)

            # Insert chunks with pgvector embeddings
            chunk_models = []
            for idx, c in enumerate(chunks):
                emb = embeddings[idx] if idx < len(embeddings) else None
                chunk_models.append(
                    DocumentChunk(
                        document_id=doc_record.id,
                        chunk_index=c.chunk_index,
                        content=c.content,
                        page_number=c.page_number,
                        sheet_name=c.sheet_name,
                        section_title=c.section_title,
                        metadata_json=c.metadata,
                        embedding=emb,
                    )
                )
            db.add_all(chunk_models)

        doc_record.status = "indexed"
        await db.commit()
        await db.refresh(doc_record)

    except Exception as e:
        doc_record.status = "error"
        doc_record.error_message = str(e)
        await db.commit()
        await db.refresh(doc_record)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process and vectorize document: {str(e)}",
        )

    # Count chunks
    chunk_count_stmt = select(func.count(DocumentChunk.id)).where(DocumentChunk.document_id == doc_record.id)
    count_res = await db.execute(chunk_count_stmt)
    total_chunks = count_res.scalar() or 0

    resp = DocumentResponse.model_validate(doc_record)
    resp.total_chunks = total_chunks
    return resp


@router.get("", response_model=List[DocumentResponse])
async def list_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """Lists all uploaded documents for the current user."""
    stmt = (
        select(Document, func.count(DocumentChunk.id).label("chunk_count"))
        .outerjoin(DocumentChunk, Document.id == DocumentChunk.document_id)
        .where(Document.user_id == current_user.id)
        .group_by(Document.id)
        .order_by(Document.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.all()

    documents = []
    for doc, chunk_count in rows:
        d = DocumentResponse.model_validate(doc)
        d.total_chunks = chunk_count
        documents.append(d)

    return documents


@router.get("/{document_id}", response_model=DocumentDetailResponse)
async def get_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves document detail including its extracted chunks."""
    stmt = (
        select(Document)
        .options(selectinload(Document.chunks))
        .where(Document.id == document_id, Document.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    doc = result.scalars().first()

    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    resp = DocumentDetailResponse.model_validate(doc)
    resp.total_chunks = len(doc.chunks)
    resp.chunks = [DocumentChunkResponse.model_validate(c) for c in doc.chunks]
    return resp


@router.delete("/{document_id}", status_code=status.HTTP_200_OK)
async def delete_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deletes a document and all corresponding chunks and vector embeddings."""
    stmt = select(Document).where(Document.id == document_id, Document.user_id == current_user.id)
    result = await db.execute(stmt)
    doc = result.scalars().first()

    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Clean local storage file if present
    if doc.storage_path and os.path.exists(doc.storage_path):
        try:
            os.remove(doc.storage_path)
        except Exception:
            pass

    await db.delete(doc)
    await db.commit()
    return {"message": "Document deleted successfully"}
