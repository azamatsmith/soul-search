import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getChallenges,
  type ApiResult,
  type Challenge,
  type ChallengeList,
} from '../lib/api'
import { ChallengesScreen } from './ChallengesScreen'
import { queryWrapper } from '../test/queryWrapper'

vi.mock('../lib/api', () => ({ getChallenges: vi.fn() }))

const NOW = Date.parse('2026-11-26T23:00:00Z')
const RULES = { categories: [], false_call: -1, regular: 1 }
const challenge = (
  id: string,
  name: string,
  starts_at: string,
  ends_at: string,
): Challenge => ({ ends_at, id, name, rules: RULES, starts_at })

const LIST: ChallengeList = {
  finished: [
    {
      ...challenge(
        'c3',
        'Stripe Hunt',
        '2026-10-19T07:00:00Z',
        '2026-10-26T07:00:00Z',
      ),
      winner: { display_name: 'Marcus T.', points: 14 },
    },
    {
      ...challenge(
        'c4',
        'Flop',
        '2026-10-01T07:00:00Z',
        '2026-10-02T07:00:00Z',
      ),
      winner: null,
    },
  ],
  running: [
    challenge(
      'c1',
      'Thanksgiving Dash',
      '2026-11-26T22:00:00Z',
      '2026-11-27T02:00:00Z',
    ),
  ],
  upcoming: [
    challenge(
      'c2',
      'Brown Week',
      '2026-11-29T17:00:00Z',
      '2026-12-03T07:59:00Z',
    ),
  ],
}

const ok = <T,>(data: T): Promise<ApiResult<T>> =>
  Promise.resolve({ ok: true, data })

const renderScreen = () =>
  render(
    <MemoryRouter>
      <ChallengesScreen />
    </MemoryRouter>,
    { wrapper: queryWrapper() },
  )

describe('ChallengesScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] })
    vi.setSystemTime(NOW)
    vi.mocked(getChallenges).mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('groups challenges with their times and results', async () => {
    vi.mocked(getChallenges).mockReturnValue(ok(LIST))
    renderScreen()

    const live = await screen.findByRole('link', { name: /Thanksgiving Dash/ })
    expect(live).toHaveAttribute('href', '/admin/challenges/c1')
    expect(
      within(live).getByText('Thu Nov 26, 2:00 – 6:00 pm'),
    ).toBeInTheDocument()
    expect(
      within(live).getByText('Live · ends 6:00 pm · 3 hours left'),
    ).toBeInTheDocument()

    const next = screen.getByRole('link', { name: /Brown Week/ })
    expect(
      within(next).getByText('Sun Nov 29, 9:00 am – Wed Dec 2, 11:59 pm'),
    ).toBeInTheDocument()
    expect(
      within(next).getByText('Starts Sun 9:00 am · in 2 days'),
    ).toBeInTheDocument()

    const done = screen.getByRole('link', { name: /Stripe Hunt/ })
    expect(within(done).getByText('Oct 19 – Oct 25')).toBeInTheDocument()
    expect(within(done).getByText('Won by Marcus T.')).toBeInTheDocument()
    expect(screen.getByText('Nobody scored')).toBeInTheDocument()

    expect(
      screen.getByRole('heading', { name: 'Running now' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Coming up' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Finished' }),
    ).toBeInTheDocument()
  })

  it('links to a new challenge', async () => {
    vi.mocked(getChallenges).mockReturnValue(ok(LIST))
    renderScreen()

    expect(
      await screen.findByRole('link', { name: '+ New challenge' }),
    ).toHaveAttribute('href', '/admin/challenges/new')
  })

  it('hides sections with nothing in them', async () => {
    vi.mocked(getChallenges).mockReturnValue(
      ok({ ...LIST, finished: [], running: [] }),
    )
    renderScreen()

    expect(
      await screen.findByRole('heading', { name: 'Coming up' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Running now' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Finished' })).toBeNull()
  })

  it('says when there are no challenges yet', async () => {
    vi.mocked(getChallenges).mockReturnValue(
      ok({ finished: [], running: [], upcoming: [] }),
    )
    renderScreen()

    expect(await screen.findByText('No challenges yet.')).toBeInTheDocument()
  })

  it('offers a retry when the list fails to load', async () => {
    vi.mocked(getChallenges)
      .mockResolvedValueOnce({ ok: false, status: 0, error: 'network' })
      .mockReturnValue(ok(LIST))
    renderScreen()

    fireEvent.click(await screen.findByRole('button', { name: /Try again/ }))

    expect(
      await screen.findByRole('link', { name: /Thanksgiving Dash/ }),
    ).toBeInTheDocument()
  })
})
