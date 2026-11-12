import type { HistoryEntry, HistoryType } from './api'
import { dayIn, formattersFor, PACIFIC } from './zonedTime'
import { signedPoints } from './signedPoints'

const { clock, monthDay, weekday } = formattersFor(PACIFIC)

type Snapshot = Record<string, unknown> | null

const DAY_MS = 24 * 60 * 60 * 1000

const TAGS: Record<HistoryType, string> = {
  challenge: 'Challenge',
  emails: 'Emails',
  photo: 'Photo',
  rules: 'Rules',
  score: 'Score',
}

const RULE_LABELS = [
  ['regular', 'Regular'],
  ['special', 'Special'],
  ['false_call', 'False call'],
] as const

const numberOf = (snapshot: Snapshot, key: string) => {
  const value = snapshot?.[key]
  return typeof value === 'number' ? value : 0
}

const textOf = (snapshot: Snapshot, key: string) => {
  const value = snapshot?.[key]
  return typeof value === 'string' ? value : ''
}

const listOf = (snapshot: Snapshot, key: string) => {
  const value = snapshot?.[key]
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

const joinAll = (parts: string[]) =>
  parts.length < 2
    ? parts.join('')
    : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`

const quoted = (reason: string) =>
  /[.!?]$/.test(reason) ? `“${reason}”` : `“${reason}.”`

const claimName = (snapshot: Snapshot) =>
  textOf(snapshot, 'claim_type') === 'special' ? 'Special' : 'Regular'

const pointsText = (snapshot: Snapshot) =>
  `(${signedPoints(numberOf(snapshot, 'points'))})`

const claimText = (snapshot: Snapshot) =>
  `${claimName(snapshot)} ${pointsText(snapshot)}`

const sameClaim = (before: Snapshot, after: Snapshot) =>
  textOf(before, 'claim_type') === textOf(after, 'claim_type') &&
  numberOf(before, 'points') === numberOf(after, 'points') &&
  listOf(before, 'categories').join() === listOf(after, 'categories').join()

const photoLine = ({ after, before, target_name }: HistoryEntry) => {
  const owner = `${target_name ?? 'a player'}'s`
  const points = pointsText(after)
  const wasFalseCall = textOf(before, 'status') === 'false_call'
  if (textOf(after, 'status') === 'false_call') {
    return wasFalseCall
      ? `kept ${owner} false call ${points}.`
      : `marked ${owner} photo as a false call ${points}.`
  }
  if (wasFalseCall) return `restored ${owner} photo as ${claimText(after)}.`
  if (sameClaim(before, after))
    return `kept ${owner} ${claimName(after)} claim ${points} and cleared the flag.`
  return `changed ${owner} photo from ${claimText(before)} to ${claimText(after)}.`
}

const rulesLine = ({ after, before }: HistoryEntry) => {
  const points = RULE_LABELS.filter(
    ([key]) => numberOf(before, key) !== numberOf(after, key),
  ).map(
    ([key, label]) =>
      `changed the ${label} points from ${signedPoints(numberOf(before, key))} to ${signedPoints(numberOf(after, key))}`,
  )
  const oldCategories = listOf(before, 'categories')
  const newCategories = listOf(after, 'categories')
  const added = newCategories
    .filter((category) => !oldCategories.includes(category))
    .map((category) => `added the category “${category}”`)
  const removed = oldCategories
    .filter((category) => !newCategories.includes(category))
    .map((category) => `removed the category “${category}”`)
  const changes = [...points, ...added, ...removed]
  if (changes.length === 0)
    return 'saved the points and categories with no changes.'
  return `${joinAll(changes)}.`
}

const scoreLine = ({ after, reason, target_name }: HistoryEntry) => {
  const change = signedPoints(numberOf(after, 'change'))
  const line = `gave ${target_name ?? 'a player'} ${change}.`
  return reason ? `${line} ${quoted(reason)}` : line
}

const emailsLine = ({ after, before }: HistoryEntry) =>
  after
    ? `added ${textOf(after, 'email')} to the allowed emails.`
    : `removed ${textOf(before, 'email')} from the allowed emails.`

const challengeLine = ({ after, before }: HistoryEntry) => {
  const name = textOf(after, 'name') || textOf(before, 'name')
  if (!name) return 'changed a challenge.'
  if (!before) return `created ${name}.`
  if (!after) return `deleted ${name}.`
  return `changed ${name}.`
}

export const historyLine = (entry: HistoryEntry) => {
  switch (entry.type) {
    case 'challenge':
      return challengeLine(entry)
    case 'emails':
      return emailsLine(entry)
    case 'photo':
      return photoLine(entry)
    case 'rules':
      return rulesLine(entry)
    case 'score':
      return scoreLine(entry)
  }
}

export const historyTag = (type: HistoryType) => TAGS[type]

export const historyTime = (createdAt: string, now: number) => {
  const at = Date.parse(createdAt)
  const daysAgo =
    (Date.parse(dayIn(now, PACIFIC)) - Date.parse(dayIn(at, PACIFIC))) / DAY_MS
  const time = clock.format(at)
  if (daysAgo === 0) return `Today ${time}`
  if (daysAgo < 7) return `${weekday.format(at)} ${time}`
  return `${monthDay.format(at)} ${time}`
}
