import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CardKind, LogCard } from '../lib/sightingsCopy'
import { SightingCard } from './SightingCard'

const card = (changes: Partial<LogCard> = {}): LogCard => ({
  categories: [],
  checkNote: null,
  claimType: 'regular',
  id: 'a',
  kind: 'counted',
  name: 'Heathyr',
  photoUrl: 'https://signed.test/a.thumb.jpg',
  points: 1,
  takenAt: '2026-11-13T00:31:00Z',
  ...changes,
})

const CASES: [CardKind, Partial<LogCard>, string][] = [
  ['counted', {}, '+1 Counted'],
  [
    'special',
    { categories: ['Alien Green'], claimType: 'special', points: 2 },
    '+2 Special',
  ],
  ['flagged', { points: 2 }, '+2 · Flagged for a second look'],
  ['false_call', { points: -1 }, '−1 False call'],
  ['waiting', {}, 'Waiting to send'],
]

describe('SightingCard', () => {
  it.each(CASES)('renders the %s card', (kind, changes, chip) => {
    render(<SightingCard card={card({ ...changes, kind })} />)

    expect(screen.getByText(chip).dataset.kind).toBe(kind)
    expect(screen.getByText('Heathyr')).toBeInTheDocument()
    expect(screen.getByText('4:31 PM')).toBeInTheDocument()
  })

  it('shows the claim line', () => {
    render(
      <SightingCard
        card={card({
          categories: ['Alien Green'],
          claimType: 'special',
          kind: 'special',
        })}
      />,
    )

    expect(screen.getByText('Special · Alien Green')).toBeInTheDocument()
  })

  it('shows the photo', () => {
    const { container } = render(<SightingCard card={card()} />)

    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'https://signed.test/a.thumb.jpg',
    )
  })

  it('renders without a photo url', () => {
    const { container } = render(
      <SightingCard card={card({ photoUrl: null })} />,
    )

    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('+1 Counted')).toBeInTheDocument()
  })
})
