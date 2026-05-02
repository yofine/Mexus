# Mission: Browser Agent And AI Wallet MVP

Mission: `2026-05-02-browser-agent-wallet-mvp`

Created by: Squad Lead

Date: 2026-05-02

## User's Original Product Intent

The product is a browser extension shaped as a Browser Agent. Users can configure model providers and models, then call those models directly inside the browser. The extension includes a simple Agent based on pi-mono that can read or change browser pages through the Chrome Debugger API. The model and Agent capabilities are exposed through a browser-side AI gateway, for example as a `window.xxx` API.

The extension should provide a split-screen side panel. The side panel contains an AI chat window, allowing users to interact with the Agent to operate the browser.

This visible Browser Agent tool is only the surface layer. The deeper strategic idea is to reference Web3 crypto wallet patterns and build an AI wallet for AI Web applications:

- Solve the token/model-compute source problem for AI Web apps.
- Avoid requiring users to entrust model API keys to every platform.
- Keep API keys only inside the browser extension.
- Let AI Web app pages request model or Agent capabilities through wallet-like authorization.
- Turn `window.xxx` style browser-provided model compute into a standard.
- Decouple compute from applications.
- Lower AI Web application development cost.
- Help the ecosystem grow.

## Desired Implementation Order

1. Build the extension options/configuration page:
   - model provider configuration
   - model configuration
   - gateway configuration
   - expose model invocation API to `window`

2. Implement a simple Agent based on pi-mono:
   - allow browser operation
   - use Chrome Debugger API for stronger page read/change capability

3. Build a side panel chat UI:
   - users can talk to the Agent
   - users can use the Agent to operate the browser

4. Build the AI-wallet-shaped protocol and authorization mechanism:
   - keep the first release product language focused on Browser Agent / AI Browser
   - avoid exposing the full AI wallet strategy too early

5. Build an AI Web application that integrates with the AI wallet:
   - use it later as the killer demo
   - show the end-to-end authorization and gateway experience

## Strategic Release Constraint

The idea is easy to copy. If it is exposed too early, especially by someone with more influence, that person may establish the AI wallet standard first.

Therefore, the first public release should not lead with AI wallet positioning. It should launch as a useful BrowserAgent that increases user adoption. It can expose a small amount of AI wallet capability through APIs such as:

```js
window.browserAgent.chat(...)
window.browserAgent.run(...)
```

The plugin should first make ordinary users feel that their normal browser has become an AI browser.

After user coverage grows, a strong AI Web application can be released to demonstrate the AI wallet capability. The AI wallet concept can then be introduced through an experience users can try.

## First Version Product Expectation

The first version is for ordinary users:

- The user uses the side panel Agent first.
- The product should feel like it turns a normal browser into an AI browser.
- The extension can expose:

```js
window.browserAgent.chat(...)
window.browserAgent.run(...)
```

as gateway examples.

Trusted sites should be allowed to request authorization for automatic `run`. This is considered critical for product adoption.

## First Version Product Surfaces

The first version has two major surfaces:

1. Side panel UI:
   - the AI Browser control surface
   - chat with the Agent
   - operate the current browser page

2. Background/options configuration:
   - configure models
   - configure gateway
   - inspect call information and observability data

## Current Problem Statement

The current project has a Chrome MV3 extension skeleton, model configuration, a basic side panel, a basic `window.browserAgent` bridge, and simple logs/tests. However, both functionality and design are below the minimum acceptance standard.

The project needs a full analysis of remaining work, a decomposition into relatively independent tasks, and prompts that can be distributed to multiple CLI agents inside Mexus.

## Minimum Acceptance Standard For This Mission

The mission should move the project toward these criteria:

- Users can configure OpenAI-compatible or Anthropic-compatible providers in options.
- Users can open any normal webpage and use the side panel to summarize, ask questions, and extract information.
- `window.browserAgent.chat(...)` and `window.browserAgent.run(...)` can be called by authorized sites.
- Site authorization is understandable and user-controlled.
- Users can allow trusted sites to auto-run.
- API keys never leave extension storage and never enter webpage context.
- Call history shows website invocation records.
- The Agent can do limited `read`, `click`, `type`, and `scroll` operations, not just answer text.
- Chrome Debugger API capability is treated as advanced and explicitly gated.
- The first release product language says Browser Agent / AI Browser, not AI Wallet.
