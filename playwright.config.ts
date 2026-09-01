import { defineConfig } from '@playwright/test'

/**
 * Playwright E2E 配置。
 * web 分支为 Web 版(Next.js),E2E 通过真实浏览器验证 UI 渲染/交互/对话/工具调用/串口/示波器。
 * LLM 用 page.route 拦截 /api/llm(mock),Web Serial 用 addInitScript 注入 fake navigator.serial —— 均不依赖真实硬件或真实 LLM 调用。
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  workers: 1, // 串行,避免 dev server 编译竞争
  use: {
    baseURL: 'http://localhost:3100',
    headless: true,
    trace: 'off',
    screenshot: 'only-on-failure',
    locale: 'zh-CN',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: {
    command: 'npm run dev -- -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
