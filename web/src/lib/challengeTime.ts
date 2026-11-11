import { clock, pacificDay, weekday } from './pacificTime'

const PACIFIC = 'America/Los_Angeles'
const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

const parts = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
  minute: '2-digit',
  month: '2-digit',
  timeZone: PACIFIC,
  year: 'numeric',
})

const monthDay = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  timeZone: PACIFIC,
})

const pacificParts = (at: number) => {
  const values = Object.fromEntries(
    parts.formatToParts(at).map((part) => [part.type, part.value]),
  )
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  }
}

const wallClockAsUtc = (date: string, time: string) =>
  Date.parse(`${date}T${time}:00Z`)

const offsetAt = (at: number) => {
  const { date, time } = pacificParts(at)
  return wallClockAsUtc(date, time) - at
}

export const pacificToIso = (date: string, time: string) => {
  const wall = wallClockAsUtc(date, time)
  const guess = wall - offsetAt(wall)
  return new Date(wall - offsetAt(guess)).toISOString()
}

export const isoToPacificFields = (iso: string) => pacificParts(Date.parse(iso))

const plural = (count: number, unit: string) =>
  `${count} ${unit}${count === 1 ? '' : 's'}`

export const durationText = (startIso: string, endIso: string) => {
  const minutes = Math.round(
    (Date.parse(endIso) - Date.parse(startIso)) / MINUTE_MS,
  )
  if (minutes < 60) return `Runs ${plural(minutes, 'minute')}`
  if (minutes < 24 * 60) {
    const rest = minutes % 60
    const hours = plural(Math.floor(minutes / 60), 'hour')
    return rest ? `Runs ${hours}, ${plural(rest, 'minute')}` : `Runs ${hours}`
  }
  let days = Math.floor(minutes / (24 * 60))
  let hours = Math.round((minutes % (24 * 60)) / 60)
  if (hours === 24) {
    days += 1
    hours = 0
  }
  const dayText = plural(days, 'day')
  return hours ? `Runs ${dayText}, ${plural(hours, 'hour')}` : `Runs ${dayText}`
}

export const clockText = (at: number) => clock.format(at).toLowerCase()

const dayText = (at: number) => `${weekday.format(at)} ${monthDay.format(at)}`

export const rangeText = (startIso: string, endIso: string) => {
  const start = Date.parse(startIso)
  const end = Date.parse(endIso)
  const endClock = clockText(end)
  if (pacificDay(start) !== pacificDay(end)) {
    return `${dayText(start)}, ${clockText(start)} – ${dayText(end)}, ${endClock}`
  }
  const startClock = clockText(start)
  const sameHalf = startClock.slice(-2) === endClock.slice(-2)
  const startShown = sameHalf ? startClock.slice(0, -3) : startClock
  return `${dayText(start)}, ${startShown} – ${endClock}`
}

export const dayRangeText = (startIso: string, endIso: string) => {
  const start = Date.parse(startIso)
  const lastMoment = Date.parse(endIso) - MINUTE_MS
  const first = monthDay.format(start)
  const last = monthDay.format(lastMoment)
  return first === last ? first : `${first} – ${last}`
}

const momentText = (at: number, now: number) => {
  const time = clockText(at)
  return pacificDay(at) === pacificDay(now)
    ? time
    : `${weekday.format(at)} ${time}`
}

const distance = (at: number, now: number) => {
  const gap = at - now
  if (gap > DAY_MS) return plural(Math.floor(gap / DAY_MS), 'day')
  if (gap >= HOUR_MS) return plural(Math.floor(gap / HOUR_MS), 'hour')
  return `${Math.ceil(gap / MINUTE_MS)} min`
}

const ENDING_NOW = 'Ending now'

export const timeLeftText = (endIso: string, now: number) => {
  const end = Date.parse(endIso)
  if (end <= now) return ENDING_NOW
  return `Ends ${momentText(end, now)} · ${distance(end, now)} left`
}

export const shortTimeLeftText = (endIso: string, now: number) => {
  const end = Date.parse(endIso)
  return end <= now ? ENDING_NOW : `${distance(end, now)} left`
}

export const startsInText = (startIso: string, now: number) => {
  const start = Date.parse(startIso)
  return `Starts ${momentText(start, now)} · in ${distance(start, now)}`
}

export const liveText = (endIso: string, now: number) =>
  `Live · e${timeLeftText(endIso, now).slice(1)}`
