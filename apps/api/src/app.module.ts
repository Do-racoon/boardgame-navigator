import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DatabaseModule } from './database/database.module'
import { GamesModule } from './games/games.module'
import { RulebooksModule } from './rulebooks/rulebooks.module'
import { RagModule } from './rag/rag.module'
import { BenchmarkModule } from './benchmark/benchmark.module'
import { SubmissionsModule } from './submissions/submissions.module'
import { AdminModule } from './admin/admin.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    GamesModule,
    RulebooksModule,
    RagModule,
    BenchmarkModule,
    SubmissionsModule,
    AdminModule,
  ],
})
export class AppModule {}
