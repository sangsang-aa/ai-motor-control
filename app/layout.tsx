// 根布局 — 全高容器 + 首屏主题(亮/暗)恢复

import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'

export const metadata: Metadata = {
  title: 'MOTOTUNE — AI 电驱控制系统',
  description: 'LLM 自然语言电机控制 + Web Serial + SVG 示波器'
}

const THEME_INIT = `try{var s=JSON.parse(localStorage.getItem('mototune.settings')||'{}');var t=s.theme==='dark'?'dark':'light';document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}catch(e){document.documentElement.dataset.theme='light';document.documentElement.style.colorScheme='light'}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
