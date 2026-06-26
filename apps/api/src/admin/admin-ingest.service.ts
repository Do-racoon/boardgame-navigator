import { Injectable, Logger } from '@nestjs/common'
import { SupabaseService } from '../database/supabase.service'
import { AzureOpenAiService } from '../rag/azure-openai.service'

const CHUNK_TARGET_TOKENS = 300
const CHUNK_MAX_TOKENS = 500
const CHARS_PER_TOKEN = 2.5
const BATCH_SIZE = 16

function estimateTokens(text: string) {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

// ─── pdfjs 타입 ──────────────────────────────────────────────────────────────
interface TextItem {
  str: string
  transform: number[]  // [a, b, c, d, tx, ty] — tx=x, ty=y
  height: number
  width: number
}

interface PageContent {
  items: TextItem[]
}

// ─── 파싱 ─────────────────────────────────────────────────────────────────────

interface RawLine {
  text: string
  y: number
  fontSize: number
  page: number
}

interface Section {
  heading: string
  body: string
  page: number
}

async function parsePdfStructured(buffer: Buffer): Promise<Section[]> {
  // Dynamic import to handle ESM-only pdfjs-dist
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs') as {
    getDocument: (opts: { data: Uint8Array; useWorkerFetch: boolean; isEvalSupported: boolean; useSystemFonts: boolean }) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<PageContent> }> }> }
    GlobalWorkerOptions: { workerSrc: string }
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc = ''

  const uint8 = new Uint8Array(buffer)
  const doc = await pdfjsLib.getDocument({
    data: uint8,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise

  const rawLines: RawLine[] = []

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()

    // group items into lines by y position (±2pt tolerance)
    const lineMap = new Map<number, TextItem[]>()
    for (const item of content.items as TextItem[]) {
      if (!item.str.trim()) continue
      const y = Math.round(item.transform[5] ?? 0)
      const key = [...lineMap.keys()].find(k => Math.abs(k - y) <= 2) ?? y
      if (!lineMap.has(key)) lineMap.set(key, [])
      lineMap.get(key)!.push(item)
    }

    // sort lines top→bottom (PDF y goes bottom→top, so higher y = higher on page)
    const sortedYs = [...lineMap.keys()].sort((a, b) => b - a)

    for (const y of sortedYs) {
      const items = lineMap.get(y)!.sort((a, b) => (a.transform[4] ?? 0) - (b.transform[4] ?? 0))
      const text = items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim()
      if (!text) continue
      const fontSize = Math.max(...items.map(i => i.height || 0))
      rawLines.push({ text, y, fontSize, page: p })
    }
  }

  if (rawLines.length === 0) return []

  // detect body font size (most common non-zero size)
  const sizeFreq = new Map<number, number>()
  for (const l of rawLines) {
    if (l.fontSize > 0) sizeFreq.set(l.fontSize, (sizeFreq.get(l.fontSize) ?? 0) + 1)
  }
  const bodyFontSize = ([...sizeFreq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]) ?? 10
  const headingThreshold = bodyFontSize * 1.2

  // split into sections at headings
  const sections: Section[] = []
  let currentHeading = ''
  let currentBody: string[] = []
  let currentPage = rawLines[0]?.page ?? 1

  function flush() {
    const body = currentBody.join(' ').replace(/\s+/g, ' ').trim()
    if (body.length > 20) {
      sections.push({ heading: currentHeading, body, page: currentPage })
    }
    currentBody = []
  }

  for (const line of rawLines) {
    const isHeading = line.fontSize >= headingThreshold && line.text.length < 120
    if (isHeading) {
      flush()
      currentHeading = line.text
      currentPage = line.page
    } else {
      currentBody.push(line.text)
    }
  }
  flush()

  return sections
}

// ─── 청킹 ─────────────────────────────────────────────────────────────────────

interface Chunk {
  chunkIndex: number
  pageNumber: number
  content: string
  tokenCount: number
}

function chunkSections(sections: Section[]): Chunk[] {
  const chunks: Chunk[] = []
  let idx = 0

  for (const section of sections) {
    const prefix = section.heading ? `[${section.heading}]\n` : ''
    const fullText = prefix + section.body

    if (estimateTokens(fullText) <= CHUNK_MAX_TOKENS) {
      chunks.push({
        chunkIndex: idx++,
        pageNumber: section.page,
        content: fullText.trim(),
        tokenCount: estimateTokens(fullText),
      })
      continue
    }

    // section too large: split by sentence, prefix each chunk with heading
    const sentences = section.body.split(/(?<=[.!?。\n])\s+/)
    let buf = ''

    for (const sentence of sentences) {
      const candidate = buf ? `${buf} ${sentence}` : sentence
      if (estimateTokens(prefix + candidate) > CHUNK_TARGET_TOKENS && buf) {
        chunks.push({
          chunkIndex: idx++,
          pageNumber: section.page,
          content: (prefix + buf).trim(),
          tokenCount: estimateTokens(prefix + buf),
        })
        buf = sentence
      } else {
        buf = candidate
      }
    }
    if (buf.trim()) {
      chunks.push({
        chunkIndex: idx++,
        pageNumber: section.page,
        content: (prefix + buf).trim(),
        tokenCount: estimateTokens(prefix + buf),
      })
    }
  }

  return chunks
}

// ─── 서비스 ──────────────────────────────────────────────────────────────────

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
    return this.ingestBuffer(rulebookId, gameId, buffer, fileUrl)
  }

  async ingestFromBuffer(rulebookId: string, gameId: string, buffer: Buffer, fileUrl: string): Promise<{ chunks: number }> {
    return this.ingestBuffer(rulebookId, gameId, buffer, fileUrl)
  }

  private async ingestBuffer(rulebookId: string, gameId: string, buffer: Buffer, fileUrl: string): Promise<{ chunks: number }> {
    const sections = await parsePdfStructured(buffer)
    this.logger.log(`섹션 파싱 완료: ${sections.length}개 섹션`)

    const chunks = chunkSections(sections)
    this.logger.log(`청킹 완료: ${chunks.length}개 청크`)

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
