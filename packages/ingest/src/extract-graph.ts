import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { GraphExtractor } from './graph-extractor'

async function main() {
  const args = process.argv.slice(2)
  const gameId = args[args.indexOf('--game-id') + 1]
  if (!gameId) {
    console.error('사용법: ts-node src/extract-graph.ts --game-id <id>')
    process.exit(1)
  }

  const supabase = createClient(
    process.env['SUPABASE_URL']!,
    process.env['SUPABASE_SERVICE_ROLE_KEY']!,
  )

  console.log(`\n🔗 그래프 추출 시작: ${gameId}\n`)

  const { data: chunks, error } = await supabase
    .from('rulebook_chunks')
    .select('id, content')
    .eq('game_id', gameId)
    .order('chunk_index')

  if (error || !chunks?.length) {
    console.error('청크를 찾을 수 없습니다:', error?.message)
    process.exit(1)
  }

  console.log(`  ${chunks.length}개 청크 로드 완료\n`)

  const extractor = new GraphExtractor()
  await extractor.extractAndStore(gameId, chunks)

  // 결과 요약
  const { count: entityCount } = await supabase
    .from('entities')
    .select('*', { count: 'exact', head: true })
    .eq('game_id', gameId)

  const { count: relCount } = await supabase
    .from('relationships')
    .select('*', { count: 'exact', head: true })
    .eq('game_id', gameId)

  console.log(`\n✅ 그래프 구축 완료`)
  console.log(`   개체 수: ${entityCount}`)
  console.log(`   관계 수: ${relCount}`)
  console.log(`\n예시 — AI 조언 질문:`)
  console.log(`   POST /api/v1/games/${gameId}/ask`)
  console.log(`   { "question": "폭탄을 언제 써야 하나요?" }\n`)
}

main()
