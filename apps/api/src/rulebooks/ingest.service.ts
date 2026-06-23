import { Injectable, Logger } from '@nestjs/common'
import { AzureOpenAiService } from '../rag/azure-openai.service'
import { SupabaseService } from '../database/supabase.service'
import { RulebooksService } from './rulebooks.service'

const CHUNK_SIZE = 600
const CHUNK_OVERLAP = 120

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name)

  constructor(
    private readonly supabase: SupabaseService,
    private readonly openai: AzureOpenAiService,
    private readonly rulebooks: RulebooksService,
  ) {}

  async ingest(rulebookId: string): Promise<void> {
    const rulebook = await this.rulebooks.findById(rulebookId)
    await this.rulebooks.updateStatus(rulebookId, 'PROCESSING')

    try {
      const text = await this.loadText(rulebook.text_url ?? rulebook.file_url)
      const chunks = this.chunk(text)
      this.logger.log(`[${rulebookId}] ${chunks.length} chunks`)

      for (let index = 0; index < chunks.length; index++) {
        const content = chunks[index]!
        const embedding = await this.openai.embed(content)
        const id = `${rulebookId}_${String(index).padStart(4, '0')}`

        const { error } = await this.supabase.client.rpc('upsert_chunk', {
          p_id: id,
          p_rulebook_id: rulebookId,
          p_game_id: rulebook.game_id,
          p_page_number: null,
          p_chunk_index: index,
          p_content: content,
          p_token_count: Math.ceil(content.length / 4),
          p_embedding_id: id,
          p_embedding: embedding,
        })
        if (error) throw new Error(`청크 저장 실패: ${error.message}`)
      }

      await this.rulebooks.updateStatus(rulebookId, 'INDEXED')
      this.logger.log(`[${rulebookId}] ingest complete`)
    } catch (err) {
      this.logger.error(`[${rulebookId}] ingest failed`, err)
      await this.rulebooks.updateStatus(rulebookId, 'FAILED')
      throw err
    }
  }

  private chunk(text: string): string[] {
    const chunks: string[] = []
    let start = 0
    while (start < text.length) {
      chunks.push(text.slice(start, Math.min(start + CHUNK_SIZE, text.length)).trim())
      start += CHUNK_SIZE - CHUNK_OVERLAP
    }
    return chunks.filter((c) => c.length > 50)
  }

  private async loadText(url: string): Promise<string> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to load text from ${url}: ${res.status}`)
    return res.text()
  }
}
