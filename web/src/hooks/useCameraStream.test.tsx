import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { openCamera } from '../lib/camera'
import { useCameraStream } from './useCameraStream'

vi.mock('../lib/camera', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/camera')>()),
  openCamera: vi.fn(),
}))

const fakeStream = () => {
  const stop = vi.fn()
  const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream
  return { stop, stream }
}

describe('useCameraStream', () => {
  afterEach(() => {
    vi.mocked(openCamera).mockReset()
  })

  it('does nothing while off', () => {
    const { result } = renderHook(() => useCameraStream(false, 0))

    expect(result.current).toEqual({ status: 'off', stream: null })
    expect(openCamera).not.toHaveBeenCalled()
  })

  it('goes live, then stops the camera when turned off', async () => {
    const { stop, stream } = fakeStream()
    vi.mocked(openCamera).mockResolvedValue({ ok: true, stream })
    const { rerender, result } = renderHook(
      ({ on }) => useCameraStream(on, 0),
      { initialProps: { on: true } },
    )

    expect(result.current.status).toBe('starting')
    await waitFor(() => expect(result.current.status).toBe('live'))
    expect(result.current.stream).toBe(stream)

    rerender({ on: false })

    expect(stop).toHaveBeenCalled()
    expect(result.current).toEqual({ status: 'off', stream: null })
  })

  it('stops a camera that opens after unmount', async () => {
    const { stop, stream } = fakeStream()
    let open: (value: { ok: true; stream: MediaStream }) => void = () => {}
    vi.mocked(openCamera).mockReturnValue(
      new Promise((resolve) => (open = resolve)),
    )
    const { unmount } = renderHook(() => useCameraStream(true, 0))

    unmount()
    open({ ok: true, stream })

    await waitFor(() => expect(stop).toHaveBeenCalled())
  })

  it('reports a denied camera and tries again on a new attempt', async () => {
    vi.mocked(openCamera)
      .mockResolvedValueOnce({ ok: false, reason: 'denied' })
      .mockResolvedValueOnce({ ok: true, stream: fakeStream().stream })
    const { rerender, result } = renderHook(
      ({ attempt }) => useCameraStream(true, attempt),
      { initialProps: { attempt: 0 } },
    )

    await waitFor(() => expect(result.current.status).toBe('denied'))

    rerender({ attempt: 1 })

    await waitFor(() => expect(result.current.status).toBe('live'))
  })
})
