import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useQueuedSightings } from '../hooks/useQueuedSightings'
import {
  getSightings,
  type ApiResult,
  type LoggedSighting,
  type SightingsLog,
} from '../lib/api'
import { type QueuedSighting, UPLOADS_FLUSHED } from '../lib/uploadQueue'
import { SightingsScreen } from './SightingsScreen'
import { queryWrapper } from '../test/queryWrapper'

vi.mock('../lib/api', () => ({ getSightings: vi.fn() }))
vi.mock('../hooks/useQueuedSightings', () => ({ useQueuedSightings: vi.fn() }))
vi.mock('../hooks/useMeContext', () => ({
  useMeContext: () => ({ me: { display_name: 'Heathyr', id: 'me' } }),
}))

const NOW = new Date('2026-11-13T04:00:00Z')

const sighting = (changes: Partial<LoggedSighting>): LoggedSighting => ({
  categories: [],
  check_note: null,
  claim_type: 'regular',
  display_name: 'Heathyr',
  flagged: false,
  id: 's1',
  is_me: true,
  player_id: 'me',
  points: 1,
  status: 'counted',
  photo_url: null,
  taken_at: '2026-11-13T00:31:00Z',
  thumb_url: null,
  ...changes,
})

const EVERYONE = [
  sighting({ id: 'today' }),
  sighting({
    display_name: 'Marcus T.',
    id: 'wed',
    is_me: false,
    player_id: 'p2',
    taken_at: '2026-11-12T01:00:00Z',
  }),
]

const log = (sightings: LoggedSighting[]): SightingsLog => ({
  ends_at: '2026-11-16T08:00:00Z',
  sightings,
  starts_at: '2026-11-09T08:00:00Z',
})

const ok = <T,>(data: T): Promise<ApiResult<T>> =>
  Promise.resolve({ ok: true, data })
const failed: Promise<ApiResult<never>> = Promise.resolve({
  ok: false,
  status: 0,
  error: 'network',
})
const never = <T,>() => new Promise<ApiResult<T>>(() => {})

const queued = (id: string): QueuedSighting => ({
  categories: [],
  claimType: 'regular',
  createdAt: 1,
  id,
  location: null,
  photo: new Blob(['jpeg'], { type: 'image/jpeg' }),
  playerId: 'me',
  takenAt: '2026-11-13T00:35:00Z',
})

const queue = (items: QueuedSighting[]) =>
  vi.mocked(useQueuedSightings).mockReturnValue({ items, reload: vi.fn() })

const serve = (everyone: LoggedSighting[]) =>
  vi
    .mocked(getSightings)
    .mockImplementation((mine) =>
      ok(log(mine ? everyone.filter((s) => s.is_me) : everyone)),
    )

const renderLog = (path = '/sightings') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <SightingsScreen />
    </MemoryRouter>,
    { wrapper: queryWrapper() },
  )

describe('SightingsScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] })
    vi.setSystemTime(NOW)
    vi.mocked(getSightings).mockReset()
    queue([])
    URL.createObjectURL = vi.fn(() => 'blob:queued')
    URL.revokeObjectURL = vi.fn()
  })

  it('shows the placeholder while loading', () => {
    vi.mocked(getSightings).mockImplementation(() => never())
    renderLog()

    expect(screen.getByLabelText('Loading sightings')).toBeInTheDocument()
  })

  it('groups cards under day headers', async () => {
    serve(EVERYONE)
    renderLog()

    const today = await screen.findByRole('list', { name: 'Today · Thu' })
    expect(within(today).getByText('Heathyr')).toBeInTheDocument()
    const wed = screen.getByRole('list', { name: 'Yesterday · Wed' })
    expect(within(wed).getByText('Marcus T.')).toBeInTheDocument()
  })

  it('switches to Just mine', async () => {
    serve(EVERYONE)
    renderLog()
    await screen.findByText('Marcus T.')

    fireEvent.click(screen.getByRole('button', { name: 'Just mine' }))

    expect(await screen.findByText('1 this week')).toBeInTheDocument()
    expect(screen.queryByText('Marcus T.')).toBeNull()
  })

  it('counts the shown cards', async () => {
    serve(EVERYONE)
    renderLog()

    expect(await screen.findByText('2 this week')).toBeInTheDocument()
  })

  it('shows the empty state', async () => {
    serve([])
    renderLog()

    expect(await screen.findByText('No sightings yet')).toBeInTheDocument()
    expect(
      screen.getByText(
        "Photos from everyone in the group show up here as soon as they're sent.",
      ),
    ).toBeInTheDocument()
  })

  it('shows the load error and retries', async () => {
    vi.mocked(getSightings).mockImplementation(() => failed)
    renderLog()

    expect(
      await screen.findByText(/Couldn't load sightings/),
    ).toBeInTheDocument()

    serve(EVERYONE)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Marcus T.')).toBeInTheDocument()
  })

  it('merges a waiting card from the queue', async () => {
    queue([queued('q1')])
    serve(EVERYONE)
    renderLog()

    expect(await screen.findByText('Waiting to send')).toBeInTheDocument()
    expect(screen.getByText('3 this week')).toBeInTheDocument()
  })

  it('keeps waiting cards on screen when the log cannot load', async () => {
    queue([queued('q1')])
    vi.mocked(getSightings).mockImplementation(() => failed)
    renderLog()

    expect(
      await screen.findByText(/Couldn't load sightings/),
    ).toBeInTheDocument()
    expect(screen.getByText('Waiting to send')).toBeInTheDocument()
  })

  it('shows a sent sighting once even while it is still queued', async () => {
    queue([queued('today')])
    serve(EVERYONE)
    renderLog()

    expect(await screen.findByText('2 this week')).toBeInTheDocument()
    expect(screen.queryByText('Waiting to send')).toBeNull()
  })
  it('reloads the log as soon as queued photos are sent', async () => {
    serve(EVERYONE)
    renderLog()
    await screen.findByText('Marcus T.')
    const before = vi.mocked(getSightings).mock.calls.length

    act(() => {
      window.dispatchEvent(new Event(UPLOADS_FLUSHED))
    })

    await waitFor(() =>
      expect(vi.mocked(getSightings).mock.calls.length).toBeGreaterThan(before),
    )
  })

  it('opens a sighting full screen and closes it', async () => {
    serve(EVERYONE)
    renderLog()

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Open photo from Marcus T., 5:00 PM',
      }),
    )
    expect(
      screen.getByRole('dialog', { name: 'Marcus T.' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('opens a linked photo and closes it', async () => {
    serve(EVERYONE)
    renderLog('/sightings?photo=wed')

    expect(
      await screen.findByRole('dialog', { name: 'Marcus T.' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('ignores a link to a photo that is not in the log', async () => {
    serve(EVERYONE)
    renderLog('/sightings?photo=gone')

    await screen.findByText('Marcus T.')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens a waiting card with its queued photo', async () => {
    queue([queued('q1')])
    serve([])
    renderLog()

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Open photo from Heathyr, 4:35 PM',
      }),
    )

    const dialog = screen.getByRole('dialog', { name: 'Heathyr' })
    expect(within(dialog).getByText('Waiting to send')).toBeInTheDocument()
    expect(
      within(dialog).getByRole('img', { name: 'Photo from Heathyr' }),
    ).toHaveAttribute('src', 'blob:queued')
  })
})
