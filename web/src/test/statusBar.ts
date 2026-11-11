import { afterEach, beforeEach } from 'vitest'

export const CREAM = '#faf4e8'
export const FOREST = '#1f4a33'
export const CAMERA = '#16110d'

export const statusBarColor = () =>
  document.querySelector('meta[name="theme-color"]')?.getAttribute('content')

export const setUpStatusBar = () => {
  beforeEach(() => {
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.content = CREAM
    document.head.append(meta)
    document.documentElement.style.setProperty('--c-forest', FOREST)
    document.documentElement.style.setProperty('--c-camera', CAMERA)
  })

  afterEach(() => {
    document.head
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((meta) => meta.remove())
    document.documentElement.style.removeProperty('--c-forest')
    document.documentElement.style.removeProperty('--c-camera')
  })
}
