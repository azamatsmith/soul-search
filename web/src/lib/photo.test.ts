import { describe, expect, it } from 'vitest'
import { fileToJpeg, fitWithin } from './photo'

describe('fitWithin', () => {
  it('keeps small photos as they are', () => {
    expect(fitWithin(1280, 960, 2000)).toEqual({ height: 960, width: 1280 })
  })

  it('shrinks the long edge to the limit', () => {
    expect(fitWithin(4032, 3024, 2000)).toEqual({ height: 1500, width: 2000 })
    expect(fitWithin(3024, 4032, 2000)).toEqual({ height: 2000, width: 1500 })
  })
})

describe('fileToJpeg', () => {
  it('passes a JPEG through untouched so its location data reaches the server', async () => {
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'a.jpg', {
      type: 'image/jpeg',
    })

    expect(await fileToJpeg(file)).toBe(file)
  })
})
