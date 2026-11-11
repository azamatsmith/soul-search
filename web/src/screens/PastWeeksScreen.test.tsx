import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPastWeeks, type ApiResult, type PastWeeks } from '../lib/api'
import { PastWeeksScreen } from './PastWeeksScreen'
import { queryWrapper } from '../test/queryWrapper'

vi.mock('../lib/api', () => ({ getPastWeeks: vi.fn() }))

const PAST: PastWeeks = {
  total_players: 23,
  weeks: [
    {
      ends_at: '2026-11-09T08:00:00Z',
      id: 'w2',
      me: { points: 18, rank: 2 },
      starts_at: '2026-11-02T08:00:00Z',
      winner: {
        display_name: 'Dana R.',
        is_me: false,
        player_id: 'p1',
        points: 21,
      },
    },
    {
      ends_at: '2026-11-02T08:00:00Z',
      id: 'w1',
      me: { points: 24, rank: 1 },
      starts_at: '2026-10-26T08:00:00Z',
      winner: {
        display_name: 'Heathyr',
        is_me: true,
        player_id: 'p2',
        points: 24,
      },
    },
  ],
}

const ok = <T,>(data: T): Promise<ApiResult<T>> =>
  Promise.resolve({ ok: true, data })

const renderScreen = () =>
  render(
    <MemoryRouter>
      <PastWeeksScreen />
    </MemoryRouter>,
    { wrapper: queryWrapper() },
  )

describe('PastWeeksScreen', () => {
  beforeEach(() => {
    vi.mocked(getPastWeeks).mockReset()
  })

  it('lists closed weeks in the order the server sends them', async () => {
    vi.mocked(getPastWeeks).mockReturnValue(ok(PAST))
    renderScreen()

    const links = await screen.findAllByRole('link', { name: /Nov|Oct/ })
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/past-weeks/w2',
      '/past-weeks/w1',
    ])
    expect(screen.getByText('23 players')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Scores/ })).toHaveAttribute(
      'href',
      '/scores',
    )
  })

  it('explains when no week has finished yet', async () => {
    vi.mocked(getPastWeeks).mockReturnValue(ok({ total_players: 3, weeks: [] }))
    renderScreen()

    expect(
      await screen.findByText(/Finished weeks show up here/),
    ).toBeInTheDocument()
  })

  it('shows the error state and retries', async () => {
    vi.mocked(getPastWeeks)
      .mockReturnValueOnce(
        Promise.resolve({ ok: false, status: 0, error: 'network' }),
      )
      .mockReturnValue(ok(PAST))
    renderScreen()

    fireEvent.click(await screen.findByRole('button', { name: /Try again/ }))

    expect(await screen.findByText('Dana R.')).toBeInTheDocument()
  })
})
