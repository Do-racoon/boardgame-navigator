'use client'

import { useState } from 'react'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

export function CorrectionForm({ gameId, gameTitle }: { gameId: string; gameTitle: string }) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  async function submit() {
    if (!content.trim()) return
    setStatus('loading')
    try {
      const res = await fetch(`${BASE_URL}/submissions/correction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, content, submitterEmail: email || undefined }),
      })
      if (!res.ok) throw new Error()
      setStatus('done')
      setContent(''); setEmail('')
    } catch {
      setStatus('error')
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-dashed py-3 text-xs text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors">
        ✏️ &quot;{gameTitle}&quot; 정보 수정 요청
      </button>
    )
  }

  return (
    <div className="rounded-xl border bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">수정 요청</p>
        <button onClick={() => { setOpen(false); setStatus('idle') }} className="text-gray-400 text-lg leading-none">×</button>
      </div>

      {status === 'done' ? (
        <div className="py-4 text-center">
          <p className="text-sm text-green-600">✅ 수정 요청이 접수되었습니다</p>
          <p className="text-xs text-gray-400 mt-1">검토 후 반영됩니다</p>
          <button onClick={() => { setOpen(false); setStatus('idle') }}
            className="mt-3 text-xs text-indigo-600 underline">닫기</button>
        </div>
      ) : (
        <>
          <div>
            <label className="text-xs text-gray-500 block mb-1">수정할 내용 *</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={4}
              placeholder="예) 난이도가 3이 아니라 4입니다. / 최소 인원이 2명이 아니라 3명입니다..."
              className="w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">이메일 (선택)</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email"
              placeholder="답변 받을 이메일"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          {status === 'error' && <p className="text-xs text-red-500">오류가 발생했습니다. 다시 시도해주세요.</p>}
          <div className="flex gap-2">
            <button onClick={() => setOpen(false)}
              className="flex-1 rounded-lg border py-2 text-sm text-gray-500">취소</button>
            <button onClick={submit} disabled={!content.trim() || status === 'loading'}
              className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm text-white disabled:opacity-50">
              {status === 'loading' ? '전송 중...' : '요청 보내기'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
