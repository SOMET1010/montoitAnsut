import { NextRequest, NextResponse } from 'next/server'
import { resolveRequestUser } from '@/lib/auth/request-user'
import { checkRateLimit } from '@/lib/rate-limiter'
import { speechToText } from '@/lib/azure-speech'

const MAX_AUDIO_BYTES = 10 * 1024 * 1024 // 10 MB — a few minutes of compressed audio at most

// POST /api/suta/speech-to-text — Transcribe a voice message for SUTA
export async function POST(req: NextRequest) {
  try {
    const auth = await resolveRequestUser(req)
    if (!auth?.userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { allowed } = checkRateLimit('suta-stt', auth.userId, { maxRequests: 20, windowMs: 60_000 })
    if (!allowed) {
      return NextResponse.json({ error: 'Trop de requêtes. Réessayez dans une minute.' }, { status: 429 })
    }

    const contentType = req.headers.get('content-type') || 'audio/webm;codecs=opus'
    const arrayBuffer = await req.arrayBuffer()

    if (arrayBuffer.byteLength === 0) {
      return NextResponse.json({ error: 'Aucun audio reçu' }, { status: 400 })
    }
    if (arrayBuffer.byteLength > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: 'Enregistrement trop long' }, { status: 413 })
    }

    const text = await speechToText(Buffer.from(arrayBuffer), contentType)
    return NextResponse.json({ text })
  } catch (error) {
    console.error('[SUTA STT Error]', error)
    const message = error instanceof Error ? error.message : 'Erreur lors de la transcription'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
