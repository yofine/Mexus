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

根据测试结果，当前最可能的根因排序如下：

1. codextui 将 Agent 输出流当成当前帧状态渲染，而不是 append-only transcript，导致中间内容被覆盖或未进入历史缓冲。
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

在 codextui 接收 Agent 输出的最底层边界添加临时日志，将每个 chunk 原样写入文件。例如：

```ts
fs.appendFileSync(
  "/tmp/codextui-agent-stream.log",
  chunk.replace(/\n/g, "\\n") + "\n---CHUNK---\n",
);
```

然后重新运行 `S001-S020` 或 `T001-T040` 测试。

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
