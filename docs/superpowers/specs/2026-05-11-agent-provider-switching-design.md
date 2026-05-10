# Agent Provider Switching Design

## 目标

在设置中的 Agent 配置里加入一套清晰的 Provider 和模型绑定能力，使用户可以用图形界面完成 CLI Agent 的安装检测、启动参数、官方或自定义模型提供商、模型选择和连接测试配置。用户新建 Agent Pane 时应自动使用所选配置；运行过程中也应能快速切换官方提供商和自定义提供商，并在需要重启 Agent 才能生效时给出明确反馈。

本设计参考 `cc-switch` 的产品模式：把供应商作为可管理的主数据，切换时将配置应用到目标 CLI 工具，必要时通过本地代理解决协议差异和运行中热切换问题。Nexus 不直接嵌入 `cc-switch`，而是在现有 Node/Fastify、React、PTY 和 `~/.nexus/config.yaml` 架构内实现等价能力。

## 非目标

Phase 1 不实现完整的本地转发代理、自动故障转移、请求修正、用量统计、托盘菜单、云同步或跨设备同步。

Phase 1 不直接改写 Claude Code、Codex、OpenCode 等工具的官方配置文件，除非后续某个 Agent adapter 明确需要且已有备份与回滚机制。

Phase 1 不保证所有 Agent 都支持运行中无重启热切换。运行中无感切换依赖 CLI 是否在每次请求时读取 endpoint，或是否通过 Nexus 本地代理接管请求。第一阶段只提供启动时注入和需要重启的明确交互。

## 现有基础

Nexus 已有全局配置文件 `~/.nexus/config.yaml`，由 `ConfigManager` 负责加载、合并默认值和保存。

当前 `models` 配置已经支持自定义 Provider、Provider 格式、base URL、API key、模型列表、连接测试和代理意图字段：

```yaml
models:
  defaults:
    tool_model: ""
  providers: {}
```

当前 Agent 配置支持 CLI binary、continue/resume/yolo 参数、statusline、transport 和 env。PTY 启动时会读取 Agent env 并注入进子进程，但还没有把 `models.providers` 绑定到 Agent 启动流程，也没有 per-agent/per-profile 的模型选择。

## 核心概念

### Model Provider

Model Provider 继续表示一个模型供应商或中转服务。它描述协议格式、访问地址、密钥和可用模型。

Provider `type` 表示协议格式，而不是品牌身份。`openai` 表示 OpenAI-compatible chat completions 形态，`anthropic` 表示 Anthropic messages 形态。官方 OpenAI、官方 Anthropic、企业网关和第三方中转都可以用相同格式表达。

### Agent Definition

Agent Definition 表示一个 CLI Agent 的静态启动能力，例如 binary、resume 方式、continue flag、yolo flag、statusline 解析能力和默认 env。它回答“这个 CLI 怎么启动”。

### Agent Profile

Agent Profile 是新增概念，表示一个可切换的运行配置。它把某个 Agent 与某个 Provider、某个模型、启动参数、环境变量覆盖和应用方式绑定起来。它回答“这个 Agent 这次用哪个账号、哪个 endpoint、哪个模型启动”。

一个 Agent 可以有多个 Profile，例如：

- `Official Anthropic`
- `Claude Relay`
- `OpenAI Official`
- `Company Gateway`
- `Local Proxy`

### Agent Adapter

Agent Adapter 是服务端内部映射层。它知道不同 CLI Agent 如何接收模型配置，例如通过 env、CLI 参数、配置文件或 Nexus 本地代理。UI 不直接拼装这些细节，只保存结构化配置。

## 配置设计

扩展 `GlobalConfig`，在不破坏现有字段的前提下为 Agent 增加 profiles。

