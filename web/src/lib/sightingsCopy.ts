import type { LoggedSighting } from './api'

export type CardKind =
  'counted' | 'false_call' | 'flagged' | 'special' | 'waiting'

export interface LogCard {
  categories: string[]
  checkNote: string | null
  claimType: 'regular' | 'special'
  id: string
  kind: CardKind
  name: string
  photoUrl: string | null
  points: number
  takenAt: string
}

export interface DayGroup {
  cards: LogCard[]
  header: string
}

const PACIFIC = 'America/Los_Angeles'
const MINUS = '−'

const dateKey = new Intl.DateTimeFormat('en-CA', {
  day: '2-digit',
  month: '2-digit',
  timeZone: PACIFIC,
  year: 'numeric',
})
const weekday = new Intl.DateTimeFormat('en-US', {
  timeZone: PACIFIC,
  weekday: 'short',
})
const clock = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: PACIFIC,
})

const pacificDay = (at: number) => dateKey.format(at)

const dayBefore = (key: string) => {
  const date = new Date(`${key}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

export const cardKind = ({
  claim_type,
  flagged,
  status,
}: Pick<LoggedSighting, 'claim_type' | 'flagged' | 'status'>): CardKind => {
  if (status === 'false_call') return 'false_call'
  if (flagged) return 'flagged'
  return claim_type === 'special' ? 'special' : 'counted'
}

const signed = (points: number) =>
  points < 0 ? `${MINUS}${-points}` : `+${points}`

export const chipText = ({ kind, points }: LogCard) => {
  switch (kind) {
    case 'counted':
      return `${signed(points)} Counted`
    case 'special':
      return `${signed(points)} Special`
    case 'flagged':
      return `${signed(points)} · Flagged for a second look`
    case 'false_call':
      return `${signed(points)} False call`
    case 'waiting':
      return 'Waiting to send'
  }
}

export const claimLine = ({
  categories,
  checkNote,
  claimType,
  kind,
}: LogCard) => {
  if (kind === 'false_call') return checkNote ?? 'Photo check: not a Kia Soul'
  return claimType === 'special'
    ? `Special · ${categories.join(', ')}`
    : 'Regular'
}

export const timeText = (takenAt: string) => clock.format(new Date(takenAt))

export const dayHeader = (takenAt: string, now: number) => {
  const at = Date.parse(takenAt)
  const day = pacificDay(at)
  const today = pacificDay(now)
  const name = weekday.format(at)
  if (day === today) return `Today · ${name}`
  if (day === dayBefore(today)) return `Yesterday · ${name}`
  return name
}

export const groupByDay = (cards: LogCard[], now: number): DayGroup[] => {
  const sorted = [...cards].sort(
    (a, b) => Date.parse(b.takenAt) - Date.parse(a.takenAt),
  )
  const groups: DayGroup[] = []
  for (const card of sorted) {
    const header = dayHeader(card.takenAt, now)
    const last = groups.at(-1)
    if (last?.header === header) last.cards.push(card)
    else groups.push({ cards: [card], header })
  }
  return groups
}
