import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, onTestFinished } from 'vitest'
import { Photo } from './Photo'

const frameOf = (container: HTMLElement) =>
  container.querySelector('[data-state]') as HTMLElement

const stubCachedImages = () => {
  const proto = HTMLImageElement.prototype
  const complete = Object.getOwnPropertyDescriptor(proto, 'complete')
  const naturalWidth = Object.getOwnPropertyDescriptor(proto, 'naturalWidth')
  Object.defineProperty(proto, 'complete', {
    configurable: true,
    get: () => true,
  })
  Object.defineProperty(proto, 'naturalWidth', {
    configurable: true,
    get: () => 480,
  })
  onTestFinished(() => {
    if (complete) Object.defineProperty(proto, 'complete', complete)
    if (naturalWidth) Object.defineProperty(proto, 'naturalWidth', naturalWidth)
  })
}

describe('Photo', () => {
  it('shows the placeholder until the photo loads', () => {
    const { container } = render(<Photo alt="Your last photo" src="/a.jpg" />)

    expect(frameOf(container)).toHaveAttribute('data-state', 'loading')
    fireEvent.load(screen.getByRole('img', { name: 'Your last photo' }))
    expect(frameOf(container)).toHaveAttribute('data-state', 'loaded')
  })

  it('keeps the placeholder and drops the image when it fails', () => {
    const { container } = render(<Photo alt="Your last photo" src="/a.jpg" />)

    fireEvent.error(container.querySelector('img') as HTMLImageElement)

    expect(frameOf(container)).toHaveAttribute('data-state', 'failed')
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByRole('img', { name: 'Your last photo' })).toBe(
      frameOf(container),
    )
  })

  it('goes back to the placeholder for a new photo', () => {
    const { container, rerender } = render(<Photo alt="" src="/a.jpg" />)
    fireEvent.load(container.querySelector('img') as HTMLImageElement)

    rerender(<Photo alt="" src="/b.jpg" />)

    expect(frameOf(container)).toHaveAttribute('data-state', 'loading')
  })

  it('loads lazily when asked', () => {
    const { container } = render(<Photo alt="" lazy src="/a.jpg" />)

    expect(container.querySelector('img')).toHaveAttribute('loading', 'lazy')
  })

  it('shows a photo the browser already has right away', () => {
    stubCachedImages()
    const { container } = render(<Photo alt="" src="/a.jpg" />)

    expect(frameOf(container)).toHaveAttribute('data-state', 'loaded')
  })
})
