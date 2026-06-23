-- Supabase: Dashboard > Database > Extensions > "vector" 활성화 후 실행
-- 또는 로컬 PostgreSQL: pgvector 설치 후 실행
--
-- 실행: psql $DATABASE_URL -f packages/database/prisma/migrations/add_pgvector.sql

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE rulebook_chunks
  ADD COLUMN IF NOT EXISTS embedding vector(3072);

-- 100개 이상 청크부터 효과적인 IVFFlat 인덱스
CREATE INDEX IF NOT EXISTS rulebook_chunks_embedding_idx
  ON rulebook_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
