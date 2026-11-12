import { dayIn, deviceZone, formattersFor, PACIFIC } from './zonedTime'

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

const FULL_DATE = /^[1-9]\d{3}-\d{2}-\d{2}$/
const FULL_TIME = /^\d{2}:\d{2}$/

export const isFullDateTime = (date: string, time: string) =>
  FULL_DATE.test(date) &&
  FULL_TIME.test(time) &&
  !Number.isNaN(wallClockAsUtc(date, time))

export const pacificToIso = (date: string, time: string) => {
  const wall = wallClockAsUtc(date, time)
  const guess = wall - offsetAt(wall)
  return new Date(wall - offsetAt(guess)).toISOString()
}

export const isoToPacificFields = (iso: string) => pacificParts(Date.parse(iso))

const plural = (count: number, unit: string) =>
  `${count} ${unit}${count === 1 ? '' : 's'}`

export const lengthText = (startIso: string, endIso: string) => {
  const minutes = Math.round(
    (Date.parse(endIso) - Date.parse(startIso)) / MINUTE_MS,
  )
  if (minutes < 60) return plural(minutes, 'minute')
  if (minutes < 24 * 60) {
    const rest = minutes % 60
    const hours = plural(Math.floor(minutes / 60), 'hour')
    return rest ? `${hours}, ${plural(rest, 'minute')}` : hours
  }
  let days = Math.floor(minutes / (24 * 60))
  let hours = Math.round((minutes % (24 * 60)) / 60)
  if (hours === 24) {
    days += 1
    hours = 0
  }
  const dayText = plural(days, 'day')
  return hours ? `${dayText}, ${plural(hours, 'hour')}` : dayText
}

export const durationText = (startIso: string, endIso: string) =>
  `Runs ${lengthText(startIso, endIso)}`

export const clockText = (at: number, zone = deviceZone()) =>
  formattersFor(zone).clock.format(at).toLowerCase()

export const dayText = (at: number, zone = deviceZone()) => {
  const { monthDay, weekday } = formattersFor(zone)
  return `${weekday.format(at)} ${monthDay.format(at)}`
}

export const rangeText = (
  startIso: string,
  endIso: string,
  zone = deviceZone(),
) => {
  const start = Date.parse(startIso)
  const end = Date.parse(endIso)
  const endClock = clockText(end, zone)
  if (dayIn(start, zone) !== dayIn(end, zone)) {
    return `${dayText(start, zone)}, ${clockText(start, zone)} – ${dayText(end, zone)}, ${endClock}`
  }
  const startClock = clockText(start, zone)
  const sameHalf = startClock.slice(-2) === endClock.slice(-2)
  const startShown = sameHalf ? startClock.slice(0, -3) : startClock
  return `${dayText(start, zone)}, ${startShown} – ${endClock}`
}

export const dayRangeText = (
  startIso: string,
  endIso: string,
  zone = deviceZone(),
) => {
  const { monthDay } = formattersFor(zone)
  const first = monthDay.format(Date.parse(startIso))
  const last = monthDay.format(Date.parse(endIso) - MINUTE_MS)
  return first === last ? first : `${first} – ${last}`
}

const momentText = (at: number, now: number, zone: string) => {
  const time = clockText(at, zone)
  return dayIn(at, zone) === dayIn(now, zone)
    ? time
    : `${formattersFor(zone).weekday.format(at)} ${time}`
}

const distance = (at: number, now: number) => {
  const gap = at - now
  if (gap > DAY_MS) return plural(Math.floor(gap / DAY_MS), 'day')
  const minutes = Math.ceil(gap / MINUTE_MS)
  if (minutes >= 60) return plural(Math.floor(minutes / 60), 'hour')
  return `${minutes} min`
}

export const endsAtText = (endIso: string, now: number, zone = deviceZone()) =>
  `ends ${momentText(Date.parse(endIso), now, zone)}`

const ENDING_NOW = 'Ending now'

export const timeLeftText = (
  endIso: string,
  now: number,
  zone = deviceZone(),
) => {
  const end = Date.parse(endIso)
  if (end <= now) return ENDING_NOW
  return `Ends ${momentText(end, now, zone)} · ${distance(end, now)} left`
}

export const shortTimeLeftText = (endIso: string, now: number) => {
  const end = Date.parse(endIso)
  return end <= now ? ENDING_NOW : `${distance(end, now)} left`
}

export const startsInText = (
  startIso: string,
  now: number,
  zone = deviceZone(),
) => {
  const start = Date.parse(startIso)
  return `Starts ${momentText(start, now, zone)} · in ${distance(start, now)}`
}

export const liveText = (endIso: string, now: number, zone = deviceZone()) =>
  `Live · e${timeLeftText(endIso, now, zone).slice(1)}`
