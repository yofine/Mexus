# Mexus Cloud Hub 线上服务设计

## 状态

草案。本文档记录 Mexus 托管线上服务的产品与架构方向，还不是实现计划。

## 产品定位

Mexus 未来有两种清晰的使用模式。

### 模式一：本地离线版

用户在自己的机器上使用 Mexus，不依赖云端账号和云端服务。

入口包括：

- `mexus hub`：启动本地 Hub，用本地 Web UI 管理本机多个 Mexus Server。
- `mexus start`：直接在当前项目启动本地 Mexus Server 和 UI。

这个模式保持传统 offline/local-first 体验：

- 不需要注册登录。
- 不需要云端 relay。
- Hub 可以继续管理本机 server、扫描本机端口、启动/停止本地实例。
- 适合个人本地开发、断网环境和完全自托管使用。

### 模式二：Mexus Cloud

用户通过注册登录使用托管的 Mexus Cloud。

Mexus Cloud 不再有“本地 Hub 管理 localhost server”的概念。Cloud 中只有用户主动连接上来的机器，以及这些机器上的 Mexus Server / workspace。

这个模式的核心是：

- 用户登录云端 Hub。
- 用户在自己的机器上运行 `mexus connect`。
- 本机 Mexus Server 通过 connector 主动连接 Mexus Cloud。
- 云端 Hub 只展示和打开这些已连接机器上的 workspace。
- 云端不创建、不扫描、不直接管理云端所在机器的本地 server。

### 桥接模式：Cloud Link

本地离线版和 Mexus Cloud 之间应该有一条自然桥梁：用户可以先用本地方式启动 Mexus，再通过额外命令把当前机器或当前 workspace 连接到云端。

也就是说，Cloud 接入不只是一条从云端 onboarding 开始的链路，也可以从本地 Hub 或本地 server 发起：

```bash
mexus start
mexus cloud link --pair mxp_abc123
```

或者：

```bash
mexus hub
# 在本地 Hub 里直接执行 Cloud Link
```

这个桥接模式让用户可以：

- 一开始完全本地使用 Mexus。
- 需要跨设备访问或云端入口时，再把已有本地 server 注册到 Mexus Cloud。
- 继续保留本地 Hub、本地 server 和本地浏览器访问能力。
- 让云端通过 connector/tunnel 访问同一个本地 Mexus Server。

因此，Mexus Cloud 可以看作之前“远程连接”方向的延续和收敛：它不再支持任意 URL 直连，也不把 local remote connection 当作独立产品能力，而是统一为“用户机器主动连接云端”的 hosted 模式。Cloud Link 则是本地离线版进入这个 hosted 模式的桥。

命名上应保留两个不同概念：

- 从云端视角出发，用户还没有本地 Mexus Server 或不关心本地 server 是否已存在，叫 `connect`。
- 从本地视角出发，用户已经有正在运行或可发现的本地 Mexus Server，要把它接到 Cloud，叫 `cloud link`。

两者的区别不是底层 tunnel 能力不同，而是入口语义和本地 server 生命周期不同。

## 背景

Mexus 当前是 local-first 架构：

- 本地 Mexus Server 负责 workspace runtime、PTY、文件树、Git diff、Pane 状态和 `agents.yaml`。
- 本地 Hub 可以发现本机 server 实例，并把浏览器 tab 代理到 `127.0.0.1:<port>`。
- 浏览器端 workspace UI 已经通过 HTTP API 和单个 WebSocket 连接一个目标 server。

Mexus Cloud 改变的是 Hub 的位置和连接边界：

- 用户在云端 Hub 注册和登录。
- 云端 Hub 展示该用户已连接的机器和 workspace。
- 用户在自己的机器上运行一条 CLI 命令，把本机连接到云端 Hub。
- 云端 Hub 可以为已连接的本地 Mexus Server 打开 workspace tab。
- 云端 Hub 不再扫描或管理云端机器上的 localhost server。

关键网络约束是：大多数用户机器都在 NAT、家用路由器、公司防火墙或移动热点后面。它们通常没有公网 IP，也不应该要求用户开放入站端口。

## 目标

