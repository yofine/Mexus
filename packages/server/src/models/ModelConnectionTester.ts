import type { ModelDefinition, ModelProviderConfig } from '../types.ts'

export interface ModelConnectionResult {
  ok: boolean
  status?: number
  message: string
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function resolveApiKey(provider: ModelProviderConfig): string {
  return provider.api_key || ''
}

function anthropicBaseUrl(baseUrl: string): string {
  const normalized = trimTrailingSlash(baseUrl)
  return normalized.endsWith('/v1') ? normalized : `${normalized}/v1`
}

export async function testModelProviderConnection(provider: ModelProviderConfig, model?: ModelDefinition): Promise<ModelConnectionResult> {
  if (!provider.type) {
    return { ok: false, message: 'Select a provider format before testing.' }
  }
  if (!provider.base_url.trim()) {
    return { ok: false, message: 'Base URL is required.' }
  }
  if (!model?.id?.trim()) {
    return { ok: false, message: 'Select a model before testing.' }
  }

  const apiKey = resolveApiKey(provider)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    let url: string
    let body: unknown
    if (provider.type === 'anthropic') {
      url = `${anthropicBaseUrl(provider.base_url)}/messages`
      if (apiKey) headers['x-api-key'] = apiKey
      headers['anthropic-version'] = '2023-06-01'
      body = {
        model: model.id,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }
    } else {
      url = `${trimTrailingSlash(provider.base_url)}/chat/completions`
      if (apiKey) headers.authorization = `Bearer ${apiKey}`
      body = {
        model: model.id,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (response.ok) {
      return { ok: true, status: response.status, message: `Connection succeeded for ${model.id}.` }
    }
    const detail = await response.text().catch(() => '')
    const suffix = detail.trim() ? `: ${detail.trim().slice(0, 160)}` : ''
    return { ok: false, status: response.status, message: `Connection failed (${response.status})${suffix}` }
  } catch (err) {
    const message = err instanceof Error && err.name === 'AbortError'
      ? 'Connection timed out.'
      : `Connection failed: ${(err as Error).message}`
    return { ok: false, message }
  } finally {
    clearTimeout(timeout)
  }
}
