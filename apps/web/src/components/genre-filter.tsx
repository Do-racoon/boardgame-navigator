'use client'

import { useRouter } from 'next/navigation'

interface Props {
  genres: string[]
  current?: string
  q?: string
}

export function GenreFilter({ genres, current, q }: Props) {
  const router = useRouter()

  function select(genre: string) {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (current === genre) {
      // 같은 장르 클릭 → 해제
    } else {
      params.set('genre', genre)
    }
    router.push(`/?${params.toString()}`)
  }

  return (
    <>
      {genres.map(g => (
        <button key={g} onClick={() => select(g)} type="button"
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            current === g
              ? 'bg-indigo-600 text-white'
              : 'bg-white border text-gray-600 hover:border-indigo-300 hover:text-indigo-600'
          }`}>
          {g}
        </button>
      ))}
    </>
  )
}
