# Nexus Documentation Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bilingual VitePress documentation site under `doc_site` that covers the current Nexus user-facing feature set, including experimental areas clearly labeled for end users.

**Architecture:** Create a standalone VitePress workspace in `doc_site`, with a single shared VitePress config and mirrored `zh` and `en` content trees. Source content from the current repository state, especially the existing manuals plus the live frontend and server surface, and organize it as quick-start plus full feature reference.

**Tech Stack:** VitePress, Markdown, pnpm, existing Nexus repository docs and source files

---

## File Structure

- Create: `doc_site/package.json`
- Create: `doc_site/docs/.vitepress/config.ts`
- Create: `doc_site/docs/index.md`
- Create: `doc_site/docs/zh/index.md`
- Create: `doc_site/docs/zh/quick-start.md`
- Create: `doc_site/docs/zh/installation.md`
- Create: `doc_site/docs/zh/cli.md`
- Create: `doc_site/docs/zh/interface.md`
- Create: `doc_site/docs/zh/tasks.md`
- Create: `doc_site/docs/zh/features.md`
- Create: `doc_site/docs/zh/configuration.md`
- Create: `doc_site/docs/zh/shortcuts.md`
- Create: `doc_site/docs/zh/faq.md`
- Create: `doc_site/docs/en/index.md`
- Create: `doc_site/docs/en/quick-start.md`
- Create: `doc_site/docs/en/installation.md`
- Create: `doc_site/docs/en/cli.md`
- Create: `doc_site/docs/en/interface.md`
- Create: `doc_site/docs/en/tasks.md`
- Create: `doc_site/docs/en/features.md`
- Create: `doc_site/docs/en/configuration.md`
- Create: `doc_site/docs/en/shortcuts.md`
- Create: `doc_site/docs/en/faq.md`
- Modify: `package.json`

Reference files to inspect while implementing:

- `README.md`
- `docs/User-Manual.md`
- `docs/用户手册.md`
- `packages/web/src/components/Layout.tsx`
- `packages/web/src/components/Sidebar.tsx`
- `packages/web/src/components/SettingsDialog.tsx`
- `packages/web/src/types.ts`

### Task 1: Scaffold the VitePress workspace

**Files:**
- Create: `doc_site/package.json`
- Modify: `package.json`

- [ ] **Step 1: Write the failing workspace check**

Document the expected new workspace shape before creating files:

```text
doc_site/
  package.json
  docs/
    .vitepress/
      config.ts
```

Failure condition: `doc_site/package.json` does not exist, and the root workspace has no way to run the docs site.

- [ ] **Step 2: Verify the failure**

Run: `rg --files doc_site`
Expected: no output, because the docs site has not been scaffolded yet.

- [ ] **Step 3: Add the minimal docs workspace**

Create `doc_site/package.json` with:

```json
{
  "name": "@nexus/doc-site",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vitepress dev docs",
    "build": "vitepress build docs",
    "preview": "vitepress preview docs"
  },
  "devDependencies": {
    "vitepress": "^1.6.3"
  }
}
```

Update the root `package.json` scripts minimally to expose docs commands:

```json
{
  "scripts": {
    "docs:dev": "pnpm -C doc_site dev",
    "docs:build": "pnpm -C doc_site build",
    "docs:preview": "pnpm -C doc_site preview"
  }
}
```

- [ ] **Step 4: Verify the workspace exists**

Run: `rg --files doc_site`
Expected: shows at least `doc_site/package.json`.

- [ ] **Step 5: Commit**

```bash
git add package.json doc_site/package.json
git commit -m "docs: scaffold VitePress doc site workspace"
```

### Task 2: Add shared VitePress configuration and bilingual navigation

**Files:**
- Create: `doc_site/docs/.vitepress/config.ts`
- Create: `doc_site/docs/index.md`

- [ ] **Step 1: Write the failing route expectation**

Define the required route families:

```ts
const requiredRoutes = [
  '/',
  '/zh/',
  '/en/',
  '/zh/quick-start',
  '/en/quick-start',
]
```

Failure condition: the config does not define language-aware navigation and the root landing page does not redirect users into the bilingual structure.

- [ ] **Step 2: Verify the failure**

Run: `test -f doc_site/docs/.vitepress/config.ts; echo $?`
Expected: `1`, because the VitePress config does not exist yet.

- [ ] **Step 3: Add the VitePress config**

Create `doc_site/docs/.vitepress/config.ts` with a bilingual site configuration shaped like:

