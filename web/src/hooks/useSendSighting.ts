import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  postSighting,
  type NewSighting,
  type PostSightingResult,
} from '../lib/api'
import { refreshAfterSighting } from '../lib/refreshAfterSighting'
import { deviceQueue, isRejectedForGood } from '../lib/uploadQueue'

export type SendStatus = 'idle' | 'sending' | 'saved' | 'failed' | 'rejected'

export const useSendSighting = (playerId: string) => {
  const client = useQueryClient()
  const [status, setStatus] = useState<SendStatus>('idle')
  const [saved, setSaved] = useState<PostSightingResult | null>(null)
  const [last, setLast] = useState<NewSighting | null>(null)
  const [progress, setProgress] = useState(0)

  const post = async (sighting: NewSighting) => {
    setStatus('sending')
    setProgress(0)
    const result = await postSighting(sighting, setProgress)
    if (result.ok || isRejectedForGood(result)) {
      await deviceQueue.remove(sighting.id).catch(() => {})
    }
    if (result.ok) {
      setSaved(result.data)
      setStatus('saved')
      refreshAfterSighting(client)
    } else {
      setStatus(isRejectedForGood(result) ? 'rejected' : 'failed')
    }
  }

  const send = async (sighting: NewSighting) => {
    setLast(sighting)
    await deviceQueue
      .add({ ...sighting, createdAt: Date.now(), playerId })
      .catch(() => {})
    await post(sighting)
  }

  const retry = async () => {
    if (last) await post(last)
  }

  const reset = () => {
    setStatus('idle')
    setSaved(null)
    setLast(null)
    setProgress(0)
  }

  return { progress, reset, retry, saved, send, status }
}
