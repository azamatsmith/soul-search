import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getLeaderboard,
  getPeriod,
  type ApiResult,
  type Leaderboard,
  type LeaderboardScope,
  type Period,
} from '../lib/api'
import { ScoresScreen } from './ScoresScreen'
import { queryWrapper } from '../test/queryWrapper'

vi.mock('../lib/api', () => ({ getLeaderboard: vi.fn(), getPeriod: vi.fn() }))

const RULES = {
  categories: [{ name: 'Brown paint', points: 2 }],
  false_call: -1,
  regular: 1,
  special: 2,
}

const BROWN_WEEK_RULES = {
  categories: [{ name: 'Brown paint', points: 3 }],
  false_call: -1,
  regular: 1,
  special: null,
}

const WEEK_PERIOD: Period = {
  ends_at: '2026-11-16T08:00:00Z',
  id: 'w1',
  kind: 'week',
  name: null,
  rules: RULES,
  starts_at: '2026-11-09T08:00:00Z',
}

const CHALLENGE_PERIOD: Period = {
  ends_at: '2026-11-16T07:59:00Z',
  id: 'c1',
  kind: 'challenge',
  name: 'Brown Week',
  rules: BROWN_WEEK_RULES,
  starts_at: '2026-11-12T17:00:00Z',
}

const WEEK: Leaderboard = {
  ends_at: '2026-11-16T08:00:00Z',
  name: null,
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
  name: null,
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

const serve = (boards: Partial<Record<LeaderboardScope, Leaderboard>>) =>
  vi
    .mocked(getLeaderboard)
    .mockImplementation((scope: LeaderboardScope) =>
      ok(boards[scope] as Leaderboard),
    )

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
    vi.mocked(getPeriod).mockReset()
    vi.mocked(getPeriod).mockImplementation(() => ok(WEEK_PERIOD))
  })

  afterEach(() => {
    vi.useRealTimers()
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
  describe('while a challenge runs', () => {
    const CHALLENGE: Leaderboard = {
      ...WEEK,
      ends_at: CHALLENGE_PERIOD.ends_at,
      name: 'Brown Week',
      rows: [{ ...WEEK.rows[0], display_name: 'Dana R.' }],
      scope: 'challenge',
      starts_at: CHALLENGE_PERIOD.starts_at,
    }

    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      vi.setSystemTime(new Date('2026-11-12T20:00:00Z'))
      vi.mocked(getPeriod).mockImplementation(() => ok(CHALLENGE_PERIOD))
    })

    it('shows the challenge board with its rules', async () => {
      serve({ all: ALL, challenge: CHALLENGE, week: WEEK })
      renderScores()

      expect(await screen.findByText('Dana R.')).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Brown Week' }),
      ).toHaveAttribute('aria-pressed', 'true')
      expect(
        screen.getByRole('button', { name: 'All time' }),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'This week' }),
      ).not.toBeInTheDocument()
      expect(
        screen.getByText('Challenge · ends Sun 11:59 pm'),
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          'Rules: Regular +1, Brown paint +3, False call \u22121',
        ),
      ).toBeInTheDocument()
    })

    it('hides the rules on All time', async () => {
      serve({ all: ALL, challenge: CHALLENGE, week: WEEK })
      renderScores()
      await screen.findByText('Dana R.')

      fireEvent.click(screen.getByRole('button', { name: 'All time' }))

      expect(await screen.findByText('40')).toBeInTheDocument()
      expect(screen.queryByText(/^Rules:/)).not.toBeInTheDocument()
    })

    it('falls back to this week once the challenge has ended', async () => {
      vi.mocked(getLeaderboard).mockImplementation((scope: LeaderboardScope) =>
        scope === 'challenge'
          ? Promise.resolve({ ok: false, status: 404, error: 'no_challenge' })
          : ok(scope === 'week' ? WEEK : ALL),
      )
      renderScores()

      await waitFor(() =>
        expect(getLeaderboard).toHaveBeenCalledWith('challenge'),
      )
      await act(async () => {})

      expect(await screen.findByText('Mom')).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'This week' }),
      ).toBeInTheDocument()
      expect(screen.queryByText(/Couldn't load/)).not.toBeInTheDocument()
    })

    it('falls back to this week when the challenge ends while open', async () => {
      let ended = false
      vi.mocked(getLeaderboard).mockImplementation(
        (scope: LeaderboardScope) => {
          if (scope !== 'challenge') return ok(scope === 'week' ? WEEK : ALL)
          return ended
            ? Promise.resolve({ ok: false, status: 404, error: 'no_challenge' })
            : ok(CHALLENGE)
        },
      )
      renderScores()
      expect(await screen.findByText('Dana R.')).toBeInTheDocument()

      ended = true
      await act(() => vi.advanceTimersByTimeAsync(30_000))

      expect(await screen.findByText('Mom')).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'This week' }),
      ).toBeInTheDocument()
      expect(screen.queryByText(/^Rules:/)).not.toBeInTheDocument()
    })

    it('never shows the last challenge board for a new challenge', async () => {
      serve({ all: ALL, challenge: CHALLENGE, week: WEEK })
      const wrapper = queryWrapper()
      const first = renderScores(wrapper)
      await screen.findByText('Dana R.')
      first.unmount()
      vi.mocked(getPeriod).mockImplementation(() =>
        ok({ ...CHALLENGE_PERIOD, id: 'c2', name: 'Dash' }),
      )
      vi.mocked(getLeaderboard).mockImplementation((scope: LeaderboardScope) =>
        scope === 'challenge' ? never() : ok(scope === 'week' ? WEEK : ALL),
      )

      renderScores(wrapper)

      expect(
        await screen.findByRole('button', { name: 'Dash' }),
      ).toBeInTheDocument()
      expect(screen.queryByText('Dana R.')).not.toBeInTheDocument()
    })

    it('shows the challenge empty state', async () => {
      serve({ all: ALL, challenge: { ...CHALLENGE, rows: [] }, week: WEEK })
      renderScores()

      expect(
        await screen.findByRole('heading', {
          name: 'No scores yet in Brown Week',
        }),
      ).toBeInTheDocument()
      expect(
        screen.getByText('The first photo puts you on top.'),
      ).toBeInTheDocument()
    })
  })

  it('shows this week while the period is still loading', async () => {
    vi.mocked(getPeriod).mockImplementation(() => never())
    serve({ all: ALL, week: WEEK })
    renderScores()

    expect(await screen.findByText('Mom')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'This week' }),
    ).toBeInTheDocument()
  })
})