- 让托管 Hub 可以访问用户本地 Mexus workspace，且不要求用户机器有公网 IP。
- 用户代码、文件、PTY 和 Agent 进程继续留在用户自己的机器上。
- 用一条本地命令完成接入。
- 支持从云端 Hub 打开已连接 workspace 的浏览器 tab。
- 为用户、机器和实时 tunnel session 提供清晰的鉴权模型。
- 尽量复用现有 workspace server、协议和 Hub tab 模型。
- 明确区分本地离线版和 Mexus Cloud，两者共享 workspace 能力，但入口、鉴权和连接方式不同。
- 第一版范围要足够窄，便于尽快验证。
- 保持一套 `mexus` CLI 分发，不拆成本地 CLI 和 Cloud CLI 两套安装入口。

## 第一版非目标

- 不把 workspace 执行迁移到云端。
- 不在云端保存完整项目文件。
- 不做通用 VPN。
- 除非明确优先，否则第一版不做完整团队协作。
- 不要求用户配置路由器端口转发、DNS 或 TLS 证书。
- 不把本地 Mexus Server 的原始端口暴露到公网。
- 不在 Mexus Cloud 中保留本地 Hub 的 localhost instance 扫描和本地 server CRUD。
- 不支持用户手动输入任意 remote URL 让 Cloud 浏览器直连。

## 产品形态

Mexus Cloud 有两条接入路径。

### Cloud-first 接入：`connect`

用户从 Mexus Cloud 开始：

1. 用户登录托管 Mexus Hub。
2. Hub dashboard 在空状态中展示连接命令。
3. 用户复制命令，并在自己的机器上运行：

   ```bash
   mexus connect --hub https://mexus.cloud --pair mxp_abc123
   ```

4. 本地命令把这台机器配对到用户账号。
5. 本地进程启动或连接一个 Mexus workspace server。
6. 这台机器在 Hub 中显示为在线。
7. 用户在 Hub tab 中打开 workspace。
8. 浏览器输入、终端输出、文件树、Git diff、Pane 事件和 REST 请求都通过云端 relay 流转到用户本机。

这个路径的语义是：Cloud 要连接一台用户机器，并在需要时启动或发现本地 Mexus Server。因此命令可以叫 `mexus connect`。

### Local-first 接入：`cloud link`

用户先在本地使用 Mexus，再把本机连接到 Cloud：

1. 用户运行 `mexus start` 或 `mexus hub`。
2. 本地 Mexus Server 正常提供本地 UI 和 workspace 能力。
3. 用户在本地 Hub 中直接执行 Cloud Link，或在终端运行 CLI：

   ```bash
   mexus cloud link --hub https://mexus.cloud --pair mxp_abc123
   ```

4. Link 命令发现或连接已有本地 Mexus Server。
5. Link 命令建立到 Mexus Cloud 的出站 WSS tunnel。
6. Cloud dashboard 出现这台机器和这个 workspace。
7. 同一个本地 Mexus Server 可以同时被本地浏览器和云端 Hub 访问。

这个路径的语义是：已有本地 Mexus Server，现在把它 link 到 Mexus Cloud。因此命令应该叫 `mexus cloud link`。

本地 Hub 上的 Cloud 连接入口应该直接执行连接流程，而不是只做命令引导。它的职责是：

- 告诉用户当前机器可以连接到 Mexus Cloud。
- 接收用户从 Cloud 复制来的 pairing code，或通过后续 device flow 获取 pairing 授权。
- 调用本地 Hub 后端执行等价的 `mexus cloud link` 流程。
- 显示当前机器是否已 link 到某个 Cloud account。
- 提供断开连接、重新连接、查看连接状态等本地辅助操作。

Cloud dashboard 的主体对象不是“本地实例”，而是：

- machine
- workspace
- connection status
- project metadata

Hub 卡片应该展示用户能理解的信息：

- project name
- machine name
- connection status
- cwd
- last seen
- Mexus version
- active port 或 local endpoint，只在诊断时展示

默认不展示内部 tunnel ID 或底层传输细节。

## 推荐网络模型

使用用户机器主动连出的 WebSocket tunnel。

```text
Browser
  -> Cloud Hub HTTP / WebSocket Gateway
  -> Cloud Relay / Tunnel Router
  <-> Local Mexus Connector over WSS
  -> Local Mexus Server over localhost HTTP / WebSocket
  -> PTY, file tree, git, agents
```

