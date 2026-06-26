'use client'

import { useRef, useState } from 'react'
import { streamAsk, searchRulebook } from '@/lib/api'

type Mode = 'search' | 'ask'
type Category = 'my_turn' | 'opp_turn' | 'my_hand' | 'opp_hand'

interface Citation { chunkId: string; pageNumber: number | null; preview: string }
interface Message {
  role: 'user' | 'assistant'
  content: string
  category?: Category
  citations?: Citation[]
}
interface SearchResult { id: string; pageNumber: number | null; content: string; score: number }

const CATEGORIES: { id: Category; emoji: string; label: string; hint: string }[] = [
  { id: 'my_turn',  emoji: '🎯', label: '내 턴',   hint: '내 턴에 할 수 있는 행동과 최선의 선택' },
  { id: 'opp_turn', emoji: '👀', label: '상대 턴',  hint: '상대 턴에 대응하거나 관찰해야 할 것' },
  { id: 'my_hand',  emoji: '🃏', label: '내 패 전략', hint: '내 패 구성 및 보유 카드 활용 전략' },
  { id: 'opp_hand', emoji: '🕵️', label: '상대 파악', hint: '상대 패 추측 및 상대 전략 대응' },
]

const SESSION_ID = Math.random().toString(36).slice(2)

export function RulebookChat({ gameId }: { gameId: string }) {
  const [mode, setMode] = useState<Mode>('ask')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [category, setCategory] = useState<Category | null>(null)

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
    const userMsg: Message = { role: 'user', content: question, ...(category ? { category } : {}) }
    setMessages((prev) => [...prev, userMsg, { role: 'assistant', content: '' }])
    setLoading(true)

    try {
      const citations: Citation[] = []
      for await (const event of streamAsk(gameId, question, SESSION_ID, category ?? undefined)) {
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

  const activeCat = CATEGORIES.find(c => c.id === category)

  return (
    <div className="flex flex-1 flex-col rounded-lg border bg-white overflow-hidden">
      {/* 탭 */}
      <div className="flex border-b">
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
      </div>

      {/* 질문 관점 선택 (ask 모드에서만) */}
      {mode === 'ask' && (
        <div className="border-b px-3 py-2 bg-gray-50">
          <p className="text-xs text-gray-400 mb-1.5">질문 관점 선택 <span className="text-gray-300">(선택 시 더 정확한 답변)</span></p>
          <div className="grid grid-cols-4 gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(prev => prev === cat.id ? null : cat.id)}
                title={cat.hint}
                className={`flex flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-xs font-medium transition-all ${
                  category === cat.id
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <span className="text-base">{cat.emoji}</span>
                <span className="leading-tight text-center">{cat.label}</span>
              </button>
            ))}
          </div>
          {activeCat && (
            <p className="mt-1.5 text-xs text-indigo-600">{activeCat.hint}</p>
          )}
        </div>
      )}

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto min-h-[340px] max-h-[480px]">
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
              <div className="mt-6 space-y-3">
                <p className="text-center text-sm text-gray-400">
                  관점을 선택하고 질문해보세요
                </p>
                <div className="space-y-1.5">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setCategory(cat.id)}
                      className={`w-full text-left rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                        category === cat.id
                          ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <span className="mr-2">{cat.emoji}</span>
                      <span className="font-medium">{cat.label}</span>
                      <span className="text-gray-400 text-xs ml-2">— {cat.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
                {msg.role === 'user' && msg.category && (
                  <p className="text-xs text-gray-400 mb-1">
                    {CATEGORIES.find(c => c.id === msg.category)?.emoji}{' '}
                    {CATEGORIES.find(c => c.id === msg.category)?.label}
                  </p>
                )}
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
      <div className="border-t p-3 space-y-2">
        {mode === 'ask' && activeCat && (
          <p className="text-xs text-indigo-500 pl-1">{activeCat.emoji} {activeCat.label} 관점으로 질문</p>
        )}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
            placeholder={
              mode === 'search'
                ? '폭탄 사용 조건'
                : activeCat
                  ? `${activeCat.hint}에 대해 질문하세요`
                  : '룰에 대해 자유롭게 질문하세요'
            }
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
    </div>
  )
}
