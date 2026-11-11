import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SendingStep } from './SendingStep'

describe('SendingStep', () => {
  it('says the photo is sending', () => {
    render(<SendingStep photoUrl="blob:photo" progress={0} />)
    expect(screen.getByRole('status')).toHaveTextContent('Sending your photo…')
  })

  it('places the car and the bar at the upload progress', () => {
    const { container } = render(
      <SendingStep photoUrl="blob:photo" progress={0.4} />,
    )
    const car = container.querySelector('[data-car]') as HTMLElement
    expect(car).toHaveAttribute('data-car', 'parked')
    expect(car.style.getPropertyValue('--car-progress')).toBe('0.4')
    const bar = container.querySelector('[data-progress-bar]') as HTMLElement
    expect(bar.style.width).toBe('40%')
  })
})
