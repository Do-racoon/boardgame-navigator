import { Body, Controller, Headers, Param, Post, Res } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Response } from 'express'
import { RagService } from './rag.service'
import { VectorSearchService } from './vector-search.service'
import { AzureOpenAiService } from './azure-openai.service'

class AskDto {
  question!: string
  category?: string
}

@ApiTags('rag')
@Controller('games/:gameId')
export class RagController {
  constructor(
    private readonly ragService: RagService,
    private readonly vectorSearch: VectorSearchService,
    private readonly openai: AzureOpenAiService,
  ) {}

  @Post('ask')
  async ask(
    @Param('gameId') gameId: string,
    @Body() dto: AskDto,
    @Headers('x-session-id') sessionId: string = 'anonymous',
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    for await (const event of this.ragService.ask(gameId, dto.question, sessionId, dto.category)) {
      res.write(`data: ${JSON.stringify(event)}\n\n`)
    }

    res.end()
  }

  @Post('search')
  async search(
    @Param('gameId') gameId: string,
    @Body() dto: AskDto,
  ) {
    const vector = await this.openai.embed(dto.question)
    const chunks = await this.vectorSearch.similaritySearch(vector, gameId, 2)
    return chunks.map((c) => ({
      id: c.id,
      pageNumber: c.pageNumber,
      content: c.content,
      score: Math.round(c.score * 100),
    }))
  }
}
