# Mexus Hub 远程连接设计

## 状态

草案。本文档只记录 Hub 二期远程连接能力的当前思路，还不是实现计划。

## 背景

一期已经把 Mexus Hub 变成主要的本地入口：

- Hub 作为一个 SPA 外壳运行。
- Hub 管理本地 Mexus Server 记录。
- Hub 可以创建、启动、停止、移除本地 server，并把它们打开为 server tab。
- 同一时间只有一个 server tab 拥有激活的 workspace 连接。
- 原来的独立 Mexus Server 模式必须继续可用，不能被强制带进 Hub UI。

二期要在这个模型上扩展：Hub 不只连接自己启动的本地 server，也可以连接不由当前 Hub 进程启动的 Mexus Server。

长期产品形态是：

- Mexus Hub 是用户面对的客户端。
- Mexus Server 是 workspace/runtime 后端。
- Hub 和 Server 通过稳定的 HTTP API / WebSocket 协议分离。
- 可以部署一个公网 Hub 页面，用户再连接自己的本地或私有 Mexus Server 使用。

这个方向和 VS Code 的本地/远程模式有相似之处，但 Mexus 的主要客户端是 Web Hub。

## 目标

- Hub 可以通过 URL 连接远端 Mexus Server。
- 远端 server 复用本地 server tab 的切换和连接语义。
- 暴露 workspace API 和 WebSocket 之前必须支持认证。
- 本地 server CRUD 仍然是一等能力。
- Hub 的部署位置不应该绑定 Server 的部署位置。
- 保持独立 Mexus Server 的原有使用方式。

## 第一版远程能力暂不做什么

- 默认不做托管中继服务。
- 不做多人协作模型。
- 不做团队账号系统。
- 不做云端项目注册表。
- 不做远端进程生命周期管理，也就是不负责远端 server 的自动启动/停止。
- 第一版不尝试解决所有 NAT、防火墙、内网穿透问题。

## 核心模型

Hub 应该把每个 server 都看成一个连接目标。

```ts
type MexusConnectionTarget = {
  id: string
  kind: 'local' | 'remote'
  label: string
  httpBaseUrl: string
  wsBaseUrl: string
  auth?: ConnectionAuthState
  status: 'unknown' | 'reachable' | 'auth_required' | 'connected' | 'disconnected' | 'error'
}
```

本地目标来自 Hub 管理的 instance registry。远端目标来自用户手动创建的 remote connection record。

Workspace UI 不应该关心目标是本地还是远端。它只接收当前激活的 target，然后把 API / WebSocket 请求发到这个 target。

## UX 方向

Dashboard 后续应该分成两组：

- Local Servers
- Remote Connections

远端连接流程：

1. 用户点击 `Add Remote Server`。
2. 用户输入 server URL，例如 `https://host.example.com` 或 `http://192.168.1.20:7700`。
3. Hub 通过公开的 capability endpoint 探测 server 元信息。
4. 如果 server 要求认证，Hub 展示认证流程。
5. 认证成功后，Hub 保存连接记录。
6. 用户把它打开为一个 server tab。

远端 tab 仍然遵守当前 Hub 规则：

- 打开 tab 不会创建、启动或销毁 server。
- 从远端 tab 切到 Dashboard 不断开当前连接。
- 连接另一个 server 时，切换唯一激活连接。
- 关闭当前激活 tab 时断开连接，但不自动连接其他 server。
- 远端 server 断连后，记录仍然保留，直到用户手动重连或移除。

## Server 能力探测接口

每个 Mexus Server 应该暴露一个很小的、无需认证的元信息接口：

```http
GET /api/server/metadata
```

示例响应：

```json
{
  "name": "Mexus Server",
  "version": "0.1.0",
  "serverId": "srv_...",
  "auth": {
    "required": true,
    "methods": ["pairing-token", "api-token"]
  },
  "features": {
    "workspace": true,
    "replay": true,
    "shutdown": false
  }
}
```

这样 Hub 在访问 workspace API 之前，可以先判断目标 URL 是否真的是 Mexus Server，以及它需要什么认证方式。

## 认证方向