推荐这个模型的原因：

- 用户本机主动发起连接，因此可以穿过 NAT。
- 大多数家庭和办公网络都允许出站 HTTPS/WSS。
- 不需要用户把 `localhost:7700` 暴露到公网。
- 与 Mexus 现有事件模型接近，现有系统已经依赖 WebSocket 多路复用。
- 执行环境和敏感文件继续留在用户本地。

## 鉴权模型

鉴权应该分层。不要让一个 API key 变成长期有效的万能凭证。

### 用户会话

浏览器用户登录云端 Hub。

这层决定：

- 用户能看到哪些机器
- 用户能打开哪些 workspace
- 用户能执行哪些操作

MVP 可以先是单用户账号模型。后续团队版再扩展为组织成员关系和 RBAC。

### 配对码

云端 Hub 生成短期、一次性的配对码。

示例：

```bash
mexus connect --hub https://mexus.cloud --pair mxp_abc123
```

配对码属性：

- 快速过期，例如 10 分钟
- 只能使用一次
- 归属于一个用户或组织
- 只用于创建或授权一次机器注册

配对码不应该是长期机器凭证。

### 机器凭证

配对成功后，本地 connector 保存机器凭证。

这个凭证标识：

- 所属用户或组织
- machine ID
- 允许的 workspace capabilities
- 是否已被吊销

机器凭证应保存在用户本地 Mexus 配置目录中，并且可以从云端 Hub 吊销。

### Tunnel Session Token

本地 connector 使用机器凭证换取短期 tunnel token。

这让 relay 层使用更安全的运行时凭证：

- 短 TTL
- 只作用于一台机器
- 只作用于一个连接 session
- 重连时轮换
- 机器被移除或禁用后立即失效

### 浏览器 Workspace 授权

浏览器打开 workspace tab 时，云端 gateway 先检查用户 session 和 workspace 权限，再把流量路由到 tunnel。

浏览器不应该拿到 machine secret。浏览器请求由云端 session 鉴权，然后由云端 gateway 在服务端完成路由。

## 通信模型

云端 relay 需要在本地 connector 的出站 WSS 连接上复用多个逻辑流。

逻辑流示例：

- 到本地 Mexus Server 的 REST 请求
- 来自本地 Mexus Server 的 REST 响应
- workspace WebSocket frame
- terminal output frame
- terminal input frame
- file tree event
- git diff event
- heartbeat 和 capability update

tunnel frame 至少需要包含：

```ts
type TunnelFrame = {
  type: string
  streamId?: string
  workspaceId?: string
  requestId?: string
  payload?: unknown
}
```

第一版 relay 可以保持简单：

- Cloud gateway 收到浏览器 HTTP 请求。
- Gateway 创建一个 tunnel stream。
- Local connector 把它转换成本地 HTTP 请求。
- Local connector 通过 tunnel 返回响应。
- 对 `/nexus-ws`，gateway 和 connector 在两个方向桥接 WebSocket frame。

这样当前本地 Mexus Server 仍然主要负责 workspace 行为。

## 背压与可靠性

终端输出是高频数据。云端 tunnel 不能让 replay、Git diff 或大文件 payload 阻塞实时终端输出。

规则：

- terminal live output 优先级高于 replay 和后台数据。
- 大 REST 响应需要 chunk 或 size limit。
- tunnel 应该按 workspace 和 logical stream 设置有界队列。
- 云端 gateway 应该关闭或降级慢浏览器连接，而不是无限堆积内存。
- heartbeat 应该跟踪 connector 存活状态和延迟。
- 重连应该保留 machine identity，但除非 replay 能补齐，否则不要假装终端连续性完美无损。

当前 workspace WebSocket 已经有多种事件类型。云端 tunnel 应尽量包裹现有协议，不在第一阶段重写所有 workspace event payload。

## 两条链路的共享边界

本地离线版和 Mexus Cloud 是两条产品链路，但不应该是两套产品实现。它们应该最大化共享 workspace 执行层和 workspace UI 层，在入口、鉴权、连接路由、实例发现和生命周期管理上分叉。

两条链路可以概括为：

```text
本地离线版:
Browser -> Local Hub / Local Server -> Workspace Runtime

Mexus Cloud:
Browser -> Cloud Hub / Gateway -> WSS Tunnel -> Local Connector -> Local Server -> Workspace Runtime
```

