import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { generateOtpCode, sendOtpEmail, sendOtpSms, normalizePhone } from '@/lib/ansut-messaging'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  createEmailOtp,
  getUserProfileByEmail,
  invalidateEmailOtps,
  normalizeEmail,
  SUPABASE_PASSWORD_PLACEHOLDER,
} from '@/lib/supabase/email-auth'
import { toAuthUser } from '@/lib/supabase/profile'
import type { UserRole } from '@/lib/supabase/types'

// Only these roles can be self-selected at registration. ADMIN and
// TIERS_CONFIANCE are privileged roles created exclusively by an existing
// admin — accepting them here would let anyone escalate privileges by
// simply posting a different `role` value.
const SELF_REGISTERABLE_ROLES: UserRole[] = ['LOCATAIRE', 'PROPRIETAIRE', 'AGENCE']

function resolveRegistrationRole(requestedRole: unknown): UserRole | null {
  if (!requestedRole) return 'LOCATAIRE'
  if (typeof requestedRole !== 'string' || !SELF_REGISTERABLE_ROLES.includes(requestedRole as UserRole)) {
    return null
  }
  return requestedRole as UserRole
}

export async function POST(req: NextRequest) {
  try {
    const { email, password, firstName, lastName, phone, role: requestedRole, method } = await req.json()

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: 'Prénom et nom sont requis' },
        { status: 400 }
      )
    }

    const role = resolveRegistrationRole(requestedRole)
    if (role === null) {
      return NextResponse.json(
        { error: 'Rôle invalide' },
        { status: 400 }
      )
    }

    if (method === 'email') {
      if (!email || !password) {
        return NextResponse.json(
          { error: 'Email et mot de passe sont requis' },
          { status: 400 }
        )
      }

      if (
        password.length < 8
        || !/[A-Z]/.test(password)
        || !/[a-z]/.test(password)
        || !/[0-9]/.test(password)
      ) {
        return NextResponse.json(
          { error: 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule et un chiffre' },
          { status: 400 }
        )
      }

      const admin = getSupabaseAdminClient()
      const normalized = normalizeEmail(email)
      const existingEmail = await getUserProfileByEmail(admin, normalized)

      if (existingEmail) {
        return NextResponse.json(
          { error: 'Un compte existe déjà avec cet email. Essayez de vous connecter.' },
          { status: 400 }
        )
      }

      if (phone) {
        const { data: existingPhone, error: phoneError } = await admin
          .from('users')
          .select('id')
          .eq('phone', phone)
          .maybeSingle()

        if (phoneError) {
          throw phoneError
        }

        if (existingPhone) {
          return NextResponse.json(
            { error: 'Ce numéro est déjà utilisé.' },
            { status: 400 }
          )
        }
      }

      let userPayload: any = existingEmail

      if (!userPayload) {
        const { data: authUserData, error: authError } = await admin.auth.admin.createUser({
          email: normalized,
          password,
          email_confirm: true,
          user_metadata: {
            firstName,
            lastName,
          },
        })

        if (authError || !authUserData.user) {
          return NextResponse.json(
            { error: authError?.message || 'Impossible de créer le compte Supabase' },
            { status: 400 }
          )
        }

        const { data: insertedProfile, error: insertError } = await admin
          .from('users')
          .insert({
            id: authUserData.user.id,
            email: normalized,
            phone: phone || null,
            password_hash: SUPABASE_PASSWORD_PLACEHOLDER,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            role: role || 'LOCATAIRE',
            active_role: role || 'LOCATAIRE',
            is_active: true,
            is_email_verified: false,
            is_phone_verified: false,
          })
          .select()
          .single()

        if (insertError || !insertedProfile) {
          await admin.auth.admin.deleteUser(authUserData.user.id).catch(() => {})
          throw insertError || new Error('Impossible de créer le profil applicatif')
        }

        userPayload = insertedProfile
      }

      await invalidateEmailOtps(admin, normalized, 'EMAIL_VERIFY')

      const otpCode = generateOtpCode(6)
      await createEmailOtp(admin, {
        email: normalized,
        code: otpCode,
        type: 'EMAIL_VERIFY',
        userId: userPayload.id,
      })

      const emailResult = await sendOtpEmail(normalized, otpCode, userPayload.first_name, 'email_verify')
      if (!emailResult.success) {
        console.warn(`[Register] Email send failed for ${normalized}, but OTP stored. Code: ${otpCode}`)
      }

      const isDev = process.env.NODE_ENV !== 'production'
      return NextResponse.json({
        user: toAuthUser(userPayload),
        needsVerification: true,
        verificationMethod: 'email',
        ...(isDev && { devCode: otpCode }),
      })
    }

    if (method === 'sms') {
      if (!phone) {
        return NextResponse.json(
          { error: 'Numéro de téléphone requis' },
          { status: 400 }
        )
      }

      const normalizedPhone = normalizePhone(phone)
      if (normalizedPhone.length !== 10) {
        return NextResponse.json(
          { error: 'Numéro de téléphone invalide (10 chiffres requis)' },
          { status: 400 }
        )
      }

      const supabase = getSupabaseAdminClient()

      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('phone', normalizedPhone)
        .maybeSingle()

      if (email) {
        const { data: existingEmail } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .maybeSingle()
        if (existingEmail && existingEmail.phone !== normalizedPhone) {
          return NextResponse.json(
            { error: 'Un compte existe déjà avec cet email' },
            { status: 400 }
          )
        }
      }

      let user

      if (existingUser && existingUser.first_name === 'Temp' && existingUser.last_name === 'User') {
        const { data: updated } = await supabase
          .from('users')
          .update({
            first_name: firstName,
            last_name: lastName,
            email: email || existingUser.email,
            role: role || 'LOCATAIRE',
            active_role: role || 'LOCATAIRE',
            is_phone_verified: false,
            is_active: true,
            password_hash: await bcrypt.hash(`sms-${Date.now()}-${Math.random()}`, 12),
          })
          .eq('id', existingUser.id)
          .select()
          .single()
        user = updated
      } else if (existingUser) {
        return NextResponse.json(
          { error: 'Un compte vérifié existe déjà avec ce numéro. Essayez de vous connecter.' },
          { status: 400 }
        )
      } else {
        const { data: created } = await supabase
          .from('users')
          .insert({
            id: crypto.randomUUID(),
            phone: normalizedPhone,
            email: email || `sms-${Date.now()}@montoit.ci`,
            password_hash: await bcrypt.hash(`sms-${Date.now()}-${Math.random()}`, 12),
            first_name: firstName,
            last_name: lastName,
            role: (role || 'LOCATAIRE') as any,
            active_role: (role || 'LOCATAIRE') as any,
            is_phone_verified: false,
            is_active: true,
          } as any)
          .select()
          .single()
        user = created
      }

      const { data: existingOtps } = await supabase
        .from('otp_codes')
        .select('id')
        .eq('phone', normalizedPhone)
        .eq('is_used', false)
        .eq('type', 'LOGIN')

      if (existingOtps) {
        for (const otp of existingOtps) {
          await supabase
            .from('otp_codes')
            .update({ is_used: true })
            .eq('id', otp.id)
        }
      }

      const otpCode = generateOtpCode(6)
      await supabase
        .from('otp_codes')
        .insert({
          id: crypto.randomUUID(),
          phone: normalizedPhone,
          code: otpCode,
          type: 'LOGIN',
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          user_id: user.id,
        })

      const smsResult = await sendOtpSms(normalizedPhone, otpCode, 'login')
      if (!smsResult.success) {
        console.warn(`[Register] SMS send failed for ${phone}, but OTP stored. Code: ${otpCode}`)
      }

      const isDev = process.env.NODE_ENV !== 'production'
      return NextResponse.json({
        user: {
          id: user.id,
          phone: normalizedPhone,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          activeRole: user.active_role,
          avatarUrl: user.avatar_url,
          isActive: user.is_active,
          isEmailVerified: user.is_email_verified,
        },
        needsVerification: true,
        verificationMethod: 'sms',
        ...(isDev && { devCode: otpCode }),
      })
    }

    return NextResponse.json({ error: 'Méthode d\'inscription non supportée' }, { status: 400 })
  } catch (error: any) {
    console.error('Register error:', error)

    if (error?.code === '23505') {
      const details = error?.details || ''
      if (details.includes('email')) {
        return NextResponse.json(
          { error: 'Cet email est déjà utilisé par un autre compte.' },
          { status: 409 }
        )
      }
      if (details.includes('phone')) {
        return NextResponse.json(
          { error: 'Ce numéro est déjà utilisé.' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: 'Une valeur est déjà utilisée par un autre compte.' },
        { status: 409 }
      )
    }

    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
