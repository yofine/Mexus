# Mexus Hub Model Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user-created custom model providers to Mexus Hub settings, with OpenAI and Anthropic only as selectable provider formats.

**Architecture:** Extend the existing global config schema with an empty `models` block owned by `ConfigManager`, then expose it through the existing config endpoints. Add a `Models` tab to the existing settings dialog so Hub users can add blank custom providers through a form, choose OpenAI or Anthropic format later, test connectivity, manage API keys, model lists, proxy intent fields, and the default Mexus tool model below provider configuration.

**Tech Stack:** TypeScript, Fastify, js-yaml, React, lucide-react, Vitest.

---

### Task 1: Backend Config Schema

**Files:**
- Modify: `packages/server/src/types.ts`
- Modify: `packages/server/src/workspace/ConfigManager.ts`
- Test: `packages/server/src/workspace/ConfigManager.test.ts`

- [ ] **Step 1: Write failing tests**

Create `ConfigManager.test.ts` with tests that load an empty default model config and merge missing model config into an existing config without injecting preset providers.

- [ ] **Step 2: Verify tests fail**

Run: `pnpm --filter @nexus/server test src/workspace/ConfigManager.test.ts`

Expected: FAIL before implementation because `GlobalConfig.models` does not exist or still contains preset providers.

- [ ] **Step 3: Add model config types and defaults**

Add `ModelProviderType`, `ModelProxyMode`, `ModelDefinition`, `ModelProviderConfig`, and `ModelConfig` to server types. Add an empty default `models` config in `ConfigManager`.

- [ ] **Step 4: Merge existing config safely**

Update `loadGlobalConfig()` so saved configs receive missing `models`, provider fields, model fields, and proxy fields without overwriting user fields.

- [ ] **Step 5: Verify tests pass**

Run: `pnpm --filter @nexus/server test src/workspace/ConfigManager.test.ts`

Expected: PASS.

### Task 2: Frontend Types and Settings UI

**Files:**
- Create: `packages/server/src/models/ModelConnectionTester.ts`
- Test: `packages/server/src/models/ModelConnectionTester.test.ts`
- Modify: `packages/server/src/index.ts`
- Modify: `packages/server/src/hub/index.ts`
- Modify: `packages/web/src/types.ts`
- Modify: `packages/web/src/components/SettingsDialog.tsx`
- Modify: `packages/web/src/styles/globals.css`

- [ ] **Step 1: Add web config types**

Mirror the server model config types in `packages/web/src/types.ts`.

- [ ] **Step 2: Add Models tab**

Add a `Models` settings tab with provider configuration above default tool model selection. `Add Provider` opens a blank form with test connection. Saving that form turns it into a provider card. Provider format selection must not mutate base URL, API key env, proxy mode, or proxy port. Provider cards include provider fields, API key fields, connection testing, proxy fields, and model list editing.

- [ ] **Step 3: Add scoped styles**

Add settings styles for model provider cards, compact model rows, and password/key controls.

- [ ] **Step 4: Verify frontend typecheck**

Run: `pnpm --filter @nexus/web build`

Expected: PASS.

### Task 3: Full Verification

**Files:**
- No new files.

- [ ] **Step 1: Run server tests**

Run: `pnpm --filter @nexus/server test src/workspace/ConfigManager.test.ts`

Expected: PASS.

- [ ] **Step 2: Run focused builds**

Run: `pnpm --filter @nexus/server build`
Run: `pnpm --filter @nexus/web build`

Expected: PASS.
