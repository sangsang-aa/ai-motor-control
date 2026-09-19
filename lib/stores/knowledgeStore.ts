// 知识库状态 — 列表 / 当前库 / 文件;数据源为 IndexedDB(见 lib/knowledge/db.ts)

import { create } from 'zustand'
import {
  addFile,
  createKb as dbCreateKb,
  deleteFile as dbDeleteFile,
  deleteKb as dbDeleteKb,
  isAllowedFile,
  listFiles,
  listKbs,
  type Kb,
  type KbFile
} from '../knowledge/db'

interface KnowledgeState {
  kbs: Kb[]
  currentKbId: string | null
  files: KbFile[]
  /** IndexedDB 不可用(隐私模式等) */
  unsupported: boolean
  refresh: () => Promise<void>
  createKb: (name: string) => Promise<void>
  deleteKb: (id: string) => Promise<void>
  selectKb: (id: string) => Promise<void>
  addFiles: (files: File[]) => Promise<{ added: number; skipped: number }>
  removeFile: (id: string) => Promise<void>
}

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  kbs: [],
  currentKbId: null,
  files: [],
  unsupported: false,

  refresh: async () => {
    try {
      const kbs = await listKbs()
      const cur = get().currentKbId
      const currentKbId = cur && kbs.some((k) => k.id === cur) ? cur : kbs[0]?.id ?? null
      const files = currentKbId ? await listFiles(currentKbId) : []
      set({ kbs, currentKbId, files, unsupported: false })
    } catch {
      set({ unsupported: true })
    }
  },

  createKb: async (name) => {
    const kb = await dbCreateKb(name)
    set({ currentKbId: kb.id })
    await get().refresh()
  },

  deleteKb: async (id) => {
    await dbDeleteKb(id)
    if (get().currentKbId === id) set({ currentKbId: null, files: [] })
    await get().refresh()
  },

  selectKb: async (id) => {
    set({ currentKbId: id })
    try {
      const files = await listFiles(id)
      set({ files })
    } catch {
      set({ unsupported: true })
    }
  },

  addFiles: async (files) => {
    const kbId = get().currentKbId
    if (!kbId) return { added: 0, skipped: files.length }
    let added = 0
    let skipped = 0
    for (const f of files) {
      if (isAllowedFile(f).ok) {
        await addFile(kbId, f)
        added += 1
      } else {
        skipped += 1
      }
    }
    await get().refresh()
    return { added, skipped }
  },

  removeFile: async (id) => {
    await dbDeleteFile(id)
    await get().refresh()
  }
}))
