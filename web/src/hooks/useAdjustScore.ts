import { useState } from 'react'
import { useNavigate } from 'react-router'
import { getScores, postScoreAdjustment } from '../lib/api'
import { useApiResource } from './useApiResource'

export const useAdjustScore = () => {
  const scores = useApiResource(['scores'], getScores)
  const navigate = useNavigate()
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [change, setChange] = useState(0)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const player =
    scores.data?.players.find((entry) => entry.id === playerId) ?? null
  const canSave =
    player !== null && change !== 0 && reason.trim() !== '' && !saving

  const save = async () => {
    if (!player || !canSave) return
    setSaving(true)
    setSaveFailed(false)
    const result = await postScoreAdjustment({
      change,
      player_id: player.id,
      reason: reason.trim(),
    })
    setSaving(false)
    if (result.ok) void navigate('/admin')
    else setSaveFailed(true)
  }

  return {
    canSave,
    change,
    player,
    reason,
    retry: scores.retry,
    save,
    saveFailed,
    scores: scores.data,
    setChange,
    setPlayerId,
    setReason,
    status: scores.status,
  }
}
