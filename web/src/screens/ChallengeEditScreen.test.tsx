import { QueryClient } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteChallenge,
  getChallenge,
  getChallenges,
  getPointRules,
  postChallenge,
  putChallenge,
  type ApiResult,
  type Challenge,
  type ChallengeDetail,
} from '../lib/api'
import { ChallengeEditScreen } from './ChallengeEditScreen'
import { queryWrapper } from '../test/queryWrapper'

vi.mock('../lib/api', () => ({
  deleteChallenge: vi.fn(),
  getChallenge: vi.fn(),
  getChallenges: vi.fn(),
  getPointRules: vi.fn(),
  postChallenge: vi.fn(),
  putChallenge: vi.fn(),
}))

const NOW = Date.parse('2026-11-12T20:00:00Z')
const RULES = { bonuses: {}, false_call: -1, regular: 1, special: 2 }
const BROWN: ChallengeDetail = {
  ends_at: '2026-12-03T07:59:00Z',
  id: 'c2',
  name: 'Brown Week',
  rules: { ...RULES, bonuses: { 'Brown paint': 3 } },
  started: false,
  starts_at: '2026-11-29T17:00:00Z',
}

const ok = <T,>(data: T): Promise<ApiResult<T>> =>
  Promise.resolve({ ok: true, data })

const renderAt = (path: string) => {
  const router = createMemoryRouter(
    [
      { path: '/admin/challenges/:id', element: <ChallengeEditScreen /> },
      { path: '/admin/challenges', element: <p>Challenge list</p> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />, { wrapper: queryWrapper() })
  return router
}

const click = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name }))
const change = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const saved = (data: Challenge) => ok(data)

