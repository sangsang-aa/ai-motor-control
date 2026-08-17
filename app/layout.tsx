// 根布局 — 深色主题 + 全高容器

import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MOTOTUNE — AI 电驱控制系统',
  description: 'LLM 自然语言电机控制 + Web Serial + SVG 示波器'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
