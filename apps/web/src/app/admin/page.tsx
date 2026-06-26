'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'
const ADMIN_PW = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? 'admin1234'

type Status = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'REJECTED'
type Tab = 'submissions' | 'rejected' | 'games' | 'trash'

interface Submission {
  id: string; title_ko: string; title_en: string | null; description: string | null
  min_players: number | null; max_players: number | null
  min_play_time: number | null; max_play_time: number | null
  difficulty: number | null; genres: string[]; rulebook_type: string
  rulebook_url: string | null; rulebook_text: string | null
  submitter_email: string | null; status: Status; admin_note: string | null; created_at: string
}

interface Game {
  id: string; title_ko: string; title_en: string | null; description: string | null
  extra_rules: string | null; min_players: number | null; max_players: number | null
  min_play_time: number | null; max_play_time: number | null
  difficulty: number | null; genres: string[]; thumbnail_url: string | null
  deleted_at: string | null
  rulebooks: { id: string; status: string; version: number }[]
}

interface ChatMessage { role: 'user' | 'assistant'; content: string }

const STATUS_LABEL: Record<Status, string> = { PENDING: '대기중', IN_PROGRESS: '작업중', DONE: '완료', REJECTED: '반려' }
const STATUS_COLOR: Record<Status, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700', IN_PROGRESS: 'bg-blue-100 text-blue-700',
  DONE: 'bg-green-100 text-green-700', REJECTED: 'bg-red-100 text-red-700',
}
const GENRES = ['카드', '심리전', '덱빌딩', '일꾼놓기', '땅따먹기', '기억력', '귀여운', '협력', '팀전', '전략', '추리', '경매']

// ─── 로그인 ───────────────────────────────────────────────────────────────────
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
          {([['submissions', '신청 관리'], ['rejected', '반려 관리'], ['games', '게임 관리'], ['trash', '🗑 휴지통']] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${tab === t ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'submissions' && <SubmissionsTab />}
      {tab === 'rejected' && <RejectedTab />}
      {tab === 'games' && <GamesTab />}
      {tab === 'trash' && <TrashTab />}
    </div>
  )
}

