# Mexus CLI 命令体系设计

## 状态

草案。本文档设计一版 Mexus CLI 命令体系，覆盖当前本地功能，并为未来 Mexus Cloud 预留稳定入口。

## 核心结论

Mexus 保持一套 CLI，一个安装入口：

```bash
npm install -g mexus
```

不要拆成 `mexus` 和 `mexus-cloud` 两套 CLI。Mexus Cloud 仍然依赖用户机器上的本地 Mexus Server，不是独立 runtime。Cloud 能力应该作为同一个 `mexus` CLI 的 cloud 命令域存在。

CLI 需要同时服务两条产品链路：

- **本地离线版**：`mexus start`、`mexus hub`、`mexus pane`、`mexus mission` 等命令操作本机 server。
- **Mexus Cloud**：`mexus connect` 和 `mexus cloud link` 让用户自己的机器连接到 Cloud。

明确不做：

- 不做 `mexus hub connect <remote-url>` 这类本地 Hub 连接任意远程 server 的能力。
- 不在本地 Hub 中加入“输入远程 server URL 并代理访问”的产品模式。
- 不把任意 remote URL direct connection 作为 CLI 或 Hub 的正式能力。

原因是这会带来额外安全成本，并且会让产品模式从“两条清晰链路”变成“本地 Hub、Cloud、任意远程 server”三套混杂模型。

## 产品边界

### 本地离线版

本地离线版只管理本机上的 Mexus Server。

```text
Browser -> Local Hub / Local Server -> Workspace Runtime
```

本地 Hub 可以：

- 扫描本机端口。
- 启动本地 server。
- 停止本地 server。
- 打开本地 server tab。
- 代理到 `127.0.0.1:<port>`。

本地 Hub 不做：

- 输入任意 URL 连接远程 server。
- 保存远程 server token。
- 代理用户手动配置的远程 server。

### Mexus Cloud

Mexus Cloud 只连接用户自己机器主动连上来的 Mexus Server。

```text
Browser -> Cloud Hub / Gateway -> Tunnel -> User Machine Connector -> Local Server
```

Cloud 中没有“本地 Hub 管理 localhost instance”的概念，也没有“任意远程 URL 直连”的正式能力。

### Cloud Link

Cloud Link 是本地离线版和 Mexus Cloud 之间的桥。

- 用户已在本地运行 Mexus Server。
- 用户通过 `mexus cloud link` 或本地 Hub Cloud Link 按钮，把已有本地 server link 到 Cloud。
- 本地 Hub 的 Cloud Link 按钮直接执行连接流程，不只是展示命令引导。

## 命令总览

推荐命令结构：

```text
mexus
├─ start [dir]             # 启动当前项目的本地 Mexus Server 和 UI
├─ hub                     # 启动本地 Hub，管理本机 Mexus Server
├─ onboard [dir]           # TUI 分步配置本地 workspace 和可选全局偏好
├─ status [dir]            # 查看当前 workspace 配置状态
├─ stop                    # 停止当前本地 Mexus Server
├─ pane ...                # 通过 REST 管理本地 server panes
├─ mission ...             # 通过 REST 管理 Agent Team missions
├─ connect                 # Cloud-first，一步连接本机到 Mexus Cloud
└─ cloud
   ├─ link                 # Local-first，把已有本地 server link 到 Cloud
   ├─ unlink               # 解除当前机器或 workspace 的 Cloud link
   ├─ status               # 查看 Cloud link 状态
   ├─ login                # 可选，后续 device auth / browser auth
   └─ logout               # 可选，清理本地 Cloud session
```

## 本地命令

### `mexus start [dir]`

启动本地 Mexus Server 和 workspace UI。

语义：

- 面向单个项目。
- 不要求 Cloud 登录。
- 默认只服务本机使用。
- 可以被 `mexus connect` 复用为 Cloud-first 本地启动步骤。

建议参数：

```text
mexus start [dir]
  --port <port>
  --host <host>
  --no-open
```

默认：

- `host` 默认为本地安全地址。
- 普通本地启动不暴露公网。
- 不启用 Cloud link。

### `mexus hub`

启动本地 Hub。

语义：

- 管理本机多个 Mexus Server。
- 扫描本机端口和本地 instance registry。
- 可以启动、停止、打开本机 server。
- 可以提供 Cloud Link 按钮，把当前本地 server link 到 Cloud。

明确不支持：

- 不支持添加任意 remote server URL。
- 不支持 remote server token 管理。
- 不支持把本地 Hub 作为通用远程 server 管理器。

### `mexus onboard [dir]`

通过 TUI 分步表单完成本机 Mexus 基础配置。

语义：

