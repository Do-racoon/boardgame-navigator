import { PageText } from './pdf-extractor'

export interface Chunk {
  chunkIndex: number
  pageNumber: number
  content: string
  tokenCount: number
}

const TARGET_TOKENS = 500
const OVERLAP_TOKENS = 100
// 한글/영문 혼합 기준 토큰 근사: 글자수 / 2.5
const CHARS_PER_TOKEN = 2.5

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

/**
 * 페이지 단위로 청크를 생성합니다.
 * 한 페이지가 TARGET_TOKENS 초과면 문장 단위로 분할하고,
 * 한 페이지가 너무 짧으면 다음 페이지와 합칩니다.
 */
export function chunkPages(pages: PageText[]): Chunk[] {
  const chunks: Chunk[] = []
  let chunkIndex = 0
  let buffer = ''
  let bufferPage = 1

  for (const { page, text } of pages) {
    const combined = buffer ? `${buffer} ${text}` : text

    if (estimateTokens(combined) <= TARGET_TOKENS) {
      // 버퍼에 계속 쌓기
      buffer = combined
      bufferPage = buffer ? bufferPage : page
    } else {
      // 버퍼를 먼저 flush
      if (buffer) {
        chunks.push({
          chunkIndex: chunkIndex++,
          pageNumber: bufferPage,
          content: buffer.trim(),
          tokenCount: estimateTokens(buffer),
        })
      }

      // 현재 페이지가 자체로도 너무 크면 문장 단위 분할
      if (estimateTokens(text) > TARGET_TOKENS) {
        const sentences = text.split(/(?<=[.!?。])\s+/)
        let sentBuffer = ''

        for (const sentence of sentences) {
          const next = sentBuffer ? `${sentBuffer} ${sentence}` : sentence
          if (estimateTokens(next) > TARGET_TOKENS && sentBuffer) {
            chunks.push({
              chunkIndex: chunkIndex++,
              pageNumber: page,
              content: sentBuffer.trim(),
              tokenCount: estimateTokens(sentBuffer),
            })
            // overlap: 마지막 문장 재사용
            sentBuffer = sentence
          } else {
            sentBuffer = next
          }
        }

        buffer = sentBuffer
        bufferPage = page
      } else {
        buffer = text
        bufferPage = page
      }
    }
  }

  // 남은 버퍼 flush
  if (buffer.trim().length > 30) {
    chunks.push({
      chunkIndex: chunkIndex++,
      pageNumber: bufferPage,
      content: buffer.trim(),
      tokenCount: estimateTokens(buffer),
    })
  }

  return chunks
}
