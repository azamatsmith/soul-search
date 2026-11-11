import { QueryClient } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getScores, postScoreAdjustment, type Scores } from '../lib/api'
import { AdjustScoreScreen } from './AdjustScoreScreen'
import { queryWrapper } from '../test/queryWrapper'

vi.mock('../lib/api', () => ({
  getScores: vi.fn(),
  postScoreAdjustment: vi.fn(),
}))

const load = vi.mocked(getScores)
const save = vi.mocked(postScoreAdjustment)

const SCORES: Scores = {
  period: { kind: 'week', name: null },
  players: [
    { display_name: 'Dana R.', id: 'p1', points: 4 },
    { display_name: 'Grandpa Joe', id: 'p2', points: 8 },
  ],
}

const renderAdjust = () => {
  const router = createMemoryRouter(
    [
      { path: '/admin/adjust', element: <AdjustScoreScreen /> },
      { path: '/admin', element: <p>Admin home</p> },
    ],
    { initialEntries: ['/admin/adjust'] },
  )
  render(<RouterProvider router={router} />, { wrapper: queryWrapper() })
  return router
}

const fillIn = async () => {
  fireEvent.change(await screen.findByLabelText('Player'), {
    target: { value: 'p2' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'More for Change by' }))
  fireEvent.click(screen.getByRole('button', { name: 'More for Change by' }))
  fireEvent.click(screen.getByRole('button', { name: 'More for Change by' }))
  fireEvent.change(screen.getByLabelText('Reason (required)'), {
    target: { value: ' Photos failed to upload ' },
  })
}

describe('AdjustScoreScreen', () => {
  beforeEach(() => {
    load.mockReset()
    save.mockReset()
    load.mockResolvedValue({ ok: true, data: SCORES })
    save.mockResolvedValue({ ok: true, data: { player_id: 'p2', points: 11 } })
  })

  it('saves a change with a reason, then goes back', async () => {
    const refreshAll = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
    const router = renderAdjust()
    expect(await screen.findByText('This week')).toBeVisible()
    await fillIn()
    expect(screen.getByText('8 → 11')).toBeVisible()
    fireEvent.click(
      screen.getByRole('button', { name: 'Save (Grandpa Joe +3)' }),
    )
    expect(save).toHaveBeenCalledWith({
      change: 3,
      player_id: 'p2',
      reason: 'Photos failed to upload',
    })
    expect(await screen.findByText('Admin home')).toBeVisible()
    expect(router.state.location.pathname).toBe('/admin')
    expect(refreshAll).toHaveBeenCalledWith()
    refreshAll.mockRestore()
  })

  it('keeps save disabled until there is a player, a change and a reason', async () => {
    renderAdjust()
    const saveButton = await screen.findByRole('button', { name: 'Save' })
    expect(saveButton).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Player'), {
      target: { value: 'p1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Less for Change by' }))
    expect(
      screen.getByRole('button', { name: 'Save (Dana R. −1)' }),
    ).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Reason (required)'), {
      target: { value: '   ' },
    })
    expect(
      screen.getByRole('button', { name: 'Save (Dana R. −1)' }),
    ).toBeDisabled()
  })

  it('names a running challenge', async () => {
    load.mockResolvedValue({
      ok: true,
      data: { ...SCORES, period: { kind: 'challenge', name: 'Brown Week' } },
    })
    renderAdjust()
    expect(await screen.findByText('Brown Week')).toBeVisible()
  })

  it('shows an error when saving fails', async () => {
    save.mockResolvedValue({ ok: false, status: 0, error: 'network' })
    renderAdjust()
    await fillIn()
    fireEvent.click(
      screen.getByRole('button', { name: 'Save (Grandpa Joe +3)' }),
    )
    expect(await screen.findByText("We couldn't save that.")).toBeVisible()
  })

  it('offers a retry when players fail to load', async () => {
    load.mockResolvedValue({ ok: false, status: 0, error: 'network' })
    renderAdjust()
    expect(await screen.findByText("Couldn't load the players")).toBeVisible()
  })
})
