import 'server-only'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getUserProfileById } from '@/lib/supabase/email-auth'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server'

/**
 * Re-verify the current user's password for a sensitive action (role switch,
 * account deletion...). Supports both auth sources used across the app:
 * Supabase Auth (sign-in check) and the legacy bcrypt password_hash column.
 */
export async function verifyCurrentPassword(
  req: NextRequest,
  userId: string,
  authSource: 'supabase' | 'session' | null,
  password: string
): Promise<boolean> {
  if (!password) return false

  const admin = getSupabaseAdminClient()

  if (authSource === 'supabase') {
    const profile = await getUserProfileById(admin, userId)
    if (!profile) return false

    const { supabase } = createRouteHandlerSupabaseClient(req)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password,
    })
    return !error && !!data.user
  }

  const { data: user } = await admin
    .from('users')
    .select('password_hash')
    .eq('id', userId)
    .single()

  if (!user?.password_hash) return false
  return bcrypt.compare(password, user.password_hash)
}
