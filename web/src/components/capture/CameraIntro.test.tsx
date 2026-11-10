import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isAndroid } from '../../lib/platform'
import { CameraIntro } from './CameraIntro'

vi.mock('../../lib/platform', () => ({ isAndroid: vi.fn() }))

const renderIntro = () =>
  render(<CameraIntro onContinue={vi.fn()} onNotNow={vi.fn()} />)

describe('CameraIntro', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('tells an iPhone player their iPhone will ask', () => {
    vi.mocked(isAndroid).mockReturnValue(false)
    renderIntro()

    expect(screen.getByText(/Next, your iPhone will ask/)).toBeInTheDocument()
  })

  it('tells an Android player their phone will ask', () => {
    vi.mocked(isAndroid).mockReturnValue(true)
    renderIntro()

    expect(screen.getByText(/Next, your phone will ask/)).toBeInTheDocument()
    expect(screen.queryByText(/iPhone/)).not.toBeInTheDocument()
  })
})
