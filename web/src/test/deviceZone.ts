import { onTestFinished, vi } from 'vitest'

export const stubDeviceZone = (timeZone: string) => {
  const spy = vi
    .spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
    .mockReturnValue({ timeZone } as Intl.ResolvedDateTimeFormatOptions)
  onTestFinished(() => {
    spy.mockRestore()
  })
}
