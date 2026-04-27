import { afterEach, describe, expect, it, vi } from 'vitest'
import { testModelProviderConnection } from './ModelConnectionTester.ts'
import type { ModelDefinition, ModelProviderConfig } from '../types.ts'

function provider(overrides: Partial<ModelProviderConfig>): ModelProviderConfig {
  return {
    name: '',
    type: '',
    enabled: true,
    base_url: '',
    api_key: '',
    models: [],
    proxy: { enabled: false, mode: '', port: 0 },
    ...overrides,
  }
}

const model = (overrides: Partial<ModelDefinition> = {}): ModelDefinition => ({
  id: 'configured-model',
  name: 'Configured Model',
  enabled: true,
  ...overrides,
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('testModelProviderConnection', () => {
  it('does not call the network when provider format is blank', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    const result = await testModelProviderConnection(provider({ base_url: 'https://example.test' }), model())

    expect(result).toEqual({ ok: false, message: 'Select a provider format before testing.' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('requires a configured model before testing', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    const result = await testModelProviderConnection(provider({
      type: 'openai',
      base_url: 'https://llm.example.test/v1',
    }))

    expect(result).toEqual({ ok: false, message: 'Select a model before testing.' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('tests OpenAI-compatible providers with the configured model and bearer key', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))

    const result = await testModelProviderConnection(provider({
      type: 'openai',
      base_url: 'https://llm.example.test/v1/',
      api_key: 'direct-key',
    }), model({ id: 'gpt-test' }))

    expect(result.ok).toBe(true)
    expect(result.message).toBe('Connection succeeded for gpt-test.')
    expect(fetchMock).toHaveBeenCalledWith('https://llm.example.test/v1/chat/completions', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ authorization: 'Bearer direct-key' }),
      body: JSON.stringify({
        model: 'gpt-test',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    }))
  })

  it('tests Anthropic-compatible providers with the configured model and direct key', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))

    const result = await testModelProviderConnection(provider({
      type: 'anthropic',
      base_url: 'https://llm.example.test',
      api_key: 'direct-key',
    }), model({ id: 'claude-test' }))

    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith('https://llm.example.test/v1/messages', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'x-api-key': 'direct-key',
        'anthropic-version': '2023-06-01',
      }),
      body: JSON.stringify({
        model: 'claude-test',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    }))
  })
})
