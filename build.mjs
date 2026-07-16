import * as esbuild from 'esbuild'
import { execSync } from 'child_process'
import { mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, 'out/renderer')

function buildCss() {
  mkdirSync(OUT, { recursive: true })
  execSync(`npx tailwindcss -i src/renderer/src/index.css -o ${join(OUT, 'index.css')} --minify`, { stdio: 'inherit', cwd: __dirname })
  console.log('[build] css: ok')
}

function buildMain() {
  const d = join(__dirname, 'out/main'); mkdirSync(d, { recursive: true })
  esbuild.buildSync({ entryPoints: [join(__dirname, 'src/main/index.ts')], bundle: true, platform: 'node', target: 'node22', outfile: join(d, 'index.js'), external: ['electron'], format: 'cjs' })
  console.log('[build] main: ok')
}

function buildPreload() {
  const d = join(__dirname, 'out/preload'); mkdirSync(d, { recursive: true })
  esbuild.buildSync({ entryPoints: [join(__dirname, 'src/preload/index.ts')], bundle: true, platform: 'node', target: 'node22', outfile: join(d, 'index.mjs'), external: ['electron'], format: 'esm' })
  console.log('[build] preload: ok')
}

function bundleJs(entry, outName) {
  esbuild.buildSync({ entryPoints: [join(__dirname, entry)], bundle: true, platform: 'browser', target: 'es2020', outfile: join(OUT, outName), loader: { '.tsx': 'tsx', '.ts': 'ts' }, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' } })
}

function copyHtml(src, oldScript, newScript) {
  let html = readFileSync(join(__dirname, src), 'utf-8').replace(oldScript, newScript)
  if (!html.includes('index.css')) html = html.replace('</head>', '  <link rel="stylesheet" href="./index.css" />\n  </head>')
  writeFileSync(join(OUT, src.split('/').pop()), html)
}

buildCss()
buildMain()
buildPreload()
bundleJs('src/renderer/src/main.tsx', 'renderer.js')
bundleJs('src/renderer/src/motor.tsx', 'motor.js')
copyHtml('src/renderer/index.html', './src/main.tsx', './renderer.js')
copyHtml('src/renderer/motor.html', './motor.js', './motor.js')
// Copy static assets
import { copyFileSync } from 'fs'
try { copyFileSync(join(__dirname, 'src/renderer/src/MOTOTUNE.png'), join(OUT, 'MOTOTUNE.png')) } catch {}
console.log('[build] done')
