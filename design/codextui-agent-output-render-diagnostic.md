# codextui Agent 输出渲染不完整诊断报告

日期：2026-05-17

## 背景

在通过 codextui 查看常规 Agent 返回内容时，发现终端界面无法完整渲染回复。最初怀疑点包括 Markdown 渲染、代码块、diff、表格、中文宽字符或高频流式输出。随后通过多轮手工输出测试逐步隔离问题。

本报告记录当前已观察到的现象、排除项、推断结论和后续排查建议。

## 测试摘要

### 1. 常规 Agent 回复测试

测试内容覆盖：

- Markdown 标题和段落
- 列表
- TypeScript 代码块
- diff 代码块
- 表格
- 中文、英文、路径和长行

观察结果：

- 多个段落缺失。
- 列表项出现截断。
- 代码块中间行缺失，例如类型声明、函数声明、条件块闭合等。
- diff 中删除行和部分上下文行缺失。
- 表格头和部分数据行缺失。
- 最后部分内容出现在输入提示区域附近。

初步结论：

这不是单纯的视觉样式问题，存在真实内容丢失或被覆盖。

### 2. 带行号 Markdown 诊断测试

测试内容使用 `L001` 到 `L046` 标记每段内容，覆盖 Markdown、代码块、diff 和表格。

观察结果：

- `L001` 缺失。
- `L002`、`L004` 等行尾截断。
- 代码块中的 `type TerminalChunk = {`、`export function ...` 等关键行缺失。
- diff 中 `- terminal.write(data);` 等行缺失。
- 表格中的部分行缺失。

结论：

Markdown 相关结构确实会暴露问题，但问题不一定只发生在 Markdown 渲染器。

### 3. 纯文本行号测试

测试内容去掉 Markdown、代码块、diff、表格和复杂符号，仅保留 `R001` 到 `R024` 的普通文本行。

观察结果：

- `R001-R005` 缺失。
- `R008-R010` 缺失。
- `R017-R023` 缺失。
- `R013`、`R015` 等长一些的普通文本行被截断。
- 最后一部分输出仍然疑似出现在输入提示区域。

结论：

问题不依赖 Markdown、代码块、diff 或表格。纯文本输出也会丢失。

### 4. 极简 ASCII 连续行测试

测试内容为 `T001 END` 到 `T040 END`，不含中文、不含 Markdown、不含复杂标点，也不包含长行。

观察结果：

- `T001` 缺失。
- `T003-T004` 缺失。
- `T008-T009` 缺失。
- `T012-T015` 缺失。
- `T018-T020` 缺失。
- `T022`、`T024`、`T028-T031`、`T033`、`T035-T039` 缺失。
- `T040 END` 出现在输入提示区域附近。

结论：

codextui 连最简单的纯 ASCII 连续行都无法完整保留。问题已经可以排除中文宽字符、Markdown 解析、代码块渲染和 diff 渲染。

### 5. 慢速输出测试

测试内容为 `S001 END` 到 `S020 END`，用于判断问题是否由高频流式 chunk 过快导致。

观察结果：

- `S003` 缺失。
- `S007-S008` 缺失。
- `S010-S011` 缺失。
- `S013-S016` 缺失。
- `S018` 缺失。
- 末尾仍出现输出内容被带到输入提示区域附近的现象。

结论：

慢速输出同样丢行，因此高频 chunk 节流或批处理不是唯一主因。问题更可能位于 TUI 布局、viewport、scrollback、repaint 或输出区与输入区边界模型。

## 当前判断

### 最终根因

本轮修复后，`T001-T040` 连续行 case 已在真实 Codex pane 中恢复完整显示。最终确认的主因不是 xterm.js 本身，也不是 Codex 未输出，而是 Mexus server 侧输出清洗链路错误：

- `PtyManager` 对所有 Agent 都运行 Claude 专用 `StatuslineParser`。
- `StatuslineParser` 旧逻辑会对无换行 chunk “先原样放行，同时写入内部 buffer”。
- 下一次遇到带换行 chunk 时，parser 会把上一次已经放行过的 chunk 从 buffer 中拼回并再次放行。
- 对普通文本，这表现为重复内容；对 Codex TUI，这会让 cursor move、scroll region、erase line、prompt repaint 等 ANSI 控制序列被重复执行，从而破坏屏幕状态，表现为缺行、内容被覆盖、历史不可滚。

修复原则：

