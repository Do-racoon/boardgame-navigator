import { Injectable } from '@nestjs/common'
import { SupabaseService } from '../database/supabase.service'
import { SearchGamesDto } from './dto/search-games.dto'

@Injectable()
export class GamesService {
  constructor(private readonly supabase: SupabaseService) {}

  async search(dto: SearchGamesDto) {
    const { q, genre, minPlayers, maxPlayers, maxPlayTime, maxDifficulty, page = 1, limit = 20 } = dto

    let query = this.supabase.client
      .from('games')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)
      .range((page - 1) * limit, page * limit - 1)
      .order('title_ko')

    if (q) query = query.or(`title_ko.ilike.%${q}%,title_en.ilike.%${q}%`)
    if (genre) query = query.contains('genres', [genre])
    if (minPlayers) query = query.gte('max_players', minPlayers)
    if (maxPlayers) query = query.lte('min_players', maxPlayers)
    if (maxPlayTime) query = query.lte('min_play_time', maxPlayTime)
    if (maxDifficulty) query = query.lte('difficulty', maxDifficulty)

    const { data, count, error } = await query
    if (error) throw new Error(error.message)

    return { items: data ?? [], total: count ?? 0, page, limit }
  }

  async findById(id: string) {
    const { data, error } = await this.supabase.client
      .from('games')
      .select('*, rulebooks(id, language, version, status)')
      .eq('id', id)
      .single()
    if (error) throw new Error(error.message)
    return data
  }
}
