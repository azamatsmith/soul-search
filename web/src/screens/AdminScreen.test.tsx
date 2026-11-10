import { render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getAllowedEmails,
  getPointRules,
  getReviewQueue,
  type ReviewItem,
} from '../lib/api'
import { AdminScreen } from './AdminScreen'

vi.mock('../lib/api', () => ({
  getAllowedEmails: vi.fn(),
  getPointRules: vi.fn(),
  getReviewQueue: vi.fn(),
}))

const load = vi.mocked(getAllowedEmails)
const loadRules = vi.mocked(getPointRules)
const loadQueue = vi.mocked(getReviewQueue)

const renderAdmin = () => {
  const router = createMemoryRouter(
    [{ path: '/admin', element: <AdminScreen /> }],
    { initialEntries: ['/admin'] },
  )
  render(<RouterProvider router={router} />)
}

describe('AdminScreen', () => {
  beforeEach(() => {
    load.mockReset()
    loadRules.mockReset()
    loadRules.mockResolvedValue({ ok: false, status: 0, error: 'network' })
    loadQueue.mockReset()
    loadQueue.mockResolvedValue({ ok: false, status: 0, error: 'network' })
  })

  it('links to flagged photos with a count badge', async () => {
    load.mockResolvedValue({ ok: true, data: { emails: [] } })
    const flagged = { id: 'a' } as ReviewItem
    loadQueue.mockResolvedValue({
      ok: true,
      data: { false_calls: [], flagged: [flagged, { ...flagged, id: 'b' }] },
    })
    renderAdmin()
    const row = screen.getByRole('link', { name: /Flagged photos/ })
    expect(row).toHaveAttribute('href', '/admin/flagged')
    expect(await within(row).findByText('2')).toBeInTheDocument()
  })

  it('links to adjust a score', () => {
    load.mockResolvedValue({ ok: true, data: { emails: [] } })
    renderAdmin()
    expect(
      screen.getByRole('link', { name: /Adjust a score/ }),
    ).toHaveAttribute('href', '/admin/adjust')
  })

  it('links to points and categories with the current rules', async () => {
    load.mockResolvedValue({ ok: true, data: { emails: [] } })
    loadRules.mockResolvedValue({
      ok: true,
      data: { categories: ['A', 'B'], false_call: -1, regular: 1, special: 2 },
    })
    renderAdmin()
    expect(
      screen.getByRole('link', { name: /Points & categories/ }),
    ).toHaveAttribute('href', '/admin/points')
    expect(
      await screen.findByText('+1, +2, −1, 2 categories'),
    ).toBeInTheDocument()
  })

  it('links to allowed emails with the head count', async () => {
    load.mockResolvedValue({
      ok: true,
      data: {
        emails: [
          { display_name: 'Dana R.', email: 'dana@example.com' },
          { display_name: null, email: 'nora@example.com' },
        ],
      },
    })
    renderAdmin()
    expect(screen.getByText('Admins only')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Admin tools' }),
    ).toBeInTheDocument()
    const row = screen.getByRole('link', { name: /Allowed emails/ })
    expect(row).toHaveAttribute('href', '/admin/emails')
    expect(await screen.findByText('2 people')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Every change here is saved to the change history with your name.',
      ),
    ).toBeInTheDocument()
  })

  it('keeps the row usable when the count fails to load', async () => {
    load.mockResolvedValue({ ok: false, status: 0, error: 'network' })
    renderAdmin()
    await waitFor(() => expect(load).toHaveBeenCalled())
    expect(await screen.findByText('Who can sign in')).toBeInTheDocument()
  })
})
