import { Injectable } from '@nestjs/common'
import { AzureOpenAiService } from './azure-openai.service'
import { VectorSearchService, SearchResult } from './vector-search.service'
import { GraphSearchService } from './graph-search.service'
import { SupabaseService } from '../database/supabase.service'

const SYSTEM_PROMPT = `당신은 보드게임 룰 전문가입니다.
아래 제공된 [룰북 내용]과 [개념 관계도]를 함께 참고하여 질문에 답변하세요.
관계도는 룰북 개념들 사이의 연결을 나타냅니다. 이를 활용해 더 정확하고 완결된 답변을 제공하세요.
답변 마지막에는 반드시 출처(페이지 번호)를 명시하세요.
룰북에 없는 내용은 "룰북에서 확인할 수 없습니다."라고 답하세요.`

@Injectable()
export class RagService {
  constructor(
    private readonly openai: AzureOpenAiService,
    private readonly vectorSearch: VectorSearchService,
    private readonly graphSearch: GraphSearchService,
    private readonly supabase: SupabaseService,
  ) {}

  async *ask(
    gameId: string,
    question: string,
    sessionId: string,
  ): AsyncIterable<{ type: 'chunk' | 'citations' | 'done'; data: unknown }> {
    const startedAt = Date.now()

    // 1. 벡터 검색
    const vector = await this.openai.embed(question)
    const chunks = await this.vectorSearch.similaritySearch(vector, gameId)

    if (chunks.length === 0) {
      yield { type: 'chunk', data: '관련 룰북 내용을 찾을 수 없습니다.' }
      yield { type: 'done', data: null }
      return
    }

    // 2. 그래프 컨텍스트
    const keywords = this.graphSearch.extractKeywords(question)
    const entityIds = await this.graphSearch.findRelatedEntities(gameId, keywords)
    const triples = await this.graphSearch.getSubgraph(gameId, entityIds)
    const graphContext = this.graphSearch.formatAsContext(triples)

    // 3. 추가 룰 조회
    const { data: gameData } = await this.supabase.client
      .from('games').select('extra_rules').eq('id', gameId).maybeSingle()
    const extraRules: string | null = gameData?.extra_rules ?? null

    // 4. 프롬프트 조립
    const chunkContext = this.buildContext(chunks)
    const userMessage = [
      `[룰북 내용]\n${chunkContext}`,
      graphContext ? `\n${graphContext}` : '',
      extraRules ? `\n[추가 룰/주의사항]\n${extraRules}` : '',
      `\n[질문]\n${question}`,
    ].join('\n')

    // 5. 스트리밍 답변
    let fullAnswer = ''
    for await (const token of this.openai.streamChat(SYSTEM_PROMPT, userMessage)) {
      fullAnswer += token
      yield { type: 'chunk', data: token }
    }

    const citations = chunks.map((c) => ({
      chunkId: c.id,
      pageNumber: c.pageNumber,
      preview: c.content.slice(0, 80),
    }))
    yield { type: 'citations', data: citations }
    yield { type: 'done', data: null }

    this.supabase.client
      .from('qa_logs')
      .insert({
        session_id: sessionId,
        game_id: gameId,
        question,
        answer: fullAnswer,
        retrieved_chunk_ids: chunks.map((c) => c.id),
        latency_ms: Date.now() - startedAt,
        model_name: 'gpt-4o-mini',
      })
      .then(({ error }) => { if (error) console.warn('qa_log 저장 실패:', error.message) })
  }

  private buildContext(chunks: SearchResult[]): string {
    return chunks
      .map((c, i) => `[${i + 1}] ${c.pageNumber ? `(p.${c.pageNumber}) ` : ''}${c.content}`)
      .join('\n\n')
  }
}
