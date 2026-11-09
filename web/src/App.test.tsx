import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

const stubFetch = (impl: () => Promise<unknown>) => {
  const fetchMock = vi.fn(impl)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('App', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:8000')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('shows the app name', () => {
    stubFetch(() => new Promise(() => {}))
    render(<App />)
    expect(
      screen.getByRole('heading', { name: 'Soul Search' }),
    ).toBeInTheDocument()
  })

  it('shows checking while the request is pending', () => {
    stubFetch(() => new Promise(() => {}))
    render(<App />)
    expect(screen.getByText('API: checking...')).toBeInTheDocument()
  })

  it('shows ok when /health responds 200', async () => {
    stubFetch(() => Promise.resolve({ ok: true, status: 200 }))
    render(<App />)
    expect(await screen.findByText('API: ok')).toBeInTheDocument()
  })

  it('shows unreachable when fetch rejects', async () => {
    stubFetch(() => Promise.reject(new Error('network down')))
    render(<App />)
    expect(await screen.findByText('API: unreachable')).toBeInTheDocument()
  })

  it('shows unreachable on a non-200 response', async () => {
    stubFetch(() => Promise.resolve({ ok: false, status: 500 }))
    render(<App />)
    expect(await screen.findByText('API: unreachable')).toBeInTheDocument()
  })

  it('calls /health without a double slash', async () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:8000/')
    const fetchMock = stubFetch(() =>
      Promise.resolve({ ok: true, status: 200 }),
    )
    render(<App />)
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
    render(<App />)
    expect(screen.getByText('API: unreachable')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
