import type { CategoryPoints, Period } from './api'
import { clockText } from './challengeTime'
import { sortedCategories } from './claim'
import { dayIn, deviceZone, formattersFor } from './zonedTime'

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

export const noteBody = (period: Period, now: number, zone = deviceZone()) => {
  const end = Date.parse(period.ends_at)
  const clause = categoryClause(period.rules.categories)
  if (dayIn(end, zone) === dayIn(now, zone)) {
    const lead = clause ?? 'Photos count toward the challenge'
    return `${lead} until ${clockText(end, zone)} today. After that, photos count toward your week again.`
  }
  const until = `${formattersFor(zone).weekday.format(end)} ${clockText(end, zone)}`
  const tail = `Photos count toward the challenge until ${until}. Weekly scores pick up again after that.`
  return clause ? `${clause}. ${tail}` : tail
}
