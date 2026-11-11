import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyNote } from './EmptyNote'

describe('EmptyNote', () => {
  it('renders its message', () => {
    render(<EmptyNote>No challenges yet.</EmptyNote>)
    expect(screen.getByText('No challenges yet.')).toBeVisible()
  })
})
