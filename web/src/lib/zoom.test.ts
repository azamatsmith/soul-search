import { describe, expect, it } from 'vitest'
import { clampZoom, pan, pinch, toggleZoom, UNZOOMED } from './zoom'

const SIZE = { height: 400, width: 300 }

describe('clampZoom', () => {
  it('keeps the scale between 1x and 4x', () => {
    expect(clampZoom({ scale: 0.5, x: 0, y: 0 }, SIZE).scale).toBe(1)
    expect(clampZoom({ scale: 6, x: 0, y: 0 }, SIZE).scale).toBe(4)
  })

  it('keeps the photo covering the frame', () => {
    expect(clampZoom({ scale: 2, x: 500, y: -500 }, SIZE)).toEqual({
      scale: 2,
      x: 150,
      y: -200,
    })
  })

  it('centers the photo at 1x', () => {
    expect(clampZoom({ scale: 1, x: 40, y: 40 }, SIZE)).toEqual(UNZOOMED)
  })
})

describe('pinch', () => {
  it('scales by how far the fingers spread', () => {
    const zoomed = pinch(
      UNZOOMED,
      { distance: 100, mid: { x: 0, y: 0 } },
      { distance: 200, mid: { x: 0, y: 0 } },
      SIZE,
    )
    expect(zoomed).toEqual({ scale: 2, x: 0, y: 0 })
  })

  it('keeps the point between the fingers in place', () => {
    const zoomed = pinch(
      UNZOOMED,
      { distance: 100, mid: { x: 50, y: -40 } },
      { distance: 200, mid: { x: 50, y: -40 } },
      SIZE,
    )
    expect(zoomed).toEqual({ scale: 2, x: -50, y: 40 })
  })
})

describe('pan', () => {
  it('does nothing at 1x', () => {
    expect(pan(UNZOOMED, { x: 0, y: 0 }, { x: 80, y: 80 }, SIZE)).toEqual(
      UNZOOMED,
    )
  })

  it('moves a zoomed photo, within bounds', () => {
    const start = { scale: 2, x: 0, y: 0 }
    expect(pan(start, { x: 0, y: 0 }, { x: 30, y: -500 }, SIZE)).toEqual({
      scale: 2,
      x: 30,
      y: -200,
    })
  })
})

describe('toggleZoom', () => {
  it('zooms to 2x around the tapped point', () => {
    expect(toggleZoom(UNZOOMED, { x: 60, y: -20 }, SIZE)).toEqual({
      scale: 2,
      x: -60,
      y: 20,
    })
  })

  it('zooms back out', () => {
    expect(
      toggleZoom({ scale: 3, x: 10, y: 10 }, { x: 0, y: 0 }, SIZE),
    ).toEqual(UNZOOMED)
  })
})
