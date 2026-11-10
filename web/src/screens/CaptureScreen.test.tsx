import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  hasSeenCameraIntro,
  markCameraIntroSeen,
  openCamera,
} from '../lib/camera'
import { fileToJpeg, frameToJpeg } from '../lib/photo'
import { CaptureScreen } from './CaptureScreen'

vi.mock('../lib/camera', () => ({
  hasSeenCameraIntro: vi.fn(),
  markCameraIntroSeen: vi.fn(),
  openCamera: vi.fn(),
  stopCamera: vi.fn(),
}))
vi.mock('../lib/photo', () => ({ fileToJpeg: vi.fn(), frameToJpeg: vi.fn() }))

const STREAM = { getTracks: () => [] } as unknown as MediaStream
const PHOTO = new Blob(['jpeg'], { type: 'image/jpeg' })

const renderCapture = () => {
  const router = createMemoryRouter(
    [
      { path: '/', element: <p>Home screen</p> },
      { path: '/capture', element: <CaptureScreen /> },
    ],
    { initialEntries: ['/capture'] },
  )
  render(<RouterProvider router={router} />)
}

const click = (name: string | RegExp) =>
  fireEvent.click(screen.getByRole('button', { name }))

describe('CaptureScreen', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:photo')
    URL.revokeObjectURL = vi.fn()
    vi.mocked(hasSeenCameraIntro).mockReturnValue(true)
    vi.mocked(openCamera).mockResolvedValue({ ok: true, stream: STREAM })
    vi.mocked(frameToJpeg).mockResolvedValue(PHOTO)
    vi.mocked(fileToJpeg).mockResolvedValue(PHOTO)
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
})
