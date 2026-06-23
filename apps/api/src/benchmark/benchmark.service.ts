import { Injectable } from '@nestjs/common'
import { SupabaseService } from '../database/supabase.service'
import { AzureOpenAiService } from '../rag/azure-openai.service'
import { VectorSearchService } from '../rag/vector-search.service'

export interface EvalResult {
  questionId: string
  question: string
  retrievalHit: boolean
  answerScore: number
  latencyMs: number
}

@Injectable()
export class BenchmarkService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly openai: AzureOpenAiService,
    private readonly vectorSearch: VectorSearchService,
  ) {}

  async runByGame(gameId: string, topK = 5): Promise<{ results: EvalResult[]; summary: unknown }> {
    const { data: questions, error } = await this.supabase.client
      .from('benchmark_questions')
      .select('*')
      .eq('game_id', gameId)
    if (error) throw new Error(error.message)

    const results: EvalResult[] = []

    for (const q of questions ?? []) {
      const start = Date.now()
      const vector = await this.openai.embed(q.question)
      const chunks = await this.vectorSearch.similaritySearch(vector, gameId, topK)
      const latencyMs = Date.now() - start

      const retrievedIds = chunks.map((c) => c.id)
      const retrievalHit =
        q.expected_chunk_ids.length === 0
          ? true
          : q.expected_chunk_ids.some((id: string) => retrievedIds.includes(id))

      const answerScore =
        q.must_include.length === 0
          ? 1
          : q.must_include.filter((kw: string) => chunks.some((c) => c.content.includes(kw))).length /
            q.must_include.length

      results.push({ questionId: q.id, question: q.question, retrievalHit, answerScore, latencyMs })
    }

    const summary = {
      total: results.length,
      retrievalAccuracy: results.length ? results.filter((r) => r.retrievalHit).length / results.length : 0,
      avgAnswerScore: results.length ? results.reduce((s, r) => s + r.answerScore, 0) / results.length : 0,
      avgLatencyMs: results.length ? results.reduce((s, r) => s + r.latencyMs, 0) / results.length : 0,
    }

    return { results, summary }
  }
}
