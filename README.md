# Mexus

**M.E.X.U.S. = Multi-agent Execution Unified System**

Mexus is the execution layer for multi-agent development. It turns scattered CLI AI agents into a unified local system: run them, observe them, review their work, and coordinate progress from one operator console.


https://github.com/user-attachments/assets/1bde703f-dda8-4a83-9421-40e212c6aba1



## Features

### 🖥️ Multi-Agent Execution
- Supports multiple agents: Claude Code, OpenCode, Aider, Codex, Gemini
- Each agent runs as a managed execution pane
- Create, close, restart, and resume agent executions
- Real-time status indicators (running / waiting / idle / stopped / error)
- Floating bottom shell terminal, always accessible

### 🔀 Git Worktree Isolation
- Each agent can work in its own isolated Git worktree
- Parallel development on independent branches without conflicts
- Branch name and file change count displayed in pane headers

### 📊 Runtime Observation
- Automatically parses Claude Code statusline for runtime info
- Live display of model name, context usage %, cumulative cost, session ID
- All agent states written to `.nexus/agents.yaml` for cross-agent awareness

### 📁 Unified Review Surface
- Live file tree with automatic change detection (chokidar)
- Built-in code viewer with Shiki syntax highlighting
- Git diff panel for repo-level change inspection

### ⌨️ Shortcuts & Command Palette
- `Cmd/Ctrl+K` — Open command palette
- `Cmd/Ctrl+N` — New agent pane
- `Cmd/Ctrl+1-9` — Switch between panes
- `Cmd/Ctrl+G` — Open Git diff
- Theme switching via command palette

### 🎨 Themes & Layout
- Resizable four-column layout: Sidebar / Agent Panes / Editor / File Tree
- 7 built-in themes: Dark IDE, GitHub Dark, Dracula, Tokyo Night, Catppuccin, Nord, Light IDE
- Responsive scaling for large screens

### 📝 Configuration
- YAML-driven config at global (`~/.nexus/config.yaml`) and project level
- Per-agent working directory and task description
- Session start modes: new session or resume a selected prior session

> Some internal paths and compatibility identifiers still use the historical Nexus name. These remain unchanged to preserve existing projects and local configuration.

## Installation & Usage

```bash
# Install globally
npm install -g mexus-cli

# Start in the current directory
mexus

# Start with a specific project path
mexus ~/projects/my-app

# Initialize project config
mexus init ~/projects/my-app

# Check workspace status
mexus status

# Stop the server
mexus stop

# Custom port
NEXUS_PORT=8080 mexus
```

### Development

```bash
# Install dependencies
pnpm install

# Dev mode (build frontend, then start server with watch)
pnpm dev

# Full dev mode (frontend + backend hot reload in parallel)
pnpm dev:full

# Production build
pnpm build

# Start production server
pnpm start
```

## Tech Stack

**Backend**
- Node.js 22+, TypeScript, Fastify 5, @fastify/websocket
- node-pty (terminal process management)
- chokidar (file watching), simple-git (Git operations)

**Frontend**
- React 18, TypeScript, Vite 6
- Tailwind CSS v4, xterm.js, Zustand
- Shiki (syntax highlighting), react-diff-view, cmdk

## Architecture

```
Browser (React + WebSocket)
    ↕
Node.js Server (Fastify)
    ↕
CLI Agent Processes (node-pty)
```

## License

MIT

## Star History

[![Star History Chart](https://api.star-history.com/image?repos=yofine/Nexus&type=date&legend=top-left)](https://www.star-history.com/?repos=yofine%2FNexus&type=date&legend=top-left)

<br/>
