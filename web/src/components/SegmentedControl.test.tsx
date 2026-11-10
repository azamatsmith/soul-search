import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SegmentedControl } from './SegmentedControl'

const OPTIONS = [
  { label: 'This week', value: 'week' },
  { label: 'All time', value: 'all' },
]

describe('SegmentedControl', () => {
  it('marks only the selected option as pressed', () => {
    render(
      <SegmentedControl
        label="Leaderboard period"
        onChange={vi.fn()}
        options={OPTIONS}
        value="week"
      />,
    )

    expect(
      screen.getByRole('group', { name: 'Leaderboard period' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'This week' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'All time' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('reports the tapped option', () => {
    const onChange = vi.fn()
    render(
      <SegmentedControl
        label="Leaderboard period"
        onChange={onChange}
        options={OPTIONS}
        value="week"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'All time' }))

    expect(onChange).toHaveBeenCalledWith('all')
  })
})
