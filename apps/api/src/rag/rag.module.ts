import { Module } from '@nestjs/common'
import { RagController } from './rag.controller'
import { RagService } from './rag.service'
import { VectorSearchService } from './vector-search.service'
import { AzureOpenAiService } from './azure-openai.service'
import { GraphSearchService } from './graph-search.service'

@Module({
  controllers: [RagController],
  providers: [RagService, VectorSearchService, AzureOpenAiService, GraphSearchService],
  exports: [RagService, VectorSearchService, AzureOpenAiService, GraphSearchService],
})
export class RagModule {}
