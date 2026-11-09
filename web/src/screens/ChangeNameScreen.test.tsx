import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { putDisplayName, type ApiResult, type Me } from '../lib/api'
import { ChangeNameScreen } from './ChangeNameScreen'

vi.mock('../lib/api', () => ({ putDisplayName: vi.fn() }))

const save = vi.mocked(putDisplayName)

const ME: Me = {
  id: '1',
  email: 'heathyr@example.com',
  display_name: 'Heathyr',
  is_admin: false,
  text_size: 'standard',
  flagged_count: null,
}

const renderChangeName = () => {
  const setMe = vi.fn()
  const router = createMemoryRouter(
    [
      {
        element: <Outlet context={{ me: ME, setMe }} />,
        children: [
          { path: '/settings/name', element: <ChangeNameScreen /> },
          { path: '/settings', element: <p>Settings page</p> },
        ],
      },
    ],
    { initialEntries: ['/settings/name'] },
  )
  render(<RouterProvider router={router} />)
  return { router, setMe }
}

const nameField = () => screen.getByLabelText('Your name')
const typeName = (value: string) =>
  fireEvent.change(nameField(), { target: { value } })
const submit = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Save name' }))

describe('ChangeNameScreen', () => {
  beforeEach(() => {
    save.mockReset()
  })

  it('starts from the current name', () => {
    renderChangeName()
    expect(
      screen.getByRole('heading', { name: 'Change your name' }),
    ).toBeInTheDocument()
    expect(nameField()).toHaveValue('Heathyr')
    expect(nameField()).toHaveAccessibleDescription('2 to 20 characters.')
    expect(screen.getByRole('link', { name: /Settings/ })).toHaveAttribute(
      'href',
      '/settings',
    )
  })

  it('checks the name before saving', () => {
    renderChangeName()
    typeName('H')
    submit()
    expect(nameField()).toHaveAccessibleDescription(
      'Names need at least 2 characters.',
    )
    expect(save).not.toHaveBeenCalled()
  })

  it('explains a taken name', async () => {
    save.mockResolvedValue({
      ok: false,
      status: 409,
      error: 'name_taken',
    } as ApiResult<Me>)
    renderChangeName()
    typeName('Dana')
    submit()
    expect(
      await screen.findByText(/Someone already goes by “Dana”/),
    ).toBeInTheDocument()
  })

  it('saves and goes back to settings', async () => {
    const saved = { ...ME, display_name: 'Heathyr K.' }
    save.mockResolvedValue({ ok: true, data: saved })
    const { router, setMe } = renderChangeName()
    typeName(' Heathyr K. ')
    submit()
    expect(await screen.findByText('Settings page')).toBeInTheDocument()
    expect(save).toHaveBeenCalledWith('Heathyr K.')
    expect(setMe).toHaveBeenCalledWith(saved)
    expect(router.state.location.pathname).toBe('/settings')
  })
})
