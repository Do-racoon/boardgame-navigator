import { Module } from '@nestjs/common'
import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'
import { AdminIngestService } from './admin-ingest.service'
import { DatabaseModule } from '../database/database.module'
import { RagModule } from '../rag/rag.module'

@Module({
  imports: [DatabaseModule, RagModule],
  controllers: [AdminController],
  providers: [AdminService, AdminIngestService],
})
export class AdminModule {}
