'use client'

import { useEffect, useState, useRef } from 'react'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'
const ADMIN_PW = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? 'admin1234'

type Status = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'REJECTED'
type Tab = 'submissions' | 'games'

interface Submission {
  id: string
  title_ko: string
  title_en: string | null
  description: string | null
  min_players: number | null
  max_players: number | null
  min_play_time: number | null
  max_play_time: number | null
  difficulty: number | null
  genres: string[]
  rulebook_type: string
  rulebook_url: string | null
  rulebook_text: string | null
  submitter_email: string | null
  status: Status
  admin_note: string | null
  created_at: string
}

interface Game {
  id: string
  title_ko: string
  title_en: string | null
  description: string | null
  min_players: number | null
  max_players: number | null
  min_play_time: number | null
  max_play_time: number | null
  difficulty: number | null
  genres: string[]
  thumbnail_url: string | null
  rulebooks: { id: string; status: string; version: number }[]
}

interface ChatMessage { role: 'user' | 'assistant'; content: string }

const STATUS_LABEL: Record<Status, string> = { PENDING: '대기중', IN_PROGRESS: '작업중', DONE: '완료', REJECTED: '반려' }
const STATUS_COLOR: Record<Status, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  DONE: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [tab, setTab] = useState<Tab>('submissions')

  if (!authed) return (
    <div className="max-w-sm mx-auto mt-20">
      <h1 className="text-xl font-bold mb-6 text-center">어드민 로그인</h1>
      <input type="password" value={pw} onChange={e => setPw(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && pw === ADMIN_PW && setAuthed(true)}
        placeholder="비밀번호" className="w-full rounded border px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
      <button onClick={() => pw === ADMIN_PW ? setAuthed(true) : alert('비밀번호가 틀렸습니다')}
        className="w-full rounded bg-indigo-600 py-2 text-sm text-white">로그인</button>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-xl font-bold">어드민</h1>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['submissions', 'games'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${tab === t ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>
              {t === 'submissions' ? '신청 관리' : '게임 관리'}
            </button>
          ))}
        </div>
      </div>
      {tab === 'submissions' ? <SubmissionsTab /> : <GamesTab />}
    </div>
  )
}

// ─── 신청 관리 탭 ────────────────────────────────────────────────────────────

