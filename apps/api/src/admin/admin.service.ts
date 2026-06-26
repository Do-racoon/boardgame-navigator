import { Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { SupabaseService } from '../database/supabase.service'
import { AdminIngestService } from './admin-ingest.service'
import { AzureOpenAiService } from '../rag/azure-openai.service'

const SETUP_GUIDE_PROMPT = `당신은 보드게임 세팅 전문가입니다.
아래 룰북 내용을 바탕으로 게임 시작 전 준비 단계를 정리해주세요.

요구사항:
- 게임 세팅/준비 과정에 해당하는 내용만 정리
- 플레이어가 게임 시작 전에 해야 할 일을 순서대로 작성
- 각 단계는 "번호. 제목\n내용" 형식으로 작성
- 5~10단계로 요약
- 한국어로 작성
- 세팅과 무관한 룰(점수 계산, 카드 효과 등)은 제외`

@Injectable()
export class AdminService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly ingest: AdminIngestService,
    private readonly openai: AzureOpenAiService,
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
        .insert({ id: randomUUID(), title_ko: testTitle, genres: [], min_players: 1, max_players: 99, min_play_time: 1, max_play_time: 999, difficulty: 1, title_en: '' })
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
        difficulty: sub.difficulty ?? 1,
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

  async getGames(deleted = false) {
    let query = this.supabase.client
      .from('games')
      .select('*, rulebooks(id, status, version)')
      .order('title_ko')
    query = deleted ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async trashGame(id: string) {
    const { error } = await this.supabase.client
      .from('games').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) throw new Error(error.message)
  }

  async restoreGame(id: string) {
    const { error } = await this.supabase.client
      .from('games').update({ deleted_at: null }).eq('id', id)
    if (error) throw new Error(error.message)
  }

  async updateGame(id: string, dto: Record<string, unknown>) {
    const allowed = ['title_ko', 'title_en', 'description', 'extra_rules', 'min_players', 'max_players', 'min_play_time', 'max_play_time', 'difficulty', 'genres']
    const update = Object.fromEntries(Object.entries(dto).filter(([k]) => allowed.includes(k)))
    const { error } = await this.supabase.client.from('games').update(update).eq('id', id)
    if (error) throw new Error(error.message)
  }

  async deleteGame(id: string) {
    // 관련 데이터 모두 삭제 (FK 순서 준수)
    await this.supabase.client.from('entities').delete().eq('game_id', id)
    await this.supabase.client.from('relationships').delete().eq('game_id', id)
    await this.supabase.client.from('qa_logs').delete().eq('game_id', id)
    await this.supabase.client.from('rulebook_chunks').delete().eq('game_id', id)
    await this.supabase.client.from('rulebooks').delete().eq('game_id', id)
    const { error } = await this.supabase.client.from('games').delete().eq('id', id)
    if (error) throw new Error(`게임 삭제 실패: ${error.message}`)
    return { deleted: true }
  }

  async reingestGame(gameId: string, fileUrl: string): Promise<{ chunks: number }> {
    return this.ingest.ingestFromUrl(`${gameId}-ko`, gameId, fileUrl)
  }

  async uploadExtraRules(gameId: string, mode: 'replace' | 'append', file?: Express.Multer.File): Promise<{ extraRules: string }> {
    let newText = ''

    if (file) {
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs') as {
        getDocument: (o: object) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: { str: string }[] }> }> }> }
        GlobalWorkerOptions: { workerSrc: string }
      }
      pdfjsLib.GlobalWorkerOptions.workerSrc = ''
      const doc = await pdfjsLib.getDocument({ data: new Uint8Array(file.buffer), useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise
      const texts: string[] = []
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p)
        const content = await page.getTextContent()
        texts.push(content.items.map((i: { str: string }) => i.str).join(' '))
      }
      newText = texts.join('\n').replace(/\s+/g, ' ').trim()
    }

    const { data: game } = await this.supabase.client.from('games').select('extra_rules').eq('id', gameId).single()
    const existing: string = game?.extra_rules ?? ''
    const extraRules = mode === 'append' && existing ? `${existing}\n\n${newText}` : newText

    const { error } = await this.supabase.client.from('games').update({ extra_rules: extraRules }).eq('id', gameId)
    if (error) throw new Error(error.message)
    return { extraRules }
  }

  async generateSetupGuide(gameId: string): Promise<{ setupGuide: string }> {
    // 세팅 관련 청크를 키워드로 검색
    const setupKeywords = ['준비', '세팅', '설치', '시작', '배치', '나눠', '카드 분배', '게임 준비', '초기']
    const { data: chunks } = await this.supabase.client
      .from('rulebook_chunks')
      .select('content, page_number, chunk_index')
      .eq('game_id', gameId)
      .or(setupKeywords.map(k => `content.ilike.%${k}%`).join(','))
      .order('chunk_index')
      .limit(15)

    // 검색 결과가 적으면 앞부분 청크로 보완 (룰북 앞쪽에 세팅이 있는 경우)
    let context = (chunks ?? []).map(c => c.content).join('\n\n')
    if ((chunks ?? []).length < 3) {
      const { data: frontChunks } = await this.supabase.client
        .from('rulebook_chunks')
        .select('content')
        .eq('game_id', gameId)
        .order('chunk_index')
        .limit(10)
      context = (frontChunks ?? []).map(c => c.content).join('\n\n')
    }

    if (!context.trim()) throw new Error('룰북 청크가 없습니다. 먼저 Ingest를 실행하세요.')

    // JSON 모드 없이 일반 텍스트 생성
    const stream = this.openai.streamChat(SETUP_GUIDE_PROMPT, `[룰북 내용]\n${context}`)
    let setupGuide = ''
    for await (const token of stream) {
      setupGuide += token
    }

    const { error } = await this.supabase.client.from('games').update({ setup_guide: setupGuide.trim() }).eq('id', gameId)
    if (error) throw new Error(error.message)
    return { setupGuide: setupGuide.trim() }
  }
}
