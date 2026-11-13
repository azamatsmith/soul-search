import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSession } from './hooks/useSession'
import { getMe } from './lib/api'
import { routes } from './routes'
import { queryWrapper } from './test/queryWrapper'

const crash = vi.hoisted(() => ({ on: true }))

vi.mock('./hooks/useSession', () => ({ useSession: vi.fn() }))
vi.mock('./lib/api', () => ({
  getLeaderboard: vi.fn(() => new Promise(() => {})),
  getMe: vi.fn(),
  getPeriod: vi.fn(() => new Promise(() => {})),
  getUpcomingChallenges: vi.fn(() => new Promise(() => {})),
  getSightings: vi.fn(() => new Promise(() => {})),
  getStanding: vi.fn(() => new Promise(() => {})),
  postSighting: vi.fn(),
}))
vi.mock('./lib/supabase', () => ({ supabase: { auth: {} } }))
vi.mock('./screens/SightingsScreen', () => ({
  SightingsScreen: () => {
    if (crash.on) throw new Error('Sightings broke')
    return <h1>Sightings are back</h1>
  },
}))
vi.mock('./screens/SettingsScreen', () => ({
  SettingsScreen: () => {
    if (crash.on) throw new Error('Settings broke')
    return <h1>Settings are back</h1>
  },
}))

const renderAt = (path: string) =>
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [path] })}
    />,
    { wrapper: queryWrapper() },
  )

describe('route errors', () => {
  beforeEach(() => {
    crash.on = true
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubEnv('VITE_API_URL', '')
    vi.mocked(useSession).mockReturnValue({
      status: 'signed_in',
      session: { user: { id: 'user-1' } } as never,
    })
    vi.mocked(getMe).mockResolvedValue({
      ok: true,
      data: {
        id: 'user-1',
        email: 'bob@example.test',
        display_name: 'Bob',
        is_admin: false,
        text_size: 'standard',
        flagged_count: null,
      },
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('shows the error inside a tab and keeps the tab bar', async () => {
    renderAt('/sightings')

    expect(
      await screen.findByRole('heading', { name: 'Something went wrong' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('This screen hit a problem. Your photos are safe.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
  })

  it('lets the player switch tabs away from a broken one', async () => {
    renderAt('/sightings')
    await screen.findByRole('heading', { name: 'Something went wrong' })

    fireEvent.click(screen.getByRole('link', { name: 'Scores' }))

    expect(
      await screen.findByRole('heading', { name: 'Leaderboard' }),
    ).toBeInTheDocument()
  })

  it('shows a full-page error with a way back to Home outside the tabs', async () => {
    renderAt('/settings')

    expect(
      await screen.findByRole('heading', { name: 'Something went wrong' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('navigation', { name: 'Main' }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back to Home' }))

    expect(
      await screen.findByRole('heading', { name: 'Take photo' }),
    ).toBeInTheDocument()
  })

  it('tries the screen again once the problem is gone', async () => {
    renderAt('/settings')
    await screen.findByRole('heading', { name: 'Something went wrong' })

    crash.on = false
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(
      await screen.findByRole('heading', { name: 'Settings are back' }),
    ).toBeInTheDocument()
  })

  it('logs the error so it can be traced', async () => {
    renderAt('/sightings')
    await screen.findByRole('heading', { name: 'Something went wrong' })

    expect(console.error).toHaveBeenCalledWith(
      'Screen crashed at /sightings',
      expect.objectContaining({ message: 'Sightings broke' }),
    )
  })
})
