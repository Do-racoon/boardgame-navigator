'use client'

import { useState, useRef } from 'react'

const GENRES = ['카드', '심리전', '덱빌딩', '일꾼놓기', '땅따먹기', '기억력', '귀여운', '협력', '팀전', '전략', '추리', '경매']
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

type RulebookType = 'PDF' | 'IMAGE' | 'TEXT'
type Step = 'form' | 'done'

export default function SubmitPage() {
  const [step, setStep] = useState<Step>('form')
  const [rulebookType, setRulebookType] = useState<RulebookType>('PDF')
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [difficulty, setDifficulty] = useState(3)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function toggleGenre(g: string) {
    setSelectedGenres((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g])
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const form = e.currentTarget
    const data = new FormData()

    const titleKo = (form.elements.namedItem('titleKo') as HTMLInputElement).value.trim()
    if (!titleKo) { setError('게임 이름을 입력해주세요'); setLoading(false); return }

    data.append('titleKo', titleKo)
    data.append('titleEn', (form.elements.namedItem('titleEn') as HTMLInputElement).value)
    data.append('minPlayers', (form.elements.namedItem('minPlayers') as HTMLInputElement).value)
    data.append('maxPlayers', (form.elements.namedItem('maxPlayers') as HTMLInputElement).value)
    data.append('minPlayTime', (form.elements.namedItem('minPlayTime') as HTMLInputElement).value)
    data.append('maxPlayTime', (form.elements.namedItem('maxPlayTime') as HTMLInputElement).value)
    data.append('difficulty', String(difficulty))
    data.append('genres', JSON.stringify(selectedGenres))
    data.append('rulebookType', rulebookType)
    data.append('submitterEmail', (form.elements.namedItem('submitterEmail') as HTMLInputElement).value)

    if (rulebookType === 'TEXT') {
      const text = (form.elements.namedItem('rulebookText') as HTMLTextAreaElement).value
      if (!text.trim()) { setError('룰북 내용을 입력해주세요'); setLoading(false); return }
      data.append('rulebookText', text)
    } else {
      const file = fileRef.current?.files?.[0]
      if (!file) { setError('파일을 첨부해주세요'); setLoading(false); return }
      data.append('file', file)
    }

    try {
      const res = await fetch(`${BASE_URL}/submissions`, { method: 'POST', body: data })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message ?? '제출 실패')
      }
      setStep('done')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (step === 'done') {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="text-5xl mb-6">🎲</div>
        <h1 className="text-2xl font-bold mb-3">신청이 접수됐습니다!</h1>
        <p className="text-gray-500 mb-8">검토 후 룰북 AI를 추가해드릴게요. 보통 2~3일 내로 완료됩니다.</p>
        <a href="/" className="rounded-lg bg-indigo-600 px-6 py-3 text-white text-sm font-medium hover:bg-indigo-700">
          홈으로 돌아가기
        </a>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">룰북 등록 신청</h1>
        <p className="mt-2 text-gray-500 text-sm">
          원하는 보드게임의 룰북을 보내주시면 AI 질의응답을 추가해드립니다.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 게임 기본 정보 */}
        <section className="rounded-lg border bg-white p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">게임 정보</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">한국어 이름 *</label>
              <input name="titleKo" placeholder="예: 티추" className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">영어 이름</label>
              <input name="titleEn" placeholder="예: Tichu" className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>

          {/* 인원 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">인원</label>
            <div className="flex items-center gap-2">
              <input name="minPlayers" type="number" min="1" max="20" placeholder="최소" className="w-20 rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <span className="text-gray-400">~</span>
              <input name="maxPlayers" type="number" min="1" max="20" placeholder="최대" className="w-20 rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <span className="text-xs text-gray-400">명</span>
            </div>
          </div>

          {/* 시간 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">플레이 시간</label>
            <div className="flex items-center gap-2">
              <input name="minPlayTime" type="number" min="1" placeholder="최소" className="w-20 rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <span className="text-gray-400">~</span>
              <input name="maxPlayTime" type="number" min="1" placeholder="최대" className="w-20 rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <span className="text-xs text-gray-400">분</span>
            </div>
          </div>

          {/* 난이도 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              난이도 <span className="text-indigo-600 font-semibold">{difficulty} / 5</span>
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDifficulty(n)}
                  className={`w-9 h-9 rounded-full text-sm font-medium transition-colors ${
                    difficulty >= n ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-400">1 = 매우 쉬움 · 5 = 매우 어려움</p>
          </div>

          {/* 장르 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">장르 (복수 선택 가능)</label>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGenre(g)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    selectedGenres.includes(g)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 룰북 */}
        <section className="rounded-lg border bg-white p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">룰북</h2>

          <div className="flex gap-2">
            {(['PDF', 'IMAGE', 'TEXT'] as RulebookType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setRulebookType(t)}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                  rulebookType === t ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {t === 'PDF' ? '📄 PDF' : t === 'IMAGE' ? '🖼️ 이미지' : '✏️ 직접 입력'}
              </button>
            ))}
          </div>

          {rulebookType === 'TEXT' ? (
            <textarea
              name="rulebookText"
              rows={8}
              placeholder="룰북 내용을 직접 붙여넣어 주세요..."
              className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            />
          ) : (
            <div
              onClick={() => fileRef.current?.click()}
              className="cursor-pointer rounded-lg border-2 border-dashed border-gray-200 p-8 text-center hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
            >
              <p className="text-sm text-gray-500">
                {rulebookType === 'PDF' ? 'PDF 파일을 선택하세요' : 'JPG, PNG, WebP 이미지를 선택하세요'}
              </p>
              <p className="mt-1 text-xs text-gray-400">최대 50MB</p>
              <input
                ref={fileRef}
                type="file"
                accept={rulebookType === 'PDF' ? '.pdf' : 'image/*'}
                className="hidden"
                onChange={(e) => {
                  const name = e.target.files?.[0]?.name
                  if (name) e.target.parentElement!.querySelector('p')!.textContent = name
                }}
              />
            </div>
          )}
        </section>

        {/* 이메일 */}
        <section className="rounded-lg border bg-white p-5">
          <label className="block text-xs font-medium text-gray-600 mb-1">이메일 (완료 시 알림, 선택)</label>
          <input
            name="submitterEmail"
            type="email"
            placeholder="example@email.com"
            className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </section>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? '제출 중...' : '룰북 등록 신청하기'}
        </button>
      </form>
    </div>
  )
}
