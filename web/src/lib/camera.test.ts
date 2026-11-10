import { afterEach, describe, expect, it, vi } from 'vitest'
import { hasSeenCameraIntro, markCameraIntroSeen, openCamera } from './camera'

const stubGetUserMedia = (impl: () => Promise<MediaStream>) => {
  const getUserMedia = vi.fn(impl)
  vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia } })
  return getUserMedia
}

const domError = (name: string) => new DOMException('nope', name)

describe('openCamera', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('asks for the back camera without audio', async () => {
    const stream = {} as MediaStream
    const getUserMedia = stubGetUserMedia(() => Promise.resolve(stream))

    expect(await openCamera()).toEqual({ ok: true, stream })
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        height: { ideal: 1440 },
        width: { ideal: 1920 },
      },
    })
  })

  it.each(['NotAllowedError', 'SecurityError'])(
    'reports %s as denied',
    async (name) => {
      stubGetUserMedia(() => Promise.reject(domError(name)))

      expect(await openCamera()).toEqual({ ok: false, reason: 'denied' })
    },
  )

  it('reports other failures as unavailable', async () => {
    stubGetUserMedia(() => Promise.reject(domError('NotReadableError')))

    expect(await openCamera()).toEqual({ ok: false, reason: 'unavailable' })
  })

  it('reports a browser without the camera API as unavailable', async () => {
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: undefined })

    expect(await openCamera()).toEqual({ ok: false, reason: 'unavailable' })
  })
})

describe('camera intro', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('is unseen until marked', () => {
    expect(hasSeenCameraIntro()).toBe(false)
    markCameraIntroSeen()
    expect(hasSeenCameraIntro()).toBe(true)
  })

  it('counts as unseen when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(() => markCameraIntroSeen()).not.toThrow()
    expect(hasSeenCameraIntro()).toBe(false)
  })
})
