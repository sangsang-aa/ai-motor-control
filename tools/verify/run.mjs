#!/usr/bin/env node
// 一键校验:用 MATLAB(样例估计器)在同一信号上取数 → 用 TS 算法跑同一 CSV → 对比。
// 环境变量:
//   MATLAB_BIN   MATLAB 可执行(默认 /mnt/d/MATLAB/R2025a/bin/matlab.exe)
//   PE_OUT_WIN   MATLAB 侧输出目录(Windows 路径,默认 D:/pe_work/cmp_out)
//   PE_OUT_WSL   WSL 侧同一目录(默认由 PE_OUT_WIN 推导)
import { execFileSync } from 'node:child_process'
import { mkdirSync, copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const MATLAB_BIN = process.env.MATLAB_BIN || '/mnt/d/MATLAB/R2025a/bin/matlab.exe'
const OUT_WIN = process.env.PE_OUT_WIN || 'D:/pe_work/cmp_out'
const OUT_WSL =
  process.env.PE_OUT_WSL || OUT_WIN.replace(/^([A-Za-z]):\//, (_, d) => `/mnt/${d.toLowerCase()}/`)
const here = path.dirname(fileURLToPath(import.meta.url))

mkdirSync(OUT_WSL, { recursive: true })
copyFileSync(path.join(here, 'extract_sample.m'), path.join(OUT_WSL, 'extract_sample.m'))

console.log(`[verify] MATLAB: ${MATLAB_BIN}`)
console.log(`[verify] 输出目录(Windows): ${OUT_WIN}`)
execFileSync(MATLAB_BIN, ['-batch', `outDir='${OUT_WIN}'; run('${OUT_WIN}/extract_sample.m')`], {
  stdio: 'inherit'
})

console.log('[verify] TS 对比同一条 CSV ...')
execFileSync('npx', ['vitest', 'run', 'unit/sampleCompare.spec.ts', '--reporter=verbose'], {
  stdio: 'inherit',
  env: { ...process.env, SAMPLE_CMP_DIR: OUT_WSL }
})
