import { fetchGame } from '@/lib/api'
import { RulebookChat } from './rulebook-chat'

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const game = await fetchGame(id)

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* 게임 정보 */}
      <div>
        {game.thumbnail_url && (
          <img src={game.thumbnail_url} alt={game.title_ko} className="mb-4 rounded-lg w-full object-cover" />
        )}
        <h1 className="text-2xl font-bold">{game.title_ko}</h1>
        {game.title_en && <p className="text-gray-500">{game.title_en}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          {(game.genres as string[] | null)?.map((g) => (
            <span key={g} className="rounded-full bg-indigo-100 px-3 py-1 text-xs text-indigo-700">
              {g}
            </span>
          ))}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <dt className="text-gray-500">인원</dt>
          <dd>{game.min_players}~{game.max_players}인</dd>
          <dt className="text-gray-500">시간</dt>
          <dd>{game.min_play_time}~{game.max_play_time}분</dd>
          <dt className="text-gray-500">난이도</dt>
          <dd>{game.difficulty} / 5</dd>
        </dl>

        {game.description && <p className="mt-4 text-sm text-gray-700 leading-relaxed">{game.description}</p>}
      </div>

      {/* 룰북 챗봇 */}
      <div className="flex flex-col">
        <h2 className="mb-4 text-lg font-semibold">룰북 AI 질의응답</h2>
        {game.rulebooks?.length > 0 ? (
          <RulebookChat gameId={game.id} />
        ) : (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-gray-400">
            등록된 룰북이 없습니다.
          </p>
        )}
      </div>
    </div>
  )
}
