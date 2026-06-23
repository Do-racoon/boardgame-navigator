import { ApiPropertyOptional } from '@nestjs/swagger'

export class SearchGamesDto {
  @ApiPropertyOptional() q?: string
  @ApiPropertyOptional() genreId?: string
  @ApiPropertyOptional({ type: Number }) minPlayers?: number
  @ApiPropertyOptional({ type: Number }) maxPlayers?: number
  @ApiPropertyOptional({ type: Number }) maxPlayTime?: number
  @ApiPropertyOptional({ type: Number }) maxDifficulty?: number
  @ApiPropertyOptional({ type: Number, default: 1 }) page?: number
  @ApiPropertyOptional({ type: Number, default: 20 }) limit?: number
}
