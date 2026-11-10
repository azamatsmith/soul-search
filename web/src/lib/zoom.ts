export interface Point {
  x: number
  y: number
}

export interface Size {
  height: number
  width: number
}

export interface Zoom {
  scale: number
  x: number
  y: number
}

export interface Touches {
  distance: number
  mid: Point
}

export const UNZOOMED: Zoom = { scale: 1, x: 0, y: 0 }

const MAX_SCALE = 4
const TAP_SCALE = 2

const clamp = (value: number, limit: number) =>
  Math.min(limit, Math.max(-limit, value)) || 0

export const clampZoom = (zoom: Zoom, size: Size): Zoom => {
  const scale = Math.min(MAX_SCALE, Math.max(1, zoom.scale))
  if (scale === 1) return UNZOOMED
  return {
    scale,
    x: clamp(zoom.x, ((scale - 1) * size.width) / 2),
    y: clamp(zoom.y, ((scale - 1) * size.height) / 2),
  }
}

const zoomAround = (start: Zoom, from: Point, to: Point, scale: number) => {
  const ratio = scale / start.scale
  return {
    scale,
    x: to.x - ratio * (from.x - start.x),
    y: to.y - ratio * (from.y - start.y),
  }
}

export const pinch = (
  start: Zoom,
  from: Touches,
  to: Touches,
  size: Size,
): Zoom => {
  const scale = Math.min(
    MAX_SCALE,
    Math.max(1, (start.scale * to.distance) / from.distance),
  )
  return clampZoom(zoomAround(start, from.mid, to.mid, scale), size)
}

export const pan = (start: Zoom, from: Point, to: Point, size: Size): Zoom =>
  start.scale === 1
    ? start
    : clampZoom(
        { ...start, x: start.x + to.x - from.x, y: start.y + to.y - from.y },
        size,
      )

export const toggleZoom = (zoom: Zoom, at: Point, size: Size): Zoom =>
  zoom.scale > 1
    ? UNZOOMED
    : clampZoom(zoomAround(zoom, at, at, TAP_SCALE), size)