```yaml
agents:
  claudecode:
    bin: claude
    continue_flag: --continue
    resume_flag: --resume
    yolo_flag: --dangerously-skip-permissions
    statusline: true
    transport: pty
    env: {}
    active_profile: official
    profiles:
      official:
        name: Official Anthropic
        enabled: true
        provider_ref: ""
        model_id: ""
        launch_mode: direct
        args: []
        env: {}
      company-relay:
        name: Company Relay
        enabled: true
        provider_ref: provider-1
        model_id: claude-sonnet-4-5
        launch_mode: direct
        args: []
        env: {}
```

字段说明：

- `active_profile`：该 Agent 新建 Pane 时默认使用的 profile id。
- `profiles`：Agent 下的 profile 字典。profile id 稳定保存，UI 可改显示名。
- `provider_ref`：引用 `models.providers` 中的 provider id。空字符串表示官方登录或不由 Nexus 注入 Provider。
- `model_id`：该 profile 使用的模型 id。必须来自引用 provider 的 enabled model，除非 profile 处于草稿状态。
- `launch_mode`：`direct` 或 `proxy`。`direct` 表示把 provider/model 映射为 env 或参数；`proxy` 表示 Agent 指向 Nexus 本地代理地址。
- `args`：profile 级附加参数，追加在 Agent 基础命令之后。
- `env`：profile 级环境变量覆盖，优先级高于 Agent Definition 的 `env`。

第一阶段只要求支持 `direct`。`proxy` 字段可以落盘但 UI 标记为后续能力，或在没有代理实现时禁用。

## 配置合并与迁移

加载旧配置时，`ConfigManager` 为每个现有 Agent 补齐：

```yaml
active_profile: default
profiles:
  default:
    name: Default
    enabled: true
    provider_ref: ""
    model_id: ""
    launch_mode: direct
    args: []
    env: {}
```

迁移不删除或重命名用户已有 Agent key、env、bin、flag 字段。若 `active_profile` 指向不存在或 disabled profile，则回退到第一个 enabled profile；如果没有 enabled profile，则使用 `default`。

如果 profile 引用的 provider 或 model 不存在，服务端保留该 profile，但启动时返回可读错误，UI 显示配置失效状态。

## 服务端设计

新增 `AgentProviderResolver`，集中处理 Agent、Profile、Provider 和 Model 的解析。

输入：

- agent key
- agent definition
- active profile id 或显式 profile id
- global model provider config

输出：

```ts
interface ResolvedAgentLaunch {
  agent: AgentDefinition
  profile: AgentProfile
  provider?: ModelProviderConfig
  model?: ModelDefinition
  env: Record<string, string>
  args: string[]
  warnings: string[]
}
```

解析顺序：

1. 读取 Agent Definition。
2. 找到 active profile。
3. 如果 `provider_ref` 为空，返回 Agent 原始 env 和 profile env。
4. 如果 `provider_ref` 非空，验证 provider enabled、model enabled。
5. 调用 Agent Adapter 生成 env 和 args。
6. 合并 env，优先级为 `process.env` < `agent.env` < adapter env < `profile.env`。
7. 返回 warnings，例如“该 Agent 需要重启后生效”。

### Agent Adapter 初始映射

第一阶段支持保守映射，只覆盖最常见的 env 方式：

| Agent | Provider 类型 | Direct 注入策略 |
| --- | --- | --- |
| Claude Code | anthropic | `ANTHROPIC_BASE_URL`、`ANTHROPIC_API_KEY`、模型 env 或 args 按实际验证后确定 |
| Claude Code | openai | 不直接注入，提示需要 proxy 模式 |
| Codex | openai | OpenAI-compatible base URL、API key、模型 env 或 args 按实际验证后确定 |
| Codex | anthropic | 不直接注入，提示需要 proxy 模式 |
| OpenCode | openai/anthropic | 优先 env 注入；若 CLI 需要配置文件，后续 adapter 单独实现 |
| Kimi/Qoder | openai/anthropic | 初始标记为 custom env，需要用户在 profile env 中补充 |

Adapter 不应在没有验证的情况下猜测不可确认的 CLI 参数。对于不确定的映射，UI 应允许用户显式配置 env 模板。

