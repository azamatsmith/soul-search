import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ToggleSwitch } from './ToggleSwitch'

describe('ToggleSwitch', () => {
  it('reports its state as a switch', () => {
    render(<ToggleSwitch checked label="Large text" onChange={vi.fn()} />)
    expect(screen.getByRole('switch', { name: 'Large text' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('asks for the opposite state when tapped', () => {
    const onChange = vi.fn()
    render(
      <ToggleSwitch checked={false} label="Large text" onChange={onChange} />,
    )
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(true)
  })
})
