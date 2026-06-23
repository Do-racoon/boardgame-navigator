import { XMLParser } from 'fast-xml-parser'

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })

export interface BggGame {
  id: number
  titleEn: string
  titleKo: string | null
  description: string
  minPlayers: number
  maxPlayers: number
  minPlayTime: number
  maxPlayTime: number
  difficulty: number   // BGG weight (1~5)
  releaseYear: number
  thumbnailUrl: string
  categories: string[]
  mechanics: string[]
}

const BATCH_SIZE = 20
const DELAY_MS = 2000 // BGG API rate limit 대응

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function getText(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null && '#text' in value) {
    return String((value as Record<string, unknown>)['#text'])
  }
  return ''
}

function toArray<T>(value: T | T[]): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

export async function fetchBggGames(ids: number[]): Promise<BggGame[]> {
  const results: BggGame[] = []

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE)
    const url = `https://boardgamegeek.com/xmlapi2/thing?id=${batch.join(',')}&stats=1`

    console.log(`  BGG API 요청 ${i + 1}~${Math.min(i + BATCH_SIZE, ids.length)} / ${ids.length}`)

    let xml: string
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      xml = await res.text()
    } catch (err) {
      console.warn(`  배치 실패, 스킵:`, err)
      await sleep(DELAY_MS)
      continue
    }

    const parsed = parser.parse(xml)
    const items = toArray(parsed?.items?.item ?? [])

    for (const item of items) {
      try {
        const names = toArray(item.name)
        const primaryName = names.find((n: Record<string, string>) => n['@_type'] === 'primary')
        const titleEn = getText(primaryName?.['@_value'] ?? primaryName?.value ?? '')

        const stats = item.statistics?.ratings
        const difficulty = parseFloat(stats?.averageweight?.['@_value'] ?? '2.5')

        const categories = toArray(item.link)
          .filter((l: Record<string, string>) => l['@_type'] === 'boardgamecategory')
          .map((l: Record<string, string>) => getText(l['@_value']))

        results.push({
          id: parseInt(item['@_id']),
          titleEn,
          titleKo: null, // 수동 입력 또는 별도 번역 필요
          description: getText(item.description).slice(0, 2000).replace(/&#10;/g, '\n').replace(/&amp;/g, '&'),
          minPlayers: parseInt(item.minplayers?.['@_value'] ?? '2'),
          maxPlayers: parseInt(item.maxplayers?.['@_value'] ?? '4'),
          minPlayTime: parseInt(item.minplaytime?.['@_value'] ?? '30'),
          maxPlayTime: parseInt(item.maxplaytime?.['@_value'] ?? '60'),
          difficulty: isNaN(difficulty) ? 2.5 : Math.round(difficulty * 10) / 10,
          releaseYear: parseInt(item.yearpublished?.['@_value'] ?? '2000'),
          thumbnailUrl: getText(item.thumbnail),
          categories,
          mechanics: toArray(item.link)
            .filter((l: Record<string, string>) => l['@_type'] === 'boardgamemechanic')
            .map((l: Record<string, string>) => getText(l['@_value'])),
        })
      } catch (err) {
        console.warn(`  게임 파싱 실패 (id: ${item['@_id']}):`, err)
      }
    }

    if (i + BATCH_SIZE < ids.length) await sleep(DELAY_MS)
  }

  return results
}
