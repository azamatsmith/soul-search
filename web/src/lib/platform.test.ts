import { afterEach, describe, expect, it, vi } from 'vitest'
import { isAndroid } from './platform'

const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'

const stubUserAgent = (userAgent: string) =>
  vi.stubGlobal('navigator', { ...navigator, userAgent })

describe('isAndroid', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is true on an Android phone', () => {
    stubUserAgent(ANDROID_UA)
    expect(isAndroid()).toBe(true)
  })

  it('is false on an iPhone', () => {
    stubUserAgent(IPHONE_UA)
    expect(isAndroid()).toBe(false)
  })
})
