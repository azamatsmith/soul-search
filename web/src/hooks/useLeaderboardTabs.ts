import { useState } from 'react'
import { getLeaderboard, getPeriod, type Rules } from '../lib/api'
import { useApiResource } from './useApiResource'

export type LeaderboardTab = 'all' | 'first'

const loadWeek = () => getLeaderboard('week')
const loadAll = () => getLeaderboard('all')
const loadChallenge = () => getLeaderboard('challenge')
const EVERY_30_SECONDS = { refreshEvery: 30_000 }

export const useLeaderboardTabs = () => {
  const [tab, setTab] = useState<LeaderboardTab>('first')
  const period = useApiResource(['period'], getPeriod, EVERY_30_SECONDS)
  const periodIsChallenge = period.data?.kind === 'challenge'
  const week = useApiResource(
    ['leaderboard', 'week'],
    loadWeek,
    EVERY_30_SECONDS,
  )
  const all = useApiResource(['leaderboard', 'all'], loadAll, EVERY_30_SECONDS)
  const challenge = useApiResource(
    ['leaderboard', 'challenge'],
    loadChallenge,
    {
      ...EVERY_30_SECONDS,
      enabled: periodIsChallenge,
    },
  )
  const showChallenge = periodIsChallenge && challenge.error !== 'no_challenge'
  const challengeName = showChallenge ? (period.data?.name ?? null) : null
  const rules: Rules | null = showChallenge
    ? (period.data?.rules ?? null)
    : null
  const first = showChallenge ? challenge : week

  return {
    board: tab === 'all' ? all : first,
    challengeName,
    options: [
      { label: challengeName ?? 'This week', value: 'first' as const },
      { label: 'All time', value: 'all' as const },
    ],
    rules,
    setTab,
    tab,
  }
}
