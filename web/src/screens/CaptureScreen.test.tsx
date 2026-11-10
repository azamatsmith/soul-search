import { act, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPeriod, postSighting, type Period } from '../lib/api'
import {
  hasSeenCameraIntro,
  markCameraIntroSeen,
  openCamera,
} from '../lib/camera'
import { fileToJpeg, frameToJpeg } from '../lib/photo'
import { deviceQueue, type QueuedSighting } from '../lib/uploadQueue'
import { CaptureScreen } from './CaptureScreen'

vi.mock('../lib/api', () => ({ getPeriod: vi.fn(), postSighting: vi.fn() }))
vi.mock('../lib/camera', () => ({
  hasSeenCameraIntro: vi.fn(),
  markCameraIntroSeen: vi.fn(),
  openCamera: vi.fn(),
  stopCamera: vi.fn(),
}))
vi.mock('../lib/photo', () => ({ fileToJpeg: vi.fn(), frameToJpeg: vi.fn() }))
vi.mock('../lib/uploadQueue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/uploadQueue')>()),
  deviceQueue: { add: vi.fn(), all: vi.fn(), remove: vi.fn() },
}))

const PERIOD: Period = {
  kind: 'week',
  id: 'w1',
  name: null,
  starts_at: '2026-11-09T08:00:00Z',
  ends_at: '2026-11-16T08:00:00Z',
  rules: {
    regular: 1,
    special: 2,
    false_call: -1,
    categories: ['Alien Green', 'Brown paint'],
    bonuses: { 'Brown paint': 3 },
  },
}
const STREAM = { getTracks: () => [] } as unknown as MediaStream
const PHOTO = new Blob(['jpeg'], { type: 'image/jpeg' })

const renderCapture = () => {
  const router = createMemoryRouter(
    [
      { path: '/', element: <p>Home screen</p> },
      {
        element: <Outlet context={{ me: { id: 'p1' }, setMe: vi.fn() }} />,
        children: [{ path: '/capture', element: <CaptureScreen /> }],
      },
    ],
    { initialEntries: ['/capture'] },
  )
  render(<RouterProvider router={router} />)
}

const click = (name: string | RegExp) =>
  fireEvent.click(screen.getByRole('button', { name }))

const SAVED = {
  ok: true as const,
  data: {
    period_points: 7,
    sighting: {
      id: 's',
      taken_at: '',
      claim_type: 'special' as const,
      categories: ['Brown paint'],
      points: 3,
      status: 'waiting_review',
      flagged: false,
    },
  },
}

const pickBrownSpecial = () => {
  fireEvent.click(screen.getByRole('radio', { name: /Special Soul/ }))
  click('Brown paint')
}

const reachClaimStep = async () => {
  renderCapture()
  await screen.findByText('Fit the whole car in the frame')
  click('Take photo')
  await screen.findByText('Can you see the Soul?')
  click('Use this photo')
  await screen.findByText('What did you find?')
}

