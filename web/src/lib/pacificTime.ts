const PACIFIC = 'America/Los_Angeles'

const dateKey = new Intl.DateTimeFormat('en-CA', {
  day: '2-digit',
  month: '2-digit',
  timeZone: PACIFIC,
  year: 'numeric',
})

export const weekday = new Intl.DateTimeFormat('en-US', {
  timeZone: PACIFIC,
  weekday: 'short',
})

export const clock = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: PACIFIC,
})

export const pacificDay = (at: number) => dateKey.format(at)

export const dayBefore = (key: string) => {
  const date = new Date(`${key}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}
