---
name: ai-coding-guard
description: "Use ONLY for the ai_motor_control / MOTOTUNE (web) project before any code change, feature work, refactor, or bug fix. Enforces a propose -> approve -> implement -> test loop: keep each module isolated, require a matching test for every functional module, tell the user the logic BEFORE writing anything, never edit without explicit approval, and raise an interference report instead of touching another feature's code or files. Triggers: '实现功能', '修复bug', '改代码', '重构', '新增功能', '加个功能', '改一下', 'motor control', 'MOTOTUNE', 'modbus', '示波器', '串口', 'LLM tool', 'ConfirmCard'. Gate: ai_motor_control, 模块隔离, 先讲逻辑, 不得擅自编写, 干涉报告."
license: MIT
compatibility: "opencode. Targets the ai_motor_control repository (Next.js + Vitest + Playwright)."
metadata:
  project: ai_motor_control
  repo_path: /home/zh180/ai_motor_control
---

# AI Coding 管控协议 — ai_motor_control

这是一个**流程约束技能**,不是编码技能。它不让 AI 写得更快,而是让 AI **在动代码之前必须先讲清逻辑、拿到批准、并守住模块边界**。

**适用范围**:`ai_motor_control` 仓库(`/home/zh180/ai_motor_control`,MOTOTUNE web 分支,Next.js 15 + Web Serial + LLM)。

**生效时机**:本技能在**任何写操作之前**生效。只读调查**不受限**。

---

## 0. 铁律(Hard Rules,不可协商)

| # | 规则 | 含义 |
|---|------|------|
| **H1** | **无批准不落笔** | 用户明确批准前,**禁止** edit / write / patch / 新建文件 / 删除文件 / 改配置 / 执行任何会改动文件系统的命令。 |
| **H2** | **先讲逻辑再写** | 功能与 bug 都要先交《变更提案》,把逻辑讲清楚,**等批准**。 |
| **H3** | **模块隔离** | 一次改动只落在"拥有该职责"的模块内(见 §4)。跨模块 = 触发干涉流程(§3.3)。 |
| **H4** | **功能必有测试** | 没有对应测试的改动不算完成(见 §4 测试矩阵)。 |
| **H5** | **干涉先报告** | 若完成 A 功能时会牵动 B 功能的文件 / 行为 / 接口 → **先出《干涉报告》,批准后才动**。未批准前**不得**改 B 的任何代码或文件。 |
| **H6** | **不破基线** | `docs/TESTING.md` 的用例必须全部仍通过。**禁止删除 / skip 失败测试**来"通过"。 |
| **H7** | **安全约束** | 转速上限 6000 RPM(clamp)、默认波特率 `781250`、API key 只走 `.env.local` / 设置面板**不得写进代码**。这些不可改动。 |
| **H8** | **只读先行** | 提案前必须先读相关代码/文档,**不许凭空猜**。未读过的代码不臆测。 |

> 违反 H1/H5 是**最严重**的错误。宁可停下来问,也不要"顺手改一下"。

---

## 1. 工作循环(每次会话按序执行)

```
侦察(只读)  →  提案  →  ⏸ 等批准  →  实现(仅批准范围)  →  验证(测试)  →  汇报
   ↑                                                                        │
   └──────────────────── 出现新发现 → 停止,重新提案 ←──────────────────────┘
```

1. **侦察(只读)**:读相关文件、`AGENTS.md`、`docs/*`、跑只读命令(`git status`、`git log`、`grep`)。确认改动归属哪个模块。
2. **提案**:按 §3 模板输出。**到此为止,停下。**
3. **⏸ 等待批准**:只有用户明确说"批准 / 同意 / 确认 / 可以 / 继续 / 开始 / OK / go"才算批准(见 §5)。
4. **实现**:只改提案里列出的文件,只做提案里描述的改动。**范围锁**生效(§6)。
5. **验证**:跑对应测试(§4)。
6. **汇报**:按 §7 格式给证据。

> **循环中途若发现必须动其它模块** → 立即停止实现,输出《干涉报告》(§3.3),回到步骤 3。
> **中途若发现原判断有误** → 停止,重新侦察 + 重新提案。不要在错误前提上继续。

---

## 2. 侦察清单(提案前必做)

```bash
cd /home/zh180/ai_motor_control
git status && git branch --show-current
git log --oneline -10
```

- 读根 `AGENTS.md`(架构/数据流/协议/组件约束)
- 按改动域读 `lib/AGENTS.md` 或 `components/AGENTS.md`
- 读 `docs/TESTING.md`(测试基线)、`docs/modbus_rtu_protocol.md`(涉及协议时)
- 找到**现有同类实现**,新代码必须沿用其模式(不另起风格)

---

## 3. 提案模板

### 3.1 新功能提案(必填,缺一不可)

