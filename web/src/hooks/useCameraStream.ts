import { useEffect, useState } from 'react'
import { openCamera, stopCamera } from '../lib/camera'

export type CameraStatus =
  'off' | 'starting' | 'live' | 'denied' | 'unavailable'

export interface CameraStream {
  status: CameraStatus
  stream: MediaStream | null
}

const OFF: CameraStream = { status: 'off', stream: null }
const STARTING: CameraStream = { status: 'starting', stream: null }

export const useCameraStream = (
  enabled: boolean,
  attempt: number,
): CameraStream => {
  const [camera, setCamera] = useState<CameraStream | null>(null)

  useEffect(() => {
    if (!enabled) return
    let current = true
    let opened: MediaStream | null = null
    openCamera().then((result) => {
      if (!result.ok) {
        if (current) setCamera({ status: result.reason, stream: null })
        return
      }
      if (!current) {
        stopCamera(result.stream)
        return
      }
      opened = result.stream
      setCamera({ status: 'live', stream: result.stream })
    })
    return () => {
      current = false
      if (opened) stopCamera(opened)
      setCamera(null)
    }
  }, [enabled, attempt])

  if (!enabled) return OFF
  return camera ?? STARTING
}
