import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router'
import { describe, expect, it } from 'vitest'
import { TabBar } from './TabBar'

const BackButton = () => {
  const navigate = useNavigate()
  const handleBackClick = () => navigate(-1)
  return <button onClick={handleBackClick}>Back</button>
}

const renderHistory = (entries: string[]) =>
  render(
    <MemoryRouter initialEntries={entries}>
      <TabBar />
      <BackButton />
    </MemoryRouter>,
  )

const renderAt = (path: string) => renderHistory([path])

const indicatorIndex = () =>
  screen.getByTestId('tab-indicator').style.getPropertyValue('--tab-index')

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

  it.each([
    ['/', '0'],
    ['/sightings', '1'],
    ['/scores', '2'],
    ['/upcoming', '0'],
  ])('puts the indicator under the tab for %s', (path, index) => {
    renderAt(path)
    expect(indicatorIndex()).toBe(index)
  })

  it('keeps Take photo highlighted on upcoming challenges', () => {
    renderAt('/upcoming')
    expect(screen.getByRole('link', { name: 'Take photo' })).toHaveClass(
      /active/,
    )
    expect(screen.getByRole('link', { name: 'Scores' })).not.toHaveClass(
      /active/,
    )
  })

  it('moves the indicator when a tab is tapped', () => {
    renderAt('/')
    fireEvent.click(screen.getByRole('link', { name: 'Scores' }))
    expect(indicatorIndex()).toBe('2')
  })

  it('moves the indicator back when going back in history', () => {
    renderHistory(['/sightings', '/scores'])
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(indicatorIndex()).toBe('1')
  })
})
