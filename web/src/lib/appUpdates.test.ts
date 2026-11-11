import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type RegisterUpdates, startAppUpdates } from './appUpdates'

const HOUR = 3_600_000

let visibility: DocumentVisibilityState = 'visible'
let path = '/'
let online = true

const becomes = async (state: DocumentVisibilityState) => {
  visibility = state
  document.dispatchEvent(new Event('visibilitychange'))
  await Promise.resolve()
}

const setup = () => {
  const registration = { update: vi.fn(() => Promise.resolve()) }
  const updateSW = vi.fn(() => Promise.resolve())
  let needRefresh = () => {}
  const register: RegisterUpdates = ({ onNeedRefresh, onRegisteredSW }) => {
    needRefresh = onNeedRefresh
    onRegisteredSW(
      '/sw.js',
      registration as unknown as ServiceWorkerRegistration,
    )
    return updateSW
  }
  const stop = startAppUpdates({ pathname: () => path, register })
  return { needRefresh: () => needRefresh(), registration, stop, updateSW }
}

describe('startAppUpdates', () => {
  let stops: (() => void)[] = []

  const start = () => {
    const app = setup()
    stops.push(app.stop)
    return app
  }

  beforeEach(() => {
    vi.useFakeTimers()
    visibility = 'visible'
    path = '/'
    online = true
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
      () => visibility,
    )
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online)
  })

  afterEach(() => {
    stops.forEach((stop) => stop())
    stops = []
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('checks for an update every hour', () => {
    const { registration } = start()

    vi.advanceTimersByTime(HOUR - 1)
    expect(registration.update).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(registration.update).toHaveBeenCalledTimes(1)
  })

  it('skips the hourly check while offline', () => {
    const { registration } = start()
    online = false

    vi.advanceTimersByTime(HOUR)

    expect(registration.update).not.toHaveBeenCalled()
  })

  it('checks for an update when the app comes back', async () => {
    const { registration } = start()

    await becomes('hidden')
    await becomes('visible')

    expect(registration.update).toHaveBeenCalledTimes(1)
  })

  it('updates while hidden on a safe screen', async () => {
    const { needRefresh, updateSW } = start()
    path = '/scores'
    needRefresh()

    await becomes('hidden')

    expect(updateSW).toHaveBeenCalledWith(true)
  })

  it('waits during a photo and updates on the next safe return', async () => {
    const { needRefresh, updateSW } = start()
    path = '/capture'
    needRefresh()

    await becomes('hidden')
    await becomes('visible')
    expect(updateSW).not.toHaveBeenCalled()

    path = '/'
    await becomes('hidden')
    expect(updateSW).toHaveBeenCalledWith(true)
  })

  it('never reloads when no update is waiting', async () => {
    const { updateSW } = start()

    await becomes('hidden')
    await becomes('visible')

    expect(updateSW).not.toHaveBeenCalled()
  })

  it('ignores a failed check', async () => {
    const { registration } = start()
    registration.update.mockRejectedValue(new Error('offline'))

    await becomes('visible')
    await vi.advanceTimersByTimeAsync(HOUR)

    expect(registration.update).toHaveBeenCalledTimes(2)
  })

  it('stops checking once stopped', async () => {
    const { registration, stop } = start()
    stop()

    vi.advanceTimersByTime(HOUR)
    await becomes('visible')

    expect(registration.update).not.toHaveBeenCalled()
  })
})
