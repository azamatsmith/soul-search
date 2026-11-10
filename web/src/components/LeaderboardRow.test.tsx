import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { LeaderboardEntry } from '../lib/api'
import { LeaderboardRow } from './LeaderboardRow'

const MOM: LeaderboardEntry = {
  count: 12,
  display_name: 'Mom',
  is_me: false,
  player_id: 'p1',
  points: 18,
  rank: 2,
}

const renderRow = (entry: LeaderboardEntry) =>
  render(
    <ol>
      <LeaderboardRow entry={entry} />
    </ol>,
  ).container.querySelector('li')

describe('LeaderboardRow', () => {
  it('shows rank, name, Souls and points', () => {
    const row = renderRow(MOM)

    expect(row).toHaveTextContent('2')
    expect(screen.getByText('Mom')).toBeInTheDocument()
    expect(screen.getByText('12 Souls')).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument()
    expect(row).toHaveAttribute('data-variant', 'default')
  })

  it('says 1 Soul for a single sighting', () => {
    renderRow({ ...MOM, count: 1 })

    expect(screen.getByText('1 Soul')).toBeInTheDocument()
  })

  it('marks the current player', () => {
    const row = renderRow({ ...MOM, is_me: true })

    expect(screen.getByText('Mom (you)')).toBeInTheDocument()
    expect(row).toHaveAttribute('data-variant', 'me')
  })

  it('styles first place', () => {
    expect(renderRow({ ...MOM, rank: 1 })).toHaveAttribute(
      'data-variant',
      'first',
    )
  })

  it('prefers the current player style over first place', () => {
    expect(renderRow({ ...MOM, is_me: true, rank: 1 })).toHaveAttribute(
      'data-variant',
      'me',
    )
  })
})
