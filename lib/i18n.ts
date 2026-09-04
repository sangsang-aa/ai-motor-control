// 轻量 i18n — 中/英。语言状态用 zustand,组件 useLang() 订阅即响应式切换。

import { create } from 'zustand'
import type { Language } from './settings'

export const translations = {
  zh: {
    appTitle: 'MOTOTUNE',
    connected: '已连接',
    disconnected: '未连接',
    baud: '波特率',
    connect: '连接串口',
    disconnect: '断开',
    rpm: '转速',
    current: '电流',
    newSession: '+ 新建会话',
    sessions: '对话记录',
    tools: '工具栏',
    scope: '示波器',
    export: '导出报告',
    settings: '设置',
    search: '搜索对话',
    hideSidebar: '收起侧栏',
    expandSidebar: '展开侧栏',
    deleteSession: '删除此会话？',
    today: '今天',
    send: '发送',
    inputPlaceholder: '输入消息... (Enter 发送, Shift+Enter 换行)',
    welcome: '您好，今天要干什么？',
    searchPlaceholder: '输入标题关键词...',
    noResult: '无匹配对话',
    settingsTitle: '设置',
    language: '使用语言',
    aiProvider: 'AI 供应商',
    apiBaseUrl: 'API Base URL',
    apiKey: 'API Key',
    model: '模型',
    save: '保存',
    close: '关闭'
  },
  en: {
    appTitle: 'MOTOTUNE',
    connected: 'Connected',
    disconnected: 'Disconnected',
    baud: 'Baud',
    connect: 'Connect Serial',
    disconnect: 'Disconnect',
    rpm: 'RPM',
    current: 'Current',
    newSession: '+ New Session',
    sessions: 'Sessions',
    tools: 'Tools',
    scope: 'Oscilloscope',
    export: 'Export Report',
    settings: 'Settings',
    search: 'Search Sessions',
    hideSidebar: 'Hide Sidebar',
    expandSidebar: 'Show Sidebar',
    deleteSession: 'Delete this session?',
    today: 'Today',
    send: 'Send',
    inputPlaceholder: 'Type a message... (Enter to send, Shift+Enter for newline)',
    welcome: 'Hi, what would you like to do?',
    searchPlaceholder: 'Type a title keyword...',
    noResult: 'No matching sessions',
    settingsTitle: 'Settings',
    language: 'Language',
    aiProvider: 'AI Provider',
    apiBaseUrl: 'API Base URL',
    apiKey: 'API Key',
    model: 'Model',
    save: 'Save',
    close: 'Close'
  }
} as const

type Key = keyof typeof translations.zh

interface LangState {
  lang: Language
  setLang: (lang: Language) => void
}

export const useLangStore = create<LangState>((set) => ({
  lang: 'zh',
  setLang: (lang) => set({ lang })
}))

/** 当前语言下的文案(组件用 useLangStore(s => s.lang) 获取语言后调用 t) */
export function t(lang: Language, key: Key): string {
  const dict = translations[lang] ?? translations.zh
  return dict[key] ?? translations.zh[key]
}
