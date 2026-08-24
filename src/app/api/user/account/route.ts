import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { resolveRequestUser } from '@/lib/auth/request-user'
import { verifyCurrentPassword } from '@/lib/auth/verify-password'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'

/**
 * DELETE /api/user/account — Self-service account deletion.
 *
 * Deletion is blocked while the user has an active lease (as tenant or
 * owner) — financial and legal records tied to leases must be retained,
 * mirroring the guard used elsewhere in the app. The account is
 * deactivated rather than hard-deleted: personal data is cleared, but
 * historical records (leases, payments, audit trail) referencing the
 * user id are preserved for compliance.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { userId, authSource, applyCookies } = await resolveRequestUser(req)
    if (!userId) {
      const resp = NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
      return applyCookies(resp)
    }

    const { password } = await req.json().catch(() => ({ password: undefined }))
    if (!password) {
      const resp = NextResponse.json({ error: 'Mot de passe requis pour confirmer la suppression' }, { status: 400 })
      return applyCookies(resp)
    }

    const passwordValid = await verifyCurrentPassword(req, userId, authSource, password)
    if (!passwordValid) {
      const resp = NextResponse.json({ error: 'Mot de passe incorrect' }, { status: 400 })
      return applyCookies(resp)
    }

    const admin = getSupabaseAdminClient()

    const { data: activeLeases } = await admin
      .from('leases')
      .select('id')
      .or(`tenant_id.eq.${userId},owner_id.eq.${userId}`)
      .in('status', ['ACTIVE', 'PENDING_SIGNATURE'])
      .limit(1)

    if (activeLeases && activeLeases.length > 0) {
      const resp = NextResponse.json(
        { error: 'Impossible de supprimer votre compte : vous avez un bail actif ou en attente de signature. Résiliez-le d\'abord.' },
        { status: 400 }
      )
      return applyCookies(resp)
    }

    const anonymizedEmail = `deleted-${userId}@deleted.montoit.local`

    const { error: updateError } = await admin
      .from('users')
      .update({
        is_active: false,
        first_name: 'Utilisateur',
        last_name: 'supprimé',
        email: anonymizedEmail,
        phone: null,
        avatar_url: null,
        address: null,
      } as any)
      .eq('id', userId)

    if (updateError) throw updateError

    if (authSource === 'supabase') {
      await admin.auth.admin.updateUserById(userId, { email: anonymizedEmail, password: crypto.randomUUID() })
      const { supabase } = createRouteHandlerSupabaseClient(req)
      await supabase.auth.signOut().catch(() => {})
    }

    await admin.from('sessions').delete().eq('user_id', userId)

    await admin.from('audit_logs').insert({
      action: 'ACCOUNT_SELF_DELETED',
      entity: 'User',
      entity_id: userId,
      user_id: userId,
    })

    const resp = NextResponse.json({ message: 'Compte supprimé' })
    resp.cookies.set('montoit-session', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0, path: '/' })
    resp.cookies.set('montoit-user-id', '', { maxAge: 0, path: '/' })
    return applyCookies(resp)
  } catch (error) {
    console.error('Account deletion error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
