import { Injectable, NotFoundException } from '@nestjs/common'
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

  async ingestTest(submissionId: string): Promise<{ gameId: string; chunks: number }> {
    const sub = await this.getSubmission(submissionId)
    if (!sub.rulebook_url) throw new Error('룰북 파일이 없습니다')

    const gameId = `test_${submissionId}`
    const rulebookId = `${gameId}-ko`
    const result = await this.ingest.ingestFromUrl(rulebookId, gameId, sub.rulebook_url)
    return { gameId, chunks: result.chunks }
  }

  async publish(submissionId: string): Promise<{ gameId: string }> {
    const sub = await this.getSubmission(submissionId)

    // 게임 INSERT
    const { data: game, error: gameError } = await this.supabase.client
      .from('games')
      .insert({
        title_ko: sub.title_ko,
        title_en: sub.title_en ?? null,
        description: sub.description ?? null,
        min_players: sub.min_players ?? null,
        max_players: sub.max_players ?? null,
        min_play_time: sub.min_play_time ?? null,
        max_play_time: sub.max_play_time ?? null,
        difficulty: sub.difficulty ?? null,
        genres: sub.genres ?? [],
      })
      .select('id')
      .single()
    if (gameError) throw new Error(`게임 등록 실패: ${gameError.message}`)
    const gameId: string = game.id

    // ingest (파일이 있는 경우)
    if (sub.rulebook_url) {
      const rulebookId = `${gameId}-ko`
      await this.ingest.ingestFromUrl(rulebookId, gameId, sub.rulebook_url)
    } else if (sub.rulebook_text) {
      // 텍스트 제출의 경우 룰북만 저장 (임베딩 없이)
      await this.supabase.client.rpc('upsert_rulebook', {
        p_id: `${gameId}-ko`,
        p_game_id: gameId,
        p_language: 'ko',
        p_source_type: 'TEXT',
        p_file_url: '',
        p_status: 'INDEXED',
      })
    }

    // 신청 완료 처리
    await this.updateSubmissionStatus(submissionId, 'DONE')
    return { gameId }
  }

  private async getSubmission(id: string) {
    const { data, error } = await this.supabase.client
      .from('game_submissions')
      .select('*')
      .eq('id', id)
      .single()
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
    const allowed = ['title_ko', 'title_en', 'description', 'min_players', 'max_players', 'min_play_time', 'max_play_time', 'difficulty', 'genres']
    const update = Object.fromEntries(Object.entries(dto).filter(([k]) => allowed.includes(k)))
    const { error } = await this.supabase.client.from('games').update(update).eq('id', id)
    if (error) throw new Error(error.message)
  }

  async reingestGame(gameId: string, fileUrl: string): Promise<{ chunks: number }> {
    const rulebookId = `${gameId}-ko`
    return this.ingest.ingestFromUrl(rulebookId, gameId, fileUrl)
  }
}
