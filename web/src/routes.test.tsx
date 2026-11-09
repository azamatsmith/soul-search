import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from './routes'

const renderAt = (path: string) =>
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [path] })}
    />,
  )

describe('routes', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([
    ['/', 'Take photo'],
    ['/sightings', 'Sightings'],
    ['/scores', 'Scores'],
  ])('shows the %s screen with the tab bar', (path, title) => {
    renderAt(path)
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
  })

  it('switches screens when a tab is tapped', async () => {
    renderAt('/')
    fireEvent.click(screen.getByRole('link', { name: 'Scores' }))
    expect(
      await screen.findByRole('heading', { name: 'Scores' }),
    ).toBeInTheDocument()
  })
})
