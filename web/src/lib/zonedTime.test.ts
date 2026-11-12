import { afterEach, describe, expect, it, vi } from 'vitest'
import { dayIn, deviceZone, formattersFor, PACIFIC } from './zonedTime'

const PHOENIX = 'America/Phoenix'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('deviceZone', () => {
  it('reads the device timezone', () => {
    expect(deviceZone()).toBe('America/Los_Angeles')
  })

  it('falls back to Pacific when the device reports no timezone', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      timeZone: undefined,
    } as unknown as Intl.ResolvedDateTimeFormatOptions)

    expect(deviceZone()).toBe(PACIFIC)
  })
})

describe('formattersFor with a zone the browser does not know', () => {
  it('falls back to Pacific instead of throwing', () => {
    const at = Date.parse('2026-11-12T23:00:00Z')

    expect(formattersFor('Etc/Unknown').clock.format(at)).toBe(
      formattersFor(PACIFIC).clock.format(at),
    )
    expect(dayIn(at, 'Etc/Unknown')).toBe(dayIn(at, PACIFIC))
  })
})

describe('dayIn', () => {
  it('names the calendar day in the given timezone', () => {
    const at = Date.parse('2026-11-13T07:30:00Z')

    expect(dayIn(at, PACIFIC)).toBe('2026-11-12')
    expect(dayIn(at, PHOENIX)).toBe('2026-11-13')
  })
})

describe('formattersFor', () => {
  it('reuses the formatters for a timezone', () => {
    expect(formattersFor(PHOENIX)).toBe(formattersFor(PHOENIX))
  })
})
