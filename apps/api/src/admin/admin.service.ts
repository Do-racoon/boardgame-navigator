import { Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { SupabaseService } from '../database/supabase.service'
import { AdminIngestService } from './admin-ingest.service'

@Injectable()
export class AdminService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly ingest: AdminIngestService,
  ) {}

  // ── 신청 ──────────────────────────────────────────────────────────

  async getSubmissions() {
    const { data, error } = await this.supabase.client
      .from('game_submissions')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async updateSubmissionStatus(id: string, status: string, adminNote?: string) {
    const { error } = await this.supabase.client
      .from('game_submissions')
      .update({ status, admin_note: adminNote })
      .eq('id', id)
    if (error) throw new Error(error.message)
  }

  async deleteSubmission(id: string) {
    const { error } = await this.supabase.client.from('game_submissions').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return { deleted: true }
  }

  async ingestTest(submissionId: string): Promise<{ gameId: string; chunks: number }> {
    const sub = await this.getSubmission(submissionId)
    if (!sub.rulebook_url) throw new Error('룰북 파일이 없습니다')

    // 기존 테스트 게임 조회 또는 신규 생성
    const testTitle = `[테스트] ${sub.title_ko as string}`
    let gameId: string
    const { data: existing } = await this.supabase.client
      .from('games').select('id').eq('title_ko', testTitle).maybeSingle()

    if (existing) {
      gameId = existing.id as string
    } else {
      const { data: newGame, error: createErr } = await this.supabase.client
        .from('games')
        .insert({ id: randomUUID(), title_ko: testTitle, genres: [], min_players: 1, max_players: 99, min_play_time: 1, max_play_time: 999 })
        .select('id').single()
      if (createErr) throw new Error(`임시 게임 생성 실패: ${createErr.message}`)
      gameId = newGame.id as string
    }

    const result = await this.ingest.ingestFromUrl(`${gameId}-ko`, gameId, sub.rulebook_url as string)
    return { gameId, chunks: result.chunks }
  }

  async publish(submissionId: string): Promise<{ gameId: string; chunks: number }> {
    const sub = await this.getSubmission(submissionId)

    const { data: game, error: gameError } = await this.supabase.client
      .from('games')
      .insert({
        id: randomUUID(),
        title_ko: sub.title_ko,
        title_en: sub.title_en ?? null,
        description: sub.description ?? null,
        min_players: sub.min_players ?? 1,
        max_players: sub.max_players ?? 99,
        min_play_time: sub.min_play_time ?? 1,
        max_play_time: sub.max_play_time ?? 999,
        difficulty: sub.difficulty ?? null,
        genres: sub.genres ?? [],
      })
      .select('id')
      .single()
    if (gameError) throw new Error(`게임 등록 실패: ${gameError.message}`)
    const gameId: string = game.id

    let chunks = 0
    if (sub.rulebook_url) {
      const result = await this.ingest.ingestFromUrl(`${gameId}-ko`, gameId, sub.rulebook_url as string)
      chunks = result.chunks
    } else if (sub.rulebook_text) {
      await this.supabase.client.rpc('upsert_rulebook', {
        p_id: `${gameId}-ko`, p_game_id: gameId, p_language: 'ko',
        p_source_type: 'TEXT', p_file_url: '', p_status: 'INDEXED',
      })
    }

    await this.updateSubmissionStatus(submissionId, 'DONE')
    return { gameId, chunks }
  }

  private async getSubmission(id: string) {
    const { data, error } = await this.supabase.client
      .from('game_submissions').select('*').eq('id', id).single()
    if (error || !data) throw new NotFoundException('신청을 찾을 수 없습니다')
    return data
  }

  // ── 게임 ──────────────────────────────────────────────────────────

  async getGames() {
    const { data, error } = await this.supabase.client
      .from('games')
      .select('*, rulebooks(id, status, version)')
      .order('title_ko')
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async updateGame(id: string, dto: Record<string, unknown>) {
    const allowed = ['title_ko', 'title_en', 'description', 'extra_rules', 'min_players', 'max_players', 'min_play_time', 'max_play_time', 'difficulty', 'genres']
    const update = Object.fromEntries(Object.entries(dto).filter(([k]) => allowed.includes(k)))
    const { error } = await this.supabase.client.from('games').update(update).eq('id', id)
    if (error) throw new Error(error.message)
  }

  async deleteGame(id: string) {
    await this.supabase.client.from('rulebook_chunks').delete().eq('game_id', id)
    await this.supabase.client.from('rulebooks').delete().eq('game_id', id)
    const { error } = await this.supabase.client.from('games').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return { deleted: true }
  }

  async reingestGame(gameId: string, fileUrl: string): Promise<{ chunks: number }> {
    return this.ingest.ingestFromUrl(`${gameId}-ko`, gameId, fileUrl)
  }
}
