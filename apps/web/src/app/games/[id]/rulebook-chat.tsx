'use client'

import { useRef, useState } from 'react'
import { streamAsk, searchRulebook } from '@/lib/api'

type Mode = 'search' | 'ask'

interface Citation { chunkId: string; pageNumber: number | null; preview: string }
interface Message {
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
}
interface SearchResult { id: string; pageNumber: number | null; content: string; score: number }

const SESSION_ID = Math.random().toString(36).slice(2)

export function RulebookChat({ gameId }: { gameId: string }) {
  const [mode, setMode] = useState<Mode>('search')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  // search mode
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])

  // ask mode
  const [messages, setMessages] = useState<Message[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  async function handleSearch() {
    const query = input.trim()
    if (!query || loading) return
    setInput('')
    setLoading(true)
    try {
      const results = await searchRulebook(gameId, query)
      setSearchResults(results)
    } catch {
      setSearchResults([])
    } finally {
      setLoading(false)
    }
  }

  async function handleAsk() {
    const question = input.trim()
    if (!question || loading) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: question }, { role: 'assistant', content: '' }])
    setLoading(true)

    try {
      const citations: Citation[] = []
      for await (const event of streamAsk(gameId, question, SESSION_ID)) {
        if (event.type === 'chunk') {
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]!
            return [...next.slice(0, -1), { ...last, content: last.content + (event.data as string) }]
          })
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        } else if (event.type === 'citations') {
          citations.push(...(event.data as Citation[]))
        }
      }
      if (citations.length > 0) {
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]!
          return [...next.slice(0, -1), { ...last, citations }]
        })
      }
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: '오류가 발생했습니다. 다시 시도해주세요.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit() {
    if (mode === 'search') handleSearch()
    else handleAsk()
  }

  return (
    <div className="flex flex-1 flex-col rounded-lg border bg-white overflow-hidden">
      {/* 탭 */}
      <div className="flex border-b">
        <button
          onClick={() => setMode('search')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            mode === 'search'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          🔍 빠른 룰 검색
        </button>
        <button
          onClick={() => setMode('ask')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            mode === 'ask'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          🧭 룰 방향성 도우미
        </button>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto min-h-[400px] max-h-[560px]">
        {mode === 'search' ? (
          <div className="p-4 space-y-3">
            {searchResults.length === 0 && !loading && (
              <p className="text-center text-sm text-gray-400 mt-8">
                룰북에서 관련 내용을 바로 찾아드립니다
              </p>
            )}
            {loading && (
              <p className="text-center text-sm text-gray-400 mt-8 animate-pulse">검색 중...</p>
            )}
            {searchResults.map((r, i) => (
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
        ) : (
          <div className="p-4 space-y-4">
            {messages.length === 0 && (
              <p className="text-center text-sm text-gray-400 mt-8">
                룰에 대해 자유롭게 질문하세요
              </p>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
                <div
                  className={`inline-block max-w-[85%] rounded-lg px-4 py-2 text-sm ${
                    msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {msg.content || (loading && i === messages.length - 1 ? '…' : '')}
                </div>
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-1 space-y-1">
                    {msg.citations.map((c) => (
                      <p key={c.chunkId} className="text-xs text-gray-400">
                        📄 {c.pageNumber ? `p.${c.pageNumber}` : '출처'} — {c.preview}…
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* 입력창 */}
      <div className="border-t p-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
          placeholder={mode === 'search' ? '폭탄 사용 조건' : '폭탄은 언제 사용할 수 있나요?'}
          className="flex-1 rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          disabled={loading}
        />
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="rounded bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {mode === 'search' ? '검색' : '전송'}
        </button>
      </div>
    </div>
  )
}
