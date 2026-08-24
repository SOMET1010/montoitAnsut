import 'server-only'

// ─── Azure OpenAI Embeddings client ──────────────────────────────────────────
// Used for semantic matching (property recommendations). Separate resource
// from the SUTA chat deployment (dtdi-openai-audio-01), so its own env vars.

export function isEmbeddingsConfigured(): boolean {
  return !!(
    process.env.AZURE_OPENAI_EMBEDDINGS_ENDPOINT
    && process.env.AZURE_OPENAI_EMBEDDINGS_API_KEY
    && process.env.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT_NAME
  )
}

/**
 * Embed a batch of texts in a single request (cheaper and faster than one
 * call per item — Azure OpenAI's embeddings endpoint accepts an array).
 * Returns embeddings in the same order as the input texts.
 */
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const endpoint = process.env.AZURE_OPENAI_EMBEDDINGS_ENDPOINT
  const apiKey = process.env.AZURE_OPENAI_EMBEDDINGS_API_KEY
  const deployment = process.env.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT_NAME
  const apiVersion = process.env.AZURE_OPENAI_EMBEDDINGS_API_VERSION || '2024-10-21'

  if (!endpoint || !apiKey || !deployment) {
    throw new Error('Azure OpenAI Embeddings non configuré.')
  }
  if (texts.length === 0) return []

  const url = `${endpoint.replace(/\/+$/, '')}/openai/deployments/${deployment}/embeddings?api-version=${apiVersion}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: texts }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[Azure Embeddings Error]', response.status, errorText)
    throw new Error(`Azure OpenAI Embeddings a répondu avec le statut ${response.status}`)
  }

  const data = await response.json()
  const items = (data?.data ?? []) as Array<{ index: number; embedding: number[] }>
  const ordered = [...items].sort((a, b) => a.index - b.index)
  return ordered.map((item) => item.embedding)
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}
