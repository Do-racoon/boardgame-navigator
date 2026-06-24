import { Injectable, Logger } from '@nestjs/common'
import { SupabaseService } from '../database/supabase.service'
import { AzureOpenAiService } from '../rag/azure-openai.service'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string; numpages: number }>

const TARGET_TOKENS = 200
const CHARS_PER_TOKEN = 2.5
const BATCH_SIZE = 16

function estimateTokens(text: string) {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

interface Chunk {
  chunkIndex: number
  pageNumber: number
  content: string
  tokenCount: number
}

function chunkPages(pages: { page: number; text: string }[]): Chunk[] {
  const chunks: Chunk[] = []
  let idx = 0
  let buffer = ''
  let bufferPage = 1

  for (const { page, text } of pages) {
    const combined = buffer ? `${buffer} ${text}` : text
    if (estimateTokens(combined) <= TARGET_TOKENS) {
      buffer = combined
      bufferPage = buffer ? bufferPage : page
    } else {
      if (buffer) {
        chunks.push({ chunkIndex: idx++, pageNumber: bufferPage, content: buffer.trim(), tokenCount: estimateTokens(buffer) })
      }
      if (estimateTokens(text) > TARGET_TOKENS) {
        const sentences = text.split(/(?<=[.!?。])\s+/)
        let sentBuf = ''
        for (const s of sentences) {
          const next = sentBuf ? `${sentBuf} ${s}` : s
          if (estimateTokens(next) > TARGET_TOKENS && sentBuf) {
            chunks.push({ chunkIndex: idx++, pageNumber: page, content: sentBuf.trim(), tokenCount: estimateTokens(sentBuf) })
            sentBuf = s
          } else sentBuf = next
        }
        buffer = sentBuf
      } else buffer = text
      bufferPage = page
    }
  }
  if (buffer.trim().length > 30) {
    chunks.push({ chunkIndex: idx++, pageNumber: bufferPage, content: buffer.trim(), tokenCount: estimateTokens(buffer) })
  }
  return chunks
}

async function parsePdf(buffer: Buffer): Promise<{ page: number; text: string }[]> {
  const result = await pdfParse(buffer)
  // v1 returns full text; split into pseudo-pages by form-feed or chunk evenly
  const pages = result.text.split(/\f/).filter((t: string) => t.trim().length > 10)
  if (pages.length > 1) {
    return pages.map((text: string, i: number) => ({ page: i + 1, text: text.replace(/\s+/g, ' ').trim() }))
  }
  // fallback: treat whole text as page 1
  return [{ page: 1, text: result.text.replace(/\s+/g, ' ').trim() }]
}

@Injectable()
export class AdminIngestService {
  private readonly logger = new Logger(AdminIngestService.name)

  constructor(
    private readonly supabase: SupabaseService,
    private readonly openai: AzureOpenAiService,
  ) {}

  async ingestFromUrl(rulebookId: string, gameId: string, fileUrl: string): Promise<{ chunks: number }> {
    this.logger.log(`Ingest 시작: gameId=${gameId}`)

    const buffer = await this.downloadFile(fileUrl)
    const pageTexts = await parsePdf(buffer)
    this.logger.log(`PDF 파싱 완료: ${pageTexts.length}페이지`)

    const chunks = chunkPages(pageTexts)
    this.logger.log(`청킹 완료: ${chunks.length}개`)

    await this.supabase.client.from('rulebook_chunks').delete().eq('game_id', gameId)

    await this.supabase.client.rpc('upsert_rulebook', {
      p_id: rulebookId, p_game_id: gameId, p_language: 'ko',
      p_source_type: 'PDF', p_file_url: fileUrl, p_status: 'PROCESSING',
    })

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE)
      const embeddings = await this.openai.embedBatch(batch.map(c => c.content))
      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j]!
        const id = `${rulebookId}_${String(chunk.chunkIndex).padStart(4, '0')}`
        const { error } = await this.supabase.client.rpc('upsert_chunk', {
          p_id: id, p_rulebook_id: rulebookId, p_game_id: gameId,
          p_page_number: chunk.pageNumber, p_chunk_index: chunk.chunkIndex,
          p_content: chunk.content, p_token_count: chunk.tokenCount,
          p_embedding_id: id, p_embedding: embeddings[j]!,
        })
        if (error) throw new Error(`청크 저장 실패: ${error.message}`)
      }
    }

    await this.supabase.client.from('rulebooks').update({ status: 'INDEXED' }).eq('id', rulebookId)
    this.logger.log(`Ingest 완료: ${chunks.length}개 청크`)
    return { chunks: chunks.length }
  }

  async ingestFromBuffer(rulebookId: string, gameId: string, buffer: Buffer, fileUrl: string): Promise<{ chunks: number }> {
    const pageTexts = await parsePdf(buffer)
    this.logger.log(`PDF 파싱 완료: ${pageTexts.length}페이지`)
    const chunks = chunkPages(pageTexts)
    await this.supabase.client.from('rulebook_chunks').delete().eq('game_id', gameId)
    await this.supabase.client.rpc('upsert_rulebook', {
      p_id: rulebookId, p_game_id: gameId, p_language: 'ko',
      p_source_type: 'PDF', p_file_url: fileUrl, p_status: 'PROCESSING',
    })
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE)
      const embeddings = await this.openai.embedBatch(batch.map(c => c.content))
      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j]!
        const id = `${rulebookId}_${String(chunk.chunkIndex).padStart(4, '0')}`
        const { error } = await this.supabase.client.rpc('upsert_chunk', {
          p_id: id, p_rulebook_id: rulebookId, p_game_id: gameId,
          p_page_number: chunk.pageNumber, p_chunk_index: chunk.chunkIndex,
          p_content: chunk.content, p_token_count: chunk.tokenCount,
          p_embedding_id: id, p_embedding: embeddings[j]!,
        })
        if (error) throw new Error(`청크 저장 실패: ${error.message}`)
      }
    }
    await this.supabase.client.from('rulebooks').update({ status: 'INDEXED' }).eq('id', rulebookId)
    return { chunks: chunks.length }
  }

  private async downloadFile(fileUrl: string): Promise<Buffer> {
    const storageMatch = fileUrl.match(/\/storage\/v1\/object\/(?:public\/)?([^/]+)\/(.+)$/)
    if (storageMatch) {
      const bucket = storageMatch[1]!
      const path = storageMatch[2]!
      const { data, error } = await this.supabase.client.storage.from(bucket).download(path)
      if (error) throw new Error(`Storage 다운로드 실패: ${error.message}`)
      return Buffer.from(await data.arrayBuffer())
    }
    const res = await fetch(fileUrl)
    if (!res.ok) throw new Error(`파일 다운로드 실패: ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
  }
}
