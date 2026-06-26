'use client'

import { useState } from 'react'
import { searchRulebook } from '@/lib/api'

interface SearchResult { id: string; pageNumber: number | null; content: string; score: number }

export function RulebookSearch({ gameId }: { gameId: string }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])

  async function handleSearch() {
    const query = input.trim()
    if (!query || loading) return
    setLoading(true)
    try {
      const data = await searchRulebook(gameId, query)
      setResults(data)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col rounded-lg border bg-white overflow-hidden">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-700">🔍 룰 검색</h2>
      </div>

      <div className="p-3 border-b flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="폭탄 사용 조건, 점수 계산 방법..."
          className="flex-1 rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          disabled={loading}
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="rounded bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {loading ? '검색 중...' : '검색'}
        </button>
      </div>

      <div className="min-h-[200px] max-h-[400px] overflow-y-auto p-3 space-y-3">
        {results.length === 0 && !loading && (
          <p className="text-center text-sm text-gray-400 mt-8">룰북에서 관련 내용을 찾아드립니다</p>
        )}
        {results.map((r, i) => (
          <div key={r.id} className="rounded-lg border p-3 text-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-indigo-600">
                {r.pageNumber ? `p.${r.pageNumber}` : `결과 ${i + 1}`}
              </span>
              <span className="text-xs text-gray-400">관련도 {r.score}%</span>
            </div>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{r.content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