- 只有声明 `statusline: true` 的 Claude Code pane 才进入 `StatuslineParser`。
- 不声明 statusline 的 Codex / OpenCode / Shell 等 pane 直接透传 PTY 输出。
- `StatuslineParser` 不再缓存任何 partial chunk。没有换行的输出一律立即透传。
- Claude statusline 只在完整换行行里识别和剥离。split statusline 可能漏掉一次 meta，但不能以吞掉 TUI 输出为代价。
- 带换行 chunk 末尾的 trailing 内容也必须立即透传。否则 Claude Code 启动或退出 TUI 后重新输入 `claude` 时，prompt/status 输出可能被缓存，后续无换行输出会持续被吞掉，表现为 Pane 没反应。
- Replay/历史需要单独记录用户输入。PTY output 并不保证包含用户输入回显，尤其是 Agent TUI/raw mode 场景；因此 `terminal.input` 现在作为 replay input event 进入 `SessionRecorder`，按 Enter 聚合为一条用户输入记录。它只用于历史展示，不回灌 live terminal，避免双重显示。

这个结论比 “xterm scrollback 不完整” 更靠前：xterm 的滚动行为仍然受 TUI scroll region 影响，但本次连续行缺失的直接触发点是 server 侧重复执行了 TUI 控制序列。

### Raw PTY capture 结论

已通过 Mexus 服务端 raw PTY capture 检查 `T001-T040` 连续行 case。原始日志中 `T001 END` 到 `T040 END` 均存在，说明 Agent 输出已经完整进入 node-pty 和 Mexus server 边界。

因此当前缺行不是 Agent 未输出、PTY 未收到或 WebSocket 之前的数据丢失。问题集中在终端屏幕语义和展示层：Codex TUI 会大量使用 scroll region、erase line、cursor move、同步输出和 prompt/status repaint，最终可见屏幕并不等同于完整 append-only transcript。

低风险验证动作：

- Codex 默认启动参数增加 `--no-alt-screen`。
- `@mexus/terminal` demo 的 Codex preset 同步增加 `--no-alt-screen`。
- 现有 Pane 的 live 输出不再经过 `terminalRegistry` 的二次 RAF 合并，改为直接交给 `@mexus/terminal` runtime 队列。
- `terminalRegistry` 不再在 writer 重新注册时重放前端本地 history，避免 TUI 控制序列在 React remount / StrictMode 下被二次灌入。
- runtime 的 follow-output 策略改为仅当用户本来位于底部时才自动 `scrollToBottom()`；用户向上滚屏后，Agent 的 spinner/status repaint 不应把 viewport 拉回底部。
- Codex / OpenCode / Shell 等不声明 `statusline` 的 Agent 绕过 Claude `StatuslineParser`。此前 parser 会对无换行 chunk “先放行、再缓存”，下一次遇到换行时重复放行前一段控制序列；对 Codex 这类大量 cursor / scroll-region repaint 的 TUI 会导致屏幕状态被二次执行。
- Claude `StatuslineParser` 仅缓存疑似 statusline JSON 的 partial chunk，普通 partial output 不再缓存后重复输出。

预期：

- Codex 进入 inline 模式后，不再依赖 alternate screen 当前帧渲染。
- 浏览器 xterm scrollback 更接近真实 transcript。
- `T001-T040` 这类连续纯文本 case 应完整显示。
- 如果 `--no-alt-screen` 后仍缺行，重点继续看 Pane 集成层的重放、resize、隐藏挂载和 scroll-follow 行为，而不是 PTY / WebSocket 数据完整性。
- 如果修复 parser 后仍缺行，下一步再评估 binary PTY frame / headless xterm mirror；在此之前不应继续调整视觉层或简单节流。

根据测试结果，历史根因候选排序如下。当前已确认第 1 点是主因，后续几项作为长期架构风险保留：

1. server 侧 statusline parser 重复放行 partial TUI 控制序列，导致 Codex 屏幕状态被二次执行。
2. TUI repaint/viewport 计算错误，清屏、擦除、光标移动或局部重绘覆盖了已输出内容。
3. 输出区和输入提示区的布局边界错位，导致输出内容被绘制到 prompt 区域，或 prompt repaint 覆盖输出行。
4. scrollback/history 只保存了当前可见窗口，而不是完整输出 transcript。
5. chunk 队列或 render batch 仍可能存在问题，但慢速测试说明它不是唯一解释。

## 已基本排除

- 不是 Markdown 语法导致的单点问题。
- 不是代码块或 diff 语法导致的单点问题。
- 不是中文宽字符或 Unicode 对齐导致的单点问题。
- 不是长行换行导致的单点问题。
- 不是单纯高频 stream 太快导致的单点问题。

