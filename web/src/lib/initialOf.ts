export const initialOf = (name: string | null) =>
  (name?.trim().charAt(0) ?? '').toUpperCase()
