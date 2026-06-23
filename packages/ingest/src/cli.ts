import 'dotenv/config'
import * as path from 'path'
import { extractPdf } from './pdf-extractor'
import { chunkPages } from './chunker'
import { Embedder } from './embedder'
import { ChunkStore } from './store'

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      args[key] = argv[i + 1] ?? ''
      i++
    }
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const gameId = args['game-id']
  const filePath = args['file']
  const language = args['language'] ?? 'ko'

  if (!gameId || !filePath) {
    console.error('사용법: pnpm ingest --game-id <id> --file <path>')
    process.exit(1)
  }

  const absolutePath = path.resolve(filePath)
  console.log(`\n🎲 Ingest 시작`)
  console.log(`   게임 ID  : ${gameId}`)
  console.log(`   파일     : ${absolutePath}`)
  console.log(`   언어     : ${language}\n`)

  const store = new ChunkStore()
  const rulebookId = args['rulebook-id'] ?? `${gameId}-${language}`

  try {
    // ── 1. 룰북 레코드 생성 ──────────────────────────────────────
    await store.saveRulebook(rulebookId, gameId, language, absolutePath)
    console.log(`✅ 룰북 레코드: ${rulebookId}`)

    // ── 2. PDF 텍스트 추출 ──────────────────────────────────────
    console.log('📄 PDF 텍스트 추출 중...')
    const pages = await extractPdf(absolutePath)
    console.log(`   → ${pages.length}페이지 추출 완료`)

    if (pages.length === 0) {
      throw new Error('텍스트를 추출할 수 없습니다. 이미지 기반 PDF는 OCR이 필요합니다.')
    }

    console.log(`\n   [1페이지 미리보기]\n   ${pages[0]!.text.slice(0, 200)}...\n`)

    // ── 3. 청킹 ─────────────────────────────────────────────────
    console.log('✂️  청킹 중...')
    const chunks = chunkPages(pages)
    console.log(`   → ${chunks.length}개 청크 생성`)
    console.log(`   → 평균 토큰 수: ${Math.round(chunks.reduce((s, c) => s + c.tokenCount, 0) / chunks.length)}`)
    console.log(`\n   [청크 #0 미리보기 (p.${chunks[0]!.pageNumber})]`)
    console.log(`   ${chunks[0]!.content.slice(0, 150)}...\n`)

    // ── 4. 임베딩 ────────────────────────────────────────────────
    console.log('🧠 임베딩 생성 중...')
    const embedder = new Embedder()
    const texts = chunks.map((c) => c.content)
    const embeddings = await embedder.embedBatch(texts)
    console.log(`   → ${embeddings.length}개 임베딩 완료 (차원: ${embeddings[0]!.length})`)

    // ── 5. 저장 ──────────────────────────────────────────────────
    console.log('💾 DB 저장 중...')
    await store.save(rulebookId, gameId, chunks, embeddings)
    console.log(`   → ${chunks.length}개 청크 저장 완료`)

    // ── 6. 상태 업데이트 ─────────────────────────────────────────
    await store.updateRulebookStatus(rulebookId, 'INDEXED')

    console.log(`\n✅ Ingest 완료!`)
    console.log(`   총 청크 수 : ${chunks.length}`)
    console.log(`   룰북 ID    : ${rulebookId}`)
    console.log(`\n   이제 챗봇에서 질문할 수 있습니다:`)
    console.log(`   POST /api/v1/games/${gameId}/ask`)
    console.log(`   { "question": "폭탄은 언제 사용할 수 있나요?" }\n`)
  } catch (err) {
    await store.updateRulebookStatus(rulebookId, 'FAILED').catch(() => {})
    console.error('\n❌ Ingest 실패:', (err as Error).message)
    process.exit(1)
  }
}

main()