describe('ChallengeEditScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] })
    vi.setSystemTime(NOW)
    vi.mocked(getPointRules).mockReturnValue(
      ok({
        categories: ['Alien Green', 'Brown paint'],
        false_call: -1,
        regular: 1,
        special: 2,
      }),
    )
    vi.mocked(getChallenges).mockReturnValue(
      ok({ finished: [], running: [], upcoming: [] }),
    )
    vi.mocked(getChallenge).mockReturnValue(ok(BROWN))
    vi.mocked(postChallenge).mockReset()
    vi.mocked(putChallenge).mockReset()
    vi.mocked(deleteChallenge).mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates a challenge from the weekly rules in Pacific time', async () => {
    const refreshAll = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
    vi.mocked(postChallenge).mockReturnValue(saved({ ...BROWN, id: 'new' }))
    const router = renderAt('/admin/challenges/new')

    expect(await screen.findByLabelText('Starts date')).toHaveValue(
      '2026-11-13',
    )
    expect(
      screen.getByRole('heading', { name: 'New challenge' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Starts time')).toHaveValue('09:00')
    expect(screen.getByLabelText('Ends time')).toHaveValue('23:59')
    expect(screen.getByText('Weekly rule: +1')).toBeInTheDocument()

    change('Name', ' Thanksgiving Dash ')
    change('Starts date', '2026-11-26')
    change('Starts time', '14:00')
    change('Ends date', '2026-11-26')
    change('Ends time', '18:00')
    click('More for Special Soul')
    click('Save challenge')

    expect(postChallenge).toHaveBeenCalledWith({
      ends_at: '2026-11-27T02:00:00.000Z',
      name: 'Thanksgiving Dash',
      rules: { bonuses: {}, false_call: -1, regular: 1, special: 3 },
      starts_at: '2026-11-26T22:00:00.000Z',
    })
    expect(await screen.findByText('Challenge list')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/challenges')
    expect(refreshAll).toHaveBeenCalledWith()
    refreshAll.mockRestore()
  })

  it('updates the duration as the times change', async () => {
    renderAt('/admin/challenges/new')
    await screen.findByLabelText('Starts date')

    change('Starts date', '2026-11-26')
    change('Starts time', '14:00')
    change('Ends date', '2026-11-26')
    change('Ends time', '18:00')

    expect(screen.getByText('Runs 4 hours')).toBeInTheDocument()
    expect(screen.getByText('All times Pacific')).toBeInTheDocument()
  })

  it('shows an overlap and keeps what was entered', async () => {
    vi.mocked(postChallenge).mockResolvedValue({
      error: 'overlaps',
      name: 'Brown Week',
      ok: false,
      status: 422,
    })
    renderAt('/admin/challenges/new')
    await screen.findByLabelText('Name')
    change('Name', 'Thanksgiving Dash')

    click('Save challenge')

    expect(
      await screen.findByText('This overlaps Brown Week. Pick other times.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Thanksgiving Dash')
  })

  it('loads an existing challenge into Pacific fields and saves it', async () => {
    vi.mocked(putChallenge).mockReturnValue(saved(BROWN))
    renderAt('/admin/challenges/c2')

    expect(await screen.findByLabelText('Name')).toHaveValue('Brown Week')
    expect(screen.getByLabelText('Starts date')).toHaveValue('2026-11-29')
    expect(screen.getByLabelText('Starts time')).toHaveValue('09:00')
    expect(screen.getByLabelText('Ends date')).toHaveValue('2026-12-02')
    expect(screen.getByLabelText('Ends time')).toHaveValue('23:59')
    expect(
      screen.getByRole('heading', { name: 'Brown Week' }),
    ).toBeInTheDocument()

    click('Save challenge')

    expect(putChallenge).toHaveBeenCalledWith('c2', {
      ends_at: '2026-12-03T07:59:00.000Z',
      name: 'Brown Week',
      rules: BROWN.rules,
      starts_at: '2026-11-29T17:00:00.000Z',
    })
  })

  it('locks the start of a running challenge but still sends it', async () => {
    vi.mocked(getChallenge).mockReturnValue(
      ok({ ...BROWN, started: true, starts_at: '2026-11-12T17:00:00Z' }),
    )
    vi.mocked(putChallenge).mockReturnValue(saved(BROWN))
    renderAt('/admin/challenges/c2')

    expect(await screen.findByLabelText('Starts date')).toBeDisabled()
    expect(screen.getByLabelText('Starts time')).toBeDisabled()
    expect(screen.getByLabelText('Ends time')).toBeEnabled()

    click('Save challenge')

    expect(vi.mocked(putChallenge).mock.calls[0][1].starts_at).toBe(
      '2026-11-12T17:00:00.000Z',
    )
  })

  it('shows a finished challenge read-only with its winner', async () => {
    const finished = {
      ...BROWN,
      ends_at: '2026-10-26T07:00:00Z',
      name: 'Stripe Hunt',
      started: true,
      starts_at: '2026-10-19T07:00:00Z',
    }
    vi.mocked(getChallenge).mockReturnValue(ok(finished))
    vi.mocked(getChallenges).mockReturnValue(
      ok({
        finished: [
          { ...finished, winner: { display_name: 'Marcus T.', points: 14 } },
        ],
        running: [],
        upcoming: [],
      }),
    )
    renderAt('/admin/challenges/c2')

    expect(
      await screen.findByText('Won by Marcus T. · 14 points'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeDisabled()
    expect(screen.getByLabelText('Ends date')).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'More for Regular Soul' }),
    ).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save challenge' })).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Delete challenge' }),
    ).toBeInTheDocument()
  })

  it('adds and removes a category bonus', async () => {
    renderAt('/admin/challenges/new')
    await screen.findByLabelText('Name')

    click('+ Add a category bonus')
    click('Alien Green')

    expect(screen.getByText('Category bonus')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'More for Alien Green' }),
    ).toBeInTheDocument()
    expect(screen.getByText('+3')).toBeInTheDocument()

    click('Remove Alien Green bonus')

    expect(screen.queryByText('Category bonus')).toBeNull()
  })

  it('deletes after an in-page confirm', async () => {
    vi.mocked(deleteChallenge).mockReturnValue(ok(null))
    renderAt('/admin/challenges/c2')
    await screen.findByLabelText('Name')

    click('Delete challenge')
    expect(
      screen.getByText('Delete Brown Week? Its photos go back to their weeks.'),
    ).toBeInTheDocument()
    click('Delete')

    expect(deleteChallenge).toHaveBeenCalledWith('c2')
    expect(await screen.findByText('Challenge list')).toBeInTheDocument()
  })

  it('cancels a delete with Keep it', async () => {
    renderAt('/admin/challenges/c2')
    await screen.findByLabelText('Name')

    click('Delete challenge')
    click('Keep it')

    expect(deleteChallenge).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Delete challenge' }),
    ).toBeInTheDocument()
  })

  it('does not offer delete for a new challenge', async () => {
    renderAt('/admin/challenges/new')
    await screen.findByLabelText('Name')

    expect(
      screen.queryByRole('button', { name: 'Delete challenge' }),
    ).toBeNull()
  })
})
