import { Injectable } from '@nestjs/common'
import { SupabaseService } from '../database/supabase.service'

export interface GraphTriple {
  from_name: string
  relation: string
  to_name: string
  description: string
}

@Injectable()
export class GraphSearchService {
  constructor(private readonly supabase: SupabaseService) {}

  async findRelatedEntities(gameId: string, keywords: string[]): Promise<string[]> {
    if (keywords.length === 0) return []
    const { data } = await this.supabase.client
      .from('entities')
      .select('id')
      .eq('game_id', gameId)
      .or(keywords.map((k) => `name.ilike.%${k}%`).join(','))
    return (data ?? []).map((e: { id: string }) => e.id)
  }

  async getSubgraph(gameId: string, entityIds: string[]): Promise<GraphTriple[]> {
    if (entityIds.length === 0) return []
    const { data, error } = await this.supabase.client.rpc('get_entity_subgraph', {
      p_entity_ids: entityIds,
      p_game_id: gameId,
      p_hops: 2,
    })
    if (error) return []
    return data ?? []
  }

  formatAsContext(triples: GraphTriple[]): string {
    if (triples.length === 0) return ''
    const lines = triples.map((t) => `• ${t.from_name} → [${t.relation}] → ${t.to_name}${t.description ? `: ${t.description}` : ''}`)
    return `[개념 관계도]\n${lines.join('\n')}`
  }

  extractKeywords(question: string): string[] {
    // 조사/어미 제거 후 2자 이상 단어 추출
    return question
      .replace(/[은는이가을를에서의도로]/g, ' ')
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 2)
      .slice(0, 5)
  }
}
