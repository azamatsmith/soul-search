import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RollingCar } from './RollingCar'

const carOf = (container: HTMLElement) =>
  container.querySelector('[data-car]') as HTMLElement

describe('RollingCar', () => {
  it('is hidden from screen readers', () => {
    const { container } = render(<RollingCar size="small" />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('drives on a loop without progress', () => {
    const { container } = render(<RollingCar size="large" />)
    expect(carOf(container)).toHaveAttribute('data-car', 'looping')
  })

  it('parks at the given progress', () => {
    const { container } = render(<RollingCar progress={0.4} size="large" />)
    const car = carOf(container)
    expect(car).toHaveAttribute('data-car', 'parked')
    expect(car.style.getPropertyValue('--car-progress')).toBe('0.4')
  })

  it('keeps progress between start and finish', () => {
    const { container } = render(<RollingCar progress={1.7} size="large" />)
    expect(carOf(container).style.getPropertyValue('--car-progress')).toBe('1')
  })
})
