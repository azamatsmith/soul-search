import { type PointerEvent, useRef, useState } from 'react'
import {
  pan,
  pinch,
  type Point,
  type Size,
  toggleZoom,
  type Touches,
  UNZOOMED,
  type Zoom,
} from '../lib/zoom'

const DOUBLE_TAP_MS = 300
const TAP_SLOP = 10

interface Gesture {
  moved: boolean
  points: Point[]
  zoom: Zoom
}

const touches = ([a, b]: Point[]): Touches => ({
  distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
  mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
})

const measure = (event: PointerEvent<HTMLElement>) => {
  const rect = event.currentTarget.getBoundingClientRect()
  const size: Size = { height: rect.height, width: rect.width }
  const point: Point = {
    x: event.clientX - (rect.left + rect.width / 2),
    y: event.clientY - (rect.top + rect.height / 2),
  }
  return { point, size }
}

export const usePinchZoom = () => {
  const [zoom, setZoom] = useState(UNZOOMED)
  const zoomRef = useRef(UNZOOMED)
  const pointers = useRef(new Map<number, Point>())
  const gesture = useRef<Gesture | null>(null)
  const lastTap = useRef<{ at: number; point: Point } | null>(null)

  const apply = (next: Zoom) => {
    zoomRef.current = next
    setZoom(next)
  }

  const begin = () => {
    const points = [...pointers.current.values()]
    gesture.current = points.length
      ? { moved: false, points, zoom: zoomRef.current }
      : null
  }

  const handleTap = (point: Point, size: Size, at: number) => {
    const last = lastTap.current
    const isDouble =
      last &&
      at - last.at < DOUBLE_TAP_MS &&
      Math.hypot(point.x - last.point.x, point.y - last.point.y) < TAP_SLOP * 3
    lastTap.current = isDouble ? null : { at, point }
    if (isDouble) apply(toggleZoom(zoomRef.current, point, size))
  }

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId)
    pointers.current.set(event.pointerId, measure(event).point)
    begin()
  }

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const start = gesture.current
    if (!start || !pointers.current.has(event.pointerId)) return
    const { point, size } = measure(event)
    pointers.current.set(event.pointerId, point)
    const points = [...pointers.current.values()]
    if (start.points.length >= 2 && points.length >= 2) {
      start.moved = true
      apply(pinch(start.zoom, touches(start.points), touches(points), size))
      return
    }
    const [from] = start.points
    if (Math.hypot(point.x - from.x, point.y - from.y) > TAP_SLOP) {
      start.moved = true
    }
    if (start.moved) apply(pan(start.zoom, from, point, size))
  }

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    if (!pointers.current.has(event.pointerId)) return
    const start = gesture.current
    pointers.current.delete(event.pointerId)
    if (start && !start.moved && start.points.length === 1) {
      const { point, size } = measure(event)
      handleTap(point, size, event.timeStamp)
    }
    begin()
  }

  const onPointerCancel = (event: PointerEvent<HTMLElement>) => {
    pointers.current.delete(event.pointerId)
    begin()
  }

  return {
    handlers: { onPointerCancel, onPointerDown, onPointerMove, onPointerUp },
    style: {
      transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`,
    },
    zoomed: zoom.scale > 1,
  }
}
