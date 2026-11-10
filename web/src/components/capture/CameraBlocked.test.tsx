import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isAndroid } from '../../lib/platform'
import { CameraBlocked } from './CameraBlocked'

vi.mock('../../lib/platform', () => ({ isAndroid: vi.fn() }))

const renderBlocked = (reason: 'denied' | 'unavailable') =>
  render(
    <CameraBlocked
      onNativeCamera={vi.fn()}
      onTryAgain={vi.fn()}
      reason={reason}
    />,
  )

const stepTexts = () =>
  screen.getAllByRole('listitem').map((step) => step.textContent)

describe('CameraBlocked on an iPhone', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('shows the iPhone settings steps', () => {
    vi.mocked(isAndroid).mockReturnValue(false)
    renderBlocked('denied')

    expect(
      screen.getByText('You can turn it back on in your iPhone settings:'),
    ).toBeInTheDocument()
    expect(stepTexts()).toEqual([
      '1Open the Settings app',
      '2Tap Apps, then Safari',
      '3Tap Camera and choose Allow',
      '4Come back here and try again',
    ])
    expect(
      screen.getByRole('button', { name: 'Use the iPhone camera instead' }),
    ).toBeInTheDocument()
  })
})

describe('CameraBlocked on Android', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('shows the Chrome site settings steps', () => {
    vi.mocked(isAndroid).mockReturnValue(true)
    renderBlocked('denied')

    expect(
      screen.getByText('You can turn it back on in your phone settings:'),
    ).toBeInTheDocument()
    expect(stepTexts()).toEqual([
      '1Open the Chrome app',
      '2Tap ⋮, then Settings, then Site settings',
      '3Tap Camera, find Soul Search and choose Allow',
      '4Come back here and try again',
    ])
  })

  it('offers the phone camera without mentioning iPhone', () => {
    vi.mocked(isAndroid).mockReturnValue(true)
    renderBlocked('unavailable')

    expect(
      screen.getByText(
        "You can still take the photo with your phone's camera.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: "Use your phone's camera instead" }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/iPhone/)).not.toBeInTheDocument()
  })
})
