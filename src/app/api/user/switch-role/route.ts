import { NextRequest, NextResponse } from 'next/server'
import { resolveRequestUser } from '@/lib/auth/request-user'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getUserProfileById } from '@/lib/supabase/email-auth'
import { verifyCurrentPassword } from '@/lib/auth/verify-password'

export async function POST(req: NextRequest) {
  try {
    const { userId, authSource, applyCookies } = await resolveRequestUser(req)
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { role, password } = await req.json()
    const validRoles = ['LOCATAIRE', 'PROPRIETAIRE', 'AGENCE']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
    }

    const admin = getSupabaseAdminClient()
    const user = await getUserProfileById(admin, userId)
    if (!user) {
      const response = NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
      return applyCookies(response)
    }

    // Switching active role changes what a user can access/do on the
    // platform — re-verify the password before applying it, same as any
    // other sensitive account action.
    if (role !== user.active_role) {
      const passwordValid = await verifyCurrentPassword(req, userId, authSource, password)
      if (!passwordValid) {
        const response = NextResponse.json({ error: 'Mot de passe incorrect' }, { status: 400 })
        return applyCookies(response)
      }
    }

    // Les rôles ADMIN et TIERS_CONFIANCE ne sont pas commutables
    if (role === 'ADMIN' || role === 'TIERS_CONFIANCE') {
      const response = NextResponse.json({ error: 'Ce rôle ne peut pas être activé' }, { status: 403 })
      return applyCookies(response)
    }

    // Seuls le rôle de base et PROPRIETAIRE/LOCATAIRE sont autorisés comme cibles
    // (un LOCATAIRE peut devenir PROPRIETAIRE et inversement)
    if (role !== user.role && role !== 'LOCATAIRE' && role !== 'PROPRIETAIRE') {
      const response = NextResponse.json(
        { error: 'Changement de rôle non autorisé' },
        { status: 403 }
      )
      return applyCookies(response)
    }

    const { data: updatedUser, error } = await admin
      .from('users')
      .update({ active_role: role })
      .eq('id', userId)
      .select('active_role')
      .single()

    if (error || !updatedUser) {
      throw error || new Error('Impossible de changer le rôle actif')
    }

    const response = NextResponse.json({
      success: true,
      activeRole: updatedUser.active_role,
    })
    return applyCookies(response)
  } catch (error) {
    console.error('Switch role error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
