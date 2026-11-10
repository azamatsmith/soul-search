import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getReviewQueue, type ReviewItem } from '../lib/api'
import { FlaggedPhotosScreen } from './FlaggedPhotosScreen'

vi.mock('../lib/api', () => ({ getReviewQueue: vi.fn() }))

const load = vi.mocked(getReviewQueue)

const FLAGGED: ReviewItem = {
  categories: ['Racing stripes'],
  check_note: 'Stripes may be a reflection.',
  claim_type: 'special',
  display_name: 'Marcus T.',
  id: 'f1',
  photo_url: null,
  points: 2,
  status: 'counted',
  taken_at: '2026-11-12T22:40:00Z',
  thumb_url: 'https://signed.test/thumb.jpg',
  verification_notes: null,
}

const FALSE_CALL: ReviewItem = {
  ...FLAGGED,
  categories: [],
  check_note: "This didn't look like a Kia Soul.",
  claim_type: 'regular',
  display_name: 'Sam W.',
  id: 'x1',
  points: -1,
  status: 'false_call',
}

const renderFlagged = (entry = '/admin/flagged') => {
  const router = createMemoryRouter(
    [{ path: '/admin/flagged', element: <FlaggedPhotosScreen /> }],
    { initialEntries: [entry] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('FlaggedPhotosScreen', () => {
  beforeEach(() => {
    load.mockReset()
    load.mockResolvedValue({
      ok: true,
      data: { false_calls: [FALSE_CALL], flagged: [FLAGGED] },
    })
  })

  it('lists flagged photos with the claim, note and points', async () => {
    renderFlagged()
    const card = await screen.findByRole('link', { name: /Marcus T\./ })
    expect(card).toHaveAttribute('href', '/admin/flagged/f1')
    expect(screen.getByText('Claimed: Special · Racing stripes')).toBeVisible()
    expect(screen.getByText('“Stripes may be a reflection.”')).toBeVisible()
    expect(screen.getByText('Counting +2 for now')).toBeVisible()
    expect(screen.queryByText('Sam W.')).not.toBeInTheDocument()
  })

  it('switches to automatic false calls and remembers the tab', async () => {
    const router = renderFlagged()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Auto false calls (1)' }),
    )
    expect(await screen.findByText('Sam W.')).toBeVisible()
    expect(screen.getByText('−1 False call')).toBeVisible()
    expect(router.state.location.search).toBe('?tab=false_calls')
  })

  it('opens on the false calls tab from the url', async () => {
    renderFlagged('/admin/flagged?tab=false_calls')
    expect(await screen.findByText('Sam W.')).toBeVisible()
  })

  it('says when there is nothing to look at', async () => {
    load.mockResolvedValue({ ok: true, data: { false_calls: [], flagged: [] } })
    renderFlagged()
    expect(
      await screen.findByText(
        'No flagged photos. Nothing to look at right now.',
      ),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Flagged (0)' })).toBeVisible()
  })

  it('offers a retry when the list fails to load', async () => {
    load.mockResolvedValue({ ok: false, status: 0, error: 'network' })
    renderFlagged()
    expect(
      await screen.findByText("Couldn't load flagged photos"),
    ).toBeVisible()
  })
})
