import { fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getPeriod,
  getStanding,
  type ApiResult,
  type Me,
  type Period,
  type Standing,
} from '../lib/api'
import { TakePhotoScreen } from './TakePhotoScreen'
import { queryWrapper } from '../test/queryWrapper'
import { FOREST, setUpStatusBar, statusBarColor } from '../test/statusBar'

vi.mock('../lib/api', () => ({ getPeriod: vi.fn(), getStanding: vi.fn() }))

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
    categories: ['Alien Green'],
    bonuses: {},
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

  it('shows the challenge banner with its bonuses', async () => {
    vi.mocked(getPeriod).mockReturnValue(
      ok({
        ...WEEK,
        kind: 'challenge',
        name: 'Brown Week',
        rules: { ...WEEK.rules, bonuses: { 'Brown paint': 3 } },
      }),
    )
    renderHome()

    const banner = await screen.findByRole('region', {
      name: 'Brown Week is on',
    })
    expect(banner).toHaveTextContent('Brown paint is worth +3.')
  })

  it('hides the challenge banner once the challenge has ended', async () => {
    vi.setSystemTime(new Date('2026-11-16T08:05:00Z'))
    vi.mocked(getPeriod).mockReturnValue(
      ok({ ...WEEK, kind: 'challenge', name: 'Brown Week' }),
    )
    renderHome()

    expect(await screen.findByText('Ending now')).toBeInTheDocument()
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('shows no challenge banner during a normal week', async () => {
    renderHome()

    expect(await screen.findByText('Week of Nov 9-15')).toBeInTheDocument()
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
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
