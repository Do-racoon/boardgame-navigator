'use client'

import { useState, useRef } from 'react'

const GENRES = ['카드', '심리전', '덱빌딩', '일꾼놓기', '땅따먹기', '기억력', '귀여운', '협력', '팀전', '전략', '추리', '경매']
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

type RulebookType = 'PDF' | 'IMAGE' | 'TEXT'

export default function SubmitPage() {
  const [step, setStep] = useState<'form' | 'done'>('form')
  const [rulebookType, setRulebookType] = useState<RulebookType>('PDF')
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [difficulty, setDifficulty] = useState(3)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 파일 refs
  const rulebookFileRef = useRef<HTMLInputElement>(null)
  const thumbnailFileRef = useRef<HTMLInputElement>(null)
  const setupImageFileRef = useRef<HTMLInputElement>(null)

  // 파일명 미리보기
  const [thumbnailName, setThumbnailName] = useState('')
  const [setupImageName, setSetupImageName] = useState('')
  const [rulebookFileName, setRulebookFileName] = useState('')

  function toggleGenre(g: string) {
    setSelectedGenres(p => p.includes(g) ? p.filter(x => x !== g) : [...p, g])
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const form = e.currentTarget
    const fd = new FormData()

    const titleKo = (form.elements.namedItem('titleKo') as HTMLInputElement).value.trim()
    if (!titleKo) { setError('게임 이름을 입력해주세요'); setLoading(false); return }

    fd.append('titleKo', titleKo)
    fd.append('titleEn', (form.elements.namedItem('titleEn') as HTMLInputElement).value)
    fd.append('minPlayers', (form.elements.namedItem('minPlayers') as HTMLInputElement).value)
    fd.append('maxPlayers', (form.elements.namedItem('maxPlayers') as HTMLInputElement).value)
    fd.append('minPlayTime', (form.elements.namedItem('minPlayTime') as HTMLInputElement).value)
    fd.append('maxPlayTime', (form.elements.namedItem('maxPlayTime') as HTMLInputElement).value)
    fd.append('difficulty', String(difficulty))
    fd.append('genres', JSON.stringify(selectedGenres))
    fd.append('rulebookType', rulebookType)
    fd.append('description', (form.elements.namedItem('description') as HTMLTextAreaElement).value)
    fd.append('submitterEmail', (form.elements.namedItem('submitterEmail') as HTMLInputElement).value)

    const youtubeUrl = (form.elements.namedItem('youtubeUrl') as HTMLInputElement).value.trim()
    if (youtubeUrl) fd.append('youtubeUrl', youtubeUrl)

    if (rulebookType === 'TEXT') {
      const text = (form.elements.namedItem('rulebookText') as HTMLTextAreaElement).value
      if (!text.trim()) { setError('룰북 내용을 입력해주세요'); setLoading(false); return }
      fd.append('rulebookText', text)
    } else {
      const file = rulebookFileRef.current?.files?.[0]
      if (!file) { setError('룰북 파일을 첨부해주세요'); setLoading(false); return }
      fd.append('file', file)
    }

    const thumbnail = thumbnailFileRef.current?.files?.[0]
    if (thumbnail) fd.append('thumbnail', thumbnail)

    const setupImage = setupImageFileRef.current?.files?.[0]
    if (setupImage) fd.append('setupImage', setupImage)

    try {
      const res = await fetch(`${BASE_URL}/submissions`, { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string }
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
      <div className="mb-6">
        <h1 className="text-xl font-bold">룰북 등록 신청</h1>
        <p className="mt-1 text-gray-500 text-sm">원하는 보드게임의 룰북을 보내주시면 AI 질의응답을 추가해드립니다.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 게임 기본 정보 */}
        <section className="rounded-xl border bg-white p-5 space-y-4">
          <h2 className="font-semibold">게임 정보</h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">한국어 이름 *</label>
              <input name="titleKo" placeholder="예: 티추"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">영어 이름</label>
              <input name="titleEn" placeholder="예: Tichu"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">인원</label>
              <div className="flex items-center gap-2">
                <input name="minPlayers" type="number" min="1" max="20" placeholder="최소"
                  className="w-16 rounded-lg border px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                <span className="text-gray-400 text-sm">~</span>
                <input name="maxPlayers" type="number" min="1" max="20" placeholder="최대"
                  className="w-16 rounded-lg border px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                <span className="text-xs text-gray-400">명</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">플레이 시간</label>
              <div className="flex items-center gap-2">
                <input name="minPlayTime" type="number" min="1" placeholder="최소"
                  className="w-16 rounded-lg border px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                <span className="text-gray-400 text-sm">~</span>
                <input name="maxPlayTime" type="number" min="1" placeholder="최대"
                  className="w-16 rounded-lg border px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                <span className="text-xs text-gray-400">분</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              난이도 <span className="text-indigo-600 font-semibold">{difficulty}/5</span>
            </label>
            <div className="flex gap-2">
              {[1,2,3,4,5].map(n => (
                <button key={n} type="button" onClick={() => setDifficulty(n)}
                  className={`w-9 h-9 rounded-full text-sm font-medium transition-colors ${difficulty >= n ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">장르</label>
            <div className="flex flex-wrap gap-1.5">
              {GENRES.map(g => (
                <button key={g} type="button" onClick={() => toggleGenre(g)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${selectedGenres.includes(g) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">게임 소개</label>
            <textarea name="description" rows={2}
              placeholder="게임의 간단한 소개나 특징..."
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
          </div>
        </section>

        {/* 썸네일 이미지 */}
        <section className="rounded-xl border bg-white p-5 space-y-3">
          <h2 className="font-semibold">게임 이미지 <span className="text-xs font-normal text-gray-400">(선택)</span></h2>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">썸네일 이미지</label>
            <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-dashed px-4 py-3 hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
              <span className="text-xl">🖼️</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-500">{thumbnailName || 'JPG, PNG, WebP'}</p>
                <p className="text-xs text-gray-400">게임 박스나 대표 이미지</p>
              </div>
              <input ref={thumbnailFileRef} type="file" accept="image/*" className="hidden"
                onChange={e => setThumbnailName(e.target.files?.[0]?.name ?? '')} />
            </label>
          </div>
        </section>

        {/* 룰북 */}
        <section className="rounded-xl border bg-white p-5 space-y-3">
          <h2 className="font-semibold">룰북 파일 *</h2>

          <div className="flex gap-2">
            {(['PDF', 'IMAGE', 'TEXT'] as RulebookType[]).map(t => (
              <button key={t} type="button" onClick={() => { setRulebookType(t); setRulebookFileName('') }}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${rulebookType === t ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                {t === 'PDF' ? '📄 PDF' : t === 'IMAGE' ? '🖼️ 이미지' : '✏️ 직접 입력'}
              </button>
            ))}
          </div>

          {rulebookType === 'TEXT' ? (
            <textarea name="rulebookText" rows={8}
              placeholder="룰북 내용을 직접 붙여넣어 주세요..."
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
          ) : (
            <label className="flex items-center gap-3 cursor-pointer rounded-lg border-2 border-dashed px-4 py-4 hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
              <span className="text-2xl">{rulebookType === 'PDF' ? '📄' : '🖼️'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-600">{rulebookFileName || (rulebookType === 'PDF' ? 'PDF 파일 선택' : '이미지 파일 선택')}</p>
                <p className="text-xs text-gray-400">최대 50MB</p>
              </div>
              <input ref={rulebookFileRef} type="file"
                accept={rulebookType === 'PDF' ? '.pdf' : 'image/*'}
                className="hidden"
                onChange={e => setRulebookFileName(e.target.files?.[0]?.name ?? '')} />
            </label>
          )}
        </section>

        {/* 세팅 참고 자료 */}
        <section className="rounded-xl border bg-white p-5 space-y-3">
          <h2 className="font-semibold">게임 세팅 참고 자료 <span className="text-xs font-normal text-gray-400">(선택)</span></h2>
          <p className="text-xs text-gray-400">게임 세팅 방법이 담긴 유튜브 영상 또는 이미지를 첨부해주세요</p>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">유튜브 링크</label>
            <input name="youtubeUrl" type="url" placeholder="https://youtube.com/watch?v=..."
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">세팅 참고 이미지</label>
            <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-dashed px-4 py-3 hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
              <span className="text-xl">📸</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-500">{setupImageName || '세팅 완료된 게임판 사진 등'}</p>
                <p className="text-xs text-gray-400">JPG, PNG, WebP</p>
              </div>
              <input ref={setupImageFileRef} type="file" accept="image/*" className="hidden"
                onChange={e => setSetupImageName(e.target.files?.[0]?.name ?? '')} />
            </label>
          </div>
        </section>

        {/* 이메일 */}
        <section className="rounded-xl border bg-white p-5">
          <label className="block text-xs font-medium text-gray-600 mb-1">이메일 <span className="text-gray-400">(완료 시 알림, 선택)</span></label>
          <input name="submitterEmail" type="email" placeholder="example@email.com"
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </section>

        {error && <p className="text-sm text-red-500 px-1">{error}</p>}

        <button type="submit" disabled={loading}
          className="w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          {loading ? '제출 중...' : '룰북 등록 신청하기'}
        </button>
      </form>
    </div>
  )
}
