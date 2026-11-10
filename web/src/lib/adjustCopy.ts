import type { PlayerScore, Scores } from './api'
import { signedPoints } from './signedPoints'

const plain = (points: number) =>
  points > 0 ? String(points) : signedPoints(points)

export const periodKicker = ({ period }: Scores) =>
  period.kind === 'challenge' && period.name ? period.name : 'This week'

export const pointsNow = (player: PlayerScore, change: number) =>
  change === 0
    ? plain(player.points)
    : `${plain(player.points)} → ${plain(player.points + change)}`

export const saveLabel = (player: PlayerScore | null, change: number) =>
  player && change !== 0
    ? `Save (${player.display_name} ${signedPoints(change)})`
    : 'Save'