远程访问必须有认证。第一版建议使用务实的“用户自己拥有 server”模型，而不是一开始就做完整账号系统。

建议优先考虑下面两种方式。

### 1. Pairing Token

Server 向 owner 打印或暴露一个一次性的配对码。

流程：

1. 用户以 remote 模式启动 Mexus Server。
2. Server 生成一个短期有效的 pairing token。
3. 用户在 Hub 输入 server URL 和 token。
4. Hub 用这个 token 换取一个较长期的 connection token。
5. Hub 本地保存 connection token。

优点：

- 适合本地、私有 server。
- 不需要密码。
- 对用户解释起来比较直观。

缺点：

- 用户需要能看到 server 日志或终端输出。
- 需要设计 token 过期和吊销机制。

### 2. Static API Token

Server 配置一个固定 token，Hub 保存并在请求中携带。

优点：

- 自部署场景很简单。
- 适合脚本化和 headless server。

缺点：

- 用户容易泄漏或误用 token。
- token 轮换和吊销需要明确设计。

### 3. OAuth / Hosted Account

不建议作为第一版远程能力。

优点：

- 更适合未来云端产品和团队能力。

缺点：

- 过早引入账号基础设施。
- 对当前 local-first 用户没有直接帮助。

## Token 处理

Hub 需要保存远端连接凭据，这些凭据应该被视为客户端侧 secret。

第一版可以先使用 browser local storage 或 IndexedDB，但设计上要保留后续扩展空间：

- 加密存储
- 桌面壳中的 OS keychain 集成
- 手动移除 token
- token 轮换

所有认证 HTTP 请求建议使用：

```http
Authorization: Bearer <token>
```

WebSocket 认证可以采用两种方式：

- 通过 `Sec-WebSocket-Protocol` 携带 token。
- 先通过认证 HTTP 请求获取短期 WebSocket ticket，再用 ticket 建立 WebSocket。

更推荐 WebSocket ticket。原因是它避免把长期 bearer token 放进 WebSocket URL 或浏览器日志里。

## 远端 Server 的安全边界

远端 server 模式必须显式开启。普通本地 standalone server 不应该意外暴露远程访问能力。

建议命令形态：

```bash
mexus start --host 127.0.0.1
mexus start --host 0.0.0.0 --remote
mexus start --host 0.0.0.0 --remote --auth-token ...
```

默认行为建议：

- 除非用户显式配置，否则只监听本地地址。
- 非本地访问必须要求认证。
- 不安全的 origin 默认拒绝，除非 CORS 策略明确允许。
- `/api/shutdown` 不应该默认暴露给远端，除非用户明确开启。

## 浏览器直连问题

如果公网 Hub 页面直接从浏览器连接用户自己的 server，必须考虑浏览器安全规则。

Mexus Server 需要支持：

- HTTP API 的 CORS。
- WebSocket origin 校验。
- 公网使用时需要 HTTPS。
- 如果 Hub 是 HTTPS，WebSocket 需要 WSS。

重要限制：

- 公网 `https://hub.mexus.dev` 页面在很多生产浏览器环境里，不能直接连接 `http://localhost:7700`，会受到 mixed content 或 private network access 限制。
- 本地开发时能连，不代表公网部署后也能连。

所以“浏览器直连 server”很有价值，但不能覆盖所有环境。

## 连接拓扑

### 方案 A：浏览器直接连接 Server

Hub SPA 直接访问 `http(s)://server` 和 `ws(s)://server`。

建议作为第一版远程实现。

优点：

- 架构简单。
- 不需要 Hub 后端代理。
- 用户仍然掌控自己的 server。
- 符合当前 active target 的前端模型。

缺点：

- 需要处理 CORS 和 WebSocket origin。
- 公网 HTTPS Hub 连接私有 HTTP server 可能失败。
- 用户需要自己暴露端口或使用 tunnel。

### 方案 B：Hub 后端代理

Hub server 通过后端代理所有远程 server 流量。

优点：

- 浏览器只访问 Hub 同源地址。
- 更容易避免 token 暴露给前端 JavaScript。
- 可以统一处理 CORS / WebSocket 差异。

