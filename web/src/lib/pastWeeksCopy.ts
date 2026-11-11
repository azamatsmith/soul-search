import type { MyResult } from './api'

const SUFFIXES: Record<string, string> = { one: 'st', two: 'nd', few: 'rd' }
const rules = new Intl.PluralRules('en-US', { type: 'ordinal' })

export const ordinal = (rank: number) =>
  `${rank}${SUFFIXES[rules.select(rank)] ?? 'th'}`

export const youResult = (me: MyResult | null) => {
  if (!me) return 'You didn’t score this week'
  if (me.rank === 1) return 'You won this week!'
  const points = `${me.points} ${me.points === 1 ? 'pt' : 'pts'}`
  return `You: ${ordinal(me.rank)} · ${points}`
}
