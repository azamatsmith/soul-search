import { fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getHistory, type HistoryEntry } from '../lib/api'
import { ChangeHistoryScreen } from './ChangeHistoryScreen'
import { queryWrapper } from '../test/queryWrapper'

vi.mock('../lib/api', () => ({
  getHistory: vi.fn(),
}))

const load = vi.mocked(getHistory)

const SCORE: HistoryEntry = {
  admin: { display_name: 'Heathyr', id: 'h' },
  after: { change: 3, points: 11 },
  before: { points: 8 },
  created_at: '2026-11-13T00:45:00Z',
  id: 'score',
  reason: 'Lost uploads',
  target_name: 'Grandpa Joe',
  type: 'score',
}

const EMAILS: HistoryEntry = {
  admin: { display_name: 'Matthew', id: 'm' },
  after: { email: 'nora@example.com' },
  before: null,
  created_at: '2026-11-12T00:45:00Z',
  id: 'emails',
  reason: null,
  target_name: null,
  type: 'emails',
}

const renderHistory = () => {
  const router = createMemoryRouter(
    [{ path: '/admin/history', element: <ChangeHistoryScreen /> }],
    { initialEntries: ['/admin/history'] },
  )
  render(<RouterProvider router={router} />, { wrapper: queryWrapper() })
}

describe('ChangeHistoryScreen', () => {
  beforeEach(() => {
    load.mockReset()
    load.mockImplementation(async (scoresOnly) => ({
      ok: true,
      data: { entries: scoresOnly ? [SCORE] : [SCORE, EMAILS] },
    }))
  })

  it('lists every change with who made it', async () => {
    renderHistory()
    const rows = await screen.findAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent(
      'Heathyr gave Grandpa Joe +3. “Lost uploads.”',
    )
    expect(within(rows[0]).getByText('Score')).toBeInTheDocument()
    expect(rows[1]).toHaveTextContent(
      'Matthew added nora@example.com to the allowed emails.',
    )
  })

  it('can show scores only', async () => {
    renderHistory()
    await screen.findAllByRole('listitem')
    fireEvent.click(screen.getByRole('button', { name: 'Scores only' }))
    expect(load).toHaveBeenCalledWith(true)
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Scores only' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('says when nothing has changed yet', async () => {
    load.mockResolvedValue({ ok: true, data: { entries: [] } })
    renderHistory()
    expect(await screen.findByText('No changes yet')).toBeInTheDocument()
  })

  it('offers a retry when the history fails to load', async () => {
    load.mockResolvedValue({ ok: false, status: 0, error: 'network' })
    renderHistory()
    expect(
      await screen.findByText("Couldn't load the change history"),
    ).toBeInTheDocument()
  })
})
