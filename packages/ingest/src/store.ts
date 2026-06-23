import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Chunk } from './chunker'

export class ChunkStore {
  private readonly supabase: SupabaseClient

  constructor() {
    const url = process.env['SUPABASE_URL']!
    const key = process.env['SUPABASE_SERVICE_ROLE_KEY']!
    this.supabase = createClient(url, key)
  }

  async saveRulebook(id: string, gameId: string, language: string, fileUrl: string): Promise<void> {
    const { error } = await this.supabase.rpc('upsert_rulebook', {
      p_id: id,
      p_game_id: gameId,
      p_language: language,
      p_source_type: 'PDF',
      p_file_url: fileUrl,
      p_status: 'PROCESSING',
    })
    if (error) throw new Error(`룰북 upsert 실패: ${error.message}`)
  }

  async updateRulebookStatus(id: string, status: 'INDEXED' | 'FAILED'): Promise<void> {
    const { error } = await this.supabase
      .from('rulebooks')
      .update({ status })
      .eq('id', id)
    if (error) throw new Error(`상태 업데이트 실패: ${error.message}`)
  }

  async save(rulebookId: string, gameId: string, chunks: Chunk[], embeddings: number[][]): Promise<void> {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!
      const embedding = embeddings[i]!
      const id = `${rulebookId}_${String(chunk.chunkIndex).padStart(4, '0')}`

      const { error } = await this.supabase.rpc('upsert_chunk', {
        p_id: id,
        p_rulebook_id: rulebookId,
        p_game_id: gameId,
        p_page_number: chunk.pageNumber,
        p_chunk_index: chunk.chunkIndex,
        p_content: chunk.content,
        p_token_count: chunk.tokenCount,
        p_embedding_id: id,
        p_embedding: embedding,
      })

      if (error) throw new Error(`청크 ${i} 저장 실패: ${error.message}`)
    }
  }
}