## 建议排查路径

### 1. 先确认原始 Agent stream 是否完整

Mexus 现在提供了一个默认关闭的 raw PTY capture 开关，可以在服务端 node-pty 输出进入任何 parser / replay / 前端渲染前写入原始日志。

启动方式：

```bash
MEXUS_TERMINAL_CAPTURE=1 npm run dev
```

默认日志目录：

```text
/tmp/mexus-terminal-capture/{paneId}.ansi.log
```

只捕获单个 pane：

```bash
MEXUS_TERMINAL_CAPTURE=1 \
MEXUS_TERMINAL_CAPTURE_PANE=<pane-id> \
npm run dev
```

自定义日志目录：

```bash
MEXUS_TERMINAL_CAPTURE=1 \
MEXUS_TERMINAL_CAPTURE_DIR=/tmp/mexus-codex-raw \
npm run dev
```

然后重新运行 `S001-S020` 或 `T001-T040` 测试，并用 `rg "S00|T00" /tmp/mexus-terminal-capture/*.ansi.log` 检查原始 PTY 输出。

判断：

- 如果日志完整，而 TUI 不完整，问题在 TUI 渲染层。
- 如果日志也不完整，问题在 Agent stream 接收、传输或解析层。

### 2. 临时绕过复杂 repaint

实现一个最朴素的 append-only 输出模型：

```ts
setMessages((prev) => [...prev, chunk]);
```

要求：

- 不做局部擦除。
- 不移动光标覆盖旧行。
- 不使用 clear screen。
- 不根据 viewport 丢弃 transcript，只在渲染时裁剪最近 N 行。

如果 append-only 模式完整，则说明当前 repaint、viewport 或布局边界存在问题。

### 3. 检查输出区和输入区边界

重点检查：

- 输出区高度是否扣除了 prompt 高度。
- prompt repaint 是否会覆盖输出区最后几行。
- 当输出新增行时，scroll offset 是否正确更新。
- bottom padding / reserved rows 是否和实际 prompt 行数一致。
- 宽度变化或自动换行后，行高计算是否重新同步。

### 4. 检查可能导致覆盖的控制逻辑

重点搜索：

- `console.clear`
- `clearScreen`
- `eraseDown`
- `eraseLine`
- `cursorTo`
- `moveCursor`
- `setRawMode`
- 自定义 viewport slice
- 只保留 latest chunk 的 throttle/debounce

需要确认这些逻辑是否只作用于 prompt 或状态栏，而不会误清输出 transcript。

## 推荐修复方向

从架构上建议把输出模型拆成两层：

1. **Transcript 层**
   - append-only。
   - 保存完整 Agent 输出。
   - 不受 viewport、prompt、重绘节流影响。

2. **Viewport 层**
   - 只负责从 transcript 中选择可见行。
   - 可以根据终端高度、滚动位置和 prompt 高度裁剪。
   - 不应反向修改 transcript。

这样可以避免 TUI 当前帧渲染逻辑破坏真实输出历史。

## 最小复现用例

### 极简 ASCII 连续行

```text
T001 END
T002 END
T003 END
T004 END
T005 END
T006 END
T007 END
T008 END
T009 END
T010 END
T011 END
T012 END
T013 END
T014 END
T015 END
T016 END
T017 END
T018 END
T019 END
T020 END
T021 END
T022 END
T023 END
T024 END
T025 END
T026 END
T027 END
T028 END
T029 END
T030 END
T031 END
T032 END
T033 END
T034 END
T035 END
T036 END
T037 END
T038 END
T039 END
T040 END
```

期望结果：

- `T001` 到 `T040` 连续完整出现。
- 输出内容不应出现在输入提示行。
- 中间不应插入空白覆盖行。

### 慢速输出连续行

```text
S001 END
S002 END
S003 END
S004 END
S005 END
S006 END
S007 END
S008 END
S009 END
S010 END
S011 END
S012 END
S013 END
S014 END
S015 END
S016 END
S017 END
S018 END
S019 END
S020 END
```

期望结果：

- 即使每秒输出一行，也必须完整保留 `S001-S020`。
- 如果慢速仍丢行，应优先排查布局、viewport、scrollback 和 repaint，而不是只查 stream 节流。

## 结论

目前证据表明：codextui 的常规 Agent 输出渲染不完整不是内容格式问题，而是基础输出渲染链路问题。由于极简 ASCII 和慢速输出都会丢行，后续应优先定位 TUI 渲染层是否把输出当作可覆盖的当前帧，或是否在 viewport/prompt repaint 时错误清除了 transcript。
