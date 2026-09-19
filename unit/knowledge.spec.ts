/**
 * 知识库文件校验纯函数单测(classifyFile / isAllowedFile)。
 * 不触碰 IndexedDB(仅调用纯函数)。
 */
import { describe, it, expect } from 'vitest'
import { classifyFile, isAllowedFile, MAX_FILE_BYTES } from '@/lib/knowledge/db'

describe('classifyFile', () => {
  it('识别 PDF 与图片,其余返回 null', () => {
    expect(classifyFile('application/pdf')).toBe('pdf')
    expect(classifyFile('image/png')).toBe('image')
    expect(classifyFile('image/jpeg')).toBe('image')
    expect(classifyFile('text/plain')).toBeNull()
    expect(classifyFile('')).toBeNull()
  })
})

describe('isAllowedFile', () => {
  it('类型白名单:PDF/图片放行', () => {
    expect(isAllowedFile({ type: 'application/pdf', size: 1024 }).ok).toBe(true)
    expect(isAllowedFile({ type: 'image/png', size: 1024 }).ok).toBe(true)
  })

  it('类型不符被拒(reason=type)', () => {
    expect(isAllowedFile({ type: 'text/plain', size: 1024 })).toEqual({ ok: false, reason: 'type' })
  })

  it('超大小上限被拒(reason=size)', () => {
    expect(isAllowedFile({ type: 'image/png', size: MAX_FILE_BYTES + 1 })).toEqual({ ok: false, reason: 'size' })
    expect(isAllowedFile({ type: 'image/png', size: MAX_FILE_BYTES }).ok).toBe(true)
  })
})