- 替代原来的 `init` 心智。
- 面向首次使用和重新整理本机默认配置。
- 默认重点配置 Agent 和 Runtime。
- 项目级 `.nexus/config.yaml` 尽量自动生成，不让用户手动填一堆低价值字段。
- 主要写入全局 `~/.nexus/config.yaml`，必要时创建最小项目配置。
- 不要求 Cloud 登录。
- 不创建 Cloud workspace 记录。
- 不默认启动 Cloud Link。

建议参数：

```text
mexus onboard [dir]
  --yes                 # 使用推荐默认值，非交互创建配置
  --minimal             # 只问必要配置
  --advanced            # 展示高级配置步骤
  --global              # 只配置全局偏好
  --reconfigure         # 已有配置时重新进入表单
```

如果用户运行 `mexus start` 时项目没有 `.nexus/config.yaml`，可以自动创建最小配置，但不应该强制进入 onboard。可以提示：

```text
No .nexus/config.yaml found. Created a minimal workspace config.
Run `mexus onboard` to customize agents, panes, and defaults.
```

#### TUI 表单结构

`mexus onboard` 应是一个短 TUI 表单，只配置真正影响使用体验的内容。Project、Pane、Mission、Cloud Link 都不进入默认 onboard 路径。

推荐步骤：

```text
1. Agents
2. Runtime
3. Review & Write
```

高级模式可额外提供：

```text
4. Advanced
```

#### 自动项目配置

Project 不应该成为表单步骤。项目配置可自动推断：

- `name`：目录名。
- `repository.path`：`.`。
- `repository.git`：检测 `.git`。
- `description`：默认空。
- `panes`：默认空，交给 UI 创建。

如果 `.nexus/config.yaml` 不存在，`onboard` 或 `start` 可以写入最小配置：

```yaml
version: '1'
name: <directory-name>
description: ''
repository:
  path: .
  git: true
panes: []
```

#### Step 1：Agents

必要配置：

- 选择至少一个可用 agent。
- 为每个启用 agent 确认 binary path。

默认行为：

- 自动检测 `claude`、`codex`、`opencode`、`kimi`、`qodercli`。
- 已安装的 agent 默认启用。
- 未安装的 agent 显示 install hint，但不阻塞 onboard。

可选配置：

- 默认 agent。
- agent default args。
- continue/resume/yolo flag。
- statusline 是否启用。
- transport：默认 `pty`，高级项才展示。
- agent env。

写入：

- 全局 `~/.nexus/config.yaml` 的 `agents`。
- 全局默认 agent 偏好，后续 UI 创建 pane 时使用。

#### Step 2：Runtime

必要配置：

- shell：默认从 `SHELL` 环境变量检测。
- theme：默认 `dark-ide`。

默认值：

- shell：从 `SHELL` 环境变量检测。
- theme：`dark-ide`。
- scrollback lines：`5000`。
- grid columns：`2`。
- history retention days：`30`。

可选配置：

- terminal scrollback。
- history retention。
- default grid columns。

写入：

- 全局 `~/.nexus/config.yaml` 的 `defaults`。

#### Step 3：Review & Write

展示即将写入的文件：

- `~/.nexus/config.yaml`
- `.nexus/config.yaml`，如果当前项目还没有最小配置

用户确认后写入。

如果目标文件已存在：

- 默认不覆盖用户已有配置。
- 展示变更摘要。
- 提供 merge / cancel。

#### Advanced：Model Providers

必要配置：

- 无。默认跳过。

可选配置：

- provider name。
- provider type：`openai` / `anthropic`。
- base URL。
- API key。
- model list。
- proxy enabled / mode / port。

写入：

- 全局 `models.providers`。
- 全局 `models.defaults.tool_model`。

Model provider 配置不应放在默认必要路径里。Mexus 主要管理 CLI agent，很多用户的 API key 已经由各 agent 自己管理。在首次 onboard 里要求模型供应商会显著增加阻力。

#### 不进入 onboard 的内容

以下内容不进入 `onboard` 默认表单：

- panes：由 Hub / workspace UI 创建，比 TUI 里提前配置更自然。
- missions：属于功能使用阶段，不是首次配置。
- Cloud Link：使用 `mexus cloud link` 或本地 Hub Cloud Link 入口。
- project description：低价值，默认空。
- worktree/isolation/yolo：创建 pane 时配置。

#### 必要配置汇总

真正值得问用户的只有：

- 启用哪些 agent。
- 每个 agent 的 binary path 是否正确。
- 默认 shell。
- 默认 theme。

其他配置都应自动推断、使用默认值，或放到高级设置。

### `mexus status [dir]`

查看当前 workspace 配置状态。

当前可展示：

- workspace name。
- panes 数量。
- pane id / agent / name / task。

未来可以扩展展示：

- 本地 server 是否运行。
- 当前 workspace 是否已 Cloud linked。
- Cloud machine/workspace id，仅在已经 link 时展示。

### `mexus stop`

