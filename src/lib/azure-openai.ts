import 'server-only'

// ─── Azure OpenAI client ──────────────────────────────────────────────────────
// Shared by SUTA (chat) and any other feature that needs a chat completion
// (property description generation, etc). No-ops with a clear error if the
// deployment isn't configured — never throws on missing keys until actually
// called, matching the pattern used for ANSUT/Intouch/ONECI elsewhere.

export interface AzureChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_call_id?: string
  tool_calls?: AzureToolCall[]
}

export interface AzureToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface AzureChoice {
  message: {
    content: string | null
    tool_calls?: AzureToolCall[]
  }
  finish_reason: string
}

export interface AzureChatResponse {
  choices: AzureChoice[]
}

export interface AzureToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export function isAzureOpenAiConfigured(): boolean {
  return !!(
    process.env.VITE_AZURE_OPENAI_ENDPOINT
    && process.env.VITE_AZURE_OPENAI_API_KEY
    && process.env.VITE_AZURE_OPENAI_DEPLOYMENT_NAME
  )
}

export async function callAzureOpenAI(
  messages: AzureChatMessage[],
  options: { tools?: AzureToolDefinition[]; maxTokens?: number; temperature?: number } = {}
): Promise<AzureChatResponse> {
  const endpoint = process.env.VITE_AZURE_OPENAI_ENDPOINT
  const apiKey = process.env.VITE_AZURE_OPENAI_API_KEY
  const deployment = process.env.VITE_AZURE_OPENAI_DEPLOYMENT_NAME
  const apiVersion = process.env.VITE_AZURE_OPENAI_API_VERSION || '2024-10-21'

  if (!endpoint || !apiKey || !deployment) {
    throw new Error('Azure OpenAI non configuré. Vérifiez les variables d\'environnement.')
  }

  const url = `${endpoint.replace(/\/+$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      max_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature ?? 0.7,
      ...(options.tools ? { tools: options.tools, tool_choice: 'auto' } : {}),
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[Azure OpenAI Error]', response.status, errorText)
    throw new Error(`Azure OpenAI a répondu avec le statut ${response.status}`)
  }

  return response.json()
}
