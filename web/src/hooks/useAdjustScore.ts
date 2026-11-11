import { useState } from 'react'
import { useNavigate } from 'react-router'
import { getScores, postScoreAdjustment } from '../lib/api'
import { useApiResource } from './useApiResource'
import { useRefreshAll } from './useRefreshAll'
import { useSaveAction } from './useSaveAction'

export const useAdjustScore = () => {
  const scores = useApiResource(['scores'], getScores)
  const navigate = useNavigate()
  const refreshAll = useRefreshAll()
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [change, setChange] = useState(0)
  const [reason, setReason] = useState('')
  const { failure, run, saving } = useSaveAction()
  const player =
    scores.data?.players.find((entry) => entry.id === playerId) ?? null
  const canSave =
    player !== null && change !== 0 && reason.trim() !== '' && !saving

  const save = async () => {
    if (!player || !canSave) return
    const result = await run(() =>
      postScoreAdjustment({
        change,
        player_id: player.id,
        reason: reason.trim(),
      }),
    )
    if (!result.ok) return
    refreshAll()
    void navigate('/admin')
  }

  return {
    canSave,
    change,
    player,
    reason,
    retry: scores.retry,
    save,
    saveFailed: failure !== null,
    scores: scores.data,
    setChange,
    setPlayerId,
    setReason,
    status: scores.status,
  }
}
