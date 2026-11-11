import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ConnectionError } from './ConnectionError'

describe('ConnectionError', () => {
  it('explains a failed save', () => {
    render(<ConnectionError kind="save" />)
    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't save that.Check your connection and try again.",
    )
  })

  it('explains an unreachable server', () => {
    render(<ConnectionError kind="unreachable" />)
    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't reach Soul Search.Check your connection and try again.",
    )
  })
})
