import OpenAI from 'openai'

const BATCH_SIZE = 16
const DELAY_MS = 500

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export class Embedder {
  private readonly client: OpenAI
  private readonly model: string

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env['OPENAI_API_KEY']!,
    })
    this.model = process.env['OPENAI_EMBEDDING_MODEL'] ?? 'text-embedding-3-large'
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = []

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE)
      const res = await this.client.embeddings.create({
        model: this.model,
        input: batch,
        dimensions: 1536,
      })
      results.push(...res.data.map((d) => d.embedding))
      if (i + BATCH_SIZE < texts.length) await sleep(DELAY_MS)
    }

    return results
  }
}
