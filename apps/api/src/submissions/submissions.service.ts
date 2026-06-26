import { Injectable } from '@nestjs/common'
import { SupabaseService } from '../database/supabase.service'

export interface CreateSubmissionDto {
  titleKo: string
  titleEn?: string | undefined
  minPlayers?: number | undefined
  maxPlayers?: number | undefined
  minPlayTime?: number | undefined
  maxPlayTime?: number | undefined
  difficulty?: number | undefined
  genres: string[]
  description?: string | undefined
  rulebookType: 'PDF' | 'IMAGE' | 'TEXT'
  rulebookText?: string | undefined
  submitterEmail?: string | undefined
}

export interface CreateCorrectionDto {
  gameId: string
  content: string
  submitterEmail?: string | undefined
}

@Injectable()
export class SubmissionsService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(dto: CreateSubmissionDto, file?: Express.Multer.File): Promise<{ id: string }> {
    let rulebookUrl: string | undefined

    if (file) {
      const ext = file.originalname.split('.').pop()
      const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

      const { error: uploadError } = await this.supabase.client.storage
        .from('rulebook-submissions')
        .upload(path, file.buffer, { contentType: file.mimetype })

      if (uploadError) throw new Error(`파일 업로드 실패: ${uploadError.message}`)

      const { data } = this.supabase.client.storage
        .from('rulebook-submissions')
        .getPublicUrl(path)
      rulebookUrl = data.publicUrl
    }

    const { data, error } = await this.supabase.client
      .from('game_submissions')
      .insert({
        title_ko: dto.titleKo,
        title_en: dto.titleEn,
        min_players: dto.minPlayers,
        max_players: dto.maxPlayers,
        min_play_time: dto.minPlayTime,
        max_play_time: dto.maxPlayTime,
        difficulty: dto.difficulty,
        description: dto.description,
        genres: dto.genres,
        rulebook_type: dto.rulebookType,
        rulebook_url: rulebookUrl,
        rulebook_text: dto.rulebookText,
        submitter_email: dto.submitterEmail,
      })
      .select('id')
      .single()

    if (error) throw new Error(error.message)
    return { id: data.id }
  }

  async createCorrection(dto: CreateCorrectionDto): Promise<{ id: string }> {
    const { data, error } = await this.supabase.client
      .from('game_submissions')
      .insert({
        title_ko: '[수정요청]',
        genres: [],
        rulebook_type: 'CORRECTION',
        rulebook_text: dto.content,
        submitter_email: dto.submitterEmail,
        correction_for_game_id: dto.gameId,
        status: 'PENDING',
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    return { id: data.id }
  }

  async findAll() {
    const { data, error } = await this.supabase.client
      .from('game_submissions')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async updateStatus(id: string, status: string, adminNote?: string) {
    const { error } = await this.supabase.client
      .from('game_submissions')
      .update({ status, admin_note: adminNote })
      .eq('id', id)
    if (error) throw new Error(error.message)
  }
}
