import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { resolveRequestUser } from '@/lib/auth/request-user'

function generateId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

// GET /api/search-alerts — List the current user's saved searches
export async function GET(req: NextRequest) {
  try {
    const { userId, applyCookies } = await resolveRequestUser(req)
    if (!userId) {
      const resp = NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
      return applyCookies(resp)
    }

    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from('search_alerts' as any)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    const resp = NextResponse.json({
      data: (data ?? []).map((a: any) => ({
        id: a.id,
        name: a.name,
        isActive: a.is_active,
        city: a.city,
        propertyType: a.property_type,
        minPrice: a.min_price,
        maxPrice: a.max_price,
        searchQuery: a.search_query,
        createdAt: a.created_at,
      })),
    })
    return applyCookies(resp)
  } catch (error) {
    console.error('Search alerts GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/search-alerts — Save the current search as an alert
export async function POST(req: NextRequest) {
  try {
    const { userId, applyCookies } = await resolveRequestUser(req)
    if (!userId) {
      const resp = NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
      return applyCookies(resp)
    }

    const body = await req.json()
    const { name, city, propertyType, minPrice, maxPrice, searchQuery } = body as {
      name?: string
      city?: string
      propertyType?: string
      minPrice?: number | string
      maxPrice?: number | string
      searchQuery?: string
    }

    if (!name || !name.trim()) {
      const resp = NextResponse.json({ error: 'Un nom est requis pour enregistrer la recherche' }, { status: 400 })
      return applyCookies(resp)
    }

    const supabase = getSupabaseAdminClient()

    const { count } = await supabase
      .from('search_alerts' as any)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    if ((count ?? 0) >= 20) {
      const resp = NextResponse.json({ error: 'Vous avez atteint la limite de 20 recherches enregistrées' }, { status: 400 })
      return applyCookies(resp)
    }

    const { data, error } = await supabase
      .from('search_alerts' as any)
      .insert({
        id: generateId(),
        user_id: userId,
        name: name.trim(),
        city: city || null,
        property_type: propertyType && propertyType !== 'ALL' ? propertyType : null,
        min_price: minPrice ? Number(minPrice) : null,
        max_price: maxPrice ? Number(maxPrice) : null,
        search_query: searchQuery || null,
      } as any)
      .select()
      .single()

    if (error) throw error
    const created = data as any

    const resp = NextResponse.json({
      data: {
        id: created.id,
        name: created.name,
        isActive: created.is_active,
        city: created.city,
        propertyType: created.property_type,
        minPrice: created.min_price,
        maxPrice: created.max_price,
        searchQuery: created.search_query,
        createdAt: created.created_at,
      },
    })
    return applyCookies(resp)
  } catch (error) {
    console.error('Search alerts POST error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
