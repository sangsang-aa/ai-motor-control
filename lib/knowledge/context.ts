// 知识库内容汇总 — 按会话已投送的库解析为 {texts, images},并施加预算上限

import { listFiles } from './db'
import { extractPdfText, blobToDataUrl } from './extract'
import type { KnowledgePayload } from '../types'

export const MAX_TEXT_CHARS = 12000
export const MAX_IMAGES = 4
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024

export interface FileMeta {
  name: string
  type: 'pdf' | 'image'
  size: number
}

/** 截断文本到预算;超出加省略标记(纯函数,可单测) */
export function truncateText(text: string, budget: number): string {
  if (budget <= 0) return ''
  if (text.length <= budget) return text
  return text.slice(0, budget) + '…[截断]'
}

/** 从文件元数据中挑选可入库的图片(类型/大小/数量上限;纯函数,可单测) */
export function selectImages(
  files: FileMeta[],
  max = MAX_IMAGES,
  maxBytes = MAX_IMAGE_BYTES
): FileMeta[] {
  return files.filter((f) => f.type === 'image' && f.size <= maxBytes).slice(0, max)
}

/**
 * 汇总已投送知识库的内容。
 * - PDF → 文本(合计受 MAX_TEXT_CHARS 预算约束,逐文件截断)
 * - 图片 → dataURL(受 selectImages 上限约束)
 * 解析失败的文件跳过,不阻塞其余。
 */
export async function buildKnowledgePayload(kbIds: string[]): Promise<KnowledgePayload> {
  const texts: KnowledgePayload['texts'] = []
  const images: KnowledgePayload['images'] = []
  let remaining = MAX_TEXT_CHARS

  for (const kbId of kbIds) {
    let files: { name: string; type: 'pdf' | 'image'; size: number; blob: Blob }[]
    try {
      files = await listFiles(kbId)
    } catch {
      continue
    }
    const pickedImages = selectImages(files)
    const imageNames = new Set(pickedImages.map((f) => f.name))

    for (const f of files) {
      if (f.type === 'pdf' && remaining > 0) {
        try {
          const text = await extractPdfText(f.blob)
          const cut = truncateText(text, remaining)
          remaining -= cut.length
          texts.push({ name: f.name, text: cut })
        } catch {
          /* 解析失败跳过 */
        }
      } else if (f.type === 'image' && imageNames.has(f.name)) {
        try {
          images.push({ name: f.name, dataUrl: await blobToDataUrl(f.blob) })
        } catch {
          /* 读取失败跳过 */
        }
      }
    }
  }

  return { texts, images }
}
