import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLocation } from './useLocation'

type Success = (position: GeolocationPosition) => void
type Failure = (error: GeolocationPositionError) => void

const stubGeolocation = () => {
  const calls: { success: Success; failure: Failure; options: unknown }[] = []
  const getCurrentPosition = vi.fn(
    (success: Success, failure: Failure, options: unknown) => {
      calls.push({ failure, options, success })
    },
  )
  vi.stubGlobal('navigator', {
    ...navigator,
    geolocation: { getCurrentPosition },
  })
  return { calls, getCurrentPosition }
}

const position = (latitude: number, longitude: number) =>
  ({ coords: { latitude, longitude } }) as GeolocationPosition

describe('useLocation', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('waits until it is asked', () => {
    const { getCurrentPosition } = stubGeolocation()

    renderHook(() => useLocation(false))

    expect(getCurrentPosition).not.toHaveBeenCalled()
  })

  it('asks once with a short timeout and keeps the result', () => {
    const { calls, getCurrentPosition } = stubGeolocation()
    const { rerender, result } = renderHook(({ on }) => useLocation(on), {
      initialProps: { on: true },
    })
    rerender({ on: true })

    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(calls[0].options).toEqual({
      enableHighAccuracy: true,
      maximumAge: 60_000,
      timeout: 5_000,
    })
    expect(result.current).toBeNull()

    act(() => calls[0].success(position(47.6, -122.3)))

    expect(result.current).toEqual({ latitude: 47.6, longitude: -122.3 })
  })

  it('stays empty when the player says no', () => {
    const { calls } = stubGeolocation()
    const { result } = renderHook(() => useLocation(true))

    act(() => calls[0].failure({ code: 1 } as GeolocationPositionError))

    expect(result.current).toBeNull()
  })

  it('stays empty without geolocation support', () => {
    vi.stubGlobal('navigator', { ...navigator, geolocation: undefined })

    const { result } = renderHook(() => useLocation(true))

    expect(result.current).toBeNull()
  })
})
