import type { Rules } from './api'
import { sortedCategories } from './claim'

const PACIFIC = 'America/Los_Angeles'
const HOUR = 60 * 60 * 1000

const monthDay = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  timeZone: PACIFIC,
})

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`

export const weekRange = (startsAt: string, endsAt: string) => {
  const start = monthDay.formatToParts(new Date(startsAt))
  const lastDay = new Date(new Date(endsAt).getTime() - HOUR)
  const end = monthDay.formatToParts(lastDay)
  const part = (parts: Intl.DateTimeFormatPart[], type: string) =>
    parts.find((p) => p.type === type)?.value ?? ''
  const startMonth = part(start, 'month')
  const endMonth = part(end, 'month')
  const endText =
    startMonth === endMonth
      ? part(end, 'day')
      : `${endMonth} ${part(end, 'day')}`
  return `${startMonth} ${part(start, 'day')}-${endText}`
}

export const ordinal = (n: number) => {
  const lastTwo = n % 100
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'
  return `${n}${suffix}`
}

export const soulCountText = (count: number, challengeName: string | null) => {
  const souls = plural(count, 'Soul', 'Souls')
  return challengeName ? `${souls} in ${challengeName}` : `${souls} this week`
}

export const behindText = (
  rank: number,
  nextRank: number | null,
  pointsBehind: number | null,
) => {
  if (rank === 1 || nextRank === null || pointsBehind === null) {
    return `You're in ${ordinal(rank)} place`
  }
  return `${plural(pointsBehind, 'pt', 'pts')} behind ${ordinal(nextRank)} place`
}

export const pointsIntro = (rules: Rules) => {
  const regular = `Regular Souls are +${rules.regular}`
  if (rules.special !== null) {
    return `${regular}, special ones +${rules.special}.`
  }
  const extras = sortedCategories(rules.categories).map(
    ({ name, points }) => `${name} +${points}`,
  )
  return `${[regular, ...extras].join(', ')}.`
}
