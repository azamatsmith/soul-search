import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  CREAM,
  FOREST,
  statusBarColor,
  setUpStatusBar,
} from '../test/statusBar'
import { useStatusBarColor } from './useStatusBarColor'

describe('useStatusBarColor', () => {
  setUpStatusBar()

  it('sets the status bar to the color of the token', () => {
    renderHook(() => useStatusBarColor('--c-forest'))

    expect(statusBarColor()).toBe(FOREST)
  })

  it('updates the existing tag instead of adding one', () => {
    renderHook(() => useStatusBarColor('--c-forest'))

    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(
      1,
    )
  })

  it('puts the previous color back on unmount', () => {
    const { unmount } = renderHook(() => useStatusBarColor('--c-forest'))

    unmount()

    expect(statusBarColor()).toBe(CREAM)
  })

  it('does nothing when the page has no theme-color tag', () => {
    document.querySelector('meta[name="theme-color"]')?.remove()

    expect(() =>
      renderHook(() => useStatusBarColor('--c-forest')).unmount(),
    ).not.toThrow()
  })
})
