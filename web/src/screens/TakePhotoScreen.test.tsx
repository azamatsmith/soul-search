import { render, screen } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Me } from '../lib/api'
import { TakePhotoScreen } from './TakePhotoScreen'

const ME: Me = {
  id: '1',
  email: 'heathyr@example.com',
  display_name: 'heathyr',
  is_admin: false,
  text_size: 'standard',
  flagged_count: null,
}

const renderTakePhoto = () => {
  const router = createMemoryRouter(
    [
      {
        element: <Outlet context={{ me: ME, setMe: vi.fn() }} />,
        children: [{ path: '/', element: <TakePhotoScreen /> }],
      },
    ],
    { initialEntries: ['/'] },
  )
  render(<RouterProvider router={router} />)
}

const stubFetch = (impl: () => Promise<unknown>) => {
  const fetchMock = vi.fn(impl)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('TakePhotoScreen', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:8000')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('shows the screen title', () => {
    stubFetch(() => new Promise(() => {}))
    renderTakePhoto()
    expect(
      screen.getByRole('heading', { name: 'Take photo' }),
    ).toBeInTheDocument()
  })

  it('opens settings from the avatar', () => {
    stubFetch(() => new Promise(() => {}))
    renderTakePhoto()
    const avatar = screen.getByRole('link', { name: 'Settings' })
    expect(avatar).toHaveAttribute('href', '/settings')
    expect(avatar).toHaveTextContent('H')
  })

  it('shows checking while the request is pending', () => {
    stubFetch(() => new Promise(() => {}))
    renderTakePhoto()
    expect(screen.getByText('API: checking...')).toBeInTheDocument()
  })

  it('shows ok when /health responds 200', async () => {
    stubFetch(() => Promise.resolve({ ok: true, status: 200 }))
    renderTakePhoto()
    expect(await screen.findByText('API: ok')).toBeInTheDocument()
  })

  it('shows unreachable when fetch rejects', async () => {
    stubFetch(() => Promise.reject(new Error('network down')))
    renderTakePhoto()
    expect(await screen.findByText('API: unreachable')).toBeInTheDocument()
  })

  it('shows unreachable on a non-200 response', async () => {
    stubFetch(() => Promise.resolve({ ok: false, status: 500 }))
    renderTakePhoto()
    expect(await screen.findByText('API: unreachable')).toBeInTheDocument()
  })

  it('calls /health without a double slash', async () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:8000/')
    const fetchMock = stubFetch(() =>
      Promise.resolve({ ok: true, status: 200 }),
    )
    renderTakePhoto()
    await screen.findByText('API: ok')
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/health',
      expect.anything(),
    )
  })

  it('shows unreachable without calling fetch when VITE_API_URL is unset', () => {
    vi.stubEnv('VITE_API_URL', '')
    const fetchMock = stubFetch(() =>
      Promise.resolve({ ok: true, status: 200 }),
    )
    renderTakePhoto()
    expect(screen.getByText('API: unreachable')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
