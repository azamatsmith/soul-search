import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSession } from './hooks/useSession'
import { getMe } from './lib/api'
import { routes } from './routes'
import { queryWrapper } from './test/queryWrapper'

vi.mock('./hooks/useSession', () => ({ useSession: vi.fn() }))
vi.mock('./lib/api', () => ({
  getLeaderboard: vi.fn(() => new Promise(() => {})),
  getMe: vi.fn(),
  getPeriod: vi.fn(() => new Promise(() => {})),
  getSightings: vi.fn(() => new Promise(() => {})),
  getStanding: vi.fn(() => new Promise(() => {})),
  postSighting: vi.fn(),
}))
vi.mock('./lib/supabase', () => ({ supabase: { auth: {} } }))
vi.mock('./lib/camera', () => ({
  hasSeenCameraIntro: () => false,
  markCameraIntroSeen: vi.fn(),
  openCamera: vi.fn(),
  stopCamera: vi.fn(),
}))

const renderAt = (path: string) =>
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [path] })}
    />,
    { wrapper: queryWrapper() },
  )

describe('routes', () => {
  beforeEach(() => {
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
  })

  it.each([
    ['/', 'Take photo'],
    ['/sightings', 'Sightings'],
    ['/scores', 'Leaderboard'],
  ])('shows the %s screen with the tab bar', async (path, title) => {
    renderAt(path)
    expect(
      await screen.findByRole('heading', { name: title }),
    ).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
  })

  it('switches screens when a tab is tapped', async () => {
    renderAt('/')
    fireEvent.click(await screen.findByRole('link', { name: 'Scores' }))
    expect(
      await screen.findByRole('heading', { name: 'Leaderboard' }),
    ).toBeInTheDocument()
  })

  it('opens the photo flow full screen from the camera button', async () => {
    renderAt('/')
    fireEvent.click(
      await screen.findByRole('link', { name: 'Take photo of a Soul' }),
    )
    expect(
      await screen.findByRole('heading', {
        name: 'Soul Search needs your camera',
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('navigation', { name: 'Main' }),
    ).not.toBeInTheDocument()
  })
})
