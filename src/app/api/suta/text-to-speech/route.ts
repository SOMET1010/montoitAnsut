import { NextRequest, NextResponse } from 'next/server'
import { resolveRequestUser } from '@/lib/auth/request-user'
import { checkRateLimit } from '@/lib/rate-limiter'
import { textToSpeech } from '@/lib/azure-speech'

const MAX_TEXT_LENGTH = 2000

// POST /api/suta/text-to-speech — Synthesize a SUTA reply as speech
export async function POST(req: NextRequest) {
  try {
    const auth = await resolveRequestUser(req)
    if (!auth?.userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { allowed } = checkRateLimit('suta-tts', auth.userId, { maxRequests: 20, windowMs: 60_000 })
    if (!allowed) {
      return NextResponse.json({ error: 'Trop de requêtes. Réessayez dans une minute.' }, { status: 429 })
    }

    const { text } = await req.json()
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Texte requis' }, { status: 400 })
    }

    const audio = await textToSpeech(text.slice(0, MAX_TEXT_LENGTH))
    return new NextResponse(new Uint8Array(audio), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[SUTA TTS Error]', error)
    const message = error instanceof Error ? error.message : 'Erreur lors de la synthèse vocale'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
