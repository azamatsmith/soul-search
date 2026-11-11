import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Stepper } from './Stepper'

const renderStepper = (value: number) => {
  const onChange = vi.fn()
  render(
    <Stepper
      label="False call"
      max={0}
      min={-10}
      onChange={onChange}
      value={value}
    />,
  )
  return onChange
}

describe('Stepper', () => {
  it('shows the signed value and steps by one', () => {
    const onChange = renderStepper(-1)
    expect(screen.getByText('−1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Less for False call' }))
    expect(onChange).toHaveBeenLastCalledWith(-2)
    fireEvent.click(screen.getByRole('button', { name: 'More for False call' }))
    expect(onChange).toHaveBeenLastCalledWith(0)
  })

  it('stops at the limits', () => {
    renderStepper(0)
    expect(
      screen.getByRole('button', { name: 'More for False call' }),
    ).toBeDisabled()
  })

  it('disables both buttons when read-only', () => {
    render(
      <Stepper
        disabled
        label="Regular Soul"
        max={10}
        min={1}
        onChange={vi.fn()}
        value={2}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Less for Regular Soul' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'More for Regular Soul' }),
    ).toBeDisabled()
  })
})