### 高度共享

这些能力应该尽量保持一套：

- `WorkspaceManager`
- `PtyManager`
- `FsWatcher`
- `GitService`
- `AgentsYamlWriter`
- `StatuslineParser`
- pane create / close / restart 协议
- terminal input / output 协议
- file tree / git diff / replay / mission 等 workspace API
- `WorkspaceApp`
- `AgentPane`
- `Terminal`
- `FileTree`
- `GitDiffPanel`
- `EditorTabs`

也就是说，真正运行 Agent、管理 PTY、看文件、看 diff、操作 pane 的核心能力，本地离线版和 Mexus Cloud 应该共享。

### 中度共享

这些可以共享抽象和视觉组件，但数据源与实现会分叉：

- Hub tab 模型
- `ConnectionTarget`
- Hub dashboard 基础 UI primitive
- machine/workspace/instance card 视觉组件
- WebSocket client reconnect 机制
- API client 封装
- running / stopped / offline / error 状态展示

本地离线版的 target 是 local instance / localhost proxy。Mexus Cloud 的 target 是 cloud workspace / cloud gateway / tunnel。Workspace UI 不应该关心二者差异。

### 低共享

这些基本是各自链路独有。

本地离线版独有：

- 本地端口扫描
- `~/.nexus/instances.json`
- 本地 Hub 启动/停止 server
- `/api/instances/:port/proxy`
- `mexus hub`
- 不登录、不鉴权的本地体验

Mexus Cloud 独有：

- 用户注册登录
- machine pairing
- machine credential
- tunnel token
- cloud relay / gateway
- connector 在线状态
- workspace ownership
- audit log
- 权限模型
- 后续 billing / quota

### 架构原则

不要让 Cloud 逻辑进入 workspace runtime，也不要让本地 Hub 的 localhost 管理模型污染 Mexus Cloud。

推荐分层：

```text
1. Workspace Runtime Layer
   本地 server 内部能力，最大化共享。

2. Workspace Protocol Layer
   HTTP API + /nexus-ws 事件协议，最大化共享。

3. Connection Adapter Layer
   本地版: localhost proxy adapter
   Cloud版: tunnel gateway adapter

4. Product Shell Layer
   本地 Hub shell
   Cloud Hub shell
```

Mexus Cloud 应新增 cloud account/control plane、connector、tunnel gateway、cloud workspace registry 和 cloud auth/permission，而不是重写 terminal、pane、file tree、git diff、agent runtime 和 workspace UI。

## 云端组件

### Cloud Web App

职责：

- 用户登录
- Hub dashboard
- 已连接机器和 workspace
- workspace tabs
- settings 和 token 管理

现有 Hub 视觉模型大体可以复用，但数据源从本地 instance registry 变为 cloud API。

### Cloud API

职责：

- auth
- user 和 organization records
- machine registration
- pairing code issuance
- workspace records
- connector status
- audit events
- gateway authorization

### Tunnel Gateway / Relay

职责：

- 接收本地 connector 的 WSS 连接
- 鉴权 tunnel session
- 跟踪在线机器
- 把浏览器 workspace 流量路由到正确 connector
- 执行 ownership 和 permission checks
- 应用 backpressure 和 size limit

它可以先和 Cloud API 放在同一个 Fastify server 里，但应该保持清晰边界，因为它的扩展、延迟和资源特征不同。

### 数据库

最小记录：

```ts
type User = {
  id: string
  email: string
  createdAt: number
}

type Machine = {
  id: string
  ownerUserId: string
  name: string
  status: 'online' | 'offline' | 'disabled'
  createdAt: number
  lastSeenAt?: number
  revokedAt?: number
}

type Workspace = {
  id: string
  machineId: string
  projectName: string
  cwd: string
  localPort?: number
  status: 'running' | 'stopped' | 'unknown'
  lastSeenAt?: number
}

type PairingCode = {
  id: string
  ownerUserId: string
  codeHash: string
  expiresAt: number
  usedAt?: number
}
```

机器 secret 在服务端应尽量只存 hash。长期明文 secret 不应出现在应用日志里。

## CLI 策略

Mexus 应保持一套 CLI，一个用户安装入口。

