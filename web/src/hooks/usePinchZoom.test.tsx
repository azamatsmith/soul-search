import { act, renderHook } from '@testing-library/react'
import type { PointerEvent } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { usePinchZoom } from './usePinchZoom'

const RECT = { height: 400, left: 0, top: 0, width: 300 }
const CENTER = { x: 150, y: 200 }

const pointer = (
  pointerId: number,
  x: number,
  y: number,
  timeStamp = 0,
): PointerEvent<HTMLElement> => {
  const fake: unknown = {
    clientX: CENTER.x + x,
    clientY: CENTER.y + y,
    currentTarget: {
      getBoundingClientRect: () => RECT,
      setPointerCapture: vi.fn(),
    },
    pointerId,
    timeStamp,
  }
  return fake as PointerEvent<HTMLElement>
}

type Hook = ReturnType<typeof usePinchZoom>
type Handler = keyof Hook['handlers']

const send = (
  result: { current: Hook },
  handler: Handler,
  event: PointerEvent<HTMLElement>,
) => act(() => result.current.handlers[handler](event))

const tap = (result: { current: Hook }, x: number, y: number, at: number) => {
  send(result, 'onPointerDown', pointer(1, x, y, at))
  send(result, 'onPointerUp', pointer(1, x, y, at + 50))
}

describe('usePinchZoom', () => {
  it('starts unzoomed', () => {
    const { result } = renderHook(() => usePinchZoom())

    expect(result.current.zoomed).toBe(false)
    expect(result.current.style.transform).toBe('translate(0px, 0px) scale(1)')
  })

  it('pinches to zoom', () => {
    const { result } = renderHook(() => usePinchZoom())

    send(result, 'onPointerDown', pointer(1, -50, 0))
    send(result, 'onPointerDown', pointer(2, 50, 0))
    send(result, 'onPointerMove', pointer(1, -100, 0))
    send(result, 'onPointerMove', pointer(2, 100, 0))

    expect(result.current.zoomed).toBe(true)
    expect(result.current.style.transform).toBe('translate(0px, 0px) scale(2)')
  })

  it('double tap zooms in and back out', () => {
    const { result } = renderHook(() => usePinchZoom())

    tap(result, 60, -20, 0)
    tap(result, 60, -20, 200)
    expect(result.current.style.transform).toBe(
      'translate(-60px, 20px) scale(2)',
    )

    tap(result, 0, 0, 1000)
    tap(result, 0, 0, 1200)
    expect(result.current.zoomed).toBe(false)
  })

  it('ignores two taps that are too far apart in time', () => {
    const { result } = renderHook(() => usePinchZoom())

    tap(result, 0, 0, 0)
    tap(result, 0, 0, 600)

    expect(result.current.zoomed).toBe(false)
  })

  it('pans only while zoomed', () => {
    const { result } = renderHook(() => usePinchZoom())

    send(result, 'onPointerDown', pointer(1, 0, 0))
    send(result, 'onPointerMove', pointer(1, 40, 0))
    send(result, 'onPointerUp', pointer(1, 40, 0))
    expect(result.current.zoomed).toBe(false)

    tap(result, 0, 0, 1000)
    tap(result, 0, 0, 1100)
    send(result, 'onPointerDown', pointer(1, 0, 0, 2000))
    send(result, 'onPointerMove', pointer(1, 40, -30, 2010))

    expect(result.current.style.transform).toBe(
      'translate(40px, -30px) scale(2)',
    )
  })
})
