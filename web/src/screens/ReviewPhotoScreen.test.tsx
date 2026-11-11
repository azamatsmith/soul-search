import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getReviewItem, postReview, type ReviewDetail } from '../lib/api'
import { ReviewPhotoScreen } from './ReviewPhotoScreen'
import { queryWrapper } from '../test/queryWrapper'

vi.mock('../lib/api', () => ({
  getReviewItem: vi.fn(),
  postReview: vi.fn(),
}))

const load = vi.mocked(getReviewItem)
const save = vi.mocked(postReview)

const FLAGGED: ReviewDetail = {
  categories: ['Racing stripes'],
  check_note: 'Stripes may be a reflection.',
  claim_type: 'special',
  display_name: 'Marcus T.',
  id: 'f1',
  photo_url: 'https://signed.test/photo.jpg',
  points: 2,
  rules: {
    bonuses: { 'Brown paint': 3 },
    categories: ['Racing stripes', 'Brown paint'],
    false_call: -1,
    regular: 1,
    special: 2,
  },
  status: 'counted',
  taken_at: '2026-11-12T22:40:00Z',
  thumb_url: null,
  verification_notes: 'White lines on the hood may be a reflection.',
}

const FALSE_CALL: ReviewDetail = {
  ...FLAGGED,
  categories: [],
  claim_type: 'regular',
  points: -1,
  status: 'false_call',
}

const renderReview = () => {
  const router = createMemoryRouter(
    [
      { path: '/admin/flagged/:id', element: <ReviewPhotoScreen /> },
      { path: '/admin/flagged', element: <p>Queue</p> },
    ],
    { initialEntries: ['/admin/flagged', '/admin/flagged/f1'] },
  )
  render(<RouterProvider router={router} />, { wrapper: queryWrapper() })
  return router
}

const choose = async (name: RegExp) =>
  fireEvent.click(await screen.findByRole('button', { name }))

describe('ReviewPhotoScreen', () => {
  beforeEach(() => {
    load.mockReset()
    save.mockReset()
    load.mockResolvedValue({ ok: true, data: FLAGGED })
    save.mockResolvedValue({ ok: true, data: null })
  })

  it('shows the claim and the photo check notes', async () => {
    renderReview()
    expect(
      await screen.findByText('Special Soul · Racing stripes · +2'),
    ).toBeVisible()
    expect(
      screen.getByText('White lines on the hood may be a reflection.'),
    ).toBeVisible()
    expect(load).toHaveBeenCalledWith('f1')
  })

  it('changes a flagged photo to regular, then goes back to the list', async () => {
    const router = renderReview()
    await choose(/Change to Regular · \+1/)
    expect(save).toHaveBeenCalledWith('f1', 'regular', null)
    expect(await screen.findByText('Queue')).toBeVisible()
    expect(router.state.location.pathname).toBe('/admin/flagged')
  })

  it('restores a false call as special with a picked category', async () => {
    load.mockResolvedValue({ ok: true, data: FALSE_CALL })
    const router = renderReview()
    await choose(/Restore as Special/)
    const confirm = screen.getByRole('button', { name: 'Pick a category' })
    expect(confirm).toBeDisabled()
    fireEvent.click(screen.getByRole('radio', { name: 'Brown paint' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Restore as Special · +3' }),
    )
    expect(save).toHaveBeenCalledWith('f1', 'special', 'Brown paint')
    await screen.findByText('Queue')
    expect(router.state.location.search).toBe('?tab=false_calls')
  })

  it('says when another admin got there first', async () => {
    save.mockResolvedValue({
      ok: false,
      status: 409,
      error: 'already_reviewed',
    })
    renderReview()
    await choose(/Keep the claim · \+2/)
    expect(
      await screen.findByText('Someone else already looked at this photo.'),
    ).toBeVisible()
  })

  it('explains a photo that is no longer waiting', async () => {
    load.mockResolvedValue({ ok: false, status: 404, error: 'not_found' })
    renderReview()
    expect(
      await screen.findByText(/Someone already looked at this photo/),
    ).toBeVisible()
  })

  it('enlarges the photo', async () => {
    renderReview()
    await choose(/Enlarge photo from Marcus T\./)
    expect(screen.getByRole('dialog')).toBeVisible()
  })
})
