import { Injectable } from '@nestjs/common'
import { SupabaseService } from '../database/supabase.service'

export interface SearchResult {
  id: string
  rulebookId: string
  gameId: string
  pageNumber: number | null
  content: string
  score: number
}

@Injectable()
export class VectorSearchService {
  constructor(private readonly supabase: SupabaseService) {}

  async similaritySearch(embedding: number[], gameId: string, topK = 5): Promise<SearchResult[]> {
    const { data, error } = await this.supabase.client.rpc('match_chunks', {
      p_embedding: embedding,
      p_game_id: gameId,
      p_top_k: topK,
    })
    if (error) throw new Error(`벡터 검색 실패: ${error.message}`)
    return (data as SearchResult[]) ?? []
  }
}