停止当前本地 Mexus Server。

语义：

- 只操作本机 server。
- 不对 Cloud workspace 做删除。
- 如果该 server 已 link 到 Cloud，Cloud 侧应变为 offline 或 disconnected。

### `mexus pane ...`

通过 REST 管理当前连接的本地 server panes。

现有语义保留：

- 面向本地 server。
- 使用 `NEXUS_SERVER_URL` 或默认本地 server URL。
- 不通过 Cloud gateway。

未来如果要支持 Cloud 操作，应另设显式参数，例如 `--cloud-workspace <id>`，但不作为 MVP 目标。

### `mexus mission ...`

通过 REST 管理 Agent Team Missions。

语义同 `pane`：

- 默认面向本地 server。
- Cloud 版后续如果需要 CLI 操作，应显式指定 Cloud workspace，不隐式改写本地语义。

## Cloud 命令

### `mexus connect`

Cloud-first 入口。

适用场景：

- 用户从 Mexus Cloud dashboard 开始。
- 本地 Mexus Server 不一定已经存在。
- 用户希望复制一条命令，把当前机器连接到 Cloud。

职责：

- 接收 Cloud pairing 信息。
- 需要时启动或发现本地 Mexus Server。
- 注册或复用 machine credential。
- 启动 connector。
- 建立出站 WSS tunnel。
- 上报 machine/workspace metadata。

建议命令：

```bash
mexus connect --hub https://mexus.cloud --pair mxp_abc123
mexus connect --hub https://mexus.cloud --pair mxp_abc123 --dir ~/project
mexus connect --hub https://mexus.cloud --pair mxp_abc123 --port 7700
```

语义边界：

- `connect` 可以拥有本地 server 的启动流程。
- `connect` 是 Cloud-first onboarding，不是本地 Hub remote connection。
- `connect` 不接受任意 remote server URL 作为目标。目标永远是 Mexus Cloud。

### `mexus cloud link`

Local-first 桥接入口。

适用场景：

- 用户已经运行了 `mexus start` 或 `mexus hub`。
- 本地 Mexus Server 已存在或可发现。
- 用户希望把当前本地 server link 到 Mexus Cloud。

职责：

- 定位已有本地 server。
- 接收 pairing code 或 device authorization。
- 注册或复用 machine credential。
- 启动 connector。
- 将云端流量转发到已运行的本地 server。

建议命令：

```bash
mexus cloud link --hub https://mexus.cloud --pair mxp_abc123
mexus cloud link --hub https://mexus.cloud --pair mxp_abc123 --server http://127.0.0.1:7700
mexus cloud link --hub https://mexus.cloud --pair mxp_abc123 --workspace .
```

语义边界：

- `cloud link` 默认不启动或停止本地 server。
- `cloud link` 不拥有本地 server 生命周期。
- `cloud link` 只把已有本地服务接到 Cloud。
- `cloud link --server` 只接受本机地址，例如 `127.0.0.1` 或 `localhost`。不接受任意远程 URL。

### `mexus cloud unlink`

解除 Cloud link。

职责：

- 停止 connector。
- 清理本地 link 状态。
- 可选地吊销本机 machine credential 或只解除当前 workspace link。

建议命令：

```bash
mexus cloud unlink
mexus cloud unlink --workspace .
mexus cloud unlink --machine
```

默认建议：

- `mexus cloud unlink` 解除当前 workspace link。
- `--machine` 才解除整台机器的 Cloud 绑定。

### `mexus cloud status`

查看 Cloud link 状态。

展示信息：

- 是否已登录或已配对。
- machine id / machine name。
- 当前 workspace 是否 linked。
- connector 是否运行。
- tunnel 是否 connected。
- cloud workspace id。
- last seen / last error。

### `mexus cloud login` / `logout`

可选命令，不作为第一版硬依赖。

如果未来采用 device auth 或 browser auth，可以使用：

```bash
mexus cloud login
mexus cloud logout
```

但 MVP 可以只依赖 Cloud dashboard 生成的 one-time pairing code。

## 本地 Hub 与 CLI 的关系

本地 Hub 的 Cloud Link 功能应该调用同一个本地 Cloud Link Service。

```text
CLI: mexus cloud link
        \
         -> Cloud Link Service -> Connector -> Mexus Cloud
        /
Hub UI: Cloud Link button
```

Cloud Link Service 负责：

- 解析 pairing code 或 device authorization。
- 注册或复用 machine credential。
- 定位本地 Mexus Server。
- 启动、停止、重连 connector。
- 上报 workspace metadata。
- 持久化 link 状态。

本地 Hub 不应该直接实现一套独立 pairing 和 connector lifecycle。CLI 也不应该复制 Hub 的连接逻辑。

## 配置与状态文件

### 本地 workspace 配置

继续使用：

