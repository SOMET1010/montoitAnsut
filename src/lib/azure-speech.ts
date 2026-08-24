import 'server-only'

// ─── Azure AI Speech client ───────────────────────────────────────────────────
// Voice input/output for SUTA (resource: DTDI-AZURESPEECH-Julaba-01).
// No-ops with a clear error if the key isn't configured yet.

const DEFAULT_LANGUAGE = 'fr-FR'
const DEFAULT_VOICE = 'fr-FR-EloiseNeural'

function getConfig() {
  const key = process.env.AZURE_SPEECH_KEY
  const region = process.env.AZURE_SPEECH_REGION || 'westeurope'
  if (!key) {
    throw new Error('Azure AI Speech non configuré. Vérifiez AZURE_SPEECH_KEY.')
  }
  return { key, region }
}

export function isAzureSpeechConfigured(): boolean {
  return !!process.env.AZURE_SPEECH_KEY
}

/**
 * Transcribe a short audio recording (webm/opus or wav) to text.
 */
export async function speechToText(audio: Buffer, contentType: string): Promise<string> {
  const { key, region } = getConfig()

  const url = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${DEFAULT_LANGUAGE}&format=simple`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': contentType,
      Accept: 'application/json',
    },
    body: new Uint8Array(audio),
  })

  if (!response.ok) {
    console.error('[Azure Speech] STT failed:', response.status, await response.text().catch(() => ''))
    throw new Error('Reconnaissance vocale indisponible')
  }

  const data = await response.json()
  if (data.RecognitionStatus !== 'Success' || !data.DisplayText) {
    throw new Error('Aucune parole reconnue')
  }

  return data.DisplayText as string
}

function escapeSsml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Synthesize text to speech (MP3), returned as a Buffer.
 */
export async function textToSpeech(text: string): Promise<Buffer> {
  const { key, region } = getConfig()

  const ssml = `<speak version='1.0' xml:lang='${DEFAULT_LANGUAGE}'>
    <voice xml:lang='${DEFAULT_LANGUAGE}' name='${DEFAULT_VOICE}'>${escapeSsml(text)}</voice>
  </speak>`

  const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-16khz-64kbitrate-mono-mp3',
    },
    body: ssml,
  })

  if (!response.ok) {
    console.error('[Azure Speech] TTS failed:', response.status, await response.text().catch(() => ''))
    throw new Error('Synthèse vocale indisponible')
  }

  return Buffer.from(await response.arrayBuffer())
}
