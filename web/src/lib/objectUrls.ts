interface Entry {
  url: string
  users: number
}

const entries = new WeakMap<Blob, Entry>()

const entryFor = (blob: Blob) => {
  const existing = entries.get(blob)
  if (existing) return existing
  const entry = { url: URL.createObjectURL(blob), users: 0 }
  entries.set(blob, entry)
  return entry
}

export const objectUrlFor = (blob: Blob) => entryFor(blob).url

// Revoking waits a microtask so StrictMode's release-then-hold keeps the url alive.
export const holdObjectUrl = (blob: Blob) => {
  const entry = entryFor(blob)
  entry.users += 1
  return () => {
    entry.users -= 1
    queueMicrotask(() => {
      if (entry.users > 0 || entries.get(blob) !== entry) return
      URL.revokeObjectURL(entry.url)
      entries.delete(blob)
    })
  }
}