用户安装的仍然是：

```bash
npm install -g mexus
```

或未来等价的包管理器安装方式。不要拆成 `mexus` 和 `mexus-cloud` 两套 CLI。

原因：

- Mexus Cloud 仍然依赖用户机器上的本地 Mexus Server，不是独立 runtime。
- Cloud 命令需要复用本地 server 启动、发现、配置、workspace metadata、connector lifecycle 等能力。
- 两套 CLI 会重复本地执行层能力，也会增加用户理解成本。
- 产品心智应该是一个 Mexus，有本地离线链路和 Cloud 链路两个入口。

推荐命令结构：

```text
mexus
├─ start              # 本地启动 server + UI
├─ hub                # 本地多实例 Hub
├─ init/status/stop   # 本地项目/实例管理
├─ connect            # Cloud-first，一步连接本机到 Cloud
└─ cloud
   ├─ link            # Local-first，把已有本地 server 接到 Cloud
   ├─ unlink
   ├─ status
   ├─ login           # 可选，后续如果需要 device auth
   └─ logout          # 可选
```

代码内部可以拆模块，但分发和用户入口保持一套：

```text
cli/local/*
cli/cloud/*
cloud-link/*
connector/*
```

`mexus connect` 和 `mexus cloud link` 都属于同一套 CLI。差别在于入口语义：

- `mexus connect`：Cloud-first，本地 server 不一定存在，可以负责启动或发现。
- `mexus cloud link`：Local-first，本地 server 已存在，默认只负责 link，不拥有 server 生命周期。

## 本地组件

### `mexus connect`

Cloud-first CLI 模式。

职责：

- 接收 `--hub`、`--pair` 或已有机器凭证
- 需要时完成机器配对
- 启动本地 Mexus Server，或在没有明确 server 时发现可用 server
- 建立出站 WSS tunnel
- 使用指数退避重连
- 上报 workspace metadata
- 把云端请求转发到本地 server

可能的命令形态：

```bash
mexus connect --hub https://mexus.cloud --pair mxp_abc123
mexus connect --hub https://mexus.cloud
mexus start --connect https://mexus.cloud --pair mxp_abc123
```

`mexus connect` 的语义是从 Cloud 出发建立连接。它可以一步完成本地 server 启动、机器配对和 tunnel 建立，适合 Cloud dashboard 空状态中展示。

### `mexus cloud link`

Local-first 桥接 CLI 模式。

职责：

- 连接当前目录或指定 URL 上已有的本地 Mexus Server。
- 如果没有明确 server，可以尝试读取本地 Hub registry 或当前目录 `.nexus` 信息。
- 使用 pairing code 或已有 machine credential 完成云端注册。
- 启动 connector，把云端请求转发到已运行的本地 server。
- 不拥有本地 server 生命周期，默认不负责启动或停止 server。

可能的命令形态：

```bash
mexus cloud link --hub https://mexus.cloud --pair mxp_abc123
mexus cloud link --server http://127.0.0.1:7700 --hub https://mexus.cloud --pair mxp_abc123
mexus cloud unlink
mexus cloud status
```

`mexus cloud link` 适合已经在本地使用 Mexus 的用户。它表达的是“把当前本地能力连接到云端”，而不是“从云端启动一个新 workspace”。

它和 `mexus connect` 的核心区别是：

- `mexus connect` 可以拥有本地 server 的启动流程。
- `mexus cloud link` 默认不拥有本地 server 生命周期，只把已有 server 接到 Cloud。

### Cloud Link Service

`mexus cloud link` 和本地 Hub 的 Cloud Link 操作应该复用同一个本地服务模块。

这个模块负责：

- 解析 pairing code 或 device authorization。
- 注册或复用 machine credential。
- 定位要连接的本地 Mexus Server。
- 启动、停止、重连 connector。
- 上报 workspace metadata。
- 持久化 link 状态。

CLI 入口只是调用这个服务。本地 Hub 入口也是调用这个服务。两者不应该各自实现 pairing、credential、connector lifecycle。

### 本地 Hub Cloud 入口

本地 Hub 可以提供 Cloud 连接入口，并且应该直接执行连接动作。

