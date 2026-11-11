import type { Period } from './api'
import { clockText } from './challengeTime'
import { pacificDay, weekday } from './pacificTime'

const listText = (items: string[]) =>
  items.length === 1
    ? items[0]
    : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`

const bonusClause = (bonuses: Record<string, number>) => {
  const sorted = Object.entries(bonuses).sort(
    ([nameA, pointsA], [nameB, pointsB]) =>
      pointsB - pointsA || nameA.localeCompare(nameB),
  )
  if (sorted.length === 0) return null
  const [[firstName, firstPoints], ...rest] = sorted
  return listText([
    `${firstName} is worth +${firstPoints}`,
    ...rest.map(([name, points]) => `${name} +${points}`),
  ])
}

export const bonusText = (bonuses: Record<string, number>) => {
  const clause = bonusClause(bonuses)
  return clause ? `${clause}.` : null
}

export const bannerTitle = (name: string) => `${name} is on`

export const bannerBody = (period: Period, now: number) => {
  const end = Date.parse(period.ends_at)
  const clause = bonusClause(period.rules.bonuses)
  if (pacificDay(end) === pacificDay(now)) {
    const lead = clause ?? 'Photos count toward the challenge'
    return `${lead} until ${clockText(end)} today. After that, photos count toward your week again.`
  }
  const until = `${weekday.format(end)} ${clockText(end)}`
  const tail = `Photos count toward the challenge until ${until}. Weekly scores pick up again after that.`
  return clause ? `${clause}. ${tail}` : tail
}
