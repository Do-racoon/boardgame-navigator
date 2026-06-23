import { Injectable, NotFoundException } from '@nestjs/common'
import { SupabaseService } from '../database/supabase.service'

@Injectable()
export class RulebooksService {
  constructor(private readonly supabase: SupabaseService) {}

  async findByGame(gameId: string) {
    const { data, error } = await this.supabase.client
      .from('rulebooks')
      .select('*')
      .eq('game_id', gameId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async create(gameId: string, data: { language: string; sourceType: 'PDF' | 'IMAGE' | 'TEXT'; fileUrl: string; version?: string }) {
    const id = `${gameId}-${data.language}-${Date.now()}`
    const { error } = await this.supabase.client.from('rulebooks').insert({
      id,
      game_id: gameId,
      language: data.language,
      source_type: data.sourceType,
      file_url: data.fileUrl,
      version: data.version,
    })
    if (error) throw new Error(error.message)
    return { id, gameId, ...data }
  }

  async updateStatus(id: string, status: 'READY' | 'PROCESSING' | 'INDEXED' | 'FAILED') {
    const { error } = await this.supabase.client
      .from('rulebooks')
      .update({ status })
      .eq('id', id)
    if (error) throw new Error(error.message)
  }

  async findById(id: string) {
    const { data, error } = await this.supabase.client
      .from('rulebooks')
      .select('*')
      .eq('id', id)
      .single()
    if (error || !data) throw new NotFoundException(`Rulebook ${id} not found`)
    return data
  }
}
