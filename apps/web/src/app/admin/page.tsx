'use client'

import { useEffect, useState } from 'react'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'
const ADMIN_PW = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? 'admin1234'

type Status = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'REJECTED'

interface Submission {
  id: string
  title_ko: string
  title_en: string | null
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

const STATUS_LABEL: Record<Status, string> = {
  PENDING: '대기중',
  IN_PROGRESS: '작업중',
  DONE: '완료',
  REJECTED: '반려',
}
const STATUS_COLOR: Record<Status, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  DONE: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [selected, setSelected] = useState<Submission | null>(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<Status | 'ALL'>('ALL')

  async function load() {
    const res = await fetch(`${BASE_URL}/submissions`)
    setSubmissions(await res.json())
  }

  useEffect(() => { if (authed) load() }, [authed])

  async function updateStatus(id: string, status: Status) {
    setLoading(true)
    await fetch(`${BASE_URL}/submissions/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, adminNote: note }),
    })
    await load()
    setSelected(null)
    setNote('')
    setLoading(false)
  }

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto mt-20">
        <h1 className="text-xl font-bold mb-6 text-center">어드민 로그인</h1>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && pw === ADMIN_PW && setAuthed(true)}
          placeholder="비밀번호"
          className="w-full rounded border px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <button
          onClick={() => pw === ADMIN_PW ? setAuthed(true) : alert('비밀번호가 틀렸습니다')}
          className="w-full rounded bg-indigo-600 py-2 text-sm text-white"
        >
          로그인
        </button>
      </div>
    )
  }

  const filtered = filter === 'ALL' ? submissions : submissions.filter((s) => s.status === filter)
  const counts = submissions.reduce((acc, s) => { acc[s.status] = (acc[s.status] ?? 0) + 1; return acc }, {} as Record<string, number>)

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">룰북 등록 신청 관리</h1>
        <button onClick={load} className="text-xs text-gray-400 hover:text-gray-600">새로고침</button>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {(['ALL', 'PENDING', 'IN_PROGRESS', 'DONE'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-lg border p-3 text-left transition-colors ${filter === s ? 'border-indigo-500 bg-indigo-50' : 'bg-white hover:bg-gray-50'}`}
          >
            <p className="text-xs text-gray-500">{s === 'ALL' ? '전체' : STATUS_LABEL[s]}</p>
            <p className="text-2xl font-bold mt-1">{s === 'ALL' ? submissions.length : (counts[s] ?? 0)}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 목록 */}
        <div className="space-y-2">
          {filtered.length === 0 && <p className="text-sm text-gray-400 py-8 text-center">신청 없음</p>}
          {filtered.map((s) => (
            <div
              key={s.id}
              onClick={() => { setSelected(s); setNote(s.admin_note ?? '') }}
              className={`cursor-pointer rounded-lg border bg-white p-4 hover:shadow-sm transition-shadow ${selected?.id === s.id ? 'border-indigo-400' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{s.title_ko} {s.title_en && <span className="text-gray-400 text-sm">({s.title_en})</span>}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {s.min_players && `${s.min_players}~${s.max_players}인`}
                    {s.min_play_time && ` · ${s.min_play_time}~${s.max_play_time}분`}
                    {s.difficulty && ` · 난이도 ${s.difficulty}`}
                  </p>
                  {s.genres?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {s.genres.map((g) => <span key={g} className="text-xs bg-gray-100 rounded-full px-2 py-0.5">{g}</span>)}
                    </div>
                  )}
                </div>
                <span className={`shrink-0 text-xs rounded-full px-2 py-0.5 font-medium ${STATUS_COLOR[s.status]}`}>
                  {STATUS_LABEL[s.status]}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {s.rulebook_type} · {new Date(s.created_at).toLocaleDateString('ko-KR')}
                {s.submitter_email && ` · ${s.submitter_email}`}
              </p>
            </div>
          ))}
        </div>

        {/* 상세 */}
        {selected && (
          <div className="rounded-lg border bg-white p-5 space-y-4 h-fit sticky top-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{selected.title_ko}</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 text-lg leading-none">×</button>
            </div>

            {/* 룰북 내용 */}
            {selected.rulebook_text && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">룰북 텍스트</p>
                <pre className="text-xs bg-gray-50 rounded p-3 max-h-48 overflow-y-auto whitespace-pre-wrap">{selected.rulebook_text}</pre>
              </div>
            )}
            {selected.rulebook_url && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">룰북 파일</p>
                <a href={selected.rulebook_url} target="_blank" className="text-xs text-indigo-600 underline break-all">
                  {selected.rulebook_url}
                </a>
              </div>
            )}

            {/* 메모 */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">관리자 메모</p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="작업 메모..."
                className="w-full rounded border px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              />
            </div>

            {/* 상태 변경 */}
            <div className="grid grid-cols-2 gap-2">
              {(['IN_PROGRESS', 'DONE', 'REJECTED', 'PENDING'] as Status[]).map((s) => (
                <button
                  key={s}
                  onClick={() => updateStatus(selected.id, s)}
                  disabled={loading || selected.status === s}
                  className={`rounded py-2 text-xs font-medium transition-colors disabled:opacity-40 ${
                    s === 'DONE' ? 'bg-green-600 text-white hover:bg-green-700' :
                    s === 'IN_PROGRESS' ? 'bg-blue-600 text-white hover:bg-blue-700' :
                    s === 'REJECTED' ? 'bg-red-100 text-red-600 hover:bg-red-200' :
                    'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  → {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