- 本地 Hub 展示 Cloud 连接状态。
- 本地 Hub 展示当前 server port、workspace 名称、cwd，用于确认即将连接的对象。
- 本地 Hub 接收 pairing code 或 device code 授权。
- 本地 Hub 调用本地后端启动 connector，并把当前 server link 到 Mexus Cloud。
- 本地 Hub 提供 unlink、reconnect、status 等操作。
- CLI 的 `mexus cloud link` 和本地 Hub 的 Cloud Link 按钮应该复用同一套后端服务能力。

这个入口的价值是让本地离线版可以一键升级为 Cloud 可访问状态，同时不改变 `mexus hub` 在未连接 Cloud 时的离线属性。

### Local Mexus Server

本地 server 继续负责：

- PTY lifecycle
- terminal scrollback
- workspace state
- file tree
- git diff
- agents.yaml
- pane creation 和 restart
- model config 和 agent CLI detection

本地 server 不需要理解太多云端用户概念。connector 可以作为经过鉴权的本地 client。

### Connector 与 Server 拓扑

本地有两种可行拓扑。

方案 A：connector 启动内嵌本地 server。

- `mexus connect <project>` 内部启动 workspace server。
- Connector 直接知道 server port 和 lifecycle。
- 适合 Cloud-first onboarding。

方案 B：connector 连接已有本地 server。

- 用户运行 `mexus start`。
- 用户运行 `mexus cloud link`。
- Connector 自动发现或由用户指定本地 server URL。
- 适合 Local-first bridge workflow。

建议两个拓扑都进入产品设计，但 MVP 实现可以先选择一个：

- 如果优先优化 Cloud onboarding，先做方案 A。
- 如果优先让现有本地用户平滑迁移，先做方案 B。

从产品连续性看，方案 B 是本地版和云端版之间的关键桥梁。

## 当前架构改造

Cloud 不是把本地 Hub 原样部署到云端。它应该复用 workspace UI、workspace protocol 和 tab 管理经验，但替换 Hub 的 instance 数据模型和 proxy 方式。

### Hub Instance Model

当前本地 Hub 模型：

```text
HubApp
  -> /api/instances
  -> instances.json / localhost scan
  -> /api/instances/:port/proxy
  -> http://127.0.0.1:<port>
```

这个模型只属于本地离线版。

Cloud Hub 模型：

```text
HubApp
  -> /api/workspaces
  -> cloud database and tunnel status
  -> /api/workspaces/:workspaceId/proxy
  -> online connector tunnel
  -> local Mexus Server
```

前端 tab 概念可以保留，但 target identity 从 `port` 变为 `workspaceId`。
Cloud dashboard 不提供“创建本地 server”“扫描本地端口”“停止云端本机进程”这类本地 Hub 操作。

### Connection Target

当前前端已经有 `ConnectionTarget` 抽象。未来应该把它整理成两个产品模式下的不同 target：

- 本地离线版：local instance target。
- Mexus Cloud：cloud tunnel workspace target。

Workspace UI 仍然只接收：

- HTTP base URL
- WebSocket base URL
- label
- stable server/workspace ID

它不应该关心当前运行在本地离线版还是 Mexus Cloud。差异应该收敛在 Hub shell、connection target 和 gateway 层。

Cloud 不把 direct remote URL target 作为正式产品能力。之前的远程连接设想可以作为 Cloud 的前置探索，但最终应收敛到 connector/tunnel 模式。

### Proxy Layer

现有本地 Hub 使用 `@fastify/http-proxy` 和基于端口的 upstream。

对 cloud 来说，等价层不再是普通 HTTP proxy 到 `127.0.0.1`，而是一个 gateway：

- 校验浏览器 session
- 把 workspace ID 映射到 machine ID
- 查找 active tunnel session
- 打开 logical tunnel stream
- 转发 request 和 response frames

`/nexus-ws` 的 WebSocket upgrade 也需要同样的路由，但它会变成 connector tunnel 上的 bridged stream。

### Server Security

当前本地 server 偏宽松，因为它面向本地使用。

Cloud mode 需要收紧：

- 不允许公开未鉴权 workspace API
- 没有 paired connector 时不能 cloud access
- 浏览器不能访问 machine secret
- destructive actions 必须通过 cloud permission checks
- `/api/shutdown`、git discard、pane close 和 terminal input 需要显式授权
- 高风险操作需要写入 cloud metadata 中的 audit log

