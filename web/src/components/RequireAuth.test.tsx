import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSession, type SessionState } from '../hooks/useSession'
import { getMe, putDisplayName, type ApiResult, type Me } from '../lib/api'
import { supabase } from '../lib/supabase'
import { routes } from '../routes'
import { queryWrapper } from '../test/queryWrapper'

vi.mock('../hooks/useSession', () => ({ useSession: vi.fn() }))
vi.mock('../lib/api', () => ({
  getLeaderboard: vi.fn(() => new Promise(() => {})),
  getPeriod: vi.fn(() => new Promise(() => {})),
  getStanding: vi.fn(() => new Promise(() => {})),
  postSighting: vi.fn(),
  getMe: vi.fn(),
  putDisplayName: vi.fn(),
  sendCode: vi.fn(),
  verifyCode: vi.fn(),
}))
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signOut: vi.fn(), setSession: vi.fn() } },
}))

const session = vi.mocked(useSession)
const me = vi.mocked(getMe)
const saveName = vi.mocked(putDisplayName)
const signOut = vi.mocked(supabase.auth.signOut)

const ME: Me = {
  id: 'user-1',
  email: 'bob@example.test',
  display_name: 'Bob',
  is_admin: false,
  text_size: 'standard',
  flagged_count: null,
}

const signedIn: SessionState = {
  status: 'signed_in',
  session: { user: { id: 'user-1' } } as never,
}

const fail = (status: number, error: string) =>
  ({ ok: false, status, error }) as ApiResult<Me>

const renderAt = (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />, { wrapper: queryWrapper() })
  return router
}

describe('RequireAuth', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', '')
    session.mockReturnValue(signedIn)
    me.mockReset()
    saveName.mockReset()
    signOut.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('sends a signed-out player to sign in', async () => {
    session.mockReturnValue({ status: 'signed_out' })
    const router = renderAt('/scores')
    expect(
      await screen.findByRole('button', { name: 'Email me a code' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/sign-in')
  })

  it('shows the rolling car while the session loads', () => {
    session.mockReturnValue({ status: 'loading' })
    renderAt('/')
    expect(screen.getByRole('status')).toHaveTextContent('Loading Soul Search…')
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(me).not.toHaveBeenCalled()
  })

  it('shows the rolling car on sign in while the session loads', () => {
    session.mockReturnValue({ status: 'loading' })
    renderAt('/sign-in')
    expect(screen.getByRole('status')).toHaveTextContent('Loading Soul Search…')
    expect(
      screen.queryByRole('button', { name: 'Email me a code' }),
    ).not.toBeInTheDocument()
  })

  it('sends a player without a display name to welcome', async () => {
    me.mockResolvedValue({ ok: true, data: { ...ME, display_name: null } })
    const router = renderAt('/')
    expect(
      await screen.findByRole('heading', { name: 'What should we call you?' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/welcome')
  })

  it('shows the app to a player with a name', async () => {
    me.mockResolvedValue({ ok: true, data: ME })
    renderAt('/scores')
    expect(
      await screen.findByRole('heading', { name: 'Leaderboard' }),
    ).toBeInTheDocument()
  })

  it('leaves welcome for the app once the name is saved', async () => {
    me.mockResolvedValue({ ok: true, data: { ...ME, display_name: null } })
    saveName.mockResolvedValue({ ok: true, data: ME })
    const router = renderAt('/welcome')
    fireEvent.change(await screen.findByLabelText('Your name'), {
      target: { value: 'Bob' },
    })
    fireEvent.click(screen.getByRole('button', { name: "Let's go" }))
    expect(
      await screen.findByRole('heading', { name: 'Take photo' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('sends a named player away from welcome', async () => {
    me.mockResolvedValue({ ok: true, data: ME })
    const router = renderAt('/welcome')
    expect(
      await screen.findByRole('heading', { name: 'Take photo' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it.each([
    [403, 'not_allowed'],
    [401, 'unauthenticated'],
  ])('signs out on a %i %s from me', async (status, error) => {
    me.mockResolvedValue(fail(status, error))
    renderAt('/')
    await vi.waitFor(() =>
      expect(signOut).toHaveBeenCalledWith({ scope: 'local' }),
    )
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('shows try again when me cannot be loaded and retries', async () => {
    me.mockResolvedValueOnce(fail(0, 'network'))
    me.mockResolvedValueOnce({ ok: true, data: ME })
    renderAt('/')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't reach Soul Search.",
    )
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(
      await screen.findByRole('heading', { name: 'Take photo' }),
    ).toBeInTheDocument()
    expect(me).toHaveBeenCalledTimes(2)
  })

  it("applies the player's large text setting", async () => {
    me.mockResolvedValue({ ok: true, data: { ...ME, text_size: 'large' } })
    renderAt('/')
    await screen.findByRole('heading', { name: 'Take photo' })
    await waitFor(() =>
      expect(document.documentElement.dataset.text).toBe('large'),
    )
  })

  it('sends a signed-in player away from sign in', async () => {
    me.mockResolvedValue({ ok: true, data: ME })
    const router = renderAt('/sign-in')
    expect(
      await screen.findByRole('heading', { name: 'Take photo' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('shows try again when the stored session cannot be refreshed', async () => {
    const retry = vi.fn()
    session.mockReturnValue({ status: 'unreachable', retry })
    const router = renderAt('/scores')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't reach Soul Search.",
    )
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalledTimes(1)
    expect(router.state.location.pathname).toBe('/scores')
  })

  it('sends an unreachable session from sign in to the retry screen', async () => {
    session.mockReturnValue({ status: 'unreachable', retry: vi.fn() })
    const router = renderAt('/sign-in')
    expect(
      await screen.findByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })
})
