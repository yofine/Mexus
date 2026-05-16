export interface TerminalSnapshotRecord {
  cacheKey: string
  terminalId: string
  sessionKey?: string
  cols: number
  rows: number
  data: string
  createdAt: number
  updatedAt: number
  bytes: number
  schemaVersion: 1
}

const DB_NAME = 'mexus-terminal-snapshots'
const DB_VERSION = 1
const STORE_NAME = 'snapshots'

export class TerminalSnapshotStore {
  private dbPromise: Promise<IDBDatabase | null> | null = null

  async read(cacheKey: string): Promise<TerminalSnapshotRecord | null> {
    const db = await this.openDb()
    if (!db) {
      return null
    }

    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(cacheKey)

      request.onsuccess = () => {
        resolve(isTerminalSnapshotRecord(request.result) ? request.result : null)
      }
      request.onerror = () => resolve(null)
      transaction.onerror = () => resolve(null)
    })
  }

  async write(record: TerminalSnapshotRecord): Promise<void> {
    const db = await this.openDb()
    if (!db) {
      return
    }

    await new Promise<void>((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      store.put(record)

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => resolve()
      transaction.onabort = () => resolve()
    })
  }

  async delete(cacheKey: string): Promise<void> {
    const db = await this.openDb()
    if (!db) {
      return
    }

    await new Promise<void>((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      store.delete(cacheKey)

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => resolve()
      transaction.onabort = () => resolve()
    })
  }

  private openDb(): Promise<IDBDatabase | null> {
    if (this.dbPromise) {
      return this.dbPromise
    }

    if (!globalThis.indexedDB) {
      this.dbPromise = Promise.resolve(null)
      return this.dbPromise
    }

    this.dbPromise = new Promise((resolve) => {
      const request = globalThis.indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'cacheKey' })
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    })

    return this.dbPromise
  }
}

function isTerminalSnapshotRecord(value: unknown): value is TerminalSnapshotRecord {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Partial<TerminalSnapshotRecord>
  return (
    record.schemaVersion === 1 &&
    typeof record.cacheKey === 'string' &&
    typeof record.terminalId === 'string' &&
    typeof record.cols === 'number' &&
    typeof record.rows === 'number' &&
    typeof record.data === 'string' &&
    typeof record.createdAt === 'number' &&
    typeof record.updatedAt === 'number' &&
    typeof record.bytes === 'number' &&
    (record.sessionKey === undefined || typeof record.sessionKey === 'string')
  )
}
