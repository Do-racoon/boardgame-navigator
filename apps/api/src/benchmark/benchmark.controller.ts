import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { BenchmarkService } from './benchmark.service'

@ApiTags('benchmark')
@Controller('benchmark')
export class BenchmarkController {
  constructor(private readonly benchmarkService: BenchmarkService) {}

  @Get('games/:gameId')
  run(@Param('gameId') gameId: string, @Query('topK') topK = 5) {
    return this.benchmarkService.runByGame(gameId, Number(topK))
  }
}