describe('CaptureScreen', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:photo')
    URL.revokeObjectURL = vi.fn()
    vi.mocked(hasSeenCameraIntro).mockReturnValue(true)
    vi.mocked(openCamera).mockResolvedValue({ ok: true, stream: STREAM })
    vi.mocked(frameToJpeg).mockResolvedValue(PHOTO)
    vi.mocked(fileToJpeg).mockResolvedValue(PHOTO)
    vi.mocked(getPeriod).mockResolvedValue({ ok: true, data: PERIOD })
    vi.mocked(deviceQueue.add).mockResolvedValue()
    vi.mocked(deviceQueue.remove).mockResolvedValue()
    vi.stubGlobal('navigator', { ...navigator, geolocation: undefined })
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('explains the camera before the first request', async () => {
    vi.mocked(hasSeenCameraIntro).mockReturnValue(false)
    renderCapture()

    expect(
      screen.getByRole('heading', { name: 'Soul Search needs your camera' }),
    ).toBeInTheDocument()
    expect(openCamera).not.toHaveBeenCalled()

    click('Continue')

    expect(markCameraIntroSeen).toHaveBeenCalled()
    expect(
      await screen.findByText('Fit the whole car in the frame'),
    ).toBeInTheDocument()
    expect(openCamera).toHaveBeenCalledTimes(1)
  })

  it('goes home from the explanation on Not now', async () => {
    vi.mocked(hasSeenCameraIntro).mockReturnValue(false)
    renderCapture()

    click('Not now')

    expect(await screen.findByText('Home screen')).toBeInTheDocument()
  })

  it('goes home on Cancel', async () => {
    renderCapture()
    await screen.findByText('Fit the whole car in the frame')

    click('Cancel')

    expect(await screen.findByText('Home screen')).toBeInTheDocument()
  })

  it('shows how to turn the camera back on and tries again', async () => {
    vi.mocked(openCamera)
      .mockResolvedValueOnce({ ok: false, reason: 'denied' })
      .mockResolvedValueOnce({ ok: true, stream: STREAM })
    renderCapture()

    expect(
      await screen.findByRole('heading', { name: 'The camera is turned off' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('list')).toHaveTextContent(
      'Tap Camera and choose Allow',
    )

    click('I turned it on. Try again')

    expect(
      await screen.findByText('Fit the whole car in the frame'),
    ).toBeInTheDocument()
    expect(openCamera).toHaveBeenCalledTimes(2)
  })

  it('offers the iPhone camera when the camera cannot start', async () => {
    vi.mocked(openCamera).mockResolvedValue({
      ok: false,
      reason: 'unavailable',
    })
    renderCapture()

    expect(
      await screen.findByRole('heading', { name: "The camera didn't start" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Use the iPhone camera instead' }),
    ).toBeInTheDocument()
  })

  it('continues at the check step with a photo from the iPhone camera', async () => {
    vi.mocked(openCamera).mockResolvedValue({ ok: false, reason: 'denied' })
    renderCapture()
    await screen.findByRole('heading', { name: 'The camera is turned off' })
    const file = new File(['x'], 'IMG_1.jpg', { type: 'image/jpeg' })

    fireEvent.change(screen.getByTestId('native-camera'), {
      target: { files: [file] },
    })

    expect(await screen.findByText('Can you see the Soul?')).toBeInTheDocument()
    expect(fileToJpeg).toHaveBeenCalledWith(file)
  })

  it('takes a photo and lets the player retake it', async () => {
    renderCapture()
    await screen.findByText('Fit the whole car in the frame')

    click('Take photo')

    expect(await screen.findByText('Can you see the Soul?')).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'The photo you just took' }),
    ).toHaveAttribute('src', 'blob:photo')

    click('Take it again')

    expect(
      await screen.findByText('Fit the whole car in the frame'),
    ).toBeInTheDocument()
  })

  it('needs a claim before sending', async () => {
    await reachClaimStep()

    const send = screen.getByRole('button', {
      name: 'Pick what makes it special',
    })
    expect(send).toBeDisabled()
    expect(
      screen.getByRole('radio', { name: /Regular Soul/ }),
    ).not.toBeChecked()
    expect(
      screen.getByRole('radio', { name: /Special Soul/ }),
    ).not.toBeChecked()

    fireEvent.click(screen.getByRole('radio', { name: /Regular Soul/ }))

    expect(
      screen.getByRole('button', { name: 'Send · +1 point' }),
    ).toBeEnabled()
  })

  it('needs a category for a special claim and shows bonus points', async () => {
    await reachClaimStep()

    fireEvent.click(screen.getByRole('radio', { name: /Special Soul/ }))

    expect(
      screen.getByRole('button', { name: 'Pick what makes it special' }),
    ).toBeDisabled()

    click('Alien Green')
    expect(screen.getByRole('button', { name: 'Alien Green' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(
      screen.getByRole('button', { name: 'Send · +2 points' }),
    ).toBeEnabled()

    click('Brown paint')
    expect(
      screen.getByRole('button', { name: 'Send · +3 points' }),
    ).toBeEnabled()

    click('Alien Green')
    click('Brown paint')
    expect(
      screen.getByRole('button', { name: 'Pick what makes it special' }),
    ).toBeDisabled()
  })

  it('saves the photo on the phone, sends it, and celebrates', async () => {
    vi.mocked(postSighting).mockResolvedValue(SAVED)
    await reachClaimStep()
    pickBrownSpecial()

    await act(async () => click('Send · +3 points'))

    expect(await screen.findByText('Special Soul saved')).toBeInTheDocument()
    expect(screen.getByText('+3')).toBeInTheDocument()
    expect(screen.getByText('You have 7 points this week.')).toBeInTheDocument()
    const queued = vi.mocked(deviceQueue.add).mock.calls[0][0] as QueuedSighting
    expect(queued).toMatchObject({
      playerId: 'p1',
      categories: ['Brown paint'],
      claimType: 'special',
      location: null,
      photo: PHOTO,
    })
    expect(queued.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(vi.mocked(postSighting).mock.calls[0][0].id).toBe(queued.id)
    expect(deviceQueue.remove).toHaveBeenCalledWith(queued.id)
  })

  it('goes home on Done', async () => {
    vi.mocked(postSighting).mockResolvedValue(SAVED)
    await reachClaimStep()
    fireEvent.click(screen.getByRole('radio', { name: /Regular Soul/ }))
    await act(async () => click('Send · +1 point'))

    click('Done')

    expect(await screen.findByText('Home screen')).toBeInTheDocument()
  })

  it('starts a fresh claim on Snap another Soul', async () => {
    vi.mocked(postSighting).mockResolvedValue(SAVED)
    await reachClaimStep()
    fireEvent.click(screen.getByRole('radio', { name: /Regular Soul/ }))
    await act(async () => click('Send · +1 point'))

    click('Snap another Soul')
    expect(
      await screen.findByText('Fit the whole car in the frame'),
    ).toBeInTheDocument()

    click('Take photo')
    await screen.findByText('Can you see the Soul?')
    click('Use this photo')
    expect(
      await screen.findByRole('button', { name: 'Pick what makes it special' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('radio', { name: /Regular Soul/ }),
    ).not.toBeChecked()
  })

  it('keeps the photo on the phone when it does not send, and tries again', async () => {
    vi.mocked(postSighting)
      .mockResolvedValueOnce({ ok: false, status: 0, error: 'network' })
      .mockResolvedValueOnce(SAVED)
    await reachClaimStep()
    pickBrownSpecial()

    await act(async () => click('Send · +3 points'))

    expect(
      await screen.findByRole('heading', { name: "Your photo didn't send" }),
    ).toBeInTheDocument()
    expect(deviceQueue.remove).not.toHaveBeenCalled()

    await act(async () => click('Try again now'))

    expect(await screen.findByText('Special Soul saved')).toBeInTheDocument()
    const [first, second] = vi.mocked(postSighting).mock.calls
    expect(second[0].id).toBe(first[0].id)
  })

  it('leaves a photo that did not send in the queue and goes home', async () => {
    vi.mocked(postSighting).mockResolvedValue({
      ok: false,
      status: 503,
      error: 'unknown',
    })
    await reachClaimStep()
    pickBrownSpecial()
    await act(async () => click('Send · +3 points'))

    click('OK, send it later')

    expect(await screen.findByText('Home screen')).toBeInTheDocument()
    expect(deviceQueue.remove).not.toHaveBeenCalled()
  })

  it('drops a photo the server will never accept and says so', async () => {
    vi.mocked(postSighting).mockResolvedValue({
      ok: false,
      status: 422,
      error: 'invalid_photo',
    })
    await reachClaimStep()
    pickBrownSpecial()

    await act(async () => click('Send · +3 points'))

    expect(
      await screen.findByText("This photo can't be used"),
    ).toBeInTheDocument()
    expect(deviceQueue.remove).toHaveBeenCalled()
  })

  it('still sends when the phone cannot store the photo', async () => {
    vi.mocked(deviceQueue.add).mockRejectedValueOnce(new Error('blocked'))
    vi.mocked(postSighting).mockResolvedValue(SAVED)
    await reachClaimStep()
    pickBrownSpecial()

    await act(async () => click('Send · +3 points'))

    expect(await screen.findByText('Special Soul saved')).toBeInTheDocument()
  })
})
