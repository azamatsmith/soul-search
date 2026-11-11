import type { Leaderboard, Rules } from './api'
import { endsAtText } from './challengeTime'
import { pointsText, sortedBonuses } from './claim'
import { weekRange } from './homeCopy'

const players = (count: number) =>
  `${count} ${count === 1 ? 'player' : 'players'}`

export const leaderboardKicker = (board: Leaderboard, now: number) => {
  if (board.scope === 'challenge' && board.ends_at) {
    return `Challenge · ${endsAtText(board.ends_at, now)}`
  }
  if (board.scope === 'week' && board.starts_at && board.ends_at) {
    const range = weekRange(board.starts_at, board.ends_at)
    return `${range} · ${players(board.total_players)} · Resets Monday`
  }
  return `Since you joined · ${players(board.total_players)}`
}

export const rulesText = (rules: Rules) =>
  [
    `Regular ${pointsText(rules.regular)}`,
    `Special ${pointsText(rules.special)}`,
    ...sortedBonuses(rules).map(
      ([name, points]) => `${name} ${pointsText(points)}`,
    ),
    `False call ${pointsText(rules.false_call)}`,
  ].reduce(
    (text, part, index) =>
      index === 0 ? `Rules: ${part}` : `${text} · ${part}`,
    '',
  )
