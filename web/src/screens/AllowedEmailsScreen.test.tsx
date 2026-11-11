import { fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addAllowedEmail,
  getAllowedEmails,
  removeAllowedEmail,
  type Me,
} from '../lib/api'
import { AllowedEmailsScreen } from './AllowedEmailsScreen'
import { queryWrapper } from '../test/queryWrapper'

vi.mock('../lib/api', () => ({
  addAllowedEmail: vi.fn(),
  getAllowedEmails: vi.fn(),
  removeAllowedEmail: vi.fn(),
}))

const load = vi.mocked(getAllowedEmails)
const add = vi.mocked(addAllowedEmail)
const remove = vi.mocked(removeAllowedEmail)

const ME: Me = {
  id: '1',
  email: 'alice@example.com',
  display_name: 'Alice',
  is_admin: true,
  text_size: 'standard',
  flagged_count: 0,
}

const EMAILS = [
  { display_name: 'Alice', email: 'alice@example.com' },
  { display_name: 'Dana R.', email: 'dana@example.com' },
  { display_name: null, email: 'nora@example.com' },
]

const renderEmails = () => {
  const router = createMemoryRouter(
    [
      {
        element: <Outlet context={{ me: ME, setMe: vi.fn() }} />,
        children: [{ path: '/admin/emails', element: <AllowedEmailsScreen /> }],
      },
    ],
    { initialEntries: ['/admin/emails'] },
  )
  render(<RouterProvider router={router} />, { wrapper: queryWrapper() })
}

const rowFor = async (email: string) =>
  (await screen.findByText(email)).closest('li') as HTMLElement

const typeEmail = (value: string) =>
  fireEvent.change(screen.getByLabelText('Add someone'), {
    target: { value },
  })

const submit = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Add to the list' }))

describe('AllowedEmailsScreen', () => {
  beforeEach(() => {
    load.mockReset()
    add.mockReset()
    remove.mockReset()
    load.mockResolvedValue({ ok: true, data: { emails: EMAILS } })
  })

  it('lists who joined and who has not signed in yet', async () => {
    renderEmails()
    expect(await screen.findByText('3 people')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Admin tools/ })).toHaveAttribute(
      'href',
      '/admin',
    )
    const dana = await rowFor('dana@example.com')
    expect(within(dana).getByText('Joined')).toBeInTheDocument()
    expect(within(dana).getByText('Dana R.')).toBeInTheDocument()
    const nora = await rowFor('nora@example.com')
    expect(within(nora).getByText('Not signed in yet')).toBeInTheDocument()
  })

  it('does not offer to remove your own email', async () => {
    renderEmails()
    const alice = await rowFor('alice@example.com')
    expect(within(alice).queryByRole('button')).not.toBeInTheDocument()
  })

  it('adds an email to the list and clears the field', async () => {
    add.mockResolvedValue({
      ok: true,
      data: { display_name: null, email: 'carol@example.com' },
    })
    renderEmails()
    await screen.findByText('3 people')
    typeEmail('Carol@Example.com')
    submit()
    expect(await screen.findByText('carol@example.com')).toBeInTheDocument()
    expect(add).toHaveBeenCalledWith('Carol@Example.com')
    expect(screen.getByText('4 people')).toBeInTheDocument()
    expect(screen.getByLabelText('Add someone')).toHaveValue('')
  })

  it.each([
    ['invalid_email', 'Check the email address.'],
    ['already_allowed', 'That email is already on the list.'],
  ] as const)('explains %s on the field', async (error, message) => {
    add.mockResolvedValue({ ok: false, status: 422, error })
    renderEmails()
    await screen.findByText('3 people')
    typeEmail('nora@example.com')
    submit()
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.getByLabelText('Add someone')).toHaveAccessibleDescription(
      message,
    )
  })

  it('removes someone who has not signed in yet right away', async () => {
    remove.mockResolvedValue({ ok: true, data: null })
    renderEmails()
    const nora = await rowFor('nora@example.com')
    fireEvent.click(within(nora).getByRole('button', { name: 'Remove' }))
    await screen.findByText('2 people')
    expect(remove).toHaveBeenCalledWith('nora@example.com')
    expect(screen.queryByText('nora@example.com')).not.toBeInTheDocument()
  })

  it('asks before removing someone who joined', async () => {
    remove.mockResolvedValue({ ok: true, data: null })
    renderEmails()
    const dana = await rowFor('dana@example.com')
    fireEvent.click(within(dana).getByRole('button', { name: 'Remove' }))
    expect(remove).not.toHaveBeenCalled()
    expect(
      within(dana).getByText(
        'Dana R. will be signed out. Their photos and points stay.',
      ),
    ).toBeInTheDocument()
    fireEvent.click(within(dana).getByRole('button', { name: 'Keep' }))
    expect(within(dana).getByRole('button', { name: 'Remove' })).toBeVisible()
    fireEvent.click(within(dana).getByRole('button', { name: 'Remove' }))
    fireEvent.click(within(dana).getByRole('button', { name: 'Yes, remove' }))
    await screen.findByText('2 people')
    expect(remove).toHaveBeenCalledWith('dana@example.com')
  })

  it('says so when a removal fails', async () => {
    remove.mockResolvedValue({ ok: false, status: 0, error: 'network' })
    renderEmails()
    const nora = await rowFor('nora@example.com')
    fireEvent.click(within(nora).getByRole('button', { name: 'Remove' }))
    expect(
      await screen.findByText("We couldn't save that."),
    ).toBeInTheDocument()
    expect(screen.getByText('nora@example.com')).toBeInTheDocument()
  })

  it('offers a retry when the list fails to load', async () => {
    load.mockResolvedValueOnce({ ok: false, status: 0, error: 'network' })
    renderEmails()
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('3 people')).toBeInTheDocument()
  })
})
