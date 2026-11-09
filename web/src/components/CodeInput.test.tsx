import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CodeInput } from './CodeInput'

interface HarnessProps {
  onComplete: (code: string) => void
  onChange?: (value: string) => void
  invalid?: boolean
}

const Harness = ({ onComplete, onChange, invalid }: HarnessProps) => {
  const [value, setValue] = useState('')
  const handleChange = (next: string) => {
    onChange?.(next)
    setValue(next)
  }
  return (
    <CodeInput
      value={value}
      onChange={handleChange}
      onComplete={onComplete}
      invalid={invalid}
    />
  )
}

const input = () => screen.getByLabelText('6-digit code')

const typeDigits = (digits: string) => {
  for (const digit of digits) {
    fireEvent.change(input(), {
      target: { value: (input() as HTMLInputElement).value + digit },
    })
  }
}

const boxes = () => screen.getAllByTestId('code-box')

describe('CodeInput', () => {
  it('is a numeric one-time-code field', () => {
    render(<Harness onComplete={vi.fn()} />)
    expect(input()).toHaveAttribute('inputmode', 'numeric')
    expect(input()).toHaveAttribute('autocomplete', 'one-time-code')
    expect(input()).toHaveFocus()
  })

  it('shows each typed digit in its own box', () => {
    render(<Harness onComplete={vi.fn()} />)
    typeDigits('482')
    expect(boxes().map((box) => box.textContent)).toEqual([
      '4',
      '8',
      '2',
      '',
      '',
      '',
    ])
  })

  it('strips non-digits and keeps the first six', () => {
    const onChange = vi.fn()
    render(<Harness onComplete={vi.fn()} onChange={onChange} />)
    fireEvent.change(input(), { target: { value: 'Code: 482 913.' } })
    expect(onChange).toHaveBeenCalledWith('482913')
    fireEvent.change(input(), { target: { value: '4829137' } })
    expect(onChange).toHaveBeenLastCalledWith('482913')
  })

  it('calls onComplete once when the sixth digit arrives', () => {
    const onComplete = vi.fn()
    render(<Harness onComplete={onComplete} />)
    typeDigits('48291')
    expect(onComplete).not.toHaveBeenCalled()
    typeDigits('3')
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith('482913')
  })

  it('accepts a full code pasted or autofilled in one change', () => {
    const onComplete = vi.fn()
    render(<Harness onComplete={onComplete} />)
    fireEvent.change(input(), { target: { value: '482913' } })
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith('482913')
  })

  it('does not call onComplete again when the value is unchanged', () => {
    const onComplete = vi.fn()
    render(<Harness onComplete={onComplete} />)
    fireEvent.change(input(), { target: { value: '482913' } })
    fireEvent.change(input(), { target: { value: '4829135' } })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('marks boxes invalid', () => {
    render(<Harness onComplete={vi.fn()} invalid />)
    expect(screen.getByTestId('code-boxes')).toHaveAttribute(
      'data-invalid',
      'true',
    )
  })

  it('replaces a full code when a new one is pasted after it', () => {
    const onComplete = vi.fn()
    render(<Harness onComplete={onComplete} />)
    fireEvent.change(input(), { target: { value: '482931' } })
    fireEvent.change(input(), { target: { value: '482931482913' } })
    expect(input()).toHaveValue('482913')
    expect(onComplete).toHaveBeenLastCalledWith('482913')
  })

  it('uses the pasted code instead of mixing it with digits already typed', () => {
    const onComplete = vi.fn()
    render(<Harness onComplete={onComplete} />)
    fireEvent.change(input(), { target: { value: '123' } })
    fireEvent.change(input(), { target: { value: '12 654-321' } })
    expect(input()).toHaveValue('654321')
    expect(onComplete).toHaveBeenCalledWith('654321')
  })

  it('ignores one extra digit typed into a full code', () => {
    const onComplete = vi.fn()
    render(<Harness onComplete={onComplete} />)
    fireEvent.change(input(), { target: { value: '482913' } })
    fireEvent.change(input(), { target: { value: '4829137' } })
    expect(input()).toHaveValue('482913')
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
