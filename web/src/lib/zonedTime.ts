export const PACIFIC = 'America/Los_Angeles'

export interface ZoneFormatters {
  clock: Intl.DateTimeFormat
  dayKey: Intl.DateTimeFormat
  monthDay: Intl.DateTimeFormat
  weekday: Intl.DateTimeFormat
}

const cache = new Map<string, ZoneFormatters>()

const build = (timeZone: string): ZoneFormatters => ({
  clock: new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }),
  dayKey: new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }),
  monthDay: new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone,
  }),
  weekday: new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }),
})

const buildOrPacific = (zone: string) => {
  try {
    return build(zone)
  } catch {
    return build(PACIFIC)
  }
}

export const formattersFor = (zone: string) => {
  const cached = cache.get(zone)
  if (cached) return cached
  const made = buildOrPacific(zone)
  cache.set(zone, made)
  return made
}

export const deviceZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || PACIFIC

export const dayIn = (at: number, zone: string) =>
  formattersFor(zone).dayKey.format(at)

export const dayBefore = (key: string) => {
  const date = new Date(`${key}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}
