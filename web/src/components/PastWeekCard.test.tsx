import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { PastWeekSummary } from '../lib/api'
import { PastWeekCard } from './PastWeekCard'

const WEEK: PastWeekSummary = {
  ends_at: '2026-11-09T08:00:00Z',
  id: 'w1',
  me: { points: 18, rank: 2 },
  starts_at: '2026-11-02T08:00:00Z',
  winner: {
    display_name: 'Dana R.',
    is_me: false,
    player_id: 'p1',
    points: 21,
  },
}

const renderCard = (week: PastWeekSummary) =>
  render(
    <MemoryRouter>
      <ul>
        <PastWeekCard week={week} />
      </ul>
    </MemoryRouter>,
  )

describe('PastWeekCard', () => {
  it('shows the dates, winner and your result, linking to the week', () => {
    renderCard(WEEK)

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/past-weeks/w1')
    expect(link).toHaveTextContent('Nov 2-8')
    expect(link).toHaveTextContent('Dana R.')
    expect(link).toHaveTextContent('21')
    expect(link).toHaveTextContent('You: 2nd · 18 pts')
  })

  it('marks your own win', () => {
    renderCard({
      ...WEEK,
      me: { points: 24, rank: 1 },
      winner: { ...WEEK.winner!, display_name: 'Heathyr', is_me: true },
    })

    expect(screen.getByText('Heathyr (you)')).toBeInTheDocument()
    expect(screen.getByText('You won this week!')).toBeInTheDocument()
  })

  it('handles a week nobody scored in', () => {
    renderCard({ ...WEEK, me: null, winner: null })

    expect(screen.getByText('Nobody scored this week')).toBeInTheDocument()
  })
})
