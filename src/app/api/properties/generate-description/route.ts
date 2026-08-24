import { NextRequest, NextResponse } from 'next/server'
import { resolveRequestUser } from '@/lib/auth/request-user'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limiter'
import { callAzureOpenAI } from '@/lib/azure-openai'

const TYPE_LABELS: Record<string, string> = {
  APPARTEMENT: 'appartement',
  MAISON: 'maison',
  STUDIO: 'studio',
  CHAMBRE: 'chambre',
  DUPLEX: 'duplex',
  PENTHOUSE: 'penthouse',
  VILLA: 'villa',
  CONCESSION: 'concession',
  IMMEUBLE: 'immeuble',
}

const SYSTEM_PROMPT = `Tu rédiges des descriptions d'annonces immobilières pour Mon Toit, une plateforme de location en Côte d'Ivoire.
Règles :
- Réponds UNIQUEMENT avec le texte de la description, sans titre ni guillemets ni markdown
- 3 à 5 phrases, ton chaleureux et professionnel, en français
- Mets en valeur uniquement les caractéristiques fournies, n'invente jamais un équipement ou un détail non mentionné
- N'invente jamais d'adresse précise ni de nom de résidence
- Termine par une phrase d'accroche invitant à candidater ou à visiter`

// POST /api/properties/generate-description — Draft a property description with AI
export async function POST(req: NextRequest) {
  try {
    const { userId, applyCookies } = await resolveRequestUser(req)
    if (!userId) {
      const resp = NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
      return applyCookies(resp)
    }

    const supabase = getSupabaseAdminClient()
    const { data: profile } = await supabase
      .from('users')
      .select('role, active_role')
      .eq('id', userId)
      .single()

    const effectiveRole = profile?.active_role || profile?.role
    if (effectiveRole !== 'PROPRIETAIRE' && effectiveRole !== 'AGENCE') {
      const resp = NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
      return applyCookies(resp)
    }

    const { allowed } = checkRateLimit('generate-description', userId, { maxRequests: 15, windowMs: 60_000 })
    if (!allowed) {
      const resp = NextResponse.json({ error: 'Trop de requêtes. Réessayez dans une minute.' }, { status: 429 })
      return applyCookies(resp)
    }

    const body = await req.json()
    const {
      title, type, area, bedrooms, bathrooms, city, commune,
      isFurnished, hasParking, hasGarden, hasPool, hasBalcony, hasTerrace, hasKitchen,
    } = body as {
      title?: string
      type?: string
      area?: number | string
      bedrooms?: number | string
      bathrooms?: number | string
      city?: string
      commune?: string
      isFurnished?: boolean
      hasParking?: boolean
      hasGarden?: boolean
      hasPool?: boolean
      hasBalcony?: boolean
      hasTerrace?: boolean
      hasKitchen?: boolean
    }

    if (!type) {
      const resp = NextResponse.json({ error: 'Le type de bien est requis' }, { status: 400 })
      return applyCookies(resp)
    }

    const amenities: string[] = []
    if (isFurnished) amenities.push('meublé')
    if (hasParking) amenities.push('place de parking')
    if (hasGarden) amenities.push('jardin')
    if (hasPool) amenities.push('piscine')
    if (hasBalcony) amenities.push('balcon')
    if (hasTerrace) amenities.push('terrasse')
    if (hasKitchen) amenities.push('cuisine équipée')

    const facts = [
      title ? `Titre proposé : ${title}` : null,
      `Type de bien : ${TYPE_LABELS[type] || type}`,
      area ? `Surface : ${area} m²` : null,
      bedrooms ? `Nombre de pièces : ${bedrooms}` : null,
      bathrooms ? `Salle(s) de bain : ${bathrooms}` : null,
      commune || city ? `Localisation : ${[commune, city].filter(Boolean).join(', ')}` : null,
      amenities.length > 0 ? `Équipements : ${amenities.join(', ')}` : null,
    ].filter(Boolean).join('\n')

    const completion = await callAzureOpenAI([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Rédige la description pour ce bien :\n${facts}` },
    ], { maxTokens: 300, temperature: 0.8 })

    const description = completion.choices?.[0]?.message?.content?.trim()
    if (!description) {
      const resp = NextResponse.json({ error: 'Impossible de générer une description pour le moment' }, { status: 502 })
      return applyCookies(resp)
    }

    const resp = NextResponse.json({ description })
    return applyCookies(resp)
  } catch (error) {
    console.error('Generate description error:', error)
    const message = error instanceof Error && error.message.includes('non configuré')
      ? 'La génération par IA n\'est pas configurée pour le moment'
      : 'Erreur serveur'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
