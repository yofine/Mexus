# Mexus Brand Enhancement Design

## Summary

Mexus should present itself as the primary product brand for the next major release. Nexus remains an internal or historical name only where changing it would risk runtime behavior, package compatibility, persisted paths, or existing user configuration.

The public brand explanation is:

**M.E.X.U.S. = Multi-agent Execution Unified System**

Chinese:

**M.E.X.U.S. = 多智能体执行统一系统**

This positions Mexus as more than a multi-terminal UI. Mexus is the execution layer for CLI AI agents: a local system for running, observing, reviewing, and coordinating multiple agent executions from one console.

## Goals

- Make Mexus the only public-facing product name for the release.
- Strengthen the brand around the acronym without making it feel forced.
- Align the product, Hub mode, documentation site, README, and visible UI copy around one narrative.
- Keep the first implementation phase safe by avoiding code logic, protocol, storage, package, and config-path changes.
- Make future Hub, claim, Observer, boundary-detection, replay, and audit features feel like natural extensions of the brand.

## Non-Goals

- Do not rename internal package scopes such as `@nexus/*`.
- Do not rename runtime config directories such as `.nexus` or `~/.nexus`.
- Do not change API paths, localStorage keys, WebSocket message types, generated state files, or compatibility paths.
- Do not rename repository paths as part of this brand pass.
- Do not imply that unfinished Observer, claim arbitration, or automatic orchestration features are already generally available.

## Brand Positioning

Primary English positioning:

> Mexus is the execution layer for multi-agent development.

Primary Chinese positioning:

> Mexus 是多智能体开发的执行层。

Expanded English positioning:

> Mexus turns scattered CLI agents into a unified execution system: run them, observe them, review their work, and coordinate progress from one local console.

Expanded Chinese positioning:

> Mexus 将分散的 CLI Agent 组织成统一执行系统：启动、观察、审查和协调，都在一个本地控制台完成。

## Brand Personality

M.E.X.U.S. has a deliberate system-code feeling. The dotted acronym can carry an EVA-like operator-console mood: institutional, procedural, synchronized, and slightly science-fictional. This should be treated as brand atmosphere, not as a direct anime reference.

The useful qualities are:

- A named execution system rather than a generic app.
- Multiple units synchronized under one operator console.
- Clear states, signals, protocols, and boundaries.
- Human operators supervising semi-autonomous execution.
- Runtime events that feel observable, reviewable, and auditable.

The brand should feel:

- Cool-headed
- Technical
- Systematic
- Command-center oriented
- High-trust rather than playful

The brand should not become:

- A literal anime homage
- A mecha-themed UI
- A decorative sci-fi skin over weak product clarity
- A brand that relies on references users must already know

Suggested atmospheric line:

> M.E.X.U.S. is the operator console for multi-agent execution.

Chinese:

> M.E.X.U.S. 是多智能体执行的操作员控制台。

## Naming System

Public names:

- Product: `Mexus`
- Hub mode: `Mexus Hub`
- CLI command: `mexus`
- Brand acronym: `M.E.X.U.S.`
- Public category: `Multi-agent Execution Unified System`

Compatibility names:

- `.nexus`
- `~/.nexus`
- `@nexus/*`
- internal `nexus` API names, storage keys, config fields, and repository paths

Documentation may describe compatibility names with a short note:

> Some internal paths and compatibility identifiers may still use the historical Nexus name. These remain unchanged to preserve existing projects and local configuration.

Avoid public-facing copy such as:

- `Nexus is...`
- `Nexus Docs`
- `Nexus Documentation`
- `Nexus Hub`

## Messaging Pillars

### Multi-Agent

Mexus supports multiple CLI agents such as Claude Code, Codex, Kimi Code, OpenCode, Gemini, and others. The message should not be "open many terminals." The message is that each agent becomes a visible execution unit with lifecycle, workspace, status, and review context.

Suggested copy:

> Run multiple CLI agents as managed execution panes, each with its own task, state, terminal, and workspace context.

Chinese:

> 将多个 CLI Agent 作为可管理的执行面板运行，每个面板都有独立任务、状态、终端和工作区上下文。

### Execution

Mexus is not another AI IDE. It is the execution layer around existing agent CLIs. It keeps the user's current tools while adding control, visibility, and coordination.

