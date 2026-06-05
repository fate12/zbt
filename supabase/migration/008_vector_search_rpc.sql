-- 向量搜索函数
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding vector(1024),
  match_count INTEGER DEFAULT 5,
  filter_knowledge_ids INTEGER[] DEFAULT '{}'
)
RETURNS TABLE (
  id INTEGER,
  knowledge_id INTEGER,
  chunk_index INTEGER,
  content TEXT,
  similarity FLOAT,
  kb_title VARCHAR,
  kb_source VARCHAR,
  kb_category VARCHAR
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.knowledge_id,
    c.chunk_index,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity,
    k.title AS kb_title,
    k.source AS kb_source,
    k.category AS kb_category
  FROM public.knowledge_chunks_bacad2ba_27a c
  JOIN public.knowledge_base_bacad2ba_27a k ON k.id = c.knowledge_id
  WHERE c.is_deleted = 'n'
    AND k.is_deleted = 'n'
    AND (filter_knowledge_ids = '{}' OR c.knowledge_id = ANY(filter_knowledge_ids))
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
