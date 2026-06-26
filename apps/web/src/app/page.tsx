import Link from 'next/link'
import { fetchGames } from '@/lib/api'
import { GenreFilter } from '@/components/genre-filter'

const GENRES = ['카드', '심리전', '덱빌딩', '일꾼놓기', '땅따먹기', '기억력', '귀여운', '협력', '팀전', '전략', '추리', '경매']

interface SearchParams {
  q?: string; genre?: string; minPlayers?: string; maxPlayTime?: string
  [key: string]: string | undefined
}

type GameItem = {
  id: string; title_ko: string; title_en: string | null
  min_players: number | null; max_players: number | null
  min_play_time: number | null; max_play_time: number | null
  difficulty: number | null; genres: string[] | null; thumbnail_url: string | null
}

export default async function HomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const { items = [], total = 0 } = await fetchGames(params).catch(() => ({ items: [], total: 0 }))

  return (
    <div>
      {/* 검색 바 */}
      <form className="mb-4">
        <div className="flex gap-2">
          <input
            name="q"
            defaultValue={params.q}
            placeholder="게임명으로 검색..."
            className="flex-1 rounded-xl border bg-white px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          {/* hidden으로 현재 장르/필터 유지 */}
          {params.genre && <input type="hidden" name="genre" value={params.genre} />}
          {params.minPlayers && <input type="hidden" name="minPlayers" value={params.minPlayers} />}
          {params.maxPlayTime && <input type="hidden" name="maxPlayTime" value={params.maxPlayTime} />}
          <button type="submit" className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium text-white shadow-sm">
            검색
          </button>
        </div>
      </form>

      {/* 장르 태그 필터 */}
      <div className="mb-4 -mx-4 px-4 overflow-x-auto">
        <div className="flex gap-2 pb-1 w-max">
          <GenreFilter genres={GENRES} {...(params.genre ? { current: params.genre } : {})} {...(params.q ? { q: params.q } : {})} />
        </div>
      </div>

      {/* 인원 / 시간 필터 */}
      <form className="mb-5 flex gap-2 flex-wrap">
        {params.q && <input type="hidden" name="q" value={params.q} />}
        {params.genre && <input type="hidden" name="genre" value={params.genre} />}
        <select name="minPlayers" defaultValue={params.minPlayers ?? ''}
          className="rounded-lg border bg-white px-3 py-2 text-xs shadow-sm focus:outline-none">
          <option value="">인원 무관</option>
          {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}인 이상</option>)}
        </select>
        <select name="maxPlayTime" defaultValue={params.maxPlayTime ?? ''}
          className="rounded-lg border bg-white px-3 py-2 text-xs shadow-sm focus:outline-none">
          <option value="">시간 무관</option>
          <option value="30">30분 이하</option>
          <option value="60">1시간 이하</option>
          <option value="120">2시간 이하</option>
        </select>
        <button type="submit" className="rounded-lg border bg-white px-3 py-2 text-xs shadow-sm hover:bg-gray-50">적용</button>
        {(params.minPlayers || params.maxPlayTime) && (
          <a href={`/?${params.q ? `q=${params.q}&` : ''}${params.genre ? `genre=${params.genre}` : ''}`}
            className="rounded-lg border px-3 py-2 text-xs text-gray-400 hover:bg-gray-50">초기화</a>
        )}
      </form>

      <p className="mb-3 text-xs text-gray-400">총 {total}개 게임</p>

      {/* 게임 목록 */}
      {items.length === 0 ? (
        <div className="py-20 text-center text-sm text-gray-400">검색 결과가 없습니다</div>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {(items as GameItem[]).map((game) => (
            <Link key={game.id} href={`/games/${game.id}`}
              className="group rounded-xl border bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              {game.thumbnail_url ? (
                <img src={game.thumbnail_url} alt={game.title_ko}
                  className="h-28 w-full object-cover" />
              ) : (
                <div className="h-28 w-full bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center">
                  <span className="text-3xl">🎲</span>
                </div>
              )}
              <div className="p-3">
                <h2 className="font-semibold text-sm leading-tight line-clamp-1">{game.title_ko}</h2>
                {game.title_en && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{game.title_en}</p>}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {game.min_players && (
                    <span className="text-xs text-gray-500">👥{game.min_players}~{game.max_players}</span>
                  )}
                  {game.min_play_time && (
                    <span className="text-xs text-gray-500">⏱{game.min_play_time}~{game.max_play_time}분</span>
                  )}
                </div>
                {game.genres?.length ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {game.genres.slice(0, 2).map(g => (
                      <span key={g} className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-600">{g}</span>
                    ))}
                    {game.genres.length > 2 && <span className="text-xs text-gray-300">+{game.genres.length - 2}</span>}
                  </div>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
