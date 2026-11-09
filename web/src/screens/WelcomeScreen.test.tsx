import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { putDisplayName, type ApiResult, type Me } from '../lib/api'
import { WelcomeScreen } from './WelcomeScreen'

vi.mock('../lib/api', () => ({ putDisplayName: vi.fn() }))

const save = vi.mocked(putDisplayName)

const ME: Me = {
  id: '1',
  email: 'heathyr@example.com',
  display_name: null,
  is_admin: false,
  text_size: 'standard',
  flagged_count: null,
}

const fail = (status: number, error: string) =>
  ({ ok: false, status, error }) as ApiResult<Me>

const renderWelcome = () => {
  const setMe = vi.fn()
  const router = createMemoryRouter(
    [
      {
        element: <Outlet context={{ me: ME, setMe }} />,
        children: [{ path: '/welcome', element: <WelcomeScreen /> }],
      },
    ],
    { initialEntries: ['/welcome'] },
  )
  render(<RouterProvider router={router} />)
  return { setMe }
}

const nameField = () => screen.getByLabelText('Your name')
const typeName = (value: string) =>
  fireEvent.change(nameField(), { target: { value } })
const submit = () =>
  fireEvent.click(screen.getByRole('button', { name: "Let's go" }))

describe('WelcomeScreen', () => {
  beforeEach(() => {
    save.mockReset()
  })

  it('asks for a name', () => {
    renderWelcome()
    expect(screen.getByText('Welcome!')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'What should we call you?' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('This is how other players see you on the leaderboard.'),
    ).toBeInTheDocument()
    expect(nameField()).toHaveAccessibleDescription(
      '2 to 20 characters. You can change it later in Settings.',
    )
  })

  it('saves the trimmed name and updates me', async () => {
    const saved = { ...ME, display_name: 'Heathyr' }
    save.mockResolvedValue({ ok: true, data: saved })
    const { setMe } = renderWelcome()
    typeName('  Heathyr ')
    submit()
    expect(save).toHaveBeenCalledWith('Heathyr')
    await vi.waitFor(() => expect(setMe).toHaveBeenCalledWith(saved))
  })

  it('shows too short without calling the api', () => {
    renderWelcome()
    typeName('H')
    submit()
    expect(nameField()).toHaveAccessibleDescription(
      'Names need at least 2 characters.',
    )
    expect(save).not.toHaveBeenCalled()
  })

  it('shows too long and invalid characters without calling the api', () => {
    renderWelcome()
    typeName('a'.repeat(21))
    submit()
    expect(nameField()).toHaveAccessibleDescription(
      'Names can be up to 20 characters.',
    )
    typeName('Mom!')
    submit()
    expect(nameField()).toHaveAccessibleDescription(
      "Use only letters, numbers, spaces and . ' -",
    )
    expect(save).not.toHaveBeenCalled()
  })

  it('shows the name taken message with the typed name', async () => {
    save.mockResolvedValue(fail(409, 'name_taken'))
    renderWelcome()
    typeName('Mom')
    submit()
    expect(
      await screen.findByText(
        'Someone already goes by “Mom”. Try adding a last initial, like “Mom K.”',
      ),
    ).toBeInTheDocument()
  })

  it('shows the could-not-reach error on network failure', async () => {
    save.mockResolvedValue(fail(0, 'network'))
    renderWelcome()
    typeName('Heathyr')
    submit()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't reach Soul Search.Check your connection and try again.",
    )
  })

  it("disables Let's go while saving", () => {
    save.mockReturnValue(new Promise(() => {}))
    renderWelcome()
    typeName('Heathyr')
    submit()
    expect(screen.getByRole('button', { name: "Let's go" })).toBeDisabled()
  })

  it('clears the error when the name is edited', () => {
    renderWelcome()
    typeName('H')
    submit()
    typeName('He')
    expect(nameField()).toHaveAccessibleDescription(
      '2 to 20 characters. You can change it later in Settings.',
    )
  })
})
