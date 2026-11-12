import { fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getPeriod,
  getStanding,
  getUpcomingChallenges,
  type ApiResult,
  type Challenge,
  type Me,
  type Period,
  type Standing,
} from '../lib/api'
import { TakePhotoScreen } from './TakePhotoScreen'
import { queryWrapper } from '../test/queryWrapper'
import { FOREST, setUpStatusBar, statusBarColor } from '../test/statusBar'

vi.mock('../lib/api', () => ({
  getPeriod: vi.fn(),
  getStanding: vi.fn(),
  getUpcomingChallenges: vi.fn(),
}))

const ME: Me = {
  id: '1',
  email: 'heathyr@example.com',
  display_name: 'heathyr',
  is_admin: false,
  text_size: 'standard',
  flagged_count: null,
}

const WEEK: Period = {
  kind: 'week',
  id: 'w1',
  name: null,
  starts_at: '2026-11-09T08:00:00Z',
  ends_at: '2026-11-16T08:00:00Z',
  rules: {
    regular: 1,
    special: 2,
    false_call: -1,
    categories: [{ name: 'Alien Green', points: 2 }],
  },
}

const STANDING: Standing = {
  points: 9,
  count: 6,
  rank: 4,
  total_players: 23,
  next_rank: 3,
  points_behind_next: 2,
  last_photo_url: 'https://signed.test/last.jpg',
}

const EMPTY: Standing = {
  ...STANDING,
  points: 0,
  count: 0,
  rank: null,
  next_rank: null,
  points_behind_next: null,
  last_photo_url: null,
}

const upcomingChallenge = (
  name: string,
  startsAt: string,
  endsAt: string,
): Challenge => ({
  ends_at: endsAt,
  id: name,
  name,
  rules: { categories: [], false_call: -1, regular: 1 },
  starts_at: startsAt,
})

const DASH = upcomingChallenge(
  'Thanksgiving Dash',
  '2026-11-26T22:00:00Z',
  '2026-11-27T02:00:00Z',
)
const BROWN = upcomingChallenge(
  'Brown Week',
  '2026-11-30T08:00:00Z',
  '2026-12-07T08:00:00Z',
)

const ok = <T,>(data: T): Promise<ApiResult<T>> =>
  Promise.resolve({ ok: true, data })
const never = <T,>() => new Promise<ApiResult<T>>(() => {})

const renderHome = () => {
  const router = createMemoryRouter(
    [
      {
        element: <Outlet context={{ me: ME, setMe: vi.fn() }} />,
        children: [{ path: '/', element: <TakePhotoScreen /> }],
      },
    ],
    { initialEntries: ['/'] },
  )
  render(<RouterProvider router={router} />, { wrapper: queryWrapper() })
}

