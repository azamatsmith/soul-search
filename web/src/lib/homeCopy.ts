const PACIFIC = 'America/Los_Angeles'
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

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

export const timeLeft = (endsAt: string, now: number) => {
  const left = new Date(endsAt).getTime() - now
  if (left <= 0) return 'Ending now'
  if (left > DAY) return `${plural(Math.floor(left / DAY), 'day', 'days')} left`
  if (left >= HOUR) {
    return `${plural(Math.floor(left / HOUR), 'hour', 'hours')} left`
  }
  return `${Math.max(1, Math.floor(left / 60_000))} min left`
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

export const pointsIntro = (rules: { regular: number; special: number }) =>
  `Regular Souls are +${rules.regular}, special ones +${rules.special}.`
