export interface CliHttpClient {
  fetch(url: string, init?: RequestInit): Promise<Response>
}

export interface CliIo {
  stdout: (text: string) => void
  stderr: (text: string) => void
}

export class CliError extends Error {
  constructor(message: string, public readonly exitCode = 1) {
    super(message)
    this.name = 'CliError'
  }
}

export function resolveServerUrl(env: NodeJS.ProcessEnv): string {
  const port = env.NEXUS_PORT || '7700'
  return `http://localhost:${port}`
}

export async function requestJson<T>(
  client: CliHttpClient,
  url: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response
  try {
    response = await client.fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    })
  } catch {
    throw new CliError('Mexus server not running - start it with `mexus start`')
  }

  const text = await response.text()
  const data = text ? JSON.parse(text) as T & { error?: string } : {} as T & { error?: string }
  if (!response.ok) {
    throw new CliError(data.error || `Request failed with HTTP ${response.status}`)
  }
  return data
}

export function takeOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  if (index < 0) return undefined
  const value = args[index + 1]
  if (!value || value.startsWith('--')) {
    throw new CliError(`Missing value for ${name}`)
  }
  args.splice(index, 2)
  return value
}

export function takeFlag(args: string[], name: string): boolean {
  const index = args.indexOf(name)
  if (index < 0) return false
  args.splice(index, 1)
  return true
}

export function requireArg(value: string | undefined, message: string): string {
  if (!value) throw new CliError(message)
  return value
}

export function printJson(io: CliIo, value: unknown): void {
  io.stdout(JSON.stringify(value, null, 2))
}
