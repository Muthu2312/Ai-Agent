import math
import hashlib
import logging
from typing import List, Dict, Any, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.core.config import settings
from app.models.document import DocumentChunk, Document

logger = logging.getLogger(__name__)


class VectorService:
    def __init__(self):
        self._openai_client = None
        self._ollama_client = None

    def _get_embedding_client(self):
        # 1. FastEmbed (Free, CPU-based local embeddings, 0 cost)
        if settings.EMBEDDING_PROVIDER == "fastembed":
            try:
                from fastembed import TextEmbedding
                if not hasattr(self, "_fastembed_model") or self._fastembed_model is None:
                    self._fastembed_model = TextEmbedding(model_name=settings.FASTEMBED_MODEL)
                return self._fastembed_model
            except Exception as e:
                logger.warning(f"FastEmbed init failed: {e}. Falling back.")

        # 2. Local Ollama Embeddings
        if settings.EMBEDDING_PROVIDER == "ollama":
            try:
                from langchain_ollama import OllamaEmbeddings
                return OllamaEmbeddings(
                    base_url=settings.OLLAMA_BASE_URL,
                    model=settings.OLLAMA_EMBED_MODEL,
                )
            except Exception as e:
                logger.warning(f"Ollama Embeddings init failed: {e}")

        # 3. OpenAI Embeddings
        if settings.EMBEDDING_PROVIDER == "openai" and settings.OPENAI_API_KEY:
            try:
                from langchain_openai import OpenAIEmbeddings
                return OpenAIEmbeddings(
                    model=settings.OPENAI_EMBEDDING_MODEL,
                    openai_api_key=settings.OPENAI_API_KEY,
                )
            except Exception as e:
                logger.warning(f"Failed to initialize OpenAI Embeddings: {e}")

        return None

    def _generate_fallback_dense_vector(self, text_input: str, dimension: int = 1536) -> List[float]:
        """Generates a deterministic normalized pseudo-embedding when no external LLM API key is configured."""
        words = text_input.lower().split()
        vector = [0.0] * dimension
        for word in words:
            # Deterministic hash to dimension
            h = int(hashlib.sha256(word.encode("utf-8")).hexdigest(), 16)
            idx = h % dimension
            sign = 1.0 if ((h >> 8) % 2 == 0) else -1.0
            vector[idx] += sign

        # Normalize L2
        norm = math.sqrt(sum(x * x for x in vector))
        if norm > 0:
            vector = [x / norm for x in vector]
        else:
            vector[0] = 1.0
        return vector

    async def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generates embeddings using FastEmbed, Ollama, OpenAI, or fallback."""
        client = self._get_embedding_client()
        if client:
            try:
                # FastEmbed returns a generator of numpy arrays
                if hasattr(client, "embed"):
                    embeddings_gen = client.embed(texts)
                    return [emb.tolist() for emb in embeddings_gen]
                # LangChain embedding interface
                if hasattr(client, "aembed_documents"):
                    return await client.aembed_documents(texts)
            except Exception as e:
                logger.error(f"Error calling embedding provider: {e}. Falling back to internal dense vectors.")

        # Fallback
        return [self._generate_fallback_dense_vector(t, settings.VECTOR_DIMENSION) for t in texts]

    async def generate_query_embedding(self, query: str) -> List[float]:
        """Generates an embedding for a search query."""
        client = self._get_embedding_client()
        if client:
            try:
                if hasattr(client, "embed"):
                    embeddings_gen = client.embed([query])
                    for emb in embeddings_gen:
                        return emb.tolist()
                if hasattr(client, "aembed_query"):
                    return await client.aembed_query(query)
            except Exception as e:
                logger.error(f"Error querying embedding provider: {e}. Falling back.")

        return self._generate_fallback_dense_vector(query, settings.VECTOR_DIMENSION)

    async def search_similar_chunks(
        self,
        db: AsyncSession,
        query: str,
        document_ids: Optional[List[UUID]] = None,
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        """Performs pgvector cosine distance similarity search."""
        query_vector = await self.generate_query_embedding(query)
        vector_str = "[" + ",".join(f"{x:.6f}" for x in query_vector) + "]"

        filter_clause = ""
        params: Dict[str, Any] = {"query_vector": vector_str, "top_k": top_k}

        if document_ids and len(document_ids) > 0:
            doc_id_strs = [str(d) for d in document_ids]
            filter_clause = "WHERE c.document_id = ANY(:doc_ids)"
            params["doc_ids"] = doc_id_strs

        sql = f"""
            SELECT 
                c.id, 
                c.document_id, 
                c.chunk_index, 
                c.content, 
                c.page_number, 
                c.sheet_name, 
                c.section_title, 
                c.metadata_json,
                d.filename,
                d.file_type,
                (c.embedding <=> :query_vector) AS distance
            FROM document_chunks c
            JOIN documents d ON c.document_id = d.id
            {filter_clause}
            ORDER BY distance ASC
            LIMIT :top_k;
        """

        try:
            result = await db.execute(text(sql), params)
            rows = result.fetchall()
            
            results = []
            for row in rows:
                # Cosine distance to similarity score: similarity = 1 - distance
                distance = float(row.distance) if row.distance is not None else 1.0
                similarity = max(0.0, min(1.0, 1.0 - distance))

                results.append({
                    "chunk_id": str(row.id),
                    "document_id": str(row.document_id),
                    "filename": row.filename,
                    "file_type": row.file_type,
                    "chunk_index": row.chunk_index,
                    "content": row.content,
                    "page_number": row.page_number,
                    "sheet_name": row.sheet_name,
                    "section_title": row.section_title,
                    "metadata": row.metadata_json or {},
                    "similarity": round(similarity, 4),
                })
            return results
        except Exception as e:
            logger.warning(f"pgvector query failed ({e}). Falling back to text-match query.")
            return await self._fallback_text_search(db, query, document_ids, top_k)

    async def _fallback_text_search(
        self,
        db: AsyncSession,
        query: str,
        document_ids: Optional[List[UUID]] = None,
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        """Text search fallback if pgvector extension or vector columns are unavailable in dev."""
        stmt = (
            select(DocumentChunk, Document.filename, Document.file_type)
            .join(Document, DocumentChunk.document_id == Document.id)
        )
        if document_ids:
            stmt = stmt.where(DocumentChunk.document_id.in_(document_ids))
        
        result = await db.execute(stmt.limit(50))
        rows = result.fetchall()

        # Score based on keyword overlap
        query_terms = set(re_word.lower() for re_word in query.split() if len(re_word) > 2)
        scored = []
        for chunk, filename, file_type in rows:
            content_lower = chunk.content.lower()
            matches = sum(1 for term in query_terms if term in content_lower)
            score = (matches / max(len(query_terms), 1)) if query_terms else 0.5
            scored.append({
                "chunk_id": str(chunk.id),
                "document_id": str(chunk.document_id),
                "filename": filename,
                "file_type": file_type,
                "chunk_index": chunk.chunk_index,
                "content": chunk.content,
                "page_number": chunk.page_number,
                "sheet_name": chunk.sheet_name,
                "section_title": chunk.section_title,
                "metadata": chunk.metadata_json or {},
                "similarity": round(score, 4),
            })

        scored.sort(key=lambda x: x["similarity"], reverse=True)
        return scored[:top_k]


vector_service = VectorService()
