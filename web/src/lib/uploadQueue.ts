import {
  postSighting,
  type ApiResult,
  type NewSighting,
  type PostSightingResult,
} from './api'

export interface QueuedSighting extends NewSighting {
  createdAt: number
  playerId: string
}

export interface QueueStore {
  add: (item: QueuedSighting) => Promise<void>
  all: () => Promise<QueuedSighting[]>
  remove: (id: string) => Promise<void>
}

export type PostQueued = (
  item: QueuedSighting,
) => Promise<ApiResult<PostSightingResult>>

const REJECTED_FOR_GOOD = new Set([409, 413, 422])

export const isRejectedForGood = (result: ApiResult<unknown>) =>
  !result.ok && REJECTED_FOR_GOOD.has(result.status)

export const flushQueue = async (
  store: QueueStore,
  post: PostQueued,
  playerId: string,
) => {
  let items: QueuedSighting[]
  try {
    items = (await store.all()).filter((item) => item.playerId === playerId)
  } catch {
    return { kept: 0, sent: 0 }
  }
  items.sort((a, b) => a.createdAt - b.createdAt)
  let sent = 0
  for (const [index, item] of items.entries()) {
    const result = await post(item)
    if (result.ok || isRejectedForGood(result)) {
      await store.remove(item.id).catch(() => {})
      if (result.ok) sent += 1
      continue
    }
    return { kept: items.length - index, sent }
  }
  return { kept: 0, sent }
}

const DB_NAME = 'soul-search'
const STORE = 'uploads'

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

const run = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
) => {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode)
      const request = action(transaction.objectStore(STORE))
      transaction.oncomplete = () => resolve(request.result)
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  } finally {
    db.close()
  }
}

export const deviceQueue: QueueStore = {
  add: async (item) => {
    await run('readwrite', (store) => store.put(item))
  },
  all: () => run<QueuedSighting[]>('readonly', (store) => store.getAll()),
  remove: async (id) => {
    await run('readwrite', (store) => store.delete(id))
  },
}

export const singleFlight = <T>(task: (key: string) => Promise<T>) => {
  const running = new Map<string, Promise<T>>()
  return (key: string) => {
    const current =
      running.get(key) ??
      task(key).finally(() => {
        running.delete(key)
      })
    running.set(key, current)
    return current
  }
}

export const UPLOADS_FLUSHED = 'soul-search:uploads-flushed'

export const flushUploads = singleFlight((playerId) =>
  flushQueue(deviceQueue, postSighting, playerId).finally(() => {
    window.dispatchEvent(new Event(UPLOADS_FLUSHED))
  }),
)
