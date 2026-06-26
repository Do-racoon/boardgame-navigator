import { Injectable, Logger } from '@nestjs/common'
import { AzureOpenAiService } from './azure-openai.service'
import { VectorSearchService, SearchResult } from './vector-search.service'
import { GraphSearchService } from './graph-search.service'
import { SupabaseService } from '../database/supabase.service'

// ─── 프롬프트 ────────────────────────────────────────────────────────────────

const QUERY_ANALYSIS_PROMPT = `당신은 보드게임 룰북 검색 전문가입니다.
사용자의 질문을 분석하여 룰북에서 검색할 쿼리를 만드세요.

규칙:
- 구어체를 룰북 문어체로 변환하세요
- 질문의 핵심 상황/조건/행동을 파악하세요
- 관련 가능한 룰북 섹션 제목이나 키워드를 포함하세요
- 반드시 JSON으로만 응답하세요

응답 형식:
{
  "intent": "질문자가 알고 싶은 핵심 상황을 한 문장으로",
  "queries": [
    "룰북 검색어 1 (핵심 규칙 용어 중심)",
    "룰북 검색어 2 (상황/조건 중심)",
    "룰북 검색어 3 (관련 예외/특수 규칙)"
  ]
}`

const SYSTEM_PROMPT = `당신은 보드게임 룰 전문가입니다. 사용자의 질문 의도를 정확히 파악하고 룰북 내용을 기반으로 명확하게 답변하세요.

답변 방식:
1. 질문의 핵심 상황을 먼저 파악하고 요약
2. 해당하는 룰을 순서대로 설명
3. 예외/특수 상황이 있으면 함께 설명
4. 답변 마지막에 출처(페이지 번호) 명시

주의:
- 룰북에 명시된 내용만 답변, 추측하지 않음
- 룰북에 없는 내용은 "룰북에서 확인할 수 없습니다."라고 명시
- 한국어로 답변`

// ─── 서비스 ──────────────────────────────────────────────────────────────────

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name)

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

    // 1. 질문 분석 — 의도 파악 + 검색 쿼리 다각화
    const { intent, queries } = await this.analyzeQuery(question)
    this.logger.log(`질문 의도: ${intent} | 검색 쿼리: ${queries.join(' / ')}`)

    // 2. 멀티 쿼리 벡터 검색 + 중복 제거
    const chunks = await this.multiQuerySearch(queries, gameId)

    if (chunks.length === 0) {
      yield { type: 'chunk', data: '관련 룰북 내용을 찾을 수 없습니다.' }
      yield { type: 'done', data: null }
      return
    }

    // 3. 그래프 컨텍스트
    const keywords = this.graphSearch.extractKeywords(question)
    const entityIds = await this.graphSearch.findRelatedEntities(gameId, keywords)
    const triples = await this.graphSearch.getSubgraph(gameId, entityIds)
    const graphContext = this.graphSearch.formatAsContext(triples)

    // 4. 추가 룰 조회
    const { data: gameData } = await this.supabase.client
      .from('games').select('extra_rules').eq('id', gameId).maybeSingle()
    const extraRules: string | null = gameData?.extra_rules ?? null

    // 5. 프롬프트 조립 — 의도 명시로 LLM 집중도 향상
    const chunkContext = this.buildContext(chunks)
    const userMessage = [
      `[질문 의도 분석]\n${intent}`,
      `\n[룰북 내용]\n${chunkContext}`,
      graphContext ? `\n${graphContext}` : '',
      extraRules ? `\n[추가 룰/주의사항]\n${extraRules}` : '',
      `\n[원래 질문]\n${question}`,
    ].join('\n')

    // 6. 스트리밍 답변
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

  // ── 질문 분석 ──────────────────────────────────────────────────────────────

  private async analyzeQuery(question: string): Promise<{ intent: string; queries: string[] }> {
    try {
      const raw = await this.openai.chat(QUERY_ANALYSIS_PROMPT, question, 400)
      const parsed = JSON.parse(raw) as { intent?: string; queries?: string[] }
      const queries = (parsed.queries ?? []).filter(Boolean).slice(0, 3)
      if (queries.length === 0) queries.push(question)
      return {
        intent: parsed.intent ?? question,
        queries,
      }
    } catch {
      return { intent: question, queries: [question] }
    }
  }

  // ── 멀티 쿼리 검색 ─────────────────────────────────────────────────────────

  private async multiQuerySearch(queries: string[], gameId: string): Promise<SearchResult[]> {
    const TOP_K_PER_QUERY = 4

    const results = await Promise.all(
      queries.map(async (q) => {
        const vector = await this.openai.embed(q)
        return this.vectorSearch.similaritySearch(vector, gameId, TOP_K_PER_QUERY)
      })
    )

    // 중복 제거: 같은 chunk id가 여러 쿼리에서 나온 경우 가장 높은 score 유지
    const seen = new Map<string, SearchResult>()
    for (const batch of results) {
      for (const chunk of batch) {
        const existing = seen.get(chunk.id)
        if (!existing || chunk.score > existing.score) {
          seen.set(chunk.id, chunk)
        }
      }
    }

    // score 내림차순 정렬, 최대 6개
    return [...seen.values()].sort((a, b) => b.score - a.score).slice(0, 6)
  }

  // ── 컨텍스트 포매팅 ────────────────────────────────────────────────────────

  private buildContext(chunks: SearchResult[]): string {
    return chunks
      .map((c, i) => `[${i + 1}]${c.pageNumber ? ` (p.${c.pageNumber})` : ''}\n${c.content}`)
      .join('\n\n---\n\n')
  }
}