### 启动流程变更

`PtyManager.spawn()` 当前通过 `ConfigManager.getAgentDefinition()` 获取 Agent Definition 并调用 `buildAgentCommand()`。变更后：

1. `PaneConfig` 增加可选 `profileId`。
2. `PtyManager` 调用 `ConfigManager.resolveAgentLaunch(config.agent, config.profileId)`。
3. `buildAgentCommand()` 接收 resolved args，将 profile args 追加到基础命令。
4. PTY env 合并 resolved env。
5. Pane meta 记录 `providerId`、`providerName`、`model`、`profileId`，供 UI 展示。

### API 设计

复用 `/api/config` 读写全量配置，同时增加更细粒度接口，避免 UI 每次改 profile 都提交完整配置。

```http
GET /api/agents
GET /api/config
PUT /api/config
POST /api/agents/:agent/profiles
PUT /api/agents/:agent/profiles/:profile
DELETE /api/agents/:agent/profiles/:profile
POST /api/agents/:agent/active-profile
POST /api/agents/:agent/profiles/:profile/test-launch-config
```

`test-launch-config` 不启动 Agent，只解析 profile、provider 和 adapter 映射，返回将注入的非敏感 env key、args 摘要、warnings 和错误。API key 等敏感值必须脱敏。

## 前端设计

Settings 保留 `Models` tab，但将 `Agents` tab 升级为 Agent 配置中心。

### Models Tab

保留现有 Provider 增删改查、连接测试和 Mexus Tool Model。新增：

- 官方 Provider 预设入口，例如 Anthropic Official、OpenAI Official、OpenAI-compatible、Anthropic-compatible。
- 从 `/v1/models` 拉取模型列表的按钮，先支持 OpenAI-compatible Provider。
- Provider 卡片显示“被哪些 Agent Profile 使用”。
- 删除 Provider 前提示受影响的 profiles。

### Agents Tab

每个 Agent 卡片包含：

- 安装状态和 binary path。
- 启动参数：continue/resume/yolo/statusline。
- Profile 列表。
- 当前 active profile。
- 快速新建 profile。

Profile 编辑表单包含：

- Profile 名称。
- Provider 选择：官方登录、不由 Nexus 管理、或某个 Model Provider。
- Model 选择：从 Provider enabled models 中选择。
- Launch Mode：Direct 或 Proxy。Proxy 在第一阶段禁用或标记为后续能力。
- Env overrides：高级折叠区。
- Args overrides：高级折叠区。
- Test Launch Config：验证引用、adapter 支持和非敏感 env/args 摘要。

### 新建 Pane

Add Pane Dialog 增加 profile 选择：

- 选择 Agent 后默认选中该 Agent 的 active profile。
- 用户可以临时切换 profile。
- Pane 名称可默认追加 profile 或 model，例如 `Claude Code · Company Relay`。

### 运行中切换

Agent Pane 顶部状态区展示当前 profile、provider 和 model。点击后打开快速切换菜单：

- 列出当前 Agent 的 enabled profiles。
- 如果该 Agent/Profile 支持热切换，点击后直接切换。
- 如果不支持热切换，点击后显示“重启此 Pane 后生效”，提供 `Restart with profile` 操作。

第一阶段所有 direct 模式默认按“需要重启”处理，除非 adapter 明确声明 `hotSwitch: true`。

## 本地代理演进

后续代理阶段新增 `ModelProxyManager`。它负责为某个 Provider 或 Agent Profile 启动本地 HTTP endpoint，让 Agent 始终连接 `127.0.0.1`，Nexus 在代理内部切换真实上游。

代理模式用于解决：

- Claude Code 使用 OpenAI-compatible Provider。
- Codex 使用 Anthropic-compatible Provider。
- 运行中热切换 Provider。
- 多 Provider failover。
- 请求/响应格式转换。
- 统一健康检查和用量记录。

