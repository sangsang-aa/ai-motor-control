// 知识库本地存储 — 原生 IndexedDB(无第三方依赖)
// 知识点: PDF/图片是二进制,localStorage 容量不足,故用 IndexedDB。

export interface Kb {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export type KbFileType = 'pdf' | 'image'

export interface KbFile {
  id: string
  kbId: string
  name: string
  type: KbFileType
  mime: string
  size: number
  blob: Blob
  addedAt: number
}

const DB_NAME = 'mototune.knowledge'
const DB_VERSION = 1
const STORE_KB = 'kb'
const STORE_FILE = 'kbFile'
const IDX_FILE_KBID = 'kbId'

/** 单文件大小上限 */
export const MAX_FILE_BYTES = 10 * 1024 * 1024

/** 按 MIME 判定类型;不支持返回 null */
export function classifyFile(mime: string): KbFileType | null {
  if (mime === 'application/pdf') return 'pdf'
  if (mime.startsWith('image/')) return 'image'
  return null
}

/** 校验文件是否可入库(类型白名单 + 大小上限) */
export function isAllowedFile(f: { type: string; size: number }): { ok: boolean; reason?: 'type' | 'size' } {
  if (!classifyFile(f.type)) return { ok: false, reason: 'type' }
  if (f.size > MAX_FILE_BYTES) return { ok: false, reason: 'size' }
  return { ok: true }
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

let dbPromise: Promise<IDBDatabase> | null = null

export function openKbDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION)
    r.onupgradeneeded = () => {
      const db = r.result
      if (!db.objectStoreNames.contains(STORE_KB)) {
        db.createObjectStore(STORE_KB, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_FILE)) {
        const s = db.createObjectStore(STORE_FILE, { keyPath: 'id' })
        s.createIndex(IDX_FILE_KBID, 'kbId', { unique: false })
      }
    }
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
  return dbPromise
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export async function listKbs(): Promise<Kb[]> {
  const db = await openKbDb()
  const all = await req<Kb[]>(db.transaction(STORE_KB).objectStore(STORE_KB).getAll())
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

export async function createKb(name: string): Promise<Kb> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('empty name')
  const now = Date.now()
  const kb: Kb = { id: uid('kb'), name: trimmed, createdAt: now, updatedAt: now }
  const db = await openKbDb()
  await req(db.transaction(STORE_KB, 'readwrite').objectStore(STORE_KB).add(kb))
  return kb
}

export async function listFiles(kbId: string): Promise<KbFile[]> {
  const db = await openKbDb()
  const idx = db.transaction(STORE_FILE).objectStore(STORE_FILE).index(IDX_FILE_KBID)
  const all = await req<KbFile[]>(idx.getAll(IDBKeyRange.only(kbId)))
  return all.sort((a, b) => a.addedAt - b.addedAt)
}

export async function addFile(kbId: string, file: File): Promise<KbFile> {
  const type = classifyFile(file.type)
  if (!type) throw new Error('unsupported type')
  const rec: KbFile = {
    id: uid('f'),
    kbId,
    name: file.name,
    type,
    mime: file.type,
    size: file.size,
    blob: file,
    addedAt: Date.now()
  }
  const db = await openKbDb()
  await req(db.transaction(STORE_FILE, 'readwrite').objectStore(STORE_FILE).add(rec))
  return rec
}

export async function deleteFile(id: string): Promise<void> {
  const db = await openKbDb()
  await req(db.transaction(STORE_FILE, 'readwrite').objectStore(STORE_FILE).delete(id))
}

export async function deleteKb(id: string): Promise<void> {
  const db = await openKbDb()
  const files = await listFiles(id)
  const tx = db.transaction([STORE_KB, STORE_FILE], 'readwrite')
  const fstore = tx.objectStore(STORE_FILE)
  for (const f of files) fstore.delete(f.id)
  tx.objectStore(STORE_KB).delete(id)
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
