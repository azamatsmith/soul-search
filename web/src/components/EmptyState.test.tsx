import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('shows the message and links to the camera', () => {
    render(
      <MemoryRouter>
        <EmptyState
          body="The first photo puts you on top."
          title="No scores yet"
        />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', { name: 'No scores yet' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('The first photo puts you on top.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Take a photo' })).toHaveAttribute(
      'href',
      '/capture',
    )
  })
})
