/**
 * 知识库内容预算纯函数单测(truncateText / selectImages)。
 * 不触碰 IndexedDB / 真实 PDF。
 */
import { describe, it, expect } from 'vitest'
import { truncateText, selectImages, type FileMeta } from '@/lib/knowledge/context'

describe('truncateText', () => {
  it('未超预算原样返回', () => {
    expect(truncateText('hello', 10)).toBe('hello')
  })
  it('超预算截断并加标记', () => {
    const out = truncateText('abcdefghij', 4)
    expect(out.startsWith('abcd')).toBe(true)
    expect(out).toContain('截断')
  })
  it('预算为 0 返回空串', () => {
    expect(truncateText('abc', 0)).toBe('')
  })
})

describe('selectImages', () => {
  const f = (name: string, type: FileMeta['type'], size: number): FileMeta => ({ name, type, size })

  it('仅图片、且超大小的剔除', () => {
    const files = [f('a.png', 'image', 100), f('doc.pdf', 'pdf', 100), f('big.png', 'image', 5 * 1024 * 1024)]
    const picked = selectImages(files)
    expect(picked.map((x) => x.name)).toEqual(['a.png'])
  })

  it('数量受上限约束', () => {
    const files = Array.from({ length: 10 }, (_, i) => f(`i${i}.png`, 'image', 100))
    expect(selectImages(files).length).toBe(4)
  })
})
