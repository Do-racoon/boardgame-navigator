const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

export async function fetchGames(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) query.set(k, String(v))
  }
  const res = await fetch(`${BASE_URL}/games?${query}`, { next: { revalidate: 60 } })
  if (!res.ok) throw new Error('Failed to fetch games')
  return res.json()
}

export async function searchRulebook(gameId: string, query: string) {
  const res = await fetch(`${BASE_URL}/games/${gameId}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: query }),
  })
  if (!res.ok) throw new Error('Search failed')
  return res.json() as Promise<{ id: string; pageNumber: number | null; content: string; score: number }[]>
}

export async function fetchGame(id: string) {
  const res = await fetch(`${BASE_URL}/games/${id}`, { next: { revalidate: 60 } })
  if (!res.ok) throw new Error('Failed to fetch game')
  return res.json()
}

export async function* streamAsk(gameId: string, question: string, sessionId: string) {
  const res = await fetch(`${BASE_URL}/games/${gameId}/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-id': sessionId,
    },
    body: JSON.stringify({ question }),
  })

  if (!res.ok || !res.body) throw new Error('Stream failed')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          yield JSON.parse(line.slice(6)) as { type: string; data: unknown }
        } catch {
          // ignore malformed line
        }
      }
    }
  }
}
