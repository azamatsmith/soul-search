import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { Period, Standing } from '../lib/api'
import { HomeHeader } from './HomeHeader'

const NOW = Date.parse('2026-11-12T20:00:00Z')

const RULES = {
  bonuses: {},
  categories: [],
  false_call: -1,
  regular: 1,
  special: 2,
}

const WEEK: Period = {
  ends_at: '2026-11-16T08:00:00Z',
  id: 'w1',
  kind: 'week',
  name: null,
  rules: RULES,
  starts_at: '2026-11-09T08:00:00Z',
}

const CHALLENGE: Period = {
  ends_at: '2026-11-16T07:59:00Z',
  id: 'c1',
  kind: 'challenge',
  name: 'Brown Week',
  rules: RULES,
  starts_at: '2026-11-12T17:00:00Z',
}

const STANDING: Standing = {
  count: 4,
  last_photo_url: null,
  next_rank: 1,
  points: 6,
  points_behind_next: 1,
  rank: 2,
  total_players: 19,
}

const renderHeader = (period: Period) =>
  render(
    <MemoryRouter>
      <HomeHeader
        name="Heathyr"
        now={NOW}
        period={period}
        standing={STANDING}
      />
    </MemoryRouter>,
  )

describe('HomeHeader', () => {
  it('shows the week with the short time left', () => {
    renderHeader(WEEK)

    expect(screen.getByText('Week of Nov 9-15')).toBeInTheDocument()
    expect(screen.getByText('3 days left')).toBeInTheDocument()
    expect(screen.getByText('Your points')).toBeInTheDocument()
  })

  it('shows a running challenge with the full time left', () => {
    renderHeader(CHALLENGE)

    expect(screen.getByText('Challenge · Brown Week')).toBeInTheDocument()
    expect(
      screen.getByText('Ends Sun 11:59 pm · 3 days left'),
    ).toBeInTheDocument()
    expect(screen.getByText('Challenge points')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('2nd')).toBeInTheDocument()
  })
})
