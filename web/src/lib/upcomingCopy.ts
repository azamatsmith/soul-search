import type { ChallengeRules } from './api'
import { clockText, dayText, lengthText, rangeText } from './challengeTime'
import { dayIn, deviceZone } from './zonedTime'
import { signedPoints } from './signedPoints'

const DAY_MS = 24 * 60 * 60 * 1000
const MINUTE_MS = 60 * 1000

const dayNumber = (at: number, zone: string) =>
  Math.round(Date.parse(`${dayIn(at, zone)}T12:00:00Z`) / DAY_MS)

export const howSoonText = (
  startIso: string,
  now: number,
  zone = deviceZone(),
) => {
  const days = dayNumber(Date.parse(startIso), zone) - dayNumber(now, zone)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 7) return `In ${days} days`
  const weeks = Math.round(days / 7)
  return `In ${weeks} ${weeks === 1 ? 'week' : 'weeks'}`
}

export const upcomingRangeText = (
  startIso: string,
  endIso: string,
  zone = deviceZone(),
) => {
  const start = Date.parse(startIso)
  const lastMoment = Date.parse(endIso) - MINUTE_MS
  if (dayIn(start, zone) === dayIn(lastMoment, zone)) {
    return rangeText(startIso, endIso, zone)
  }
  return `${dayText(start, zone)} – ${dayText(lastMoment, zone)}`
}

export const upcomingRulesText = ({ categories, regular }: ChallengeRules) =>
  [
    `Regular ${signedPoints(regular)}`,
    ...categories.map(({ name, points }) => `${name} ${signedPoints(points)}`),
  ].join(', ')

export const reminderText = (startIso: string, endIso: string) =>
  `For those ${lengthText(startIso, endIso)}, new photos count toward the challenge instead of your week.`

export const startText = (startIso: string, zone = deviceZone()) => {
  const start = Date.parse(startIso)
  return `${dayText(start, zone)}, ${clockText(start, zone)}`
}
