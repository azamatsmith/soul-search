import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { avatarTone } from '../lib/avatarTone'
import { PlayerAvatar } from './PlayerAvatar'

describe('PlayerAvatar', () => {
  it('shows the initial, hidden from screen readers, in the player tone', () => {
    const { container } = render(<PlayerAvatar id="b" name="bob" />)
    const avatar = container.firstElementChild

    expect(avatar).toHaveTextContent('B')
    expect(avatar).toHaveAttribute('aria-hidden', 'true')
    expect(avatar).toHaveAttribute('data-tone', avatarTone('b'))
  })
})
