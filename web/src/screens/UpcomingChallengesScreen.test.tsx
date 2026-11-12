import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getUpcomingChallenges,
  type ApiResult,
  type Challenge,
} from '../lib/api'
import { queryWrapper } from '../test/queryWrapper'
import { UpcomingChallengesScreen } from './UpcomingChallengesScreen'

vi.mock('../lib/api', () => ({ getUpcomingChallenges: vi.fn() }))

const DASH: Challenge = {
  ends_at: '2026-11-27T02:00:00Z',
  id: 'c1',
  name: 'Thanksgiving Dash',
  rules: {
    categories: [{ name: 'Alien Green', points: 3 }],
    false_call: -1,
    regular: 1,
  },
  starts_at: '2026-11-26T22:00:00Z',
}

const BROWN: Challenge = {
  ends_at: '2026-12-07T08:00:00Z',
  id: 'c2',
  name: 'Brown Week',
  rules: {
    categories: [{ name: 'Brown paint', points: 3 }],
    false_call: -1,
    regular: 1,
  },
  starts_at: '2026-11-30T08:00:00Z',
}

const ok = <T,>(data: T): Promise<ApiResult<T>> =>
  Promise.resolve({ ok: true, data })

const renderScreen = () =>
  render(
    <MemoryRouter>
      <UpcomingChallengesScreen />
    </MemoryRouter>,
    { wrapper: queryWrapper() },
  )

const cards = () => screen.getAllByRole('listitem')

describe('UpcomingChallengesScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-11-12T20:00:00Z'))
    vi.mocked(getUpcomingChallenges).mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows each upcoming challenge in the order the server sends them', async () => {
    vi.mocked(getUpcomingChallenges).mockReturnValue(ok([DASH, BROWN]))
    renderScreen()

    const headings = await screen.findAllByRole('heading', { level: 2 })
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Thanksgiving Dash',
      'Brown Week',
    ])
    const [soonest, later] = cards()
    expect(within(soonest).getByText('In 2 weeks')).toBeInTheDocument()
    expect(
      within(soonest).getByText('Thu Nov 26, 2:00 – 6:00 pm'),
    ).toBeInTheDocument()
    expect(
      within(soonest).getByText('Regular +1, Alien Green +3'),
    ).toBeInTheDocument()
    expect(within(later).getByText('In 2 weeks')).toBeInTheDocument()
    expect(
      within(later).getByText('Mon Nov 30 – Sun Dec 6'),
    ).toBeInTheDocument()
  })

  it('reminds players how long only the soonest challenge runs', async () => {
    vi.mocked(getUpcomingChallenges).mockReturnValue(ok([DASH, BROWN]))
    renderScreen()

    await screen.findByText('Thanksgiving Dash')
    const [soonest, later] = cards()
    expect(within(soonest).getByText(/For those 4 hours/)).toBeInTheDocument()
    expect(within(later).queryByText(/For those/)).not.toBeInTheDocument()
  })

  it('heads back to Home with the times note', async () => {
    vi.mocked(getUpcomingChallenges).mockReturnValue(ok([DASH]))
    renderScreen()

    await screen.findByText('Thanksgiving Dash')
    expect(screen.getByText('Coming soon')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Home/ })).toHaveAttribute(
      'href',
      '/',
    )
    expect(screen.getByText(/All times Pacific/)).toBeInTheDocument()
  })

  it('says so when nothing is scheduled', async () => {
    vi.mocked(getUpcomingChallenges).mockReturnValue(ok([]))
    renderScreen()

    expect(
      await screen.findByText('No challenges are scheduled yet.'),
    ).toBeInTheDocument()
  })

  it('offers a retry when loading fails', async () => {
    vi.mocked(getUpcomingChallenges)
      .mockResolvedValueOnce({ error: 'network', ok: false, status: 0 })
      .mockReturnValueOnce(ok([DASH]))
    renderScreen()

    fireEvent.click(await screen.findByRole('button', { name: /try again/i }))

    expect(await screen.findByText('Thanksgiving Dash')).toBeInTheDocument()
  })
})
