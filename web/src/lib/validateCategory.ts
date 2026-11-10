export const MAX_CATEGORY_LENGTH = 24

export const validateCategory = (name: string, existing: string[]) => {
  if (name === '') return 'Type a category name.'
  if (name.length > MAX_CATEGORY_LENGTH) {
    return `Keep it to ${MAX_CATEGORY_LENGTH} characters or fewer.`
  }
  const lowered = name.toLowerCase()
  if (existing.some((category) => category.toLowerCase() === lowered)) {
    return 'That category is already on the list.'
  }
  return undefined
}
