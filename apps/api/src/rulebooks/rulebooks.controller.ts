import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { RulebooksService } from './rulebooks.service'
import { IngestService } from './ingest.service'

class CreateRulebookDto {
  language!: string
  sourceType!: 'PDF' | 'IMAGE' | 'TEXT'
  fileUrl!: string
  version?: string
}

@ApiTags('rulebooks')
@Controller('games/:gameId/rulebooks')
export class RulebooksController {
  constructor(
    private readonly rulebooksService: RulebooksService,
    private readonly ingestService: IngestService,
  ) {}

  @Get()
  findAll(@Param('gameId') gameId: string) {
    return this.rulebooksService.findByGame(gameId)
  }

  @Post()
  async create(@Param('gameId') gameId: string, @Body() dto: CreateRulebookDto) {
    const rulebook = await this.rulebooksService.create(gameId, dto)
    // 비동기 ingest 시작
    this.ingestService.ingest(rulebook.id).catch(() => null)
    return rulebook
  }

  @Post(':rulebookId/ingest')
  triggerIngest(@Param('rulebookId') rulebookId: string) {
    this.ingestService.ingest(rulebookId).catch(() => null)
    return { message: 'Ingest started', rulebookId }
  }
}