第一版代理只支持单上游转发和 Anthropic/OpenAI 两种格式转换，不做自动故障转移。Failover、熔断、用量统计和请求修正作为后续扩展。

## 错误处理

服务端解析 profile 时返回结构化错误：

- Agent 不存在。
- Profile 不存在。
- Provider 不存在。
- Provider disabled。
- Model 不存在或 disabled。
- Agent adapter 不支持该 provider format。
- Proxy mode 被选择但代理服务未启用。

UI 对错误分层显示：

- Provider 卡片显示被引用但不可用。
- Profile 列表显示 invalid badge。
- 新建 Pane 时阻止启动并展示具体修复入口。
- 运行中切换失败不影响当前 Pane。

## 安全与隐私

API key 当前继续保存在本地 `~/.nexus/config.yaml`，与现有模型配置保持一致。所有返回给前端的测试摘要和日志必须脱敏。

Env 注入继续沿用现有 blocklist，禁止 profile 覆盖 `PATH`、`LD_PRELOAD`、`LD_LIBRARY_PATH`、`DYLD_INSERT_LIBRARIES`、`DYLD_LIBRARY_PATH`、`DYLD_FRAMEWORK_PATH` 等危险变量。

后续可以引入 `SecretStore` 抽象，将 `api_key` 从明文 YAML 迁移到系统钥匙串或加密文件。配置结构应允许 `api_key_ref` 与 `api_key` 并存一段迁移期。

## 测试策略

后端测试：

- 旧配置加载后自动补齐 default profile。
- active profile 缺失时自动回退。
- provider/model 引用失效时保留配置但启动解析失败。
- `AgentProviderResolver` 正确合并 env 优先级。
- adapter 不支持的 provider format 返回明确错误。
- sensitive env 和 API key 在测试摘要中脱敏。

前端测试：

- Agents Tab 能展示 profiles 和 active profile。
- Profile 表单按 Provider 过滤模型。
- 删除 Provider 时能显示受影响 profiles。
- Add Pane Dialog 能按 Agent 默认 profile 预选。
- invalid profile 阻止创建 pane。

集成测试：

- 使用临时 `NEXUS_GLOBAL_CONFIG_DIR` 写入配置。
- 创建 pane 时 resolved env 注入到 PTY。
- profileId 持久化到 workspace config。
- 重启 pane 时沿用 profileId。

## 分阶段交付

### Phase 1: Agent Profile 与启动注入

新增配置 schema、迁移、Resolver、基础 Adapter、Agents Tab profile UI、Add Pane profile 选择和启动时 env/args 注入。此阶段实现“新建或重启 Agent 时使用指定 Provider/Model”。

### Phase 2: Provider 预设与模型发现

增加官方 Provider 预设、OpenAI-compatible `/v1/models` 拉取、Provider 被引用状态、删除影响提示和更完整的连接测试。

### Phase 3: 快速切换体验

在 Agent Pane 顶部加入 profile/provider/model 快速切换。Direct 模式提供重启后生效；已验证支持热切换的 adapter 可直接应用。

### Phase 4: 本地代理与热切换

实现 `ModelProxyManager`、代理生命周期 API、profile proxy mode、基本协议转换和代理状态 UI。此阶段实现真正的运行中 Provider 热切换基础。

## 实施前确认项

实施 Phase 1 前需要逐个验证 Claude Code、Codex、OpenCode、Kimi CLI 和 Qoder CLI 当前版本支持哪些 env 和 CLI 参数来设置 base URL、API key 和 model。未经验证的 Agent 不应提供“官方支持”的自动映射，只能提供 custom env/args 模板。

Provider 预设放在服务端 YAML/JSON 数据文件中，由 API 暴露给前端。这样可以避免前端重复编码预设，也便于未来插件化。

Active profile 在 Phase 1 只作为全局 Agent 默认保存。Workspace 级覆盖不进入第一阶段，后续有团队协作需求时再增加 workspace override。
