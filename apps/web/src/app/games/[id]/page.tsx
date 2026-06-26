import { fetchGame } from '@/lib/api'
import { RulebookSearch } from './rulebook-chat'

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const game = await fetchGame(id)

  const setupSteps = parseSetupGuide(game.setup_guide as string | null)

  return (
    <div className="space-y-8">
      {/* 게임 기본 정보 */}
      <div className="flex gap-6 items-start">
        {game.thumbnail_url && (
          <img src={game.thumbnail_url} alt={game.title_ko} className="rounded-lg w-32 h-32 object-cover shrink-0" />
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{game.title_ko}</h1>
          {game.title_en && <p className="text-gray-500 text-sm mt-0.5">{game.title_en}</p>}

          <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-600">
            {game.min_players && (
              <span className="flex items-center gap-1">👥 {game.min_players}~{game.max_players}인</span>
            )}
            {game.min_play_time && (
              <span className="flex items-center gap-1">⏱ {game.min_play_time}~{game.max_play_time}분</span>
            )}
            {game.difficulty && (
              <span className="flex items-center gap-1">🎯 난이도 {game.difficulty}/5</span>
            )}
          </div>

          {(game.genres as string[] | null)?.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {(game.genres as string[]).map((g) => (
                <span key={g} className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">{g}</span>
              ))}
            </div>
          ) : null}

          {game.description && (
            <p className="mt-3 text-sm text-gray-700 leading-relaxed">{game.description}</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 게임 세팅 가이드 */}
        <div>
          <h2 className="text-lg font-semibold mb-3">🎲 게임 세팅</h2>
          {setupSteps.length > 0 ? (
            <div className="rounded-lg border bg-white overflow-hidden">
              {setupSteps.map((step, i) => (
                <div key={i} className={`flex gap-4 px-4 py-4 ${i > 0 ? 'border-t' : ''}`}>
                  <div className="shrink-0 w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    {step.title && (
                      <p className="font-medium text-sm text-gray-800 mb-0.5">{step.title}</p>
                    )}
                    <p className="text-sm text-gray-600 leading-relaxed">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-gray-400">
              세팅 가이드가 아직 없습니다.<br />
              <span className="text-xs text-gray-300 mt-1 block">룰북 등록 후 어드민에서 생성할 수 있습니다</span>
            </div>
          )}
        </div>

        {/* 룰 검색 */}
        <div>
          <h2 className="text-lg font-semibold mb-3">📖 룰 검색</h2>
          {game.rulebooks?.length > 0 ? (
            <RulebookSearch gameId={game.id} />
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-gray-400">
              등록된 룰북이 없습니다
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// setup_guide 텍스트를 단계별로 파싱
// 형식: "1. 제목\n내용" 또는 번호 없이 줄 구분
function parseSetupGuide(raw: string | null): { title: string; body: string }[] {
  if (!raw?.trim()) return []

  // 번호 기반 분리: "1." "2." 등
  const numbered = raw.split(/\n(?=\d+[\.\)]\s)/).filter(Boolean)
  if (numbered.length > 1) {
    return numbered.map(block => {
      const lines = block.replace(/^\d+[\.\)]\s*/, '').trim().split('\n')
      const first = lines[0]?.trim() ?? ''
      const rest = lines.slice(1).join('\n').trim()
      return rest
        ? { title: first, body: rest }
        : { title: '', body: first }
    })
  }

  // 줄 기반 분리 (번호 없음)
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
  return lines.map(l => ({ title: '', body: l }))
}
