import Link from 'next/link'
import { fetchGames } from '@/lib/api'

interface SearchParams { q?: string; minPlayers?: string; maxPlayers?: string; maxPlayTime?: string }

export default async function HomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const { items = [], total = 0 } = await fetchGames(params).catch(() => ({ items: [], total: 0 }))

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">보드게임 검색</h1>

      {/* 검색 필터 */}
      <form className="mb-6 flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={params.q}
          placeholder="게임명 검색"
          className="rounded border px-3 py-2 text-sm"
        />
        <select name="minPlayers" defaultValue={params.minPlayers} className="rounded border px-3 py-2 text-sm">
          <option value="">인원 무관</option>
          {[2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>{n}인 이상</option>
          ))}
        </select>
        <select name="maxPlayTime" defaultValue={params.maxPlayTime} className="rounded border px-3 py-2 text-sm">
          <option value="">시간 무관</option>
          <option value="30">30분 이하</option>
          <option value="60">1시간 이하</option>
          <option value="120">2시간 이하</option>
        </select>
        <button type="submit" className="rounded bg-indigo-600 px-4 py-2 text-sm text-white">검색</button>
      </form>

      <p className="mb-4 text-sm text-gray-500">총 {total}개 게임</p>

      {/* 게임 목록 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((game: { id: string; title_ko: string; min_players: number; max_players: number; min_play_time: number; max_play_time: number; thumbnail_url?: string }) => (
          <Link
            key={game.id}
            href={`/games/${game.id}`}
            className="rounded-lg border bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            {game.thumbnail_url && (
              <img src={game.thumbnail_url} alt={game.title_ko} className="mb-3 h-32 w-full rounded object-cover" />
            )}
            <h2 className="font-semibold">{game.title_ko}</h2>
            <p className="mt-1 text-xs text-gray-500">
              {game.min_players}~{game.max_players}인 · {game.min_play_time}~{game.max_play_time}분
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
