export interface DocumentChunk {
  id: string;
  chunk_index: number;
  content: string;
  page_number?: number;
  sheet_name?: string;
  section_title?: string;
  metadata_json: Record<string, any>;
}

export interface DocumentItem {
  id: string;
  filename: string;
  file_type: string;
  file_size_bytes: number;
  status: 'pending' | 'processing' | 'indexed' | 'error';
  error_message?: string;
  metadata_json: Record<string, any>;
  created_at: string;
  updated_at: string;
  total_chunks?: number;
  chunks?: DocumentChunk[];
}