// ─── 신청 관리 탭 ─────────────────────────────────────────────────────────────
function SubmissionsTab() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [selected, setSelected] = useState<Submission | null>(null)
  const [note, setNote] = useState('')
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'IN_PROGRESS'>('PENDING')
  const [loading, setLoading] = useState(false)
  const [testGameId, setTestGameId] = useState<string | null>(null)
  const [manualGameId, setManualGameId] = useState('')
  const [ingesting, setIngesting] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishMsg, setPublishMsg] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`${BASE_URL}/admin/submissions`)
    setSubmissions(await res.json())
  }, [])
  useEffect(() => { void load() }, [load])

  async function updateStatus(id: string, status: Status) {
    setLoading(true)
    await fetch(`${BASE_URL}/admin/submissions/${id}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, adminNote: note }),
    })
    await load(); setSelected(null); setNote(''); setLoading(false)
  }

  async function handleIngestTest(id: string) {
    setIngesting(true); setTestGameId(null)
    try {
      const res = await fetch(`${BASE_URL}/admin/submissions/${id}/ingest-test`, { method: 'POST' })
      if (!res.ok) { const e = await res.json() as {message:string}; throw new Error(e.message) }
      const data = await res.json() as { gameId: string; chunks: number }
      setTestGameId(data.gameId)
      alert(`테스트 Ingest 완료! ${data.chunks}개 청크`)
    } catch (e) { alert(`Ingest 실패: ${(e as Error).message}`) }
    finally { setIngesting(false) }
  }

  async function handlePublish(id: string) {
    if (!confirm('게임 테이블에 등록하고 완료 처리합니다. 계속하시겠습니까?')) return
    setPublishing(true); setPublishMsg('')
    try {
      const res = await fetch(`${BASE_URL}/admin/submissions/${id}/publish`, { method: 'POST' })
      if (!res.ok) { const e = await res.json() as {message:string}; throw new Error(e.message) }
      const data = await res.json() as { gameId: string; chunks: number }
      setPublishMsg(`✅ 등록 완료! 게임 ID: ${data.gameId} (${data.chunks}개 청크)`)
      await load(); setSelected(null); setTestGameId(null)
    } catch (e) { setPublishMsg(`❌ 실패: ${(e as Error).message}`) }
    finally { setPublishing(false) }
  }

  const activeGameId = testGameId ?? (manualGameId.trim() || null)
  const allFiltered = submissions.filter(s => s.status !== 'REJECTED')
  const filtered = filter === 'ALL' ? allFiltered : allFiltered.filter(s => s.status === filter)
  const counts = submissions.reduce((acc, s) => { acc[s.status] = (acc[s.status] ?? 0) + 1; return acc }, {} as Record<string, number>)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_440px]">
      <div>
        {publishMsg && <div className="mb-3 rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">{publishMsg}</div>}
        <div className="flex gap-2 mb-4">
          {(['ALL', 'PENDING', 'IN_PROGRESS'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`rounded-lg border px-3 py-2 text-xs transition-colors ${filter === s ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
              {s === 'ALL' ? `전체 ${allFiltered.length}` : `${STATUS_LABEL[s]} ${counts[s] ?? 0}`}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {filtered.map(s => (
            <div key={s.id} onClick={() => { setSelected(s); setNote(s.admin_note ?? ''); setTestGameId(null); setManualGameId('') }}
              className={`cursor-pointer rounded-lg border bg-white p-4 hover:shadow-sm transition-shadow ${selected?.id === s.id ? 'border-indigo-400' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{s.title_ko}{s.title_en && <span className="text-gray-400 text-sm ml-1">({s.title_en})</span>}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {s.min_players && `${s.min_players}~${s.max_players}인`}
                    {s.min_play_time && ` · ${s.min_play_time}~${s.max_play_time}분`}
                    {s.difficulty && ` · 난이도 ${s.difficulty}`}
                  </p>
                  {s.genres?.length > 0 && <div className="flex flex-wrap gap-1 mt-1">{s.genres.map(g => <span key={g} className="text-xs bg-gray-100 rounded-full px-2 py-0.5">{g}</span>)}</div>}
                </div>
                <span className={`shrink-0 text-xs rounded-full px-2 py-0.5 font-medium ${STATUS_COLOR[s.status]}`}>{STATUS_LABEL[s.status]}</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">{s.rulebook_type} · {new Date(s.created_at).toLocaleDateString('ko-KR')}{s.submitter_email && ` · ${s.submitter_email}`}</p>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-sm text-gray-400 py-8 text-center">신청 없음</p>}
        </div>
      </div>

      {selected && (
        <div className="space-y-3 sticky top-4 max-h-[92vh] overflow-y-auto">
          <div className="rounded-lg border bg-white p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{selected.title_ko}</h2>
              <button onClick={() => { setSelected(null); setTestGameId(null) }} className="text-gray-400 text-lg">×</button>
            </div>
            {selected.description && <p className="text-sm text-gray-600 bg-gray-50 rounded p-2">{selected.description}</p>}
            {selected.rulebook_url && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">룰북 파일</p>
                <a href={selected.rulebook_url} target="_blank" className="text-xs text-indigo-600 underline break-all">{selected.rulebook_url}</a>
              </div>
            )}
            {selected.rulebook_text && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">룰북 텍스트</p>
                <pre className="text-xs bg-gray-50 rounded p-2 max-h-28 overflow-y-auto whitespace-pre-wrap">{selected.rulebook_text}</pre>
              </div>
            )}

            {/* 메모 + 상태 변경 */}
            <div className="border-t pt-3 space-y-2">
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                placeholder="관리자 메모..." className="w-full rounded border px-2 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-indigo-300" />
              <div className="grid grid-cols-3 gap-1.5">
                {(['IN_PROGRESS', 'PENDING', 'REJECTED'] as Status[]).map(s => (
                  <button key={s} onClick={() => updateStatus(selected.id, s)} disabled={loading || selected.status === s}
                    className={`rounded py-1.5 text-xs font-medium disabled:opacity-40 transition-colors ${s === 'REJECTED' ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* 테스트 ingest */}
            {selected.rulebook_url && selected.status !== 'DONE' && (
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-medium text-gray-600">테스트 채팅</p>
                <button onClick={() => handleIngestTest(selected.id)} disabled={ingesting}
                  className="w-full rounded border border-indigo-300 py-1.5 text-xs text-indigo-700 hover:bg-indigo-50 disabled:opacity-40">
                  {ingesting ? '⏳ Ingest 중...' : '🧪 테스트 Ingest 실행'}
                </button>
              </div>
            )}

            {/* 게임으로 등록 */}
            {selected.status !== 'DONE' && (
              <button onClick={() => handlePublish(selected.id)} disabled={publishing}
                className="w-full rounded bg-green-600 py-2 text-sm text-white font-medium hover:bg-green-700 disabled:opacity-40">
                {publishing ? '⏳ 등록 중 (ingest 포함, 시간 소요)...' : '✅ 게임으로 등록 (완료)'}
              </button>
            )}
          </div>

          {/* 수동 또는 테스트 채팅 */}
          <div className="rounded-lg border bg-white p-4 space-y-2">
            <p className="text-xs font-medium text-gray-600">채팅 테스트</p>
            {!activeGameId ? (
              <div className="flex gap-2">
                <input value={manualGameId} onChange={e => setManualGameId(e.target.value)}
                  placeholder="Game ID 직접 입력..."
                  className="flex-1 rounded border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">게임 ID: <span className="font-mono text-indigo-600">{activeGameId}</span></p>
                <button onClick={() => { setTestGameId(null); setManualGameId('') }} className="text-xs text-gray-400 hover:text-gray-600">초기화</button>
              </div>
            )}
            {activeGameId && <TestChat gameId={activeGameId} />}
            {!activeGameId && manualGameId.trim() && (
              <button onClick={() => setTestGameId(manualGameId.trim())}
                className="w-full rounded bg-indigo-100 text-indigo-700 py-1.5 text-xs hover:bg-indigo-200">채팅 시작</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 반려 관리 탭 ─────────────────────────────────────────────────────────────
function RejectedTab() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`${BASE_URL}/admin/submissions`)
    const all = await res.json() as Submission[]
    setSubmissions(all.filter(s => s.status === 'REJECTED'))
  }, [])
  useEffect(() => { void load() }, [load])

  async function restore(id: string) {
    await fetch(`${BASE_URL}/admin/submissions/${id}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PENDING' }),
    })
    await load()
  }

  async function del(id: string) {
    if (!confirm('완전히 삭제합니다. 되돌릴 수 없습니다.')) return
    setDeleting(id)
    await fetch(`${BASE_URL}/admin/submissions/${id}`, { method: 'DELETE' })
    await load(); setDeleting(null)
  }

  return (
    <div className="space-y-2 max-w-2xl">
      <p className="text-sm text-gray-500 mb-4">반려된 신청 {submissions.length}건</p>
      {submissions.length === 0 && <p className="text-sm text-gray-400 py-8 text-center">반려된 신청이 없습니다</p>}
      {submissions.map(s => (
        <div key={s.id} className="rounded-lg border bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium">{s.title_ko}{s.title_en && <span className="text-gray-400 text-sm ml-1">({s.title_en})</span>}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.rulebook_type} · {new Date(s.created_at).toLocaleDateString('ko-KR')}</p>
              {s.admin_note && <p className="text-xs text-gray-500 mt-1 bg-gray-50 rounded px-2 py-1">메모: {s.admin_note}</p>}
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => restore(s.id)} className="rounded border px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">↩ 복원</button>
              <button onClick={() => del(s.id)} disabled={deleting === s.id}
                className="rounded bg-red-100 px-3 py-1.5 text-xs text-red-600 hover:bg-red-200 disabled:opacity-40">
                {deleting === s.id ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── 테스트 채팅 컴포넌트 ────────────────────────────────────────────────────
function TestChat({ gameId }: { gameId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function send() {
    if (!input.trim() || loading) return
    const question = input.trim(); setInput(''); setLoading(true)
    setMessages(prev => [...prev, { role: 'user', content: question }])
    try {
      const res = await fetch(`${BASE_URL}/games/${gameId}/ask`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      const reader = res.body!.getReader(); const decoder = new TextDecoder()
      let answer = ''
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        for (const line of decoder.decode(value).split('\n')) {
          if (!line.startsWith('data:')) continue
          try {
            const ev = JSON.parse(line.slice(5).trim()) as { type: string; data?: string }
            if (ev.type === 'chunk' && ev.data) {
              answer += ev.data
              setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: answer }])
            }
          } catch { /* skip */ }
        }
      }
    } finally {
      setLoading(false)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }

  return (
    <div className="space-y-2">
      <div className="max-h-52 overflow-y-auto space-y-2 text-xs border rounded p-2 bg-gray-50">
        {messages.length === 0 && <p className="text-gray-400 text-center py-6">질문을 입력해보세요</p>}
        {messages.map((m, i) => (
          <div key={i} className={`rounded p-2 ${m.role === 'user' ? 'bg-indigo-100 ml-6' : 'bg-white border mr-6'}`}>
            <p className="font-medium text-gray-400 mb-0.5 text-[10px]">{m.role === 'user' ? '질문' : 'AI'}</p>
            <p className="whitespace-pre-wrap">{m.content}{loading && i === messages.length - 1 && m.role === 'assistant' && <span className="animate-pulse">▌</span>}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && void send()}
          placeholder="룰 관련 질문..." className="flex-1 rounded border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
        <button onClick={() => void send()} disabled={loading}
          className="rounded bg-indigo-600 px-3 text-xs text-white disabled:opacity-40">{loading ? '...' : '전송'}</button>
      </div>
    </div>
  )
}

// ─── 게임 관리 탭 ─────────────────────────────────────────────────────────────
type EditForm = {
  title_ko: string; title_en: string; description: string; extra_rules: string
  min_players: number | ''; max_players: number | ''; min_play_time: number | ''
  max_play_time: number | ''; difficulty: number | ''; genres: string[]
}

const EMPTY_FORM: EditForm = {
  title_ko: '', title_en: '', description: '', extra_rules: '',
  min_players: '', max_players: '', min_play_time: '', max_play_time: '', difficulty: '', genres: [],
}

function GamesTab() {
  const [games, setGames] = useState<Game[]>([])
  const [selected, setSelected] = useState<Game | null>(null)
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [reingestUrl, setReingestUrl] = useState('')
  const [reingesting, setReingesting] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [msg, setMsg] = useState('')
  const [rulesMode, setRulesMode] = useState<'replace' | 'append'>('replace')
  const [rulesFile, setRulesFile] = useState<File | null>(null)
  const [uploadingRules, setUploadingRules] = useState(false)
  const [generatingSetup, setGeneratingSetup] = useState(false)
  const [setupPreview, setSetupPreview] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`${BASE_URL}/admin/games?deleted=false`)
    setGames(await res.json())
  }, [])
  useEffect(() => { void load() }, [load])

  function selectGame(game: Game) {
    setSelected(game); setShowChat(false); setMsg('')
    setReingestUrl(''); setRulesFile(null); setSetupPreview(null)
    setEditForm({
      title_ko: game.title_ko ?? '', title_en: game.title_en ?? '',
      description: game.description ?? '', extra_rules: game.extra_rules ?? '',
      min_players: game.min_players ?? '', max_players: game.max_players ?? '',
      min_play_time: game.min_play_time ?? '', max_play_time: game.max_play_time ?? '',
      difficulty: game.difficulty ?? '', genres: game.genres ?? [],
    })
  }

  function set<K extends keyof EditForm>(k: K, v: EditForm[K]) {
    setEditForm(p => ({ ...p, [k]: v }))
  }

  async function save() {
    if (!selected) return; setSaving(true); setMsg('')
    try {
      const res = await fetch(`${BASE_URL}/admin/games/${selected.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (!res.ok) throw new Error('저장 실패')
      await load(); setMsg('✅ 저장 완료')
    } catch (e) { setMsg(`❌ ${(e as Error).message}`) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!selected || !confirm(`"${selected.title_ko}" 게임을 휴지통으로 이동합니다.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`${BASE_URL}/admin/games/${selected.id}/trash`, { method: 'PATCH' })
      if (!res.ok) throw new Error('삭제 실패')
      await load(); setSelected(null)
    } catch (e) { setMsg(`❌ ${(e as Error).message}`) }
    finally { setDeleting(false) }
  }

  async function handleReingest() {
    if (!selected || !reingestUrl.trim()) return
    setReingesting(true); setMsg('')
    try {
      const res = await fetch(`${BASE_URL}/admin/games/${selected.id}/reingest`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl: reingestUrl }),
      })
      if (!res.ok) { const e = await res.json() as {message:string}; throw new Error(e.message) }
      const data = await res.json() as { chunks: number }
      setMsg(`✅ Reingest 완료! ${data.chunks}개 청크`)
      setShowChat(true)
    } catch (e) { setMsg(`❌ ${(e as Error).message}`) }
    finally { setReingesting(false) }
  }

  async function handleUploadRules() {
    if (!selected || !rulesFile) return
    setUploadingRules(true); setMsg('')
    try {
      const fd = new FormData()
      fd.append('file', rulesFile)
      fd.append('mode', rulesMode)
      const res = await fetch(`${BASE_URL}/admin/games/${selected.id}/upload-rules`, { method: 'POST', body: fd })
      if (!res.ok) { const e = await res.json() as { message: string }; throw new Error(e.message) }
      const data = await res.json() as { extraRules: string }
      set('extra_rules', data.extraRules)
      setRulesFile(null)
      setMsg(`✅ 추가 룰 업로드 완료`)
    } catch (e) { setMsg(`❌ ${(e as Error).message}`) }
    finally { setUploadingRules(false) }
  }

  async function handleGenerateSetup() {
    if (!selected) return
    setGeneratingSetup(true); setMsg('')
    try {
      const res = await fetch(`${BASE_URL}/admin/games/${selected.id}/generate-setup`, { method: 'POST' })
      if (!res.ok) { const e = await res.json() as { message: string }; throw new Error(e.message) }
      const data = await res.json() as { setupGuide: string }
      setSetupPreview(data.setupGuide)
      setMsg('✅ 세팅 가이드 생성 완료')
    } catch (e) { setMsg(`❌ ${(e as Error).message}`) }
    finally { setGeneratingSetup(false) }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_460px]">
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
        {games.length === 0 && <p className="text-sm text-gray-400 py-8 text-center">등록된 게임 없음</p>}
      </div>

      {selected && (
        <div className="space-y-3 sticky top-4 max-h-[92vh] overflow-y-auto">
          {msg && <div className={`rounded-lg px-4 py-2 text-sm ${msg.startsWith('✅') ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>{msg}</div>}

          <div className="rounded-lg border bg-white p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">게임 편집</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 text-lg">×</button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500">한국어 이름</label>
                <input value={editForm.title_ko} onChange={e => set('title_ko', e.target.value)}
                  className="w-full rounded border px-2 py-1.5 text-sm mt-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500">영어 이름</label>
                <input value={editForm.title_en} onChange={e => set('title_en', e.target.value)}
                  className="w-full rounded border px-2 py-1.5 text-sm mt-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500">게임 소개</label>
              <textarea value={editForm.description} onChange={e => set('description', e.target.value)}
                rows={2} className="w-full rounded border px-2 py-1.5 text-sm mt-0.5 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-300" />
            </div>

            <div>
              <label className="text-xs text-gray-500">추가 룰 / 주의사항 <span className="text-gray-400">(AI 답변에 자동 반영)</span></label>
              <textarea value={editForm.extra_rules} onChange={e => set('extra_rules', e.target.value)}
                rows={4} placeholder="예) 이 게임은 한국판 기준입니다. 폭탄은 상대팀 폭탄보다 작은 경우 막을 수 없습니다..."
                className="w-full rounded border px-2 py-1.5 text-sm mt-0.5 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-300" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {([['min_players', '최소 인원'], ['max_players', '최대 인원'], ['min_play_time', '최소 시간(분)'], ['max_play_time', '최대 시간(분)'], ['difficulty', '난이도 (1-5)']] as [keyof EditForm, string][]).map(([k, label]) => (
                <div key={k}>
                  <label className="text-xs text-gray-500">{label}</label>
                  <input type="number" value={editForm[k] as number | ''} onChange={e => set(k, e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full rounded border px-2 py-1.5 text-sm mt-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                </div>
              ))}
            </div>

            <div>
              <label className="text-xs text-gray-500">장르</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {GENRES.map(g => {
                  const active = editForm.genres.includes(g)
                  return (
                    <button key={g} type="button"
                      onClick={() => set('genres', active ? editForm.genres.filter(x => x !== g) : [...editForm.genres, g])}
                      className={`rounded-full px-2 py-0.5 text-xs transition-colors ${active ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {g}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => void save()} disabled={saving}
                className="flex-1 rounded bg-indigo-600 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-40">
                {saving ? '저장 중...' : '저장'}
              </button>
              <button onClick={() => void handleDelete()} disabled={deleting}
                className="rounded border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40">
                {deleting ? '이동 중...' : '🗑 휴지통'}
              </button>
            </div>
          </div>

          {/* 룰북 재ingestion */}
          <div className="rounded-lg border bg-white p-4 space-y-2">
            <p className="text-xs font-medium text-gray-600">룰북 재ingestion</p>
            <input value={reingestUrl} onChange={e => setReingestUrl(e.target.value)}
              placeholder="PDF URL 입력..." className="w-full rounded border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
            <button onClick={() => void handleReingest()} disabled={reingesting || !reingestUrl.trim()}
              className="w-full rounded border border-orange-300 py-1.5 text-sm text-orange-700 hover:bg-orange-50 disabled:opacity-40">
              {reingesting ? '⏳ Ingest 중...' : '🔄 룰북 재ingestion'}
            </button>
            <button onClick={() => void handleGenerateSetup()} disabled={generatingSetup}
              className="w-full rounded border border-green-300 py-1.5 text-sm text-green-700 hover:bg-green-50 disabled:opacity-40">
              {generatingSetup ? '⏳ 생성 중 (30초 소요)...' : '🎲 세팅 가이드 생성'}
            </button>
            {setupPreview && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-2">
                <p className="text-xs font-medium text-green-700">미리보기</p>
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {setupPreview.split('\n').filter(l => l.trim()).map((line, i) => (
                    <p key={i} className="text-xs text-gray-700 leading-relaxed">{line}</p>
                  ))}
                </div>
                <button onClick={() => setSetupPreview(null)} className="text-xs text-gray-400 hover:text-gray-600">닫기</button>
              </div>
            )}
            <button onClick={() => setShowChat(p => !p)}
              className="w-full rounded border py-1.5 text-xs text-gray-600 hover:bg-gray-50">
              {showChat ? '채팅 숨기기' : '💬 채팅 테스트 열기'}
            </button>
            {showChat && <TestChat gameId={selected.id} />}
          </div>

          {/* 추가 룰 PDF 업로드 */}
          <div className="rounded-lg border bg-white p-4 space-y-2">
            <p className="text-xs font-medium text-gray-600">추가 룰 / 주의사항 PDF 업로드</p>
            <p className="text-xs text-gray-400">PDF를 업로드하면 텍스트를 추출해 추가 룰 필드에 반영합니다.</p>
            <div className="flex gap-2">
              {(['replace', 'append'] as const).map(m => (
                <button key={m} type="button" onClick={() => setRulesMode(m)}
                  className={`flex-1 rounded border py-1 text-xs transition-colors ${rulesMode === m ? 'bg-indigo-600 text-white border-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}>
                  {m === 'replace' ? '덮어쓰기' : '이어붙이기'}
                </button>
              ))}
            </div>
            <label className="block">
              <span className="sr-only">PDF 파일 선택</span>
              <input type="file" accept=".pdf" onChange={e => setRulesFile(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-gray-500 file:mr-2 file:rounded file:border-0 file:bg-indigo-50 file:px-2 file:py-1 file:text-xs file:text-indigo-700 hover:file:bg-indigo-100" />
            </label>
            {rulesFile && <p className="text-xs text-gray-500">선택된 파일: {rulesFile.name}</p>}
            <button onClick={() => void handleUploadRules()} disabled={uploadingRules || !rulesFile}
              className="w-full rounded border border-purple-300 py-1.5 text-sm text-purple-700 hover:bg-purple-50 disabled:opacity-40">
              {uploadingRules ? '⏳ 업로드 중...' : '📄 추가 룰 업로드'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 휴지통 탭 ────────────────────────────────────────────────────────────────
function TrashTab() {
  const [games, setGames] = useState<Game[]>([])
  const [deleting, setDeleting] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`${BASE_URL}/admin/games?deleted=true`)
    setGames(await res.json())
  }, [])
  useEffect(() => { void load() }, [load])

  async function restore(id: string) {
    setRestoring(id)
    try {
      await fetch(`${BASE_URL}/admin/games/${id}/trash`, { method: 'DELETE' })
      await load()
    } finally { setRestoring(null) }
  }

  async function hardDelete(id: string, title: string) {
    if (!confirm(`"${title}" 게임과 모든 룰북 데이터를 영구 삭제합니다. 되돌릴 수 없습니다.`)) return
    setDeleting(id)
    try {
      await fetch(`${BASE_URL}/admin/games/${id}`, { method: 'DELETE' })
      await load()
    } finally { setDeleting(null) }
  }

  return (
    <div className="space-y-2 max-w-2xl">
      <p className="text-sm text-gray-500 mb-4">휴지통 {games.length}건 — 여기서 삭제하면 DB에서 완전히 제거됩니다</p>
      {games.length === 0 && <p className="text-sm text-gray-400 py-8 text-center">휴지통이 비어 있습니다</p>}
      {games.map(g => (
        <div key={g.id} className="rounded-lg border bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-500">{g.title_ko}{g.title_en && <span className="text-gray-400 text-sm ml-1">({g.title_en})</span>}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {g.min_players && `${g.min_players}~${g.max_players}인`}
                {g.min_play_time && ` · ${g.min_play_time}~${g.max_play_time}분`}
                {g.deleted_at && ` · 삭제: ${new Date(g.deleted_at).toLocaleDateString('ko-KR')}`}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => restore(g.id)} disabled={restoring === g.id}
                className="rounded border px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                {restoring === g.id ? '복원 중...' : '↩ 복원'}
              </button>
              <button onClick={() => hardDelete(g.id, g.title_ko)} disabled={deleting === g.id}
                className="rounded bg-red-100 px-3 py-1.5 text-xs text-red-600 hover:bg-red-200 disabled:opacity-40">
                {deleting === g.id ? '삭제 중...' : '영구 삭제'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
