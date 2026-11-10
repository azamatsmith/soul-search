const MINUS = '−'

export const signedPoints = (points: number) =>
  points < 0 ? `${MINUS}${-points}` : `+${points}`
