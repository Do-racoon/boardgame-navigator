import { fetchGame } from '@/lib/api'
import { RulebookSearch } from './rulebook-chat'
import { CorrectionForm } from '@/components/correction-form'

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const game = await fetchGame(id)

  const setupSteps = parseSetupGuide(game.setup_guide as string | null)

  return (
    <div className="space-y-6 pb-8">
      {/* 뒤로가기 */}
      <a href="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600">
        ← 목록으로
      </a>

      {/* 게임 기본 정보 */}
      <div className="rounded-xl border bg-white p-4 flex gap-4 items-start">
        {game.thumbnail_url ? (
          <img src={game.thumbnail_url} alt={game.title_ko}
            className="rounded-lg w-20 h-20 sm:w-24 sm:h-24 object-cover shrink-0" />
        ) : (
          <div className="rounded-lg w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center shrink-0">
            <span className="text-3xl">🎲</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold leading-tight">{game.title_ko}</h1>
          {game.title_en && <p className="text-gray-400 text-sm mt-0.5">{game.title_en}</p>}

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-600">
            {game.min_players && <span>👥 {game.min_players}~{game.max_players}인</span>}
            {game.min_play_time && <span>⏱ {game.min_play_time}~{game.max_play_time}분</span>}
            {game.difficulty && <span>🎯 난이도 {game.difficulty}/5</span>}
          </div>

          {(game.genres as string[] | null)?.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {(game.genres as string[]).map(g => (
                <a key={g} href={`/?genre=${g}`}
                  className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600 hover:bg-indigo-100">
                  {g}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {game.description && (
        <p className="text-sm text-gray-600 leading-relaxed px-1">{game.description}</p>
      )}

      {/* 세팅 가이드 */}
      <section>
        <h2 className="text-base font-semibold mb-3">🎲 게임 세팅</h2>
        {setupSteps.length > 0 ? (
          <div className="rounded-xl border bg-white overflow-hidden divide-y">
            {setupSteps.map((step, i) => (
              <div key={i} className="flex gap-3 px-4 py-3.5">
                <div className="shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  {step.title && <p className="font-medium text-sm text-gray-800 mb-0.5">{step.title}</p>}
                  <p className="text-sm text-gray-600 leading-relaxed">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-gray-400">
            세팅 가이드 준비 중
          </div>
        )}
      </section>

      {/* 룰 검색 */}
      <section>
        <h2 className="text-base font-semibold mb-3">📖 룰 검색</h2>
        {game.rulebooks?.length > 0 ? (
          <RulebookSearch gameId={game.id} />
        ) : (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-gray-400">
            등록된 룰북이 없습니다
          </div>
        )}
      </section>

      {/* 수정 요청 */}
      <section>
        <CorrectionForm gameId={game.id} gameTitle={game.title_ko} />
      </section>
    </div>
  )
}

function parseSetupGuide(raw: string | null): { title: string; body: string }[] {
  if (!raw?.trim()) return []
  const numbered = raw.split(/\n(?=\d+[\.\)]\s)/).filter(Boolean)
  if (numbered.length > 1) {
    return numbered.map(block => {
      const lines = block.replace(/^\d+[\.\)]\s*/, '').trim().split('\n')
      const first = lines[0]?.trim() ?? ''
      const rest = lines.slice(1).join('\n').trim()
      return rest ? { title: first, body: rest } : { title: '', body: first }
    })
  }
  return raw.split('\n').map(l => l.trim()).filter(Boolean).map(l => ({ title: '', body: l }))
}
