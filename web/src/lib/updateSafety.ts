const SAFE_PATHS = new Set([
  '/',
  '/sightings',
  '/scores',
  '/past-weeks',
  '/settings',
  '/admin',
  '/admin/flagged',
  '/admin/challenges',
  '/admin/history',
])

const PAST_WEEK = /^\/past-weeks\/[^/]+$/

export const isSafeToUpdate = (pathname: string) =>
  SAFE_PATHS.has(pathname) || PAST_WEEK.test(pathname)
