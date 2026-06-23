/**
 * 드라이런: Azure OpenAI / DB 없이 PDF 추출 + 청킹 결과만 확인
 * 실행: npx ts-node --project tsconfig.json src/dry-run.ts <pdf경로>
 */
import * as path from 'path'
import { extractPdf } from './pdf-extractor'
import { chunkPages } from './chunker'

async function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('사용법: npx ts-node src/dry-run.ts <pdf경로>')
    process.exit(1)
  }

  console.log(`\n📄 PDF 분석: ${path.resolve(filePath)}\n`)

  // 1. 텍스트 추출
  const pages = await extractPdf(path.resolve(filePath))
  console.log(`=== 페이지별 추출 결과 (${pages.length}페이지) ===\n`)
  for (const p of pages) {
    console.log(`[p.${p.page}] (${p.text.length}자)`)
    console.log(`  ${p.text.slice(0, 120).replace(/\n/g, ' ')}...`)
    console.log()
  }

  // 2. 청킹
  const chunks = chunkPages(pages)
  console.log(`\n=== 청킹 결과 (${chunks.length}개 청크) ===\n`)
  for (const c of chunks) {
    console.log(`[청크 #${c.chunkIndex}] p.${c.pageNumber} | ${c.tokenCount} 토큰`)
    console.log(`  ${c.content.slice(0, 150).replace(/\n/g, ' ')}...`)
    console.log()
  }

  console.log('=== 요약 ===')
  console.log(`  총 페이지   : ${pages.length}`)
  console.log(`  총 청크 수  : ${chunks.length}`)
  console.log(`  평균 토큰   : ${Math.round(chunks.reduce((s, c) => s + c.tokenCount, 0) / chunks.length)}`)
  console.log(`  최대 토큰   : ${Math.max(...chunks.map((c) => c.tokenCount))}`)
  console.log(`  최소 토큰   : ${Math.min(...chunks.map((c) => c.tokenCount))}`)
}

main().catch(console.error)
