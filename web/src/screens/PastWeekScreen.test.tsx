import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPastWeek, type ApiResult, type PastWeek } from '../lib/api'
import { PastWeekScreen } from './PastWeekScreen'
import { queryWrapper } from '../test/queryWrapper'

vi.mock('../lib/api', () => ({ getPastWeek: vi.fn() }))

const WEEK: PastWeek = {
  ends_at: '2026-11-09T08:00:00Z',
  id: 'w2',
  rows: [
    {
      count: 16,
      display_name: 'Dana R.',
      is_me: false,
      player_id: 'p1',
      points: 21,
      rank: 1,
    },
    {
      count: 14,
      display_name: 'Heathyr',
      is_me: true,
      player_id: 'p2',
      points: 18,
      rank: 2,
    },
  ],
  starts_at: '2026-11-02T08:00:00Z',
}

const ok = <T,>(data: T): Promise<ApiResult<T>> =>
  Promise.resolve({ ok: true, data })

const renderScreen = () =>
  render(
    <MemoryRouter initialEntries={['/past-weeks/w2']}>
      <Routes>
        <Route element={<PastWeekScreen />} path="/past-weeks/:id" />
      </Routes>
    </MemoryRouter>,
    { wrapper: queryWrapper() },
  )

describe('PastWeekScreen', () => {
  beforeEach(() => {
    vi.mocked(getPastWeek).mockReset()
  })

  it('shows the winner and final standings for the week in the URL', async () => {
    vi.mocked(getPastWeek).mockReturnValue(ok(WEEK))
    renderScreen()

    expect(
      await screen.findByRole('heading', { name: 'Dana R. won' }),
    ).toBeInTheDocument()
    expect(getPastWeek).toHaveBeenCalledWith('w2')
    expect(screen.getByText('Final · Nov 2-8')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('Heathyr (you)')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Past weeks/ })).toHaveAttribute(
      'href',
      '/past-weeks',
    )
  })

  it('says nobody scored in an empty week', async () => {
    vi.mocked(getPastWeek).mockReturnValue(ok({ ...WEEK, rows: [] }))
    renderScreen()

    expect(
      await screen.findByRole('heading', { name: 'Nobody scored' }),
    ).toBeInTheDocument()
  })

  it('shows the error state when the week is missing', async () => {
    vi.mocked(getPastWeek).mockReturnValue(
      Promise.resolve({ ok: false, status: 404, error: 'not_found' }),
    )
    renderScreen()

    expect(
      await screen.findByText(/Couldn't load this week/),
    ).toBeInTheDocument()
  })
})
