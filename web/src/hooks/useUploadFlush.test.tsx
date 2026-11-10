import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushUploads } from '../lib/uploadQueue'
import { useUploadFlush } from './useUploadFlush'

vi.mock('../lib/uploadQueue', () => ({
  flushUploads: vi.fn(() => Promise.resolve({ kept: 0, sent: 0 })),
}))

describe('useUploadFlush', () => {
  afterEach(() => {
    vi.mocked(flushUploads).mockClear()
  })

  it('sends waiting photos when the app opens', () => {
    renderHook(() => useUploadFlush('p1'))

    expect(flushUploads).toHaveBeenCalledTimes(1)
    expect(flushUploads).toHaveBeenCalledWith('p1')
  })

  it('sends again when the phone is back online, until unmounted', () => {
    const { unmount } = renderHook(() => useUploadFlush('p1'))

    window.dispatchEvent(new Event('online'))
    expect(flushUploads).toHaveBeenCalledTimes(2)

    unmount()
    window.dispatchEvent(new Event('online'))
    expect(flushUploads).toHaveBeenCalledTimes(2)
  })
})
