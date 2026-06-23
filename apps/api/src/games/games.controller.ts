import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { GamesService } from './games.service'
import { SearchGamesDto } from './dto/search-games.dto'

@ApiTags('games')
@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get()
  search(@Query() dto: SearchGamesDto) {
    return this.gamesService.search(dto)
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.gamesService.findById(id)
  }
}
