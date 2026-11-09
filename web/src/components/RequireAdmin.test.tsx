import { render, screen } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { useMeContext } from '../hooks/useMeContext'
import type { Me } from '../lib/api'
import { RequireAdmin } from './RequireAdmin'

const ME: Me = {
  id: '1',
  email: 'heathyr@example.com',
  display_name: 'Heathyr',
  is_admin: false,
  text_size: 'standard',
  flagged_count: null,
}

const AdminPage = () => <p>Admin for {useMeContext().me.display_name}</p>

const renderAdmin = (me: Me) => {
  const router = createMemoryRouter(
    [
      {
        element: <Outlet context={{ me, setMe: () => {} }} />,
        children: [
          { path: '/', element: <p>Home page</p> },
          {
            element: <RequireAdmin />,
            children: [{ path: '/admin', element: <AdminPage /> }],
          },
        ],
      },
    ],
    { initialEntries: ['/admin'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('RequireAdmin', () => {
  it('sends players home', () => {
    const router = renderAdmin(ME)
    expect(screen.getByText('Home page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('lets admins through with the player context', () => {
    renderAdmin({ ...ME, is_admin: true })
    expect(screen.getByText('Admin for Heathyr')).toBeInTheDocument()
  })
})