Suggested copy:

> Keep the agents you already use. Mexus adds the execution layer around them.

Chinese:

> 保留你已经在用的 Agent。Mexus 提供围绕它们的执行层。

### Unified

Mexus unifies scattered execution surfaces: agent panes, terminal sessions, file tree, Git diff, activity views, review comments, Hub tabs, and settings.

Suggested copy:

> One console for agent terminals, file activity, diffs, review, and workspace switching.

Chinese:

> 一个控制台统一管理 Agent 终端、文件活动、Diff、Review 和工作区切换。

### System

Mexus should feel like a system, not a single utility. Hub, worktree isolation, replay, activity maps, future claims, Observer arbitration, and audit logs should all support one idea: governed multi-agent collaboration.

Suggested copy:

> Mexus gives multi-agent work a visible, reviewable, and recoverable system boundary.

Chinese:

> Mexus 为多智能体协作建立可见、可审查、可恢复的系统边界。

## Homepage Design

### First View

The first viewport should make the product concrete. Use a real or high-fidelity product screenshot as the dominant visual signal. Avoid abstract AI gradients or purely decorative diagrams.

Hero structure:

- H1: `Mexus`
- Subtitle: `Multi-agent Execution Unified System`
- Supporting copy: `Run, observe, and coordinate multiple CLI AI agents from one local console.`
- Primary CTA: `Get Started`
- Secondary CTA: `View on GitHub`

Chinese version:

- H1: `Mexus`
- Subtitle: `多智能体执行统一系统`
- Supporting copy: `在一个本地控制台中运行、观察和协调多个 CLI AI Agent。`
- Primary CTA: `快速开始`
- Secondary CTA: `查看 GitHub`

The hero should hint at the next section on both desktop and mobile. Do not make a full-height isolated splash screen.

### Section 2: Execution Layer

Title:

`The execution layer for CLI agents`

Chinese:

`面向 CLI Agent 的执行层`

Content:

- `Multi-agent`: run heterogeneous agent CLIs side by side.
- `Execution`: treat each agent as a managed execution unit.
- `Unified`: bring panes, diffs, file activity, review, and settings into one console.
- `System`: create a foundation for observed, reviewable, and coordinated work.

Optional atmospheric copy:

> Multiple agents. One operator console. A visible execution system.

Chinese:

> 多个 Agent。一个操作员控制台。一个可见的执行系统。

### Section 3: Mexus Hub

Title:

`Mexus Hub brings every local workspace into one place`

Chinese:

`Mexus Hub 将本地工作空间集中到一个入口`

Copy points:

- Manage local Mexus server instances.
- Open workspaces as Hub tabs.
- Keep a single active workspace connection to reduce confusion.
- Preserve stopped instance records for later restart or cleanup.

Do not present Hub as a cloud service unless a future release explicitly adds cloud behavior.

### Section 4: Workflow

Use a compact visual workflow:

`Create agents -> Assign work -> Observe changes -> Review diffs -> Merge or redirect`

Chinese:

`创建 Agent -> 分配任务 -> 观察变化 -> 审查 Diff -> 合并或调整方向`

### Section 5: System Direction

This section can explain where the system is going without overclaiming shipped behavior.

Use labels:

- `Runtime observation`
- `Claim-based coordination`
- `Observer-assisted execution`
- `Replay and audit trail`

Suggested caveat:

> Mexus is evolving toward governed multi-agent execution. Some coordination and arbitration capabilities are staged across releases.

Chinese:

> Mexus 正在演进为可治理的多智能体执行系统。部分协调与仲裁能力会分阶段发布。

## Documentation Site

The documentation site should stop presenting itself as `Nexus Documentation`. It should become `Mexus Docs`.

Recommended landing structure:

- What is Mexus?
- Why an execution layer?
- Quick start
- Mexus Hub
- Agent runtimes
- Execution panes
- Review and diffs
- Worktree isolation
- Configuration and compatibility paths

The docs should include a short migration note near the start:

> Mexus is the public product name. Some internal package names, config paths, and compatibility files may still use Nexus to avoid breaking existing local setups.

Chinese:

> Mexus 是新的公开产品名。为避免破坏现有本地配置，部分内部包名、配置路径和兼容文件仍可能保留 Nexus。

