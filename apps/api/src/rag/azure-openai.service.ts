import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'

@Injectable()
export class AzureOpenAiService {
  private readonly client: OpenAI
  private readonly embeddingModel: string
  private readonly chatModel: string

  constructor(private readonly config: ConfigService) {
    this.client = new OpenAI({
      apiKey: config.getOrThrow('OPENAI_API_KEY'),
    })
    this.embeddingModel = config.get('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-large')
    this.chatModel = config.get('OPENAI_CHAT_MODEL', 'gpt-4o-mini')
  }

  async embed(text: string): Promise<number[]> {
    const res = await this.client.embeddings.create({
      model: this.embeddingModel,
      input: text,
      dimensions: 1536,
    })
    return res.data[0]!.embedding
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const res = await this.client.embeddings.create({
      model: this.embeddingModel,
      input: texts,
      dimensions: 1536,
    })
    return res.data.map(d => d.embedding)
  }

  async chat(systemPrompt: string, userMessage: string, maxTokens = 400): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: this.chatModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    })
    return res.choices[0]?.message?.content ?? '{}'
  }

  async *streamChat(systemPrompt: string, userMessage: string): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      model: this.chatModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      stream: true,
      temperature: 0.1,
      max_tokens: 1024,
    })

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content
      if (delta) yield delta
    }
  }
}
