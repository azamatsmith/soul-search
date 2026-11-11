import { describe, expect, it } from 'vitest'
import {
  dayRangeText,
  endsAtText,
  durationText,
  isoToPacificFields,
  liveText,
  pacificToIso,
  rangeText,
  shortTimeLeftText,
  startsInText,
  timeLeftText,
} from './challengeTime'

const NOW = Date.parse('2026-11-12T20:00:00Z')

describe('pacificToIso', () => {
  it('converts a standard-time wall clock to UTC', () => {
    expect(pacificToIso('2026-11-26', '14:00')).toBe('2026-11-26T22:00:00.000Z')
  })

  it('converts a daylight-time wall clock to UTC', () => {
    expect(pacificToIso('2026-07-04', '09:00')).toBe('2026-07-04T16:00:00.000Z')
  })

  it('handles both sides of the spring-forward change', () => {
    expect(pacificToIso('2026-03-08', '01:30')).toBe('2026-03-08T09:30:00.000Z')
    expect(pacificToIso('2026-03-08', '03:30')).toBe('2026-03-08T10:30:00.000Z')
  })
})

describe('isoToPacificFields', () => {
  it('reads a UTC instant back as a Pacific date and time', () => {
    expect(isoToPacificFields('2026-11-16T07:59:00Z')).toEqual({
      date: '2026-11-15',
      time: '23:59',
    })
  })

  it('round-trips with pacificToIso', () => {
    const { date, time } = isoToPacificFields('2026-07-04T16:00:00.000Z')
    expect(pacificToIso(date, time)).toBe('2026-07-04T16:00:00.000Z')
  })
})

describe('durationText', () => {
  it.each([
    ['2026-11-26T22:00:00Z', '2026-11-27T02:00:00Z', 'Runs 4 hours'],
    ['2026-11-12T17:00:00Z', '2026-11-16T07:59:00Z', 'Runs 3 days, 15 hours'],
    ['2026-11-26T22:00:00Z', '2026-11-26T22:45:00Z', 'Runs 45 minutes'],
    ['2026-11-26T22:00:00Z', '2026-11-26T23:30:00Z', 'Runs 1 hour, 30 minutes'],
    ['2026-11-12T17:00:00Z', '2026-11-15T17:00:00Z', 'Runs 3 days'],
    ['2026-11-12T17:00:00Z', '2026-11-13T18:00:00Z', 'Runs 1 day, 1 hour'],
    ['2026-03-08T09:30:00Z', '2026-03-08T10:30:00Z', 'Runs 1 hour'],
  ])('%s to %s is "%s"', (start, end, text) => {
    expect(durationText(start, end)).toBe(text)
  })
})

describe('rangeText', () => {
  it('shares the day and am/pm within one afternoon', () => {
    expect(rangeText('2026-11-26T22:00:00Z', '2026-11-27T02:00:00Z')).toBe(
      'Thu Nov 26, 2:00 – 6:00 pm',
    )
  })

  it('keeps both am and pm within one day', () => {
    expect(rangeText('2026-11-26T17:00:00Z', '2026-11-27T02:00:00Z')).toBe(
      'Thu Nov 26, 9:00 am – 6:00 pm',
    )
  })

  it('names both days across several days', () => {
    expect(rangeText('2026-11-12T17:00:00Z', '2026-11-16T07:59:00Z')).toBe(
      'Thu Nov 12, 9:00 am – Sun Nov 15, 11:59 pm',
    )
  })
})

describe('dayRangeText', () => {
  it('shows only the days, ending on the last full day before midnight', () => {
    expect(dayRangeText('2026-10-19T07:00:00Z', '2026-10-26T07:00:00Z')).toBe(
      'Oct 19 – Oct 25',
    )
  })

  it('shows one day for a same-day challenge', () => {
    expect(dayRangeText('2026-11-26T22:00:00Z', '2026-11-27T02:00:00Z')).toBe(
      'Nov 26',
    )
  })
})

describe('timeLeftText', () => {
  it('counts days and names the weekday when over 24 hours away', () => {
    expect(timeLeftText('2026-11-16T07:59:00Z', NOW)).toBe(
      'Ends Sun 11:59 pm · 3 days left',
    )
  })

  it('says 1 day left in the singular', () => {
    expect(timeLeftText('2026-11-14T02:00:00Z', NOW)).toBe(
      'Ends Fri 6:00 pm · 1 day left',
    )
  })

  it('counts hours and drops the weekday later today', () => {
    expect(timeLeftText('2026-11-13T02:00:00Z', NOW)).toBe(
      'Ends 6:00 pm · 6 hours left',
    )
  })

  it('keeps the weekday for an end tomorrow within 24 hours', () => {
    expect(timeLeftText('2026-11-13T17:00:00Z', NOW)).toBe(
      'Ends Fri 9:00 am · 21 hours left',
    )
  })

  it('says 1 hour left in the singular', () => {
    expect(timeLeftText('2026-11-12T21:30:00Z', NOW)).toBe(
      'Ends 1:30 pm · 1 hour left',
    )
  })

  it('counts minutes under an hour, rounding up', () => {
    expect(timeLeftText('2026-11-12T20:44:30Z', NOW)).toBe(
      'Ends 12:44 pm · 45 min left',
    )
  })

  it('says Ending now once the end has passed', () => {
    expect(timeLeftText('2026-11-12T19:59:00Z', NOW)).toBe('Ending now')
    expect(timeLeftText('2026-11-12T20:00:00Z', NOW)).toBe('Ending now')
  })
})

describe('shortTimeLeftText', () => {
  const end = '2026-11-16T08:00:00Z'

  it.each([
    ['2026-11-10T20:00:00Z', '5 days left'],
    ['2026-11-14T07:00:00Z', '2 days left'],
    ['2026-11-15T07:00:00Z', '1 day left'],
    ['2026-11-15T09:00:00Z', '23 hours left'],
    ['2026-11-16T07:00:00Z', '1 hour left'],
    ['2026-11-16T07:15:00Z', '45 min left'],
    ['2026-11-16T07:00:30Z', '1 hour left'],
    ['2026-11-16T07:59:30Z', '1 min left'],
    ['2026-11-16T08:00:00Z', 'Ending now'],
  ])('at %s says %s', (now, text) => {
    expect(shortTimeLeftText(end, Date.parse(now))).toBe(text)
  })
})

describe('startsInText', () => {
  it('uses the same bands as the end', () => {
    expect(startsInText('2026-11-15T17:00:00Z', NOW)).toBe(
      'Starts Sun 9:00 am · in 2 days',
    )
    expect(startsInText('2026-11-12T23:00:00Z', NOW)).toBe(
      'Starts 3:00 pm · in 3 hours',
    )
    expect(startsInText('2026-11-12T20:45:00Z', NOW)).toBe(
      'Starts 12:45 pm · in 45 min',
    )
  })
})

describe('liveText', () => {
  it('prefixes the time left with Live', () => {
    expect(liveText('2026-11-13T02:00:00Z', NOW)).toBe(
      'Live · ends 6:00 pm · 6 hours left',
    )
  })
})

describe('endsAtText', () => {
  it('names the weekday when the end is another day', () => {
    expect(endsAtText('2026-11-16T07:59:00Z', NOW)).toBe('ends Sun 11:59 pm')
  })

  it('drops the weekday when it ends today', () => {
    expect(endsAtText('2026-11-13T02:00:00Z', NOW)).toBe('ends 6:00 pm')
  })
})
