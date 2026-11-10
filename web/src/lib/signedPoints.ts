const MINUS = '−'

export const signedPoints = (points: number) => {
  if (points === 0) return '0'
  return points < 0 ? `${MINUS}${-points}` : `+${points}`
}
