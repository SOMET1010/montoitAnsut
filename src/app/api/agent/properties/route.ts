import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { resolveRequestUser } from '@/lib/auth/request-user'
import { checkRateLimit } from '@/lib/rate-limiter'
import { propertySearchSchema, searchActiveProperties } from '@/lib/agent/property-search'

export async function POST(req: NextRequest) {
  try {
    const { userId, applyCookies } = await resolveRequestUser(req)
    if (!userId) return applyCookies(NextResponse.json({ error: 'Non authentifié' }, { status: 401 }))
    const { allowed } = checkRateLimit('agent-properties', userId, { maxRequests: 20, windowMs: 60_000 })
    if (!allowed) return applyCookies(NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 }))
    const raw = await req.json()
    const parsed = propertySearchSchema.safeParse(raw)
    if (!parsed.success) return applyCookies(NextResponse.json({ error: 'Filtres invalides' }, { status: 400 }))
    const properties = await searchActiveProperties(parsed.data, getSupabaseAdminClient())
    return applyCookies(NextResponse.json({ properties }))
  } catch {
    return NextResponse.json({ error: 'Recherche indisponible' }, { status: 500 })
  }
}
