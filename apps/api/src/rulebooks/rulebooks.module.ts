import { Module } from '@nestjs/common'
import { RulebooksController } from './rulebooks.controller'
import { RulebooksService } from './rulebooks.service'
import { IngestService } from './ingest.service'
import { RagModule } from '../rag/rag.module'

@Module({
  imports: [RagModule],
  controllers: [RulebooksController],
  providers: [RulebooksService, IngestService],
})
export class RulebooksModule {}
