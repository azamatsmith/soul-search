export type AvatarTone = 'forest' | 'ink' | 'inkMuted' | 'orange'

const TONES: AvatarTone[] = ['forest', 'orange', 'inkMuted', 'ink']

export const avatarTone = (id: string): AvatarTone => {
  const sum = [...id].reduce((total, char) => total + char.charCodeAt(0), 0)
  return TONES[sum % TONES.length]
}