describe('TakePhotoScreen', () => {
  setUpStatusBar()

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-11-10T20:00:00Z'))
    vi.mocked(getPeriod).mockReturnValue(ok(WEEK))
    vi.mocked(getStanding).mockReturnValue(ok(STANDING))
    vi.mocked(getUpcomingChallenges).mockReturnValue(ok([]))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the week, time left, points and rank', async () => {
    renderHome()

    expect(await screen.findByText('Week of Nov 9-15')).toBeInTheDocument()
    expect(screen.getByText('5 days left')).toBeInTheDocument()
    expect(await screen.findByText('9')).toBeInTheDocument()
    expect(screen.getByText('4th')).toBeInTheDocument()
    expect(screen.getByText('of 23')).toBeInTheDocument()
  })

  it('summarizes the week with the last photo', async () => {
    renderHome()

    expect(await screen.findByText('6 Souls this week')).toBeInTheDocument()
    expect(screen.getByText('2 pts behind 3rd place')).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'Your last photo' }),
    ).toHaveAttribute('src', 'https://signed.test/last.jpg')
  })

  it('shows stripes until the last photo loads', async () => {
    renderHome()

    const photo = await screen.findByRole('img', { name: 'Your last photo' })
    expect(photo.parentElement).toHaveAttribute('data-state', 'loading')
    fireEvent.load(photo)
    expect(photo.parentElement).toHaveAttribute('data-state', 'loaded')
  })

  it('keeps the stripes when the last photo fails to load', async () => {
    renderHome()

    fireEvent.error(await screen.findByRole('img', { name: 'Your last photo' }))

    expect(
      screen.getByRole('img', { name: 'Your last photo' }),
    ).toHaveAttribute('data-state', 'failed')
  })

  it('opens settings from the avatar', () => {
    renderHome()

    const avatar = screen.getByRole('link', { name: 'Settings and profile' })
    expect(avatar).toHaveAttribute('href', '/settings')
    expect(avatar).toHaveTextContent('H')
  })

  it('offers the camera while scores are still loading', () => {
    vi.mocked(getPeriod).mockReturnValue(never())
    vi.mocked(getStanding).mockReturnValue(never())
    renderHome()

    const camera = screen.getByRole('link', { name: 'Take photo of a Soul' })
    expect(camera).toHaveAttribute('href', '/capture')
    expect(screen.getByRole('banner')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText('Your points')).not.toBeInTheDocument()
  })

  it('shows the empty week with point values from the rules', async () => {
    vi.mocked(getPeriod).mockReturnValue(
      ok({ ...WEEK, rules: { ...WEEK.rules, regular: 2, special: 5 } }),
    )
    vi.mocked(getStanding).mockReturnValue(ok(EMPTY))
    renderHome()

    expect(
      await screen.findByText('No Souls yet this week'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Your first one is out there. Regular Souls are +2, special ones +5.',
      ),
    ).toBeInTheDocument()
    const header = within(screen.getByRole('banner'))
    expect(header.getByText('Snap a Soul to get ranked')).toBeInTheDocument()
    expect(header.getByText('23 players')).toBeInTheDocument()
    expect(header.queryByText('-')).not.toBeInTheDocument()
  })

  it('names a running challenge', async () => {
    vi.mocked(getPeriod).mockReturnValue(
      ok({ ...WEEK, kind: 'challenge', name: 'Brown Week' }),
    )
    renderHome()

    expect(
      await screen.findByText('Challenge · Brown Week'),
    ).toBeInTheDocument()
    expect(await screen.findByText('6 Souls in Brown Week')).toBeInTheDocument()
  })

  const BROWN_WEEK = {
    ...WEEK,
    kind: 'challenge' as const,
    name: 'Brown Week',
    rules: {
      ...WEEK.rules,
      categories: [{ name: 'Brown paint', points: 3 }],
      special: null,
    },
  }

  it('shows the challenge note with its categories', async () => {
    vi.mocked(getPeriod).mockReturnValue(ok(BROWN_WEEK))
    renderHome()

    const note = await screen.findByRole('note', { name: 'LIVE Brown Week' })
    expect(note).toHaveTextContent('Brown paint is worth +3.')
  })

  it('titles the challenge note with a live tag and the challenge name', async () => {
    vi.mocked(getPeriod).mockReturnValue(ok(BROWN_WEEK))
    renderHome()

    const title = await screen.findByRole('heading', {
      name: 'LIVE Brown Week',
    })
    expect(within(title).getByText('LIVE')).toBeInTheDocument()
    expect(within(title).getByText('Brown Week')).toBeInTheDocument()
  })

  it('keeps the challenge note out of the controls', async () => {
    vi.mocked(getPeriod).mockReturnValue(ok(BROWN_WEEK))
    renderHome()

    const note = await screen.findByRole('note')
    expect(within(note).queryByRole('button')).not.toBeInTheDocument()
    expect(within(note).queryByRole('link')).not.toBeInTheDocument()
    expect(note.closest('button, a')).toBeNull()
  })

  it('hides the challenge note once the challenge has ended', async () => {
    vi.setSystemTime(new Date('2026-11-16T08:05:00Z'))
    vi.mocked(getPeriod).mockReturnValue(
      ok({ ...WEEK, kind: 'challenge', name: 'Brown Week' }),
    )
    renderHome()

    expect(await screen.findByText('Ending now')).toBeInTheDocument()
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('shows no challenge note during a normal week', async () => {
    renderHome()

    expect(await screen.findByText('Week of Nov 9-15')).toBeInTheDocument()
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('links to the soonest upcoming challenge during a normal week', async () => {
    vi.mocked(getUpcomingChallenges).mockReturnValue(ok([DASH, BROWN]))
    renderHome()

    const row = await screen.findByRole('link', {
      name: /Upcoming challenge: Thanksgiving Dash/,
    })
    expect(row).toHaveAttribute('href', '/upcoming')
    expect(within(row).getByText('Thu Nov 26, 2:00 pm')).toBeInTheDocument()
    expect(screen.queryByText(/Brown Week/)).not.toBeInTheDocument()
  })

  it('hides the upcoming row while a challenge is running', async () => {
    vi.mocked(getPeriod).mockReturnValue(
      ok({ ...WEEK, kind: 'challenge', name: 'Brown Week' }),
    )
    vi.mocked(getUpcomingChallenges).mockReturnValue(ok([DASH]))
    renderHome()

    expect(await screen.findAllByText(/Brown Week/)).not.toHaveLength(0)
    expect(
      screen.queryByRole('link', { name: /Upcoming challenge/ }),
    ).not.toBeInTheDocument()
  })

  it('shows no upcoming row when nothing is scheduled', async () => {
    renderHome()

    expect(await screen.findByText('9')).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /Upcoming challenge/ }),
    ).not.toBeInTheDocument()
  })

  it('skips a challenge once its start time has passed', async () => {
    const started = upcomingChallenge(
      'Started',
      '2026-11-10T19:00:00Z',
      '2026-11-10T23:00:00Z',
    )
    vi.mocked(getUpcomingChallenges).mockReturnValue(ok([started, DASH]))
    renderHome()

    expect(
      await screen.findByRole('link', {
        name: /Upcoming challenge: Thanksgiving Dash/,
      }),
    ).toBeInTheDocument()
  })

  it('lets the player try again when scores fail to load', async () => {
    vi.mocked(getStanding)
      .mockReturnValueOnce(
        Promise.resolve({ ok: false, status: 0, error: 'network' }),
      )
      .mockReturnValue(ok(STANDING))
    renderHome()

    expect(
      await screen.findByText("Couldn't load your points"),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('6 Souls this week')).toBeInTheDocument()
  })

  it('turns the status bar forest to match the header', () => {
    renderHome()

    expect(statusBarColor()).toBe(FOREST)
  })
})