function SubmissionsTab() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [selected, setSelected] = useState<Submission | null>(null)
  const [note, setNote] = useState('')
  const [filter, setFilter] = useState<Status | 'ALL'>('ALL')
  const [loading, setLoading] = useState(false)
  const [testGameId, setTestGameId] = useState<string | null>(null)
  const [ingesting, setIngesting] = useState(false)
  const [publishing, setPublishing] = useState(false)

  async function load() {
    const res = await fetch(`${BASE_URL}/admin/submissions`)
    setSubmissions(await res.json())
  }

  useEffect(() => { void load() }, [])

  async function updateStatus(id: string, status: Status) {
    setLoading(true)
    await fetch(`${BASE_URL}/admin/submissions/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, adminNote: note }),
    })
    await load()
    setSelected(null)
    setNote('')
    setLoading(false)
  }

  async function handleIngestTest(id: string) {
    setIngesting(true)
    setTestGameId(null)
    try {
      const res = await fetch(`${BASE_URL}/admin/submissions/${id}/ingest-test`, { method: 'POST' })
      const data = await res.json() as { gameId: string; chunks: number }
      setTestGameId(data.gameId)
      alert(`테스트 ingest 완료! ${data.chunks}개 청크`)
    } catch {
      alert('Ingest 실패')
    } finally {
      setIngesting(false)
    }
  }

  async function handlePublish(id: string) {
    if (!confirm('게임 테이블에 등록하고 완료 처리합니다. 계속하시겠습니까?')) return
    setPublishing(true)
    try {
      const res = await fetch(`${BASE_URL}/admin/submissions/${id}/publish`, { method: 'POST' })
      const data = await res.json() as { gameId: string }
      alert(`등록 완료! 게임 ID: ${data.gameId}`)
      await load()
      setSelected(null)
      setTestGameId(null)
    } catch {
      alert('등록 실패')
    } finally {
      setPublishing(false)
    }
  }

  const filtered = filter === 'ALL' ? submissions : submissions.filter(s => s.status === filter)
  const counts = submissions.reduce((acc, s) => { acc[s.status] = (acc[s.status] ?? 0) + 1; return acc }, {} as Record<string, number>)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      {/* 목록 */}
      <div>
        <div className="grid grid-cols-5 gap-2 mb-4">
          {(['ALL', 'PENDING', 'IN_PROGRESS', 'DONE', 'REJECTED'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`rounded-lg border p-2 text-left transition-colors ${filter === s ? 'border-indigo-500 bg-indigo-50' : 'bg-white hover:bg-gray-50'}`}>
              <p className="text-xs text-gray-500">{s === 'ALL' ? '전체' : STATUS_LABEL[s]}</p>
              <p className="text-xl font-bold mt-0.5">{s === 'ALL' ? submissions.length : (counts[s] ?? 0)}</p>
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {filtered.map(s => (
            <div key={s.id} onClick={() => { setSelected(s); setNote(s.admin_note ?? ''); setTestGameId(null) }}
              className={`cursor-pointer rounded-lg border bg-white p-4 hover:shadow-sm transition-shadow ${selected?.id === s.id ? 'border-indigo-400' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{s.title_ko}{s.title_en && <span className="text-gray-400 text-sm ml-1">({s.title_en})</span>}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {s.min_players && `${s.min_players}~${s.max_players}인`}
                    {s.min_play_time && ` · ${s.min_play_time}~${s.max_play_time}분`}
                    {s.difficulty && ` · 난이도 ${s.difficulty}`}
                  </p>
                  {s.genres?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {s.genres.map(g => <span key={g} className="text-xs bg-gray-100 rounded-full px-2 py-0.5">{g}</span>)}
                    </div>
                  )}
                </div>
                <span className={`shrink-0 text-xs rounded-full px-2 py-0.5 font-medium ${STATUS_COLOR[s.status]}`}>{STATUS_LABEL[s.status]}</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {s.rulebook_type} · {new Date(s.created_at).toLocaleDateString('ko-KR')}
                {s.submitter_email && ` · ${s.submitter_email}`}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 상세 */}
      {selected && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-5 space-y-4 sticky top-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{selected.title_ko}</h2>
              <button onClick={() => { setSelected(null); setTestGameId(null) }} className="text-gray-400 text-lg">×</button>
            </div>

            {selected.description && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">게임 소개</p>
                <p className="text-sm text-gray-700">{selected.description}</p>
              </div>
            )}
            {selected.rulebook_url && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">룰북 파일</p>
                <a href={selected.rulebook_url} target="_blank" className="text-xs text-indigo-600 underline break-all">{selected.rulebook_url}</a>
              </div>
            )}
            {selected.rulebook_text && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">룰북 텍스트</p>
                <pre className="text-xs bg-gray-50 rounded p-3 max-h-32 overflow-y-auto whitespace-pre-wrap">{selected.rulebook_text}</pre>
              </div>
            )}

            {/* 테스트 ingest */}
            {selected.rulebook_url && selected.status !== 'DONE' && (
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-medium text-gray-500">테스트 채팅</p>
                <button onClick={() => handleIngestTest(selected.id)} disabled={ingesting}
                  className="w-full rounded border border-indigo-300 py-2 text-sm text-indigo-700 hover:bg-indigo-50 disabled:opacity-40">
                  {ingesting ? '⏳ Ingest 중...' : '🧪 테스트 Ingest 실행'}
                </button>
                {testGameId && <TestChat gameId={testGameId} />}
              </div>
            )}

            {/* 메모 + 상태 변경 */}
            <div className="border-t pt-3 space-y-3">
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                placeholder="관리자 메모..." className="w-full rounded border px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
              <div className="grid grid-cols-2 gap-2">
                {(['IN_PROGRESS', 'REJECTED', 'PENDING'] as Status[]).map(s => (
                  <button key={s} onClick={() => updateStatus(selected.id, s)} disabled={loading || selected.status === s}
                    className={`rounded py-2 text-xs font-medium disabled:opacity-40 ${s === 'REJECTED' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    → {STATUS_LABEL[s]}
                  </button>
                ))}
                <button onClick={() => handlePublish(selected.id)} disabled={publishing || selected.status === 'DONE'}
                  className="rounded py-2 text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 col-span-1">
                  {publishing ? '등록 중...' : '✅ 게임으로 등록'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 테스트 채팅 ─────────────────────────────────────────────────────────────

function TestChat({ gameId }: { gameId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function send() {
    if (!input.trim() || loading) return
    const question = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: question }])
    setLoading(true)

    try {
      const res = await fetch(`${BASE_URL}/games/${gameId}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let answer = ''
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = decoder.decode(value).split('\n')
        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const raw = line.slice(5).trim()
          try {
            const ev = JSON.parse(raw) as { type: string; content?: string }
            if (ev.type === 'delta' && ev.content) {
              answer += ev.content
              setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: answer }])
            }
          } catch { /* skip */ }
        }
      }
    } finally {
      setLoading(false)
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="rounded border bg-gray-50 p-3 space-y-2">
      <div className="max-h-48 overflow-y-auto space-y-2 text-xs">
        {messages.length === 0 && <p className="text-gray-400 text-center py-4">질문을 입력해보세요</p>}
        {messages.map((m, i) => (
          <div key={i} className={`rounded p-2 ${m.role === 'user' ? 'bg-indigo-100 ml-4' : 'bg-white mr-4 border'}`}>
            <p className="font-medium text-gray-500 mb-0.5">{m.role === 'user' ? '질문' : 'AI'}</p>
            <p className="whitespace-pre-wrap">{m.content}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && void send()}
          placeholder="룰북 내용 질문..." className="flex-1 rounded border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
        <button onClick={() => void send()} disabled={loading} className="rounded bg-indigo-600 px-3 py-1.5 text-xs text-white disabled:opacity-40">
          {loading ? '...' : '전송'}
        </button>
      </div>
    </div>
  )
}

// ─── 게임 관리 탭 ────────────────────────────────────────────────────────────

function GamesTab() {
  const [games, setGames] = useState<Game[]>([])
  const [selected, setSelected] = useState<Game | null>(null)
  type EditForm = { title_ko: string; title_en: string; description: string; min_players: number | ''; max_players: number | ''; min_play_time: number | ''; max_play_time: number | ''; difficulty: number | ''; genres: string[] }
  const [editForm, setEditForm] = useState<EditForm>({ title_ko: '', title_en: '', description: '', min_players: '', max_players: '', min_play_time: '', max_play_time: '', difficulty: '', genres: [] })
  const [saving, setSaving] = useState(false)
  const [reingestUrl, setReingestUrl] = useState('')
  const [reingesting, setReingesting] = useState(false)
  const [testGameId, setTestGameId] = useState<string | null>(null)

  async function load() {
    const res = await fetch(`${BASE_URL}/admin/games`)
    setGames(await res.json())
  }

  useEffect(() => { void load() }, [])

  function selectGame(game: Game) {
    setSelected(game)
    setEditForm({
      title_ko: game.title_ko ?? '',
      title_en: game.title_en ?? '',
      description: game.description ?? '',
      min_players: game.min_players ?? '',
      max_players: game.max_players ?? '',
      min_play_time: game.min_play_time ?? '',
      max_play_time: game.max_play_time ?? '',
      difficulty: game.difficulty ?? '',
      genres: game.genres ?? [],
    })
    setReingestUrl('')
    setTestGameId(null)
  }

  async function save() {
    if (!selected) return
    setSaving(true)
    await fetch(`${BASE_URL}/admin/games/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    await load()
    setSaving(false)
    alert('저장 완료')
  }

  async function handleReingest() {
    if (!selected || !reingestUrl.trim()) return
    setReingesting(true)
    try {
      const res = await fetch(`${BASE_URL}/admin/games/${selected.id}/reingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl: reingestUrl }),
      })
      const data = await res.json() as { chunks: number }
      setTestGameId(selected.id)
      alert(`Reingest 완료! ${data.chunks}개 청크`)
    } catch {
      alert('Reingest 실패')
    } finally {
      setReingesting(false)
    }
  }

  const GENRES = ['카드', '심리전', '덱빌딩', '일꾼놓기', '땅따먹기', '기억력', '귀여운', '협력', '팀전', '전략', '추리', '경매']

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      {/* 목록 */}
      <div className="space-y-2">
        <p className="text-sm text-gray-500 mb-3">총 {games.length}개 게임</p>
        {games.map(g => (
          <div key={g.id} onClick={() => selectGame(g)}
            className={`cursor-pointer rounded-lg border bg-white p-4 hover:shadow-sm transition-shadow ${selected?.id === g.id ? 'border-indigo-400' : ''}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{g.title_ko}{g.title_en && <span className="text-gray-400 text-sm ml-1">({g.title_en})</span>}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {g.min_players && `${g.min_players}~${g.max_players}인`}
                  {g.min_play_time && ` · ${g.min_play_time}~${g.max_play_time}분`}
                  {g.difficulty && ` · 난이도 ${g.difficulty}`}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {g.rulebooks?.map(r => (
                  <span key={r.id} className={`text-xs rounded-full px-2 py-0.5 ${r.status === 'INDEXED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    룰북 {r.status}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 상세/편집 */}
      {selected && (
        <div className="rounded-lg border bg-white p-5 space-y-4 sticky top-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">게임 편집</h2>
            <button onClick={() => setSelected(null)} className="text-gray-400 text-lg">×</button>
          </div>

          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500">한국어 이름</label>
                <input value={editForm.title_ko ?? ''} onChange={e => setEditForm(p => ({ ...p, title_ko: e.target.value }))}
                  className="w-full rounded border px-2 py-1.5 text-sm mt-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500">영어 이름</label>
                <input value={editForm.title_en ?? ''} onChange={e => setEditForm(p => ({ ...p, title_en: e.target.value }))}
                  className="w-full rounded border px-2 py-1.5 text-sm mt-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500">게임 소개</label>
              <textarea value={editForm.description ?? ''} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                rows={3} className="w-full rounded border px-2 py-1.5 text-sm mt-0.5 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-300" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500">최소 인원</label>
                <input type="number" value={editForm.min_players ?? ''} onChange={e => setEditForm(p => ({ ...p, min_players: Number(e.target.value) }))}
                  className="w-full rounded border px-2 py-1.5 text-sm mt-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500">최대 인원</label>
                <input type="number" value={editForm.max_players ?? ''} onChange={e => setEditForm(p => ({ ...p, max_players: Number(e.target.value) }))}
                  className="w-full rounded border px-2 py-1.5 text-sm mt-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500">최소 시간(분)</label>
                <input type="number" value={editForm.min_play_time ?? ''} onChange={e => setEditForm(p => ({ ...p, min_play_time: Number(e.target.value) }))}
                  className="w-full rounded border px-2 py-1.5 text-sm mt-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500">최대 시간(분)</label>
                <input type="number" value={editForm.max_play_time ?? ''} onChange={e => setEditForm(p => ({ ...p, max_play_time: Number(e.target.value) }))}
                  className="w-full rounded border px-2 py-1.5 text-sm mt-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500">난이도 (1-5)</label>
              <input type="number" min={1} max={5} value={editForm.difficulty ?? ''} onChange={e => setEditForm(p => ({ ...p, difficulty: Number(e.target.value) }))}
                className="w-full rounded border px-2 py-1.5 text-sm mt-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
            </div>

            <div>
              <label className="text-xs text-gray-500">장르</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {GENRES.map(g => {
                  const active = (editForm.genres ?? []).includes(g)
                  return (
                    <button key={g} type="button"
                      onClick={() => setEditForm(p => ({
                        ...p, genres: active ? (p.genres ?? []).filter(x => x !== g) : [...(p.genres ?? []), g]
                      }))}
                      className={`rounded-full px-2 py-0.5 text-xs ${active ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {g}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <button onClick={() => void save()} disabled={saving}
            className="w-full rounded bg-indigo-600 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-40">
            {saving ? '저장 중...' : '저장'}
          </button>

          {/* 룰북 재ingestion */}
          <div className="border-t pt-4 space-y-2">
            <p className="text-xs font-medium text-gray-600">룰북 재ingestion</p>
            <input value={reingestUrl} onChange={e => setReingestUrl(e.target.value)}
              placeholder="PDF URL 입력..." className="w-full rounded border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
            <button onClick={() => void handleReingest()} disabled={reingesting || !reingestUrl.trim()}
              className="w-full rounded border border-orange-300 py-2 text-sm text-orange-700 hover:bg-orange-50 disabled:opacity-40">
              {reingesting ? '⏳ Ingest 중...' : '🔄 룰북 재ingestion'}
            </button>
            {testGameId && <TestChat gameId={testGameId} />}
          </div>
        </div>
      )}
    </div>
  )
}
