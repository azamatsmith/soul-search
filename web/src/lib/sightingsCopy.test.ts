import { describe, expect, it } from 'vitest'
import {
  cardKind,
  chipText,
  claimLine,
  dayHeader,
  groupByDay,
  type LogCard,
  timeText,
} from './sightingsCopy'

const THU_EVENING = Date.parse('2026-11-13T04:00:00Z')

const card = (changes: Partial<LogCard> = {}): LogCard => ({
  categories: [],
  checkNote: null,
  claimType: 'regular',
  id: 'a',
  kind: 'counted',
  name: 'Heathyr',
  photoUrl: null,
  points: 1,
  takenAt: '2026-11-13T00:31:00Z',
  ...changes,
})

describe('dayHeader', () => {
  it('labels today, yesterday and older days', () => {
    expect(dayHeader('2026-11-13T00:31:00Z', THU_EVENING)).toBe('Today · Thu')
    expect(dayHeader('2026-11-12T01:00:00Z', THU_EVENING)).toBe(
      'Yesterday · Wed',
    )
    expect(dayHeader('2026-11-09T18:00:00Z', THU_EVENING)).toBe('Mon')
  })

  it('keeps day headers right across the DST change', () => {
    const mondayNoon = Date.parse('2026-11-02T20:00:00Z')
    expect(dayHeader('2026-11-01T07:30:00Z', mondayNoon)).toBe(
      'Yesterday · Sun',
    )
    expect(dayHeader('2026-11-01T06:30:00Z', mondayNoon)).toBe('Sat')
  })
})

describe('groupByDay', () => {
  it('groups by Pacific day, not UTC', () => {
    const sundayNight = card({ id: 's', takenAt: '2026-11-16T07:30:00Z' })
    const groups = groupByDay([sundayNight], Date.parse('2026-11-16T07:45:00Z'))
    expect(groups.map((g) => g.header)).toEqual(['Today · Sun'])
  })

  it('sorts days and cards newest first', () => {
    const groups = groupByDay(
      [
        card({ id: 'wed', takenAt: '2026-11-12T01:00:00Z' }),
        card({ id: 'thu-early', takenAt: '2026-11-12T17:05:00Z' }),
        card({ id: 'thu-late', takenAt: '2026-11-13T00:31:00Z' }),
      ],
      THU_EVENING,
    )
    expect(groups.map((g) => [g.header, g.cards.map((c) => c.id)])).toEqual([
      ['Today · Thu', ['thu-late', 'thu-early']],
      ['Yesterday · Wed', ['wed']],
    ])
  })
})

describe('timeText', () => {
  it('shows Pacific clock time', () => {
    expect(timeText('2026-11-13T00:31:00Z')).toBe('4:31 PM')
  })
})

describe('cardKind', () => {
  const base = {
    claim_type: 'regular' as const,
    flagged: false,
    status: 'counted' as const,
  }

  it('maps status, flag and claim', () => {
    expect(cardKind(base)).toBe('counted')
    expect(cardKind({ ...base, status: 'waiting_review' })).toBe('counted')
    expect(cardKind({ ...base, claim_type: 'special' })).toBe('special')
    expect(cardKind({ ...base, flagged: true })).toBe('flagged')
  })

  it('lets a false call win over flagged', () => {
    expect(cardKind({ ...base, flagged: true, status: 'false_call' })).toBe(
      'false_call',
    )
  })
})

describe('chipText', () => {
  it('writes each chip from the points', () => {
    expect(chipText(card())).toBe('+1 Counted')
    expect(chipText(card({ kind: 'special', points: 3 }))).toBe('+3 Special')
    expect(chipText(card({ kind: 'flagged', points: 2 }))).toBe(
      '+2 · Flagged for a second look',
    )
    expect(chipText(card({ kind: 'false_call', points: -1 }))).toBe(
      '−1 False call',
    )
    expect(chipText(card({ kind: 'waiting' }))).toBe('Waiting to send')
  })
})

describe('claimLine', () => {
  it('names the claim', () => {
    expect(claimLine(card())).toBe('Regular')
    expect(
      claimLine(
        card({
          categories: ['Alien Green', 'Brown paint'],
          claimType: 'special',
        }),
      ),
    ).toBe('Special · Alien Green, Brown paint')
  })

  it('shows the check note on a false call, with a fallback', () => {
    expect(
      claimLine(
        card({ checkNote: 'Looks like a Kia Niro', kind: 'false_call' }),
      ),
    ).toBe('Looks like a Kia Niro')
    expect(claimLine(card({ kind: 'false_call' }))).toBe(
      'Photo check: not a Kia Soul',
    )
  })
})
