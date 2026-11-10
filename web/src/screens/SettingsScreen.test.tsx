import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { putTextSize, type ApiResult, type Me } from '../lib/api'
import { supabase } from '../lib/supabase'
import { SettingsScreen } from './SettingsScreen'

vi.mock('../lib/api', () => ({ putTextSize: vi.fn() }))
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signOut: vi.fn() } },
}))

const save = vi.mocked(putTextSize)
const signOut = vi.mocked(supabase.auth.signOut)

const PLAYER: Me = {
  id: '1',
  email: 'heathyr@example.com',
  display_name: 'heathyr',
  is_admin: false,
  text_size: 'standard',
  flagged_count: null,
}

const renderSettings = (me: Me = PLAYER) => {
  const setMe = vi.fn()
  const router = createMemoryRouter(
    [
      {
        element: <Outlet context={{ me, setMe }} />,
        children: [{ path: '/settings', element: <SettingsScreen /> }],
      },
    ],
    { initialEntries: ['/settings'] },
  )
  render(<RouterProvider router={router} />)
  return { setMe }
}

const largeText = () => screen.getByRole('switch', { name: 'Large text' })

describe('SettingsScreen', () => {
  beforeEach(() => {
    save.mockReset()
    signOut.mockReset()
  })

  it('shows the profile, name row and version', () => {
    renderSettings()
    expect(
      screen.getByRole('heading', { name: 'Settings' }),
    ).toBeInTheDocument()
    expect(screen.getByText('H')).toBeInTheDocument()
    expect(screen.getByText('heathyr@example.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Your name/ })).toHaveAttribute(
      'href',
      '/settings/name',
    )
    expect(screen.getByRole('link', { name: /Home/ })).toHaveAttribute(
      'href',
      '/',
    )
    expect(screen.getByText('Version dev')).toBeInTheDocument()
  })

  it('turns on large text right away and saves it', async () => {
    save.mockResolvedValue({
      ok: true,
      data: { ...PLAYER, text_size: 'large' },
    })
    const { setMe } = renderSettings()
    expect(largeText()).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(largeText())
    expect(setMe).toHaveBeenCalledWith({ ...PLAYER, text_size: 'large' })
    expect(save).toHaveBeenCalledWith('large')
    await waitFor(() => expect(setMe).toHaveBeenCalledTimes(2))
  })

  it('puts the size back and explains when saving fails', async () => {
    save.mockResolvedValue({
      ok: false,
      status: 0,
      error: 'network',
    } as ApiResult<Me>)
    const { setMe } = renderSettings({ ...PLAYER, text_size: 'large' })
    expect(largeText()).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(largeText())
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't save that.",
    )
    expect(setMe).toHaveBeenLastCalledWith({ ...PLAYER, text_size: 'large' })
  })

  it('hides admin tools from players', () => {
    renderSettings()
    expect(screen.queryByText('Admin tools')).not.toBeInTheDocument()
  })

  it('shows admin tools with the flagged count to admins', () => {
    renderSettings({ ...PLAYER, is_admin: true, flagged_count: 3 })
    expect(screen.getByText('Only admins see this')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Admin tools/ })).toHaveAttribute(
      'href',
      '/admin',
    )
    expect(screen.getByText('3 photos to look at')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('uses the singular for one flagged photo', () => {
    renderSettings({ ...PLAYER, is_admin: true, flagged_count: 1 })
    expect(screen.getByText('1 photo to look at')).toBeInTheDocument()
  })

  it('drops the badge when nothing is flagged', () => {
    renderSettings({ ...PLAYER, is_admin: true, flagged_count: 0 })
    expect(screen.getByText('Nothing to look at')).toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('signs out', () => {
    renderSettings()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(signOut).toHaveBeenCalled()
  })
})
