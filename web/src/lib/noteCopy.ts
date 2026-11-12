import type { CategoryPoints, Period } from './api'
import { clockText } from './challengeTime'
import { sortedCategories } from './claim'
import { pacificDay, weekday } from './pacificTime'

const listText = (items: string[]) =>
  items.length === 1
    ? items[0]
    : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`

const categoryClause = (categories: CategoryPoints[]) => {
  const [first, ...rest] = sortedCategories(categories)
  if (!first) return null
  return listText([
    `${first.name} is worth +${first.points}`,
    ...rest.map(({ name, points }) => `${name} +${points}`),
  ])
}

export const noteTitle = (name: string) => `${name} is on`

export const noteBody = (period: Period, now: number) => {
  const end = Date.parse(period.ends_at)
  const clause = categoryClause(period.rules.categories)
  if (pacificDay(end) === pacificDay(now)) {
    const lead = clause ?? 'Photos count toward the challenge'
    return `${lead} until ${clockText(end)} today. After that, photos count toward your week again.`
  }
  const until = `${weekday.format(end)} ${clockText(end)}`
  const tail = `Photos count toward the challenge until ${until}. Weekly scores pick up again after that.`
  return clause ? `${clause}. ${tail}` : tail
}
