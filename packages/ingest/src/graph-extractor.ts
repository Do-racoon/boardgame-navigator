import OpenAI from 'openai'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

interface Triple {
  from: string
  fromType: string
  relation: string
  to: string
  toType: string
  description: string
}

interface Chunk {
  id: string
  content: string
}

const EXTRACT_PROMPT = `당신은 보드게임 룰북에서 개념과 관계를 추출하는 전문가입니다.

주어진 룰북 텍스트에서 (개체, 관계, 개체) 트리플을 추출하세요.

개체 타입:
- CARD: 카드 종류 (폭탄, 용, 봉황, 참새, 개, 마작패 등)
- ACTION: 행동/플레이 (티추 선언, 패스, 카드 내기 등)
- COMBO: 카드 조합 (싱글, 원페어, 스트레이트, 풀하우스 등)
- RULE: 규칙/조건
- SCORE: 점수 관련
- PHASE: 게임 단계

관계 타입:
- BEATS: 이긴다/제압한다
- REQUIRES: 필요조건
- WORTH: 점수값
- TRIGGERS: 발동시킨다
- PART_OF: 구성요소
- CANNOT: 불가능
- GRANTS: 권한 부여

다음 JSON 형식으로만 응답하세요:
{"triples": [
  {
    "from": "개체명",
    "fromType": "타입",
    "relation": "관계",
    "to": "개체명",
    "toType": "타입",
    "description": "한줄 설명"
  }
]}

텍스트에서 확실하게 파악되는 것만 추출하세요. 없으면 {"triples": []}`

export class GraphExtractor {
  private readonly openai: OpenAI
  private readonly supabase: SupabaseClient

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY']! })
    this.supabase = createClient(
      process.env['SUPABASE_URL']!,
      process.env['SUPABASE_SERVICE_ROLE_KEY']!,
    )
  }

  async extractAndStore(gameId: string, chunks: Chunk[]): Promise<void> {
    let totalTriples = 0

    for (const chunk of chunks) {
      process.stdout.write(`  청크 ${chunk.id} 분석 중...`)

      const triples = await this.extractTriples(chunk.content)
      if (triples.length === 0) {
        console.log(' (트리플 없음)')
        continue
      }

      await this.storeTriples(gameId, chunk.id, triples)
      totalTriples += triples.length
      console.log(` → ${triples.length}개 트리플 저장`)

      await sleep(300)
    }

    console.log(`\n  총 ${totalTriples}개 트리플 저장 완료`)
  }

  private async extractTriples(text: string): Promise<Triple[]> {
    const res = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: EXTRACT_PROMPT },
        { role: 'user', content: text.slice(0, 2000) },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    })

    const raw = res.choices[0]?.message?.content ?? '[]'
    try {
      const parsed = JSON.parse(raw)
      return parsed.triples ?? []
    } catch {
      return []
    }
  }

  private async storeTriples(gameId: string, chunkId: string, triples: Triple[]): Promise<void> {
    for (const t of triples) {
      const fromId = `${gameId}_${slugify(t.from)}`
      const toId = `${gameId}_${slugify(t.to)}`

      await this.supabase.from('entities').upsert([
        { id: fromId, game_id: gameId, name: t.from, type: t.fromType, source_chunk_id: chunkId },
        { id: toId, game_id: gameId, name: t.to, type: t.toType, source_chunk_id: chunkId },
      ], { onConflict: 'game_id,name', ignoreDuplicates: true })

      const relId = `${fromId}_${t.relation}_${toId}`
      await this.supabase.from('relationships').upsert({
        id: relId,
        game_id: gameId,
        from_entity_id: fromId,
        to_entity_id: toId,
        relation: t.relation,
        description: t.description,
        source_chunk_id: chunkId,
      }, { onConflict: 'id', ignoreDuplicates: true })
    }
  }
}

function slugify(s: string): string {
  return s.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9가-힣_]/g, '').slice(0, 40)
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