MVP 中权限可以保持简单：

- owner 可以操作全部能力
- 暂不支持 team sharing

但 action boundary 应该提前设计好，后续能加 team roles。

## API 草案

Cloud API：

```http
POST /api/auth/login
POST /api/pairing-codes
GET  /api/machines
POST /api/machines/:machineId/revoke
GET  /api/workspaces
GET  /api/workspaces/:workspaceId
ANY  /api/workspaces/:workspaceId/proxy/*
GET  /api/workspaces/:workspaceId/ws
```

Connector API：

```http
POST /api/connect/pair
POST /api/connect/tunnel-token
WSS  /api/connect/tunnel
```

Local server API 基本保持不变，隐藏在 connector 后面。

## 分期

### Phase 1：Cloud MVP

范围：

- user login
- 单用户 machine pairing
- `mexus connect`
- 出站 WSS connector tunnel
- cloud dashboard 展示在线 workspaces
- 通过 cloud gateway 打开 workspace tab
- terminal input/output
- file tree
- git diff
- pane create/close/restart

避免：

- organization/team sharing
- cloud terminal history
- 云端 file content indexing
- 复杂 workspace lifecycle orchestration

### Phase 2：可靠性与安全加固

范围：

- token revocation
- machine rename/remove
- connection diagnostics
- reconnect handling
- tunnel queue limits
- action audit log
- version compatibility checks
- 更清晰的 offline states

### Phase 3：团队与协作

范围：

- organizations
- shared machines 或 shared workspaces
- viewer/operator/admin roles
- per-action permissions
- concurrent user presence
- optional read-only mode
- destructive operations approval gates

## 备选方案

### 浏览器直连本地 Server

云端 Hub 页面直接连接 `http://localhost:7700` 或用户提供的 server URL。

优点：

- 基础设施更简单
- relay 成本更低
- 更接近当前前端 target 模型

缺点：

- 在 HTTPS、mixed content、CORS、private network access 场景下容易失败
- 不解决 NAT
- 需要用户暴露 server 或和 server 处在同一局域网

这个方案属于早期远程连接探索，不进入 Mexus Cloud 的正式产品路径。Cloud 模式统一要求用户机器通过 connector 主动连接云端。

### 用户自管 Tunnel Provider

用户自行运行 Cloudflare Tunnel、Tailscale、ngrok 或类似工具。

优点：

- 网络穿透能力成熟
- Mexus 需要运营的 tunnel 基础设施更少

缺点：

- onboarding 明显更复杂
- 鉴权和产品状态分散在外部工具里
- 支持成本转移到用户网络配置上

可以把它作为高级选项写进文档。

### 云端托管执行

Mexus 在云端容器中运行 agents 和 workspaces。

优点：

- 不需要本地 connector
- 浏览器访问更简单
- 团队协作故事可能更完整

缺点：

- 安全和基础设施范围大很多
- 需要同步代码或连接代码仓库
- 会把 Mexus 从本地执行控制台变成云计算产品

这是另一条产品线，不是第一版托管 Hub 的路径。

## 关键待决策问题

- 第一版线上服务是 personal-only，还是必须 day one 支持团队？
- Cloud-first MVP 是否优先实现 `mexus connect` 的自动启动 server，还是先实现发现可用 server？
- 一台机器是否允许同时暴露多个 workspace？
- 云端是否保存 terminal/session history？如果保存，保存到什么程度？
- MVP 中哪些操作必须写 audit log？
- 用户登录的最低可接受 auth provider 是什么？
- 浏览器 tab 已打开时，本地 connector 重连应该如何恢复？

## 推荐方案

线上产品应围绕一方自研的出站 WSS connector 构建。

第一版建议定位为个人远程访问：

- cloud account
- 一条命令完成 machine pairing
- 用户自己的机器上运行 Mexus Server，本地执行仍然留在用户本机
- cloud relay 把 workspace tabs 路由到已连接机器
- 不要求本地开放公网入站端口
- Cloud 中没有本地 Hub 的 localhost instance 管理概念
- 单用户流程稳定前，不做 team sharing

这条路径符合用户机器在 NAT 后面的现实，保留 Mexus 的 local-first 执行模型，并以最小有意义的架构变化复用现有 workspace 协议。