```ts
import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Nexus',
  description: 'Documentation for Nexus',
  cleanUrls: true,
  themeConfig: {
    search: { provider: 'local' },
  },
  locales: {
    root: {
      label: '中文',
      lang: 'zh-CN',
      link: '/zh/',
    },
    zh: {
      label: '中文',
      lang: 'zh-CN',
      link: '/zh/',
      themeConfig: {
        nav: [],
        sidebar: [],
      },
    },
    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      themeConfig: {
        nav: [],
        sidebar: [],
      },
    },
  },
})
```

Populate `nav` and `sidebar` with mirrored sections for:

```ts
[
  'Quick Start',
  'Installation',
  'CLI Usage',
  'Interface Overview',
  'Common Tasks',
  'Feature Reference',
  'Configuration',
  'Shortcuts',
  'FAQ',
]
```

Create `doc_site/docs/index.md` as a lightweight language chooser:

```md
# Nexus Documentation

- [中文文档](/zh/)
- [English Docs](/en/)
```

- [ ] **Step 4: Verify config syntax and routes**

Run: `pnpm -C doc_site exec vitepress build docs`
Expected: build succeeds far enough to resolve the config, even if page files are still missing and need to be added next.

- [ ] **Step 5: Commit**

```bash
git add doc_site/docs/.vitepress/config.ts doc_site/docs/index.md
git commit -m "docs: add bilingual VitePress configuration"
```

### Task 3: Write the Chinese user documentation set

**Files:**
- Create: `doc_site/docs/zh/index.md`
- Create: `doc_site/docs/zh/quick-start.md`
- Create: `doc_site/docs/zh/installation.md`
- Create: `doc_site/docs/zh/cli.md`
- Create: `doc_site/docs/zh/interface.md`
- Create: `doc_site/docs/zh/tasks.md`
- Create: `doc_site/docs/zh/features.md`
- Create: `doc_site/docs/zh/configuration.md`
- Create: `doc_site/docs/zh/shortcuts.md`
- Create: `doc_site/docs/zh/faq.md`

- [ ] **Step 1: Write the failing content checklist**

Every Chinese page set must cover these user-facing topics:

```text
产品定位
安装与 Node.js 版本要求
CLI 启动与常见命令
界面结构
Pane 管理
恢复与重启模式
终端与底部 Shell
文件树与预览
Git 变更与分支信息
Worktree 隔离
Replay History
Notes
活动追踪
设置与主题
快捷键
配置文件
FAQ/排障
实验性能力标注
```

Failure condition: any current user-visible feature area from the checklist is absent from the Chinese docs set.

- [ ] **Step 2: Verify the failure**

Run: `test -f doc_site/docs/zh/features.md; echo $?`
Expected: `1`, because the Chinese feature docs do not exist yet.

- [ ] **Step 3: Write the Chinese pages**

Write compact user-facing pages with these minimum content shapes:

`doc_site/docs/zh/index.md`

```md
# Nexus 文档

本地浏览器控制台，用来并行管理多个 CLI AI Agent。

## 你可以用它做什么

- 在一个界面里运行多个 agent pane
- 查看文件、Diff、分支信息和会话状态
- 用 worktree 隔离并行任务
- 回放历史会话，查看 Notes 和活动记录

> 部分功能仍处于实验性阶段，文档会明确标注。
```

`doc_site/docs/zh/tasks.md`

```md
# 常见任务

## 新建一个 Agent Pane
## 恢复或重启已有会话
## 用独立 worktree 并行开发
## 查看 Git 变更
## 打开回放历史
## 使用 Notes 记录协作信息
```

`doc_site/docs/zh/features.md`

```md
# 功能参考

## Agent 管理
## 状态与元信息
## 终端与对话事件
## 文件浏览与预览
## Git 与工作区变更
## Replay History
## Notes
## 活动追踪
## 设置、主题与字体

> Experimental
>
> 某些能力已经出现在界面或协议中，但可能仍在迭代中。此类条目需要在对应章节中明确说明状态。
```

`doc_site/docs/zh/configuration.md`

```md
# 配置

## 全局配置
`~/.nexus/config.yaml`

## 项目配置
`.nexus/config.yaml`

## 常见字段
- shell
- scrollback_lines
- grid_columns
- history_retention_days
- theme
- agents.<name>.bin
- agents.<name>.continue_flag
- agents.<name>.resume_flag
- agents.<name>.yolo_flag
- agents.<name>.transport
- agents.<name>.env
```

Fill the rest of the pages with repository-accurate command examples and user explanation based on the current code surface.

- [ ] **Step 4: Verify coverage**

Run: `rg -n "Replay|Notes|worktree|resume|theme|history_retention_days|__shell__|git" doc_site/docs/zh`
Expected: matches across the Chinese page set, showing all major user-facing capabilities are documented.

