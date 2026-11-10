import type { Leaderboard } from './api'
import { weekRange } from './homeCopy'

const players = (count: number) =>
  `${count} ${count === 1 ? 'player' : 'players'}`

export const leaderboardKicker = (board: Leaderboard) => {
  if (board.scope === 'week' && board.starts_at && board.ends_at) {
    const range = weekRange(board.starts_at, board.ends_at)
    return `${range} · ${players(board.total_players)} · Resets Monday`
  }
  return `Since you joined · ${players(board.total_players)}`
}
