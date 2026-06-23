import { PrismaClient } from '@prisma/client'
import { fetchBggGames } from './bgg-client'
import { UNIQUE_BGG_IDS } from './bgg-ids'
import { KO_TITLES } from './ko-titles'

const prisma = new PrismaClient()

// BGG 카테고리 → 우리 장르 매핑
const CATEGORY_MAP: Record<string, string> = {
  'Card Game': '카드 게임',
  'Strategy': '전략',
  'Economic': '경제',
  'Fantasy': '판타지',
  'Science Fiction': 'SF',
  'Cooperative Game': '협력',
  'Party Game': '파티',
  'Deduction': '추리',
  'Adventure': '어드벤처',
  'Abstract Strategy': '추상 전략',
  'Deck Building': '덱빌딩',
  'Worker Placement': '일꾼 놓기',
  'Area Control': '영역 장악',
  'Wargame': '워게임',
  'City Building': '도시 건설',
  'Drafting': '드래프팅',
  'Puzzle': '퍼즐',
  'Negotiation': '협상',
}

function mapCategories(categories: string[]): string[] {
  const genres = new Set<string>()
  for (const cat of categories) {
    const mapped = CATEGORY_MAP[cat]
    if (mapped) genres.add(mapped)
  }
  return [...genres].slice(0, 3) // 게임당 최대 3개 장르
}

async function main() {
  console.log('🎲 보드게임 시드 데이터 시작\n')

  // ── 장르 upsert ────────────────────────────────────────────────────────────
  const allGenres = Object.values(CATEGORY_MAP)
  console.log(`장르 ${allGenres.length}개 upsert 중...`)
  await Promise.all(
    allGenres.map((name) =>
      prisma.genre.upsert({
        where: { name },
        create: { name },
        update: {},
      }),
    ),
  )

  // ── BGG API 수집 ──────────────────────────────────────────────────────────
  console.log(`\nBGG에서 게임 ${UNIQUE_BGG_IDS.length}개 수집 중...`)
  const games = await fetchBggGames(UNIQUE_BGG_IDS)
  console.log(`\n수집 완료: ${games.length}개\n`)

  // ── DB 저장 ───────────────────────────────────────────────────────────────
  let created = 0
  let skipped = 0

  for (const game of games) {
    const genreNames = mapCategories(game.categories)

    try {
      const titleKo = KO_TITLES[game.id] ?? game.titleKo ?? game.titleEn

      await prisma.game.upsert({
        where: {
          // BGG ID를 직접 저장하지 않으므로 영어 제목으로 중복 체크
          // 실제 운영에서는 bgg_id 컬럼 추가 권장
          id: String(game.id), // seed에서는 BGG ID를 UUID 대신 사용
        },
        create: {
          id: String(game.id),
          titleKo,
          titleEn: game.titleEn,
          description: game.description,
          minPlayers: game.minPlayers,
          maxPlayers: game.maxPlayers,
          minPlayTime: game.minPlayTime,
          maxPlayTime: game.maxPlayTime,
          difficulty: game.difficulty,
          releaseYear: game.releaseYear,
          thumbnailUrl: game.thumbnailUrl,
          genres: {
            create: await Promise.all(
              genreNames.map(async (name) => {
                const genre = await prisma.genre.findUnique({ where: { name } })
                return { genre: { connect: { id: genre!.id } } }
              }),
            ),
          },
        },
        update: {
          thumbnailUrl: game.thumbnailUrl,
          difficulty: game.difficulty,
        },
      })
      created++
    } catch (err) {
      console.warn(`  스킵 (${game.titleEn}):`, (err as Error).message)
      skipped++
    }
  }

  console.log(`\n✅ 완료: ${created}개 저장, ${skipped}개 스킵`)

  // ── 티츄 벤치마크 질문 샘플 ───────────────────────────────────────────────
  const tichuId = '9216'
  const tichuExists = await prisma.game.findUnique({ where: { id: tichuId } })
  if (tichuExists) {
    console.log('\n티츄 벤치마크 질문 삽입 중...')
    const questions = [
      {
        question: '폭탄은 언제 사용할 수 있나요?',
        expectedAnswer: '폭탄은 자신의 차례가 아니어도 언제든지 사용할 수 있습니다.',
        mustInclude: ['폭탄', '차례'],
        mustNotInclude: [],
        difficulty: 'EASY' as const,
        category: 'RULE' as const,
      },
      {
        question: '피닉스는 몇 점인가요?',
        expectedAnswer: '피닉스는 -25점입니다.',
        mustInclude: ['-25'],
        mustNotInclude: ['25점'],
        difficulty: 'EASY' as const,
        category: 'SCORING' as const,
      },
      {
        question: '드래곤을 낸 후 트릭은 누구에게 주나요?',
        expectedAnswer: '드래곤으로 이긴 트릭은 상대 팀 중 원하는 플레이어에게 줄 수 있습니다.',
        mustInclude: ['드래곤', '상대'],
        mustNotInclude: [],
        difficulty: 'MEDIUM' as const,
        category: 'CARD_EFFECT' as const,
      },
      {
        question: '티츄 선언은 언제까지 할 수 있나요?',
        expectedAnswer: '티츄는 자신의 첫 번째 카드를 내기 전까지 선언할 수 있습니다.',
        mustInclude: ['첫 번째', '카드'],
        mustNotInclude: [],
        difficulty: 'EASY' as const,
        category: 'RULE' as const,
      },
      {
        question: '개(DOG) 카드의 효과는 무엇인가요?',
        expectedAnswer: '개는 파트너에게 리드권을 넘깁니다. 트릭을 이기지 못합니다.',
        mustInclude: ['파트너'],
        mustNotInclude: [],
        difficulty: 'MEDIUM' as const,
        category: 'CARD_EFFECT' as const,
      },
    ]

    for (const q of questions) {
      await prisma.benchmarkQuestion.upsert({
        where: {
          id: `bench-tichu-${questions.indexOf(q)}`,
        },
        create: {
          id: `bench-tichu-${questions.indexOf(q)}`,
          gameId: tichuId,
          expectedChunkIds: [],
          ...q,
        },
        update: {},
      })
    }
    console.log(`  티츄 벤치마크 질문 ${questions.length}개 삽입 완료`)
  }
}

main()
  .catch((err) => {
    console.error('시드 실패:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
