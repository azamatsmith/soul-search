import { isSafeToUpdate } from './updateSafety'

export interface RegisterUpdatesOptions {
  onNeedRefresh: () => void
  onRegisteredSW: (
    url: string,
    registration: ServiceWorkerRegistration | undefined,
  ) => void
}

export type RegisterUpdates = (
  options: RegisterUpdatesOptions,
) => (reloadPage?: boolean) => Promise<void>

export interface AppUpdatesOptions {
  intervalMs?: number
  pathname: () => string
  register: RegisterUpdates
}

const HOUR = 60 * 60 * 1000

export const startAppUpdates = ({
  intervalMs = HOUR,
  pathname,
  register,
}: AppUpdatesOptions) => {
  let registration: ServiceWorkerRegistration | undefined
  let waiting = false
  let timer: ReturnType<typeof setInterval> | undefined

  const check = () => {
    if (!registration || !navigator.onLine) return
    registration.update().catch(() => {})
  }

  const applyIfSafe = () => {
    if (waiting && isSafeToUpdate(pathname())) void updateSW(true)
  }

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') check()
    applyIfSafe()
  }

  const updateSW = register({
    onNeedRefresh: () => {
      waiting = true
    },
    onRegisteredSW: (_url, registered) => {
      registration = registered
      timer = setInterval(check, intervalMs)
    },
  })

  document.addEventListener('visibilitychange', handleVisibility)

  return () => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', handleVisibility)
  }
}