```markdown
## 功能提案:<一句话标题>

**需求原文**:<复述用户原话,不许改写意思>
**所属模块**:<lib/serial | lib/llm | lib/stores | components/chat | components/scope | app | ...>
**当前行为**:<现在是什么样,附文件:行>
**目标行为**:<改成什么样>

### 逻辑(必须先讲清)
- 数据流:输入(<来源>) → 处理(<函数/步骤>) → 输出(<去向>)
- 关键函数/接口:签名 + 职责
- 状态变化:哪些 store / bus 事件受影响
- 边界与异常:为空 / 超时 / 断连 / 超限(clamp) 时怎么办

### 改动文件(新增 / 修改)
| 文件 | 操作 | 说明 |
|------|------|------|
| lib/xxx.ts | 修改 | 加函数 yyy |
| unit/xxx.spec.ts | 新增 | 测 yyy |

### 测试计划(必填)
- 单测:`unit/<module>.spec.ts` — 用例:1)… 2)…
- E2E(涉及 UI/串口/LLM 时):`e2e/<feature>.spec.ts` — 用例:1)…
- 复用 mock:`e2e/mockSerial.ts`(串口)/ `page.route('**/api/llm')`(LLM)

### 不做(Out of scope)
- <明确列出这次不碰的东西>

### 风险 / 回滚
- 风险:<是否触碰其它功能>
- 回滚:<如何撤回>

**请批准后我再开始编写。**
```

### 3.2 Bug 修复提案

```markdown
## Bug 修复提案:<现象一句话>

**现象**:<用户看到什么>
**复现步骤**:1)… 2)… 3)…
**证据**:<日志 / 报错 / 失败测试 / 文件:行>
**出现频率**:必现 / 偶现

### 根因假设(先讲逻辑)
- 假设:<根因>
- 依据:<代码位置 / 日志>
- 排除项:<为什么不是 X / Y>

### 最小修复
- 文件:`<file>:<函数>` — 改什么
- **不改什么**:<明确列出保持原样的部分>
- 为何不影响其它功能:<说明>

### 回归测试(先写失败用例)
- `unit/<x>.spec.ts` 或 `e2e/<x>.spec.ts` — 用例:<复现 bug 的断言>

### 影响面
- 受影响功能:<有/无>
- 若牵动其它模块 → 见《干涉报告》

**请批准后我再开始修改。**
```

### 3.3 干涉报告(★ 本技能的核心)

**触发条件(满足任一)**:实现 A 功能时,需要
- 改到 B 功能的**文件**;
- 改 B 功能的**函数签名 / 行为 / 数据结构**;
- 改共享的 `lib/types.ts` / `lib/bus.ts` / `lib/config.ts` / `lib/settings.ts`;
- 改 B 功能的**测试**或让 B 的测试变红;
- 任何"为了顺手"的额外修改。

```markdown
## ⚠️ 干涉报告:实现 <A> 会牵动 <B>

**为什么停下**:<原提案只批了 A,但 A 必须改到 B 才能完成>

### 受影响的其他功能
| 其他功能 | 文件 / 函数 | 会被改成什么 | 为什么必须改 |
|----------|-------------|--------------|--------------|
| <B>      | lib/xxx.ts:<fn> | <变化>    | <理由>       |

### 能否避免
- 方案 1(不改 B):<可行?代价?>
- 方案 2(改 B):<最小侵入方式>

### 风险 / 回归
- B 的现有测试:<哪些会受影响>
- 新增回归测试:<文件 + 用例>

### 请选择
- **A. 允许改动 B**(我会同步给 B 加回归测试)
- **B. 只报告,不改 B**(我停在这里,只交付 A 中不依赖 B 的部分)
- **C. 换方案**(按方案 1 重做)

**在你选择前,我不会改动 B 的任何代码或文件。**
```

---

## 4. 模块归属与测试矩阵

**改动必须落在"拥有该职责"的模块**。跨模块前先看是否触发 §3.3。

| 功能模块 | 归属文件 | 必配测试 | 说明 |
|---|---|---|---|
| Modbus 协议层 | `lib/serial/modbus.ts` | `unit/modbus.spec.ts` | CRC / 帧 / float32 / 地址表,纯逻辑单测 |
| 串口适配 / 轮询 | `lib/serial/motorController.ts` | `e2e/serial-scope.spec.ts`(mock) | 事务队列 / 50ms 遥测 / readWaveFrame |
| 桥接 | `lib/serial/bridge.ts` | 单测或 e2e | BridgePort 握手 READY |
| 事件总线 | `lib/bus.ts` + `lib/types.ts` | `unit/*.spec.ts` | 新增 bus 类型须同步 types |
| LLM 客户端 | `lib/llm/llmClient.ts` | `unit/llmClient.spec.ts` | SSE 解析 / abort / 无条件 turn_end |
| LLM 工具 / 提示词 | `lib/llm/tools.ts` | 单测 + `e2e/tool-call.spec.ts` | 前后端共用,改动影响面大 |
| 会话 store | `lib/stores/sessionStore.ts` | `unit/sessionStore.spec.ts` | localStorage `mototune.sessions` |
| 电机 store | `lib/stores/motorStore.ts` | **`unit/motorStore.spec.ts`(缺则补)** | applyEvent→状态 |
| 命令锁 | `lib/stores/commandLockStore.ts` | **`unit/commandLockStore.spec.ts`(缺则补)** | idle→pending→executing→idle |
| 示波器 store | `lib/stores/scopeStore.ts` | `unit/scopeStore.spec.ts` | applyFrame / 通道配置 |
| 设置 / i18n | `lib/settings.ts` + `lib/i18n.ts` | `e2e/settings-search.spec.ts` | zh/en 必须同步 |
| 聊天 UI | `components/chat/*` | `e2e/chat.spec.ts`、`e2e/tool-call.spec.ts` | 仅经 store/bus 取数 |
| 示波器 UI | `components/scope/*` | `e2e/serial-scope.spec.ts` | SVG path 波形 / 暂停 |
| 页面 / 代理 | `app/**`、`app/api/llm/route.ts` | e2e / 手动验证 | 纯客户端渲染,禁止 SSR |
| 报告 / 统计 | `lib/report.ts` + `lib/stats.ts` | `unit/*.spec.ts` | 纯函数 |

