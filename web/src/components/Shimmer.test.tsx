import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Shimmer } from './Shimmer'

describe('Shimmer', () => {
  it('is hidden from assistive tech', () => {
    const { container } = render(<Shimmer />)
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('uses the light tone by default', () => {
    const { container } = render(<Shimmer />)
    expect(container.firstChild).toHaveClass(/light/)
  })

  it('uses the dark tone on the green header', () => {
    const { container } = render(<Shimmer tone="dark" />)
    expect(container.firstChild).toHaveClass(/dark/)
  })

  it('keeps the caller class for sizing', () => {
    const { container } = render(<Shimmer className="size" />)
    expect(container.firstChild).toHaveClass('size')
  })
})
