import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useTextSize, type TextSize } from './useTextSize'

describe('useTextSize', () => {
  afterEach(() => {
    delete document.documentElement.dataset.text
  })

  it('sets data-text to large on the html element', () => {
    renderHook(() => useTextSize('large'))
    expect(document.documentElement.dataset.text).toBe('large')
  })

  it('removes data-text for standard', () => {
    document.documentElement.dataset.text = 'large'
    renderHook(() => useTextSize('standard'))
    expect(document.documentElement.dataset.text).toBeUndefined()
  })

  it('updates when the size changes', () => {
    const { rerender } = renderHook(({ size }) => useTextSize(size), {
      initialProps: { size: 'large' as TextSize },
    })
    rerender({ size: 'standard' })
    expect(document.documentElement.dataset.text).toBeUndefined()
  })
})