- [ ] **Step 5: Commit**

```bash
git add doc_site/docs/zh
git commit -m "docs: add Chinese Nexus user documentation"
```

### Task 4: Write the English user documentation set

**Files:**
- Create: `doc_site/docs/en/index.md`
- Create: `doc_site/docs/en/quick-start.md`
- Create: `doc_site/docs/en/installation.md`
- Create: `doc_site/docs/en/cli.md`
- Create: `doc_site/docs/en/interface.md`
- Create: `doc_site/docs/en/tasks.md`
- Create: `doc_site/docs/en/features.md`
- Create: `doc_site/docs/en/configuration.md`
- Create: `doc_site/docs/en/shortcuts.md`
- Create: `doc_site/docs/en/faq.md`

- [ ] **Step 1: Write the failing parity checklist**

The English docs must mirror the Chinese structure and cover the same feature scope:

```text
Same page count
Same route structure
Same feature coverage
Same experimental labels where applicable
```

Failure condition: the English docs omit sections that exist in the Chinese docs or use a different information architecture.

- [ ] **Step 2: Verify the failure**

Run: `test -f doc_site/docs/en/features.md; echo $?`
Expected: `1`, because the English page set does not exist yet.

- [ ] **Step 3: Write the English pages**

Use English pages that mirror the Chinese set and match the same route names:

```text
doc_site/docs/en/index.md
doc_site/docs/en/quick-start.md
doc_site/docs/en/installation.md
doc_site/docs/en/cli.md
doc_site/docs/en/interface.md
doc_site/docs/en/tasks.md
doc_site/docs/en/features.md
doc_site/docs/en/configuration.md
doc_site/docs/en/shortcuts.md
doc_site/docs/en/faq.md
```

Use equivalent headings such as:

```md
# Nexus Docs
# Quick Start
# Installation
# CLI Usage
# Interface Overview
# Common Tasks
# Feature Reference
# Configuration
# Keyboard Shortcuts
# FAQ and Troubleshooting
```

Keep command examples aligned with the Chinese set and preserve the same experimental status notes.

- [ ] **Step 4: Verify parity**

Run: `find doc_site/docs/zh -maxdepth 1 -name "*.md" | wc -l && find doc_site/docs/en -maxdepth 1 -name "*.md" | wc -l`
Expected: both counts match.

- [ ] **Step 5: Commit**

```bash
git add doc_site/docs/en
git commit -m "docs: add English Nexus user documentation"
```

### Task 5: Install dependencies and verify the site end to end

**Files:**
- Modify: `doc_site/package.json`
- Modify: `doc_site/docs/.vitepress/config.ts`
- Modify: any doc page with broken links discovered during verification

- [ ] **Step 1: Write the failing verification checklist**

The finished docs site must satisfy all of the following:

```text
pnpm install resolves VitePress
pnpm docs:build succeeds
/ route loads
/zh/ route loads
/en/ route loads
No broken internal sidebar links
Chinese and English navigation both render
```

Failure condition: any build error, missing route, or broken sidebar link remains.

- [ ] **Step 2: Verify the initial failure**

Run: `pnpm docs:build`
Expected: FAIL before dependency install or before all required page files/config are in place.

- [ ] **Step 3: Install and fix**

Run the required install and build flow:

```bash
pnpm install
pnpm docs:build
```

If the build reports missing pages or broken links, update the referenced Markdown files or `doc_site/docs/.vitepress/config.ts` until the build passes cleanly.

- [ ] **Step 4: Verify success**

Run: `pnpm docs:build`
Expected: VitePress build completes successfully with both `/zh/` and `/en/` content included.

Optionally run:

```bash
pnpm docs:dev
```

Expected: local dev server starts and serves the bilingual docs site.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml doc_site
git commit -m "docs: ship bilingual VitePress documentation site"
```

## Self-Review

### Spec coverage

- VitePress site under `doc_site`: covered by Tasks 1 and 2
- Bilingual Chinese and English navigation: covered by Tasks 2, 3, and 4
- User-focused information architecture: covered by Tasks 2, 3, and 4
- Coverage of current implemented feature set: covered by Tasks 3 and 4
- Experimental feature labeling: covered by Tasks 3 and 4
- Local verification and buildability: covered by Task 5

### Placeholder scan

No `TODO`, `TBD`, or implied follow-up placeholders remain in the task steps. Every created file and every required verification command is named explicitly.

### Type consistency

The plan consistently uses `doc_site/docs/.vitepress/config.ts`, mirrored `zh` and `en` page trees, and root scripts `docs:dev`, `docs:build`, and `docs:preview`.
