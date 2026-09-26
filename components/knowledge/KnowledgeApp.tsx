// 知识库页面 — 创建命名知识库、上传 PDF/图片、列表与删除(本地 IndexedDB)

'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useLangStore, t } from '@/lib/i18n'
import { useKnowledgeStore } from '@/lib/stores/knowledgeStore'

export const KnowledgeApp: React.FC = () => {
  const lang = useLangStore((s) => s.lang)
  const { kbs, currentKbId, files, unsupported, refresh, createKb, deleteKb, selectKb, addFiles, removeFile } =
    useKnowledgeStore()
  const [name, setName] = useState('')
  const [notice, setNotice] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleCreate = async () => {
    const n = name.trim()
    if (!n) return
    try {
      await createKb(n)
      setName('')
    } catch {
      setNotice(t(lang, 'kbCreateFailed'))
    }
  }

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || [])
    e.target.value = ''
    if (picked.length === 0) return
    const { added, skipped } = await addFiles(picked)
    setNotice(skipped > 0 ? `${t(lang, 'kbAdded')} ${added}, ${t(lang, 'kbSkipped')} ${skipped}` : '')
  }

  const card: React.CSSProperties = { background: 'var(--cx-surface)', border: '1px solid var(--cx-border)', borderRadius: 10 }
  const btn: React.CSSProperties = {
    padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    background: 'var(--cx-surface-2)', color: 'var(--cx-text)', border: '1px solid var(--cx-border-2)'
  }

  return (
    <div data-ui="codex" style={{ minHeight: '100vh', background: 'var(--cx-bg)', color: 'var(--cx-text)', fontFamily: "'Noto Sans SC',system-ui,sans-serif" }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', height: 44, borderBottom: '1px solid var(--cx-border)' }}>
        <Link href="/" style={{ fontSize: 12, color: 'var(--cx-text)', textDecoration: 'none', border: '1px solid var(--cx-border-2)', padding: '3px 10px', borderRadius: 6 }}>
          ← {t(lang, 'backToChat')}
        </Link>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{t(lang, 'knowledge')}</span>
      </header>

      {unsupported && (
        <div data-testid="kb-unsupported" style={{ padding: '8px 16px', fontSize: 12, color: 'var(--cx-warning)', background: 'rgba(254,188,46,0.08)', borderBottom: '1px solid rgba(254,188,46,0.25)' }}>
          {t(lang, 'kbUnsupported')}
        </div>
      )}
      {notice && (
        <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--cx-muted)' }}>{notice}</div>
      )}

      <div style={{ display: 'flex', gap: 16, padding: 16, alignItems: 'flex-start' }}>
        {/* 左:知识库列表 + 新建 */}
        <div style={{ ...card, width: 280, flexShrink: 0, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cx-muted)', marginBottom: 8 }}>{t(lang, 'kbList')}</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <input
              data-testid="kb-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
              placeholder={t(lang, 'kbNamePlaceholder')}
              style={{ flex: 1, minWidth: 0, background: 'var(--cx-surface-2)', border: '1px solid var(--cx-border)', borderRadius: 8, padding: '6px 8px', color: 'var(--cx-text)', fontSize: 13, outline: 'none' }}
            />
            <button data-testid="kb-create" onClick={handleCreate} style={btn}>{t(lang, 'kbCreate')}</button>
          </div>
          {kbs.length === 0 && <div style={{ fontSize: 12, color: 'var(--cx-subtle)' }}>{t(lang, 'kbNoKb')}</div>}
          {kbs.map((kb) => (
            <div key={kb.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                data-testid="kb-item"
                onClick={() => selectKb(kb.id)}
                style={{
                  flex: 1, textAlign: 'left', padding: '8px 10px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                  background: kb.id === currentKbId ? 'var(--cx-surface-2)' : 'transparent',
                  color: kb.id === currentKbId ? 'var(--cx-text)' : 'var(--cx-muted)', border: '1px solid transparent'
                }}
              >
                {kb.name}
              </button>
              <button
                data-testid="kb-delete"
                title={t(lang, 'kbDelete')}
                onClick={() => { if (confirm(t(lang, 'kbDeleteConfirm'))) deleteKb(kb.id) }}
                style={{ background: 'none', border: 'none', color: 'var(--cx-subtle)', cursor: 'pointer', fontSize: 12 }}
              >✕</button>
            </div>
          ))}
        </div>

        {/* 右:文件列表 + 上传 */}
        <div style={{ ...card, flex: 1, minWidth: 0, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--cx-muted)' }}>{t(lang, 'kbFiles')}</span>
            <input
              ref={fileRef}
              data-testid="file-input"
              type="file"
              accept="application/pdf,image/*"
              multiple
              onChange={handlePick}
              style={{ display: 'none' }}
            />
            <button
              data-testid="file-upload"
              onClick={() => fileRef.current?.click()}
              disabled={!currentKbId}
              style={{ ...btn, opacity: currentKbId ? 1 : 0.4, marginLeft: 'auto' }}
            >
              {t(lang, 'kbUpload')}
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--cx-subtle)', marginBottom: 10 }}>{t(lang, 'kbUploadHint')}</div>
          {!currentKbId && <div style={{ fontSize: 12, color: 'var(--cx-subtle)' }}>{t(lang, 'kbPickFirst')}</div>}
          {currentKbId && files.length === 0 && <div style={{ fontSize: 12, color: 'var(--cx-subtle)' }}>{t(lang, 'kbNoFile')}</div>}
          {currentKbId && files.map((f) => (
            <div
              key={f.id}
              data-testid="file-item"
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--cx-border)', borderRadius: 8, marginBottom: 6, background: 'var(--cx-surface-2)' }}
            >
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--cx-subtle)', border: '1px solid var(--cx-border)', borderRadius: 4, padding: '1px 5px' }}>{f.type === 'pdf' ? 'PDF' : 'IMG'}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              <span style={{ fontSize: 11, color: 'var(--cx-subtle)' }}>{(f.size / 1024).toFixed(1)} KB</span>
              <button
                data-testid="file-delete"
                title={t(lang, 'kbDelete')}
                onClick={() => removeFile(f.id)}
                style={{ background: 'none', border: 'none', color: 'var(--cx-subtle)', cursor: 'pointer', fontSize: 12 }}
              >✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
