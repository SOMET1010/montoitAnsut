import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { resolveRequestUser } from '@/lib/auth/request-user'

// DELETE /api/search-alerts/[id] — Remove a saved search
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, applyCookies } = await resolveRequestUser(req)
    if (!userId) {
      const resp = NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
      return applyCookies(resp)
    }

    const { id } = await params
    const supabase = getSupabaseAdminClient()

    const { data } = await supabase
      .from('search_alerts' as any)
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle()
    const alert = data as any

    if (!alert) {
      const resp = NextResponse.json({ error: 'Recherche introuvable' }, { status: 404 })
      return applyCookies(resp)
    }

    if (alert.user_id !== userId) {
      const resp = NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
      return applyCookies(resp)
    }

    await supabase.from('search_alerts' as any).delete().eq('id', id)

    const resp = NextResponse.json({ success: true })
    return applyCookies(resp)
  } catch (error) {
    console.error('Search alerts DELETE error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
