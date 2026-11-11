import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LogCard } from '../lib/sightingsCopy'
import { PhotoViewer } from './PhotoViewer'
import {
  CAMERA,
  CREAM,
  setUpStatusBar,
  statusBarColor,
} from '../test/statusBar'

const card = (changes: Partial<LogCard> = {}): LogCard => ({
  categories: ['Racing stripes'],
  challengeName: null,
  checkNote: null,
  claimType: 'special',
  fullPhotoUrl: 'https://signed.test/a.jpg',
  id: 'a',
  kind: 'special',
  name: 'Marcus T.',
  photoUrl: 'https://signed.test/a.thumb.jpg',
  points: 2,
  takenAt: '2026-11-12T22:40:00Z',
  ...changes,
})

const renderViewer = (changes: Partial<LogCard> = {}) => {
  const onClose = vi.fn()
  render(<PhotoViewer card={card(changes)} onClose={onClose} />)
  return onClose
}

describe('PhotoViewer', () => {
  setUpStatusBar()

  it('shows the photo with name, time, claim and chip', () => {
    renderViewer()

    const dialog = screen.getByRole('dialog', { name: 'Marcus T.' })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('Thu 2:40 PM')).toBeInTheDocument()
    expect(screen.getByText('Special · Racing stripes')).toBeInTheDocument()
    expect(screen.getByText('+2 Special')).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'Photo from Marcus T.' }),
    ).toHaveAttribute('src', 'https://signed.test/a.jpg')
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('explains a flagged sighting', () => {
    renderViewer({ checkNote: 'Unsure about the stripes.', kind: 'flagged' })

    expect(screen.getByRole('note')).toHaveTextContent(
      'Unsure about the stripes.',
    )
    expect(
      screen.getByText('+2 · Flagged for a second look'),
    ).toBeInTheDocument()
  })

  it('explains a false call', () => {
    renderViewer({
      categories: [],
      checkNote: 'This is a Kia Niro.',
      claimType: 'regular',
      kind: 'false_call',
      points: -1,
    })

    expect(screen.getByText('Claimed: Regular')).toBeInTheDocument()
    expect(screen.getByText('−1 False call')).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('This is a Kia Niro.')
  })

  it('focuses Close and closes on click or Escape', () => {
    const onClose = renderViewer()

    const close = screen.getByRole('button', { name: 'Close' })
    expect(close).toHaveFocus()
    fireEvent.click(close)
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('locks page scroll while open', () => {
    const { unmount } = render(<PhotoViewer card={card()} onClose={vi.fn()} />)

    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('turns the status bar dark while open', () => {
    const { unmount } = render(<PhotoViewer card={card()} onClose={vi.fn()} />)

    expect(statusBarColor()).toBe(CAMERA)

    unmount()

    expect(statusBarColor()).toBe(CREAM)
  })
})