缺点：

- 公网 Hub 后端会变成数据中继。
- 安全和运维负担更高。
- “用户拥有自己的 server”这个语义会变得不够干净。

### 方案 C：用户自有 Tunnel / Connector

用户在 Mexus Server 附近运行一个 connector，公网 Hub 通过 tunnel 或 rendezvous 层连接。

优点：

- 能解决 NAT、内网、防火墙场景。
- 可以支持公网 Hub，而不要求用户直接暴露原始 server 端口。

缺点：

- 需要新的基础设施。
- 产品面会变大。
- 应该在直连方案验证出真实限制后再考虑。

## 推荐分期

### Phase 2A：直接远程连接

- Hub 增加 remote connection 记录。
- Mexus Server 增加 `GET /api/server/metadata`。
- 受保护的 workspace API 增加 auth middleware。
- 支持 pairing token 或 static API token。
- Dashboard 增加远端 target CRUD。
- 复用当前 server tab 和 active connection 模型。

### Phase 2B：强化 remote mode

- 增加 token 吊销。
- 增加 WebSocket ticket 流程。
- 增加 origin allowlist。
- 增加 remote-safe capability flags。
- 对 CORS、TLS、mixed content、认证失败、版本不匹配提供更清楚的诊断。

### Phase 2C：Connector / Tunnel 探索

- 评估公网 Hub 是否需要 relay 或 connector。
- 如果需要，定义用户自有 connector 进程。
- relay 保持可选，让自部署用户仍然可以直连。

## 数据模型草案

本地 registry 应该和远端连接记录分开。

```ts
type RemoteConnectionRecord = {
  id: string
  label: string
  httpBaseUrl: string
  wsBaseUrl: string
  serverId?: string
  version?: string
  authMethod: 'pairing-token' | 'api-token'
  credentialRef?: string
  createdAt: number
  lastConnectedAt?: number
  lastError?: string
}
```

如果 Hub 只是浏览器页面，`credentialRef` 第一版可以指向 local storage 或 IndexedDB。以后如果有桌面壳，可以指向 OS keychain。

## API 草案

Hub 自己拥有的 API：

```http
GET    /api/hub/remote-connections
POST   /api/hub/remote-connections
PUT    /api/hub/remote-connections/:id
DELETE /api/hub/remote-connections/:id
POST   /api/hub/remote-connections/:id/probe
```

Mexus Server 拥有的 API：

```http
GET  /api/server/metadata
POST /api/auth/pair
POST /api/auth/ws-ticket
GET  /api/health
```

现有 workspace API 仍然属于 Mexus Server。remote auth 开启后，这些 API 需要受认证保护。

## 与 standalone server 的兼容

独立 Mexus Server 模式仍然有效。

规则：

- 执行 `mexus start` 仍然直接提供 workspace UI。
- 纯本地 standalone 使用不需要 remote auth。
- Hub 专用 API 继续放在 `/api/hub/*` 下。
- Server 的 metadata 和 auth endpoint 可以存在于 standalone 模式中，但受保护的 workspace 行为必须遵守 remote auth 设置。

## 待决策问题

- 第一版远程认证只做 pairing token、只做 static token，还是两个都做？
- 纯浏览器 Hub 在没有桌面壳之前，凭据应该存在哪里？
- 公网 HTTPS Hub 是否要支持直连用户本机 `localhost`，还是明确引导用户使用本地 Hub / 自部署 Hub？
- 远端连接记录应该存在 Hub 后端、本地浏览器存储，还是两者都支持？
- 远端 server 是否永远不暴露 shutdown 能力，还是允许用户显式开启？
- Hub 和远端 Server 的版本兼容要多严格？
- 配对成功后，CORS origin allowlist 是否默认收敛到当前 Hub origin？

## 当前建议

先实现“浏览器直连 Mexus Server”的远程连接能力，同时要求 Mexus Server 显式开启 remote mode 并启用认证。

不要过早建设 relay 基础设施。先把连接契约稳定下来：

- target metadata
- 认证机制
- active connection 切换
- 清晰的连接诊断
- 与本地 Hub 和 standalone server 兼容

