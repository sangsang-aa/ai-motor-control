# tools/verify — 与样例估计器的同输入对比

在**同一条信号**上比较:

- **样例侧**:MATLAB + MCB 内部 p-code 估计器 `mcb.internal.estimatePMSMLd/Lq`(`extract_sample.m`);
- **本项目侧**:`lib/analysis/paramEstimation.ts` 的 `estimateLFrom`(读取同一份 CSV,`unit/sampleCompare.spec.ts`)。

## 一键运行
```bash
npm run verify:sample
```
流程:`run.mjs` → 调 MATLAB 生成信号并跑样例估计器,导出 `sig_ld.csv / sig_lq.csv / sample_results.txt` → 再跑 vitest 用同一 CSV 反算并对比。

## 可配置(环境变量)
| 变量 | 默认 | 说明 |
|---|---|---|
| `MATLAB_BIN` | `/mnt/d/MATLAB/R2025a/bin/matlab.exe` | MATLAB 可执行 |
| `PE_OUT_WIN` | `D:/pe_work/cmp_out` | MATLAB 侧输出目录(Windows 路径) |
| `PE_OUT_WSL` | 由 `PE_OUT_WIN` 推导 | WSL 侧同一目录 |

电机真值/测试条件(可选,改 `extract_sample.m` 顶部默认值或经 `-batch` 传入):
`motorRs=0.12952, motorLd=114.82e-6, motorLq=116.25e-6, injFreq=500, Ts=1/20000, nSamp=4000, gate=80`。

## 说明
- 样例**闭环 target 模型**在 headless 仿真下不产出估计(估计使能未驱动),故此工具直接调用样例的**估计器函数**,属"算法对算法"同输入对比。
- `unit/sampleCompare.spec.ts` 在 CSV 缺失时自动 skip,可安全纳入常规 `test:unit`。
