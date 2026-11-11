import type { ApiFailure } from './api'

export const challengeErrorText = (failure: ApiFailure) => {
  switch (failure.error) {
    case 'overlaps':
      return `This overlaps ${failure.name ?? 'another challenge'}. Pick other times.`
    case 'invalid_name':
      return 'Give the challenge a name (up to 40 characters).'
    case 'invalid_times':
      return "The end has to be after the start, and can't be in the past once it's running."
    case 'start_locked':
      return "This challenge has started, so its start time can't change."
    case 'invalid_bonus':
      return 'A bonus uses a category that no longer exists. Remove it and try again.'
    case 'invalid_points':
      return 'Point values are out of range.'
    case 'not_found':
      return 'This challenge was deleted.'
    default:
      return "We couldn't save that. Check your connection and try again."
  }
}
