import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getLeaderboard,
  type ApiResult,
  type Leaderboard,
  type LeaderboardScope,
} from '../lib/api'
import { ScoresScreen } from './ScoresScreen'
import { queryWrapper } from '../test/queryWrapper'

vi.mock('../lib/api', () => ({ getLeaderboard: vi.fn() }))

const WEEK: Leaderboard = {
  ends_at: '2026-11-16T08:00:00Z',
  rows: [
    {
      count: 5,
      display_name: 'Mom',
      is_me: false,
      player_id: 'p1',
      points: 7,
      rank: 1,
    },
    {
      count: 3,
      display_name: 'Matthew',
      is_me: true,
      player_id: 'p2',
      points: 3,
      rank: 2,
    },
  ],
  scope: 'week',
  starts_at: '2026-11-09T08:00:00Z',
  total_players: 23,
}

const ALL: Leaderboard = {
  ...WEEK,
  ends_at: null,
  rows: [{ ...WEEK.rows[1], points: 40, rank: 1 }],
  scope: 'all',
  starts_at: null,
}

const ok = <T,>(data: T): Promise<ApiResult<T>> =>
  Promise.resolve({ ok: true, data })
const failed: Promise<ApiResult<never>> = Promise.resolve({
  ok: false,
  status: 0,
  error: 'network',
})
const never = <T,>() => new Promise<ApiResult<T>>(() => {})

const serve = (boards: Record<LeaderboardScope, Leaderboard>) =>
  vi
    .mocked(getLeaderboard)
    .mockImplementation((scope: LeaderboardScope) => ok(boards[scope]))

const renderScores = (wrapper = queryWrapper()) =>
  render(
    <MemoryRouter>
      <ScoresScreen />
    </MemoryRouter>,
    { wrapper },
  )

describe('ScoresScreen', () => {
  beforeEach(() => {
    vi.mocked(getLeaderboard).mockReset()
  })

  it('shows shimmer rows while the first load runs', () => {
    vi.mocked(getLeaderboard).mockImplementation(() => never())
    renderScores()

    expect(screen.getByLabelText('Loading the scores')).toBeInTheDocument()
    expect(screen.getAllByText('This week')).toHaveLength(2)
  })

  it('shows the weekly board with its kicker', async () => {
    serve({ all: ALL, week: WEEK })
    renderScores()

    expect(await screen.findByText('Mom')).toBeInTheDocument()
    expect(screen.getByText('Matthew (you)')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Leaderboard' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Nov 9-15 · 23 players · Resets Monday'),
    ).toBeInTheDocument()
  })

  it('switches between this week and all time without reloading', async () => {
    serve({ all: ALL, week: WEEK })
    renderScores()
    await screen.findByText('Mom')

    fireEvent.click(screen.getByRole('button', { name: 'All time' }))

    expect(await screen.findByText('40')).toBeInTheDocument()
    expect(screen.queryByText('Mom')).not.toBeInTheDocument()
    expect(
      screen.getByText('Since you joined · 23 players'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'This week' }))

    expect(screen.getByText('Mom')).toBeInTheDocument()
    expect(
      screen.queryByLabelText('Loading the scores'),
    ).not.toBeInTheDocument()
  })

  it('shows the saved board right away when opened again', async () => {
    serve({ all: ALL, week: WEEK })
    const wrapper = queryWrapper()
    const first = renderScores(wrapper)
    await screen.findByText('Mom')
    first.unmount()
    vi.mocked(getLeaderboard).mockImplementation(() => never())

    renderScores(wrapper)

    expect(screen.getByText('Mom')).toBeInTheDocument()
    expect(
      screen.queryByLabelText('Loading the scores'),
    ).not.toBeInTheDocument()
    expect(getLeaderboard).toHaveBeenCalledTimes(4)
  })

  it('links to past weeks', async () => {
    serve({ all: ALL, week: WEEK })
    renderScores()

    expect(
      await screen.findByRole('link', { name: /See past weeks/ }),
    ).toHaveAttribute('href', '/past-weeks')
  })

  it('shows the weekly empty state', async () => {
    serve({ all: ALL, week: { ...WEEK, rows: [] } })
    renderScores()

    expect(
      await screen.findByRole('heading', { name: 'No scores yet this week' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Nobody has spotted a Soul since Monday. The first photo puts you on top.',
      ),
    ).toBeInTheDocument()
  })

  it('shows the all-time empty state', async () => {
    serve({ all: { ...ALL, rows: [] }, week: WEEK })
    renderScores()
    await screen.findByText('Mom')

    fireEvent.click(screen.getByRole('button', { name: 'All time' }))

    expect(
      await screen.findByRole('heading', { name: 'No scores yet' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('The first photo puts you on top.'),
    ).toBeInTheDocument()
  })

  it('shows the error and loads again on Try again', async () => {
    vi.mocked(getLeaderboard)
      .mockImplementationOnce(() => failed)
      .mockImplementation((scope: LeaderboardScope) =>
        ok(scope === 'week' ? WEEK : ALL),
      )
    renderScores()

    expect(
      await screen.findByText("Couldn't load the scores"),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Mom')).toBeInTheDocument()
  })
})
