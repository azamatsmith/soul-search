const INTRO_KEY = 'soul-search:camera-intro-seen'

export type OpenCameraResult =
  | { ok: true; stream: MediaStream }
  | { ok: false; reason: 'denied' | 'unavailable' }

const DENIED = new Set(['NotAllowedError', 'SecurityError'])

export const openCamera = async (): Promise<OpenCameraResult> => {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, reason: 'unavailable' }
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        height: { ideal: 1440 },
        width: { ideal: 1920 },
      },
    })
    return { ok: true, stream }
  } catch (error) {
    const denied = error instanceof DOMException && DENIED.has(error.name)
    return { ok: false, reason: denied ? 'denied' : 'unavailable' }
  }
}

export const stopCamera = (stream: MediaStream) => {
  stream.getTracks().forEach((track) => track.stop())
}

export const hasSeenCameraIntro = () => {
  try {
    return localStorage.getItem(INTRO_KEY) === 'yes'
  } catch {
    return false
  }
}

export const markCameraIntroSeen = () => {
  try {
    localStorage.setItem(INTRO_KEY, 'yes')
  } catch {
    return
  }
}