### 测试命令

```bash
npm run test:unit                       # 全部单测
npx vitest run unit/modbus.spec.ts      # 单文件
npm run test:e2e                        # 全部 E2E(自动起 3100 端口)
npx playwright test e2e/app.spec.ts -g "折叠"   # 单用例
npm run test:all                        # 全量,交付前必跑
```

**规则**:
- 纯逻辑(协议/store/解析)→ **必须**有 `unit/` 单测。
- UI 交互 / 串口 / LLM 链路 → **必须**有 `e2e/` 用例如(mock LLM + fake serial,**禁止**真调 LLM/真串口)。
- 改布局 → 检查 e2e 选择器(`.composer-send`、`.sb-item`、`data-testid`)。
- **新增功能模块若缺测试文件,先补测试文件**再谈完成。

---

## 5. 批准判定

**算批准**:用户明确说「批准 / 同意 / 确认 / 可以 / 继续 / 开始 / 写吧 / 改吧 / OK / go / 按这个来」。

**不算批准**:沉默、「嗯」「hmm」「?」、提问、只补充需求、只表达情绪。

**边界情况**:
- 用户改了提案范围 → 用改后范围重新确认,不默认沿用旧批准。
- 用户可以**预先授权**一类操作(如"这个文件的测试随你补"),此时在提案里写明并记录授权范围,只在该范围内免逐次批准。
- 不确定是否算批准 → **当作没批准,再问一次**。

---

## 6. 实现约束(范围锁)

批准后,实现期间:

1. **只改提案列出的文件**。多改一个文件 = 违反 H5。
2. **只做提案描述的改动**。不重构、不美化、不"顺手优化"(bug 修复尤其:最小修复,绝不顺带重构)。
3. **沿用既有模式**:命名、目录、store/bus 用法、样式 token 都跟现有代码一致。
4. **不绕过架构**:组件↔组件只经 store;串口只走 `motorController`;跨页导航用 `next/link`;不新增 SSR 依赖。
5. **不引入新依赖**,除非提案里说明并获批。
6. **不留垃圾**:无 `console.log` 调试残留、无注释掉的死代码、无 TODO 占位交付。
7. **不抑制类型错误**:禁止 `as any` / `@ts-ignore` / `@ts-expect-error`。
8. 中途发现需要动其它模块 → **停止**,出《干涉报告》。

---

## 7. 完成汇报格式(附证据)

```markdown
## 完成:<标题>

**改动**:<文件列表 + 每个文件做了什么>
**逻辑落地**:<实际实现与提案是否一致;若有偏差说明原因>
**测试证据**:
- 命令:`npm run test:unit` → 输出:<通过 x / 失败 y>
- 命令:`npx playwright test e2e/<x>.spec.ts` → 输出:<通过 / 失败>
- 新增用例:<文件:用例名>
**未做**:<按 out of scope 说明>
**遗留 / 风险**:<如实报告,不确定就说不确定>
**建议下一步**:<可选>
```

**没有测试证据 = 不算完成。** 若测试失败且非本次改动引起,注明"预存在失败",不要顺手修(除非获批准)。

---

## 8. 禁区(任何时候都禁止)

- ❌ 未批准就 edit / write / 生成文件 / 删文件。
- ❌ 未出《干涉报告》就改其它功能的代码或文件(H5)。
- ❌ 删除 / skip / 注释掉失败测试来"变绿"。
- ❌ bug 修复时顺带重构别处代码。
- ❌ 为了跑通而绕过架构(直接 `navigator.serial`、组件直连 store 内部、`<a href>` 跨页)。
- ❌ 把 API key / 密钥写进代码;改动 6000 RPM clamp 或 `781250` 波特率。
- ❌ 不读代码就臆测(违反 H8);改完不做验证就报完成。
- ❌ 用"我认为这样可以"代替"我提案并等你批准"。

---

## 9. 一句话口诀

> **先读、再讲、等批准、只改本模块、必带测试、干涉先报告。**
>
> 讲不清逻辑 = 不许写;没批准 = 不许写;会牵动别的功能 = 先报告。
