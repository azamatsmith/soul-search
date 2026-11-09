import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { TabBar } from './TabBar'

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <TabBar />
    </MemoryRouter>,
  )

describe('TabBar', () => {
  it('shows the three tabs in order', () => {
    renderAt('/')
    const nav = screen.getByRole('navigation', { name: 'Main' })
    const labels = Array.from(nav.querySelectorAll('a')).map(
      (link) => link.textContent,
    )
    expect(labels).toEqual(['Take photo', 'Sightings', 'Scores'])
  })

  it('links each tab to its screen', () => {
    renderAt('/')
    expect(screen.getByRole('link', { name: 'Take photo' })).toHaveAttribute(
      'href',
      '/',
    )
    expect(screen.getByRole('link', { name: 'Sightings' })).toHaveAttribute(
      'href',
      '/sightings',
    )
    expect(screen.getByRole('link', { name: 'Scores' })).toHaveAttribute(
      'href',
      '/scores',
    )
  })

  it('marks only the current tab', () => {
    renderAt('/scores')
    expect(screen.getByRole('link', { name: 'Scores' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(
      screen.getByRole('link', { name: 'Take photo' }),
    ).not.toHaveAttribute('aria-current')
  })
})
