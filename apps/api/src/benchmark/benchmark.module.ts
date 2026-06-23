import { Module } from '@nestjs/common'
import { BenchmarkController } from './benchmark.controller'
import { BenchmarkService } from './benchmark.service'
import { RagModule } from '../rag/rag.module'

@Module({
  imports: [RagModule],
  controllers: [BenchmarkController],
  providers: [BenchmarkService],
})
export class BenchmarkModule {}
