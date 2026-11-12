import type { ChallengeRules } from './api'
import { dayText, lengthText, rangeText } from './challengeTime'
import { pacificDay } from './pacificTime'
import { signedPoints } from './signedPoints'

const DAY_MS = 24 * 60 * 60 * 1000
const MINUTE_MS = 60 * 1000

const dayNumber = (at: number) =>
  Math.round(Date.parse(`${pacificDay(at)}T12:00:00Z`) / DAY_MS)

export const howSoonText = (startIso: string, now: number) => {
  const days = dayNumber(Date.parse(startIso)) - dayNumber(now)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 7) return `In ${days} days`
  const weeks = Math.round(days / 7)
  return `In ${weeks} ${weeks === 1 ? 'week' : 'weeks'}`
}

export const upcomingRangeText = (startIso: string, endIso: string) => {
  const start = Date.parse(startIso)
  const lastMoment = Date.parse(endIso) - MINUTE_MS
  if (pacificDay(start) === pacificDay(lastMoment)) {
    return rangeText(startIso, endIso)
  }
  return `${dayText(start)} – ${dayText(lastMoment)}`
}

export const upcomingRulesText = ({ categories, regular }: ChallengeRules) =>
  [
    `Regular ${signedPoints(regular)}`,
    ...categories.map(({ name, points }) => `${name} ${signedPoints(points)}`),
  ].join(', ')

export const reminderText = (startIso: string, endIso: string) =>
  `For those ${lengthText(startIso, endIso)}, new photos count toward the challenge instead of your week.`