## In-App Copy

These changes are copy-only and should not alter logic, identifiers, data models, or message protocols.

### Global

- `Loading Mexus...`
- Topbar product name: `Mexus`
- Documentation link label: `Mexus Docs`
- Optional system-flavored subtitle: `Operator console for multi-agent execution`

### Empty State

Preferred:

- Title: `No execution panes yet`
- Body: `Create an agent pane to start a multi-agent run.`

Chinese:

- Title: `还没有执行面板`
- Body: `创建一个 Agent 面板，开始一次多智能体执行。`

### Add Pane Dialog

Preferred labels:

- Dialog title: `Create execution pane`
- `Agent type` -> `Agent runtime`
- `Pane name` -> `Execution name`
- `Task description` -> `Assigned task`
- `Working directory` -> `Execution workspace`
- `Isolation` -> `Execution mode`
- `Shared` -> `Shared workspace`
- `Worktree` -> `Isolated worktree`

### Review And Diff

Preferred labels:

- `Workspace Review` -> `Unified Review`
- `Pane Diff` -> `Execution Diff`
- `Merge` -> `Merge execution`
- `Discard` -> `Discard execution changes`

### Hub

Preferred labels:

- `Hub Dashboard` -> `Mexus Hub`
- `Local instances` -> `Local execution servers`
- `Start server` -> `Start execution server`
- `Open tab` -> `Open workspace`
- `Connected` -> `Active connection`
- `Stopped` -> `Offline`

### Settings

Preferred labels:

- `Agents` -> `Agent Runtimes`
- `Models` -> `Model Providers`
- `Config` -> `System Configuration`

## Visual Direction

Mexus should feel like a professional execution console.

Recommended traits:

- Dense, readable, local-first developer tool interface.
- Dark-first but not purely dark-blue or purple.
- Real UI screenshots or faithful UI compositions as the primary website visual.
- Subtle execution signals: status dots, connection lines, tab stacks, file-change traces, diff colors, activity timelines.
- Restrained accent palette using cyan/blue-green for active execution, amber for attention, red/green for diff semantics.
- Dotted acronym treatment for `M.E.X.U.S.` where it reinforces the feeling of a named system.
- Console-like labels such as `Execution Unit`, `Runtime Signal`, `Observation Layer`, `System Boundary`, and `Active Connection`.

Avoid:

- Abstract AI orb visuals.
- Overly decorative gradient hero sections.
- Marketing cards that obscure the actual product.
- A one-note purple, beige, or slate palette.
- Claims that make Mexus sound like a cloud IDE or autonomous coding platform.
- Direct visual references to existing anime, mecha franchises, or copyrighted control-room interfaces.
- Excessive warning-strip, neon, or fake-military styling that makes the product feel less trustworthy.

## Logo And Brandmark Direction

The brandmark should express "multiple execution units unified by a control center." It does not need to literally spell `M`.

Acceptable directions:

- Three or four execution nodes converging into a central axis.
- A compact terminal-window motif with split panes.
- A geometric mark that reads as coordination, routing, and system boundary.

Avoid:

- Generic sparkle or magic symbols.
- A plain monitor icon as the primary mark.
- Decorative letterforms that do not communicate execution or unity.

## Implementation Boundaries

Phase 1 should modify:

- README and public docs copy.
- Documentation site homepage and navigation labels.
- Static website layout and homepage content.
- Visible UI strings where they are clearly display-only.
- Brand messaging document and release notes.

Phase 1 should not modify:

- Runtime identifiers.
- Config filenames or directories.
- Package names.
- API routes.
- WebSocket message names.
- localStorage keys.
- Test fixtures that encode current runtime identifiers.
- Server or workspace behavior.

## Acceptance Criteria

- Public-facing pages consistently use `Mexus` as the product name.
- The acronym `M.E.X.U.S. = Multi-agent Execution Unified System` is visible in the homepage hero or first documentation screen.
- Hub is presented as `Mexus Hub`.
- The website explains Mexus as an execution layer, not an AI IDE.
- Any remaining `Nexus` references are either internal compatibility names or explicitly marked as historical/internal.
- No runtime behavior, persisted identifier, protocol, or config-path behavior changes as part of the first brand pass.
