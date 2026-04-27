# Mexus Hub Model Configuration Design

## Goal

Add first-class model provider configuration to Mexus Hub so users can define custom model providers, maintain their model lists, configure API keys, test connectivity, and choose the default tool model Mexus will use later for internal workflows.

## Scope

This phase implements configuration and provider connection testing only. It does not start model proxy servers or wire configured models into Agent startup. Proxy settings are stored so a later phase can add manual start and stop behavior.

## Configuration

Model configuration lives in the existing global config file at `~/.nexus/config.yaml` under `models`.

```yaml
models:
  defaults:
    tool_model: ""
  providers: {}
```

Mexus does not ship preconfigured OpenAI or Anthropic provider records. Users add a custom provider first, then choose the provider format themselves. Provider `type` may be empty while the provider is a draft, and otherwise is limited to `openai` and `anthropic`. The format only declares the interaction protocol used for actions such as connection testing. It does not imply that the configured provider is the OpenAI or Anthropic hosted service, and choosing a format does not mutate other provider fields. API keys are stored directly in the local YAML file for this phase because the project does not yet have a secrets store.

`models.defaults.tool_model` is a stable reference in the form `providerId/modelId`. The UI should select it in two steps: first choose an enabled provider, then choose one of that provider's enabled models.

## Hub UI

Hub Settings gains a `Models` tab. The tab shows model provider configuration first and the default tool model selector below it.

Clicking `Add Provider` opens a compact blank provider form. The form supports display name, provider format, base URL, API key, one or more models, and test connection. Each model has a model id and a label. Saving the form adds a provider card to the config editor using an internally generated provider id. The user still saves the settings page to persist the config file.

Saved provider cards show provider fields, model list editing, connection testing, and proxy configuration. Connection testing uses a selected configured model; when multiple enabled models exist, the UI shows a model selector next to the test button. Proxy mode, proxy port, and proxy enabled state are displayed on the provider card. This phase stores proxy intent only; it does not start or stop proxy processes.

The UI does not show proxy runtime state and does not include start or stop buttons in this phase.

## Backend

`ConfigManager` owns the empty default model configuration and backward-compatible merging. Loading an existing config fills missing `models`, missing provider fields, missing model fields, and missing proxy fields without overwriting user-defined values. It must not inject OpenAI or Anthropic provider records into an empty user config.

The existing `/api/config` and `/api/hub/config` endpoints continue to read and write the global config shape. `/api/models/test-connection` and `/api/hub/models/test-connection` test a provider and selected model using the selected provider format.

## Validation

This phase keeps validation lightweight. The server ensures missing required containers are restored on load. The UI generates provider ids internally for newly added providers and defaults new provider/model records to usable values.

## Future Work

Later phases can add manual proxy lifecycle endpoints, reverse proxy request handling for OpenAI and Anthropic compatible APIs, and Agent model binding.
