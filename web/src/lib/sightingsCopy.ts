import type { ClaimType, LoggedSighting } from './api'
import { clock, dayBefore, pacificDay, weekday } from './pacificTime'
import { signedPoints } from './signedPoints'

export type CardKind =
  'counted' | 'false_call' | 'flagged' | 'special' | 'waiting'

export interface LogCard {
  categories: string[]
  challengeName: string | null
  checkNote: string | null
  claimType: ClaimType
  fullPhotoUrl: string | null
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

export const cardKind = ({
  claim_type,
  flagged,
  status,
}: Pick<LoggedSighting, 'claim_type' | 'flagged' | 'status'>): CardKind => {
  if (status === 'false_call') return 'false_call'
  if (flagged) return 'flagged'
  return claim_type === 'regular' ? 'counted' : 'special'
}

export const chipText = ({ categories, claimType, kind, points }: LogCard) => {
  switch (kind) {
    case 'counted':
      return `${signedPoints(points)} Counted`
    case 'special':
      return claimType === 'challenge'
        ? `${signedPoints(points)} ${categories.join(', ')}`
        : `${signedPoints(points)} Special`
    case 'flagged':
      return `${signedPoints(points)} · Flagged for a second look`
    case 'false_call':
      return `${signedPoints(points)} False call`
    case 'waiting':
      return 'Waiting to send'
  }
}

const FALSE_CALL_FALLBACK = 'Photo check: not a Kia Soul'

const claimed = ({ categories, claimType }: LogCard) => {
  if (claimType === 'challenge') return categories.join(', ')
  return claimType === 'special'
    ? `Special · ${categories.join(', ')}`
    : 'Regular'
}

export const claimLine = (card: LogCard) =>
  card.kind === 'false_call'
    ? (card.checkNote ?? FALSE_CALL_FALLBACK)
    : claimed(card)

export const viewerClaimLine = (card: LogCard) =>
  card.kind === 'false_call' ? `Claimed: ${claimed(card)}` : claimed(card)

export const viewerNote = (card: LogCard) => {
  if (card.kind === 'false_call') return card.checkNote ?? FALSE_CALL_FALLBACK
  if (card.kind !== 'flagged') return null
  return (
    card.checkNote ??
    `Our photo check wasn't sure about this one. The ${signedPoints(card.points)} still counts while an admin takes a look.`
  )
}

export const timeText = (takenAt: string) => clock.format(new Date(takenAt))

export const viewerTime = (takenAt: string) => {
  const at = new Date(takenAt)
  return `${weekday.format(at)} ${clock.format(at)}`
}

export const dayHeader = (takenAt: string, now: number) => {
  const at = Date.parse(takenAt)
  const day = pacificDay(at)
  const today = pacificDay(now)
  const name = weekday.format(at)
  if (day === today) return `Today · ${name}`
  if (day === dayBefore(today)) return `Yesterday · ${name}`
  return name
}

const challengeSuffix = (cards: LogCard[], weekHasChallenge: boolean) => {
  const name = cards.find((card) => card.challengeName)?.challengeName
  if (name) return ` · ${name}`
  const allWaiting = cards.every((card) => card.kind === 'waiting')
  return weekHasChallenge && !allWaiting ? ' · Weekly' : ''
}

export const groupByDay = (cards: LogCard[], now: number): DayGroup[] => {
  const sorted = [...cards].sort(
    (a, b) => Date.parse(b.takenAt) - Date.parse(a.takenAt),
  )
  const days: DayGroup[] = []
  for (const card of sorted) {
    const header = dayHeader(card.takenAt, now)
    const last = days.at(-1)
    if (last?.header === header) last.cards.push(card)
    else days.push({ cards: [card], header })
  }
  const weekHasChallenge = cards.some((card) => card.challengeName)
  return days.map((day) => ({
    cards: day.cards,
    header: `${day.header}${challengeSuffix(day.cards, weekHasChallenge)}`,
  }))
}
