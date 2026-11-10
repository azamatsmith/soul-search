import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAllowedEmails } from '../lib/api'
import { AdminScreen } from './AdminScreen'

vi.mock('../lib/api', () => ({ getAllowedEmails: vi.fn() }))

const load = vi.mocked(getAllowedEmails)

const renderAdmin = () => {
  const router = createMemoryRouter(
    [{ path: '/admin', element: <AdminScreen /> }],
    { initialEntries: ['/admin'] },
  )
  render(<RouterProvider router={router} />)
}

describe('AdminScreen', () => {
  beforeEach(() => {
    load.mockReset()
  })

  it('links to allowed emails with the head count', async () => {
    load.mockResolvedValue({
      ok: true,
      data: {
        emails: [
          { display_name: 'Dana R.', email: 'dana@example.com' },
          { display_name: null, email: 'nora@example.com' },
        ],
      },
    })
    renderAdmin()
    expect(screen.getByText('Admins only')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Admin tools' }),
    ).toBeInTheDocument()
    const row = screen.getByRole('link', { name: /Allowed emails/ })
    expect(row).toHaveAttribute('href', '/admin/emails')
    expect(await screen.findByText('2 people')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Every change here is saved to the change history with your name.',
      ),
    ).toBeInTheDocument()
  })

  it('keeps the row usable when the count fails to load', async () => {
    load.mockResolvedValue({ ok: false, status: 0, error: 'network' })
    renderAdmin()
    await waitFor(() => expect(load).toHaveBeenCalled())
    expect(await screen.findByText('Who can sign in')).toBeInTheDocument()
  })
})