```text
.nexus/config.yaml
.nexus/agents.yaml
.nexus/history/
```

这些属于本地 workspace runtime，不应该依赖 Cloud。

### 本地 CLI / Cloud 状态

建议新增或扩展全局目录：

```text
~/.nexus/
├── config.yaml
├── instances.json
├── cloud/
│   ├── machines.yaml
│   ├── links.yaml
│   └── credentials.json
└── hub-logs/
```

职责：

- `machines.yaml`：本机已配对的 Cloud machine 记录。
- `links.yaml`：本地 workspace/server 到 Cloud workspace 的 link 记录。
- `credentials.json`：machine credential 或 credential reference。

安全要求：

- 长期 secret 不应该出现在日志中。
- 能接入 OS keychain 时，`credentials.json` 应只保存引用。
- 无 keychain 时，文件权限必须收紧。

## 内部模块建议

CLI 用户入口保持一套，但内部代码应模块化。

```text
packages/server/src/cli/
├── index.ts              # command dispatch
├── local.ts              # start/onboard/status/stop/hub
├── onboard.ts            # TUI onboarding form
├── pane.ts
├── mission.ts
├── cloud.ts              # cloud command dispatch
├── connect.ts            # mexus connect
└── http.ts

packages/server/src/cloud-link/
├── CloudLinkService.ts
├── CloudCredentialStore.ts
├── LocalServerResolver.ts
├── ConnectorManager.ts
└── types.ts

packages/server/src/connector/
├── TunnelClient.ts
├── TunnelProtocol.ts
├── LocalServerBridge.ts
└── types.ts
```

边界：

- `cli/*` 只负责解析参数、输出结果、调用服务。
- `cloud-link/*` 负责 link 状态、credential、server 定位、connector lifecycle。
- `connector/*` 负责 WSS tunnel 和本地 server bridge。
- workspace runtime 不依赖 Cloud。

## 错误处理与诊断

CLI 输出应清晰区分问题来源。

本地 server 问题：

- 找不到 `.nexus/config.yaml`，建议运行 `mexus onboard`。
- 目标目录不存在。
- 本地 server 未运行。
- 端口被占用。

Cloud pairing 问题：

- pairing code 过期。
- pairing code 已使用。
- hub URL 不可信或不可达。
- machine credential 被吊销。

Connector 问题：

- tunnel 连接失败。
- tunnel token 过期。
- 本地 server bridge 失败。
- 云端 gateway 拒绝 workspace 注册。

建议 `mexus cloud status` 成为诊断入口，而不是让用户去读日志。

## 安全边界

必须明确的安全原则：

- 本地 Hub 不连接任意远程 server。
- 本地 Hub 不保存 remote server token。
- `mexus cloud link --server` 只允许本机地址。
- Cloud 访问本地 server 必须经过 connector。
- 浏览器不接触 machine secret。
- Destructive 操作需要 Cloud permission checks。
- `/api/shutdown`、git discard、pane close、terminal input 等操作未来需要明确授权边界。

## 兼容与迁移

现有命令应保持兼容：

- `mexus` 默认等价于 `mexus start`。
- `mexus <dir>` 继续等价于在该目录 `start`。
- `mexus start <dir>` 保持显式本地启动。
- `mexus hub` 保持本地 Hub。
- `nexus` 作为兼容 alias 可以继续存在。
- 旧的 `mexus init` 可以保留为 deprecated alias，执行 `mexus onboard --minimal` 或打印迁移提示。

Cloud 命令是新增能力，不应该改变现有本地命令的默认行为。

## 第一版建议

第一版 CLI 改造建议：

- 保留现有本地命令语义。
- 将推荐初始化入口从 `init` 改为 `onboard`。
- 设计 `onboard` TUI 分步表单，默认只包含 Agents、Runtime、Review。
- 增加 `cloud` 命令域占位和 help。
- 增加 `connect` 命令设计入口，但可以先不实现完整 tunnel。
- 先实现 Cloud Link Service 的接口边界和状态模型。
- 本地 Hub Cloud Link 按钮调用同一个 Cloud Link Service。
- 明确移除或冻结“本地 Hub 任意远程 server”方向。

MVP 实现顺序建议：

1. 梳理 CLI dispatcher，让 top-level command 和 subcommand 更清晰。
2. 引入 `mexus onboard`，先支持 Agents + Runtime + Review/Write。
3. 将 `mexus init` 标记为 deprecated alias。
4. 加入 `mexus cloud status/link/unlink` 的接口骨架。
5. 实现 LocalServerResolver，只允许本机 server。
6. 实现 CloudCredentialStore 和 link 状态文件。
7. 实现 ConnectorManager 与 tunnel client。
8. 实现 `mexus connect` 的 Cloud-first 包装流程。
9. 本地 Hub UI 接入 Cloud Link Service。
