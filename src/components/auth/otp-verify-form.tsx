'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, RotateCcw, Phone, Mail, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useAuthStore, type OtpPurpose } from '@/lib/auth-store'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import Image from 'next/image'

const RESEND_COOLDOWN = 60 // seconds

export function OtpVerifyForm() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN)
  const [isResending, setIsResending] = useState(false)
  const [copied, setCopied] = useState(false)
  const {
    verifySmsOtp,
    sendEmailOtp,
    verifyEmailOtp,
    pendingPhone,
    pendingEmail,
    otpPurpose,
    isLoading,
    devCode,
    setView,
    loginWithSms,
    authMethod,
  } = useAuthStore()

  // Determine the channel (SMS vs Email) based on context
  const isEmailOtp = otpPurpose === 'email_verify' || otpPurpose === 'password_reset'
  const targetLabel = isEmailOtp ? pendingEmail : pendingPhone

  const purposeLabels: Record<OtpPurpose, string> = {
    login: 'connexion',
    email_verify: 'vérification d\'email',
    password_reset: 'réinitialisation',
    phone_verify: 'vérification téléphone',
  }

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const doVerify = useCallback(async (otpCode: string) => {
    setError('')
    try {
      if (isEmailOtp) {
        const result = await verifyEmailOtp(pendingEmail, otpCode, otpPurpose)

        if (otpPurpose === 'password_reset' && result?.valid) {
          setView('forgot-password')
          return
        }

        if (result?.needsRegistration) {
          toast.success('Email vérifié ! Complétez votre inscription.')
          return
        }

        toast.success('Email vérifié avec succès !')
      } else {
        await verifySmsOtp(pendingPhone, otpCode)
        toast.success('Connexion réussie !')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Code invalide')
      // Important : vider le code pour casser la boucle d'auto-submit du useEffect.
      // Sans ça, code.length=6 + isLoading=false re-déclenche doVerify avec le même mauvais code.
      setCode('')
    }
  }, [isEmailOtp, pendingEmail, otpPurpose, pendingPhone, verifyEmailOtp, verifySmsOtp, setView])

  // Auto-submit when all 6 digits are entered
  useEffect(() => {
    if (code.length === 6 && !isLoading) {
      doVerify(code.trim())
    }
  }, [code, isLoading, doVerify])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim() || code.length < 6) {
      setError('Veuillez entrer le code complet à 6 chiffres')
      return
    }
    await doVerify(code.trim())
  }

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || isResending) return
    setError('')
    setIsResending(true)
    try {
      if (isEmailOtp) {
        await sendEmailOtp(pendingEmail, otpPurpose)
        toast.success('Nouveau code envoyé par email !')
      } else {
        await loginWithSms(pendingPhone)
        toast.success('Nouveau code OTP envoyé par SMS !')
      }
      setCooldown(RESEND_COOLDOWN)
    } catch (error) {
      setError('Erreur lors du renvoi')
    } finally {
      setIsResending(false)
    }
  }, [cooldown, isResending, isEmailOtp, pendingEmail, otpPurpose, sendEmailOtp, pendingPhone, loginWithSms])

  const handleCopyDevCode = () => {
    navigator.clipboard.writeText(devCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatCooldown = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const channelIcon = isEmailOtp ? (
    <Mail className="size-3.5 text-brand-500" />
  ) : (
    <Phone className="size-3.5 text-brand-500" />
  )

  const channelLabel = isEmailOtp ? 'Envoyé par email' : 'Envoyé par SMS'

  // Logo is now used in CardHeader instead of headerIcon

  const titleMap: Record<OtpPurpose, string> = {
    login: 'Vérification SMS',
    email_verify: 'Vérification Email',
    password_reset: 'Réinitialisation',
    phone_verify: 'Vérification téléphone',
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8 sm:py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <Card className="border-border shadow-base">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4">
              <Image
                src="/favicon-96x96.png"
                alt="Mon Toit"
                width={56}
                height={56}
                className="shrink-0 mx-auto"
                priority
              />
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">{titleMap[otpPurpose]}</CardTitle>
            <CardDescription className="text-muted-foreground">
              Entrez le code de {purposeLabels[otpPurpose]} envoyé à{' '}
              <span className="font-semibold text-foreground">{targetLabel}</span>
            </CardDescription>
            <div className="flex items-center justify-center gap-1.5 mt-2">
              {channelIcon}
              <span className="text-xs text-brand-500 font-medium">{channelLabel}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp-code">Code de vérification</Label>
                <Input
                  id="otp-code"
                  type="text"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                    setCode(val)
                    setError('')
                  }}
                  className="h-14 text-center text-2xl tracking-[0.5em] font-mono"
                  maxLength={6}
                  disabled={isLoading}
                  autoFocus
                />
                {error && (
                  <p className="text-sm text-red-500 text-center mt-2">{error}</p>
                )}
              </div>

              {/* Dev mode: show dev code */}
              {devCode && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-medium text-amber-700 mb-1.5">🔧 Mode développement</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-mono font-bold text-amber-900 tracking-wider">{devCode}</span>
                    <button
                      type="button"
                      onClick={handleCopyDevCode}
                      className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 transition-colors"
                    >
                      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {copied ? 'Copié' : 'Copier'}
                    </button>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground text-base font-semibold"
                disabled={isLoading || code.length < 6}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Vérification...
                  </span>
                ) : (
                  'Vérifier'
                )}
              </Button>
            </form>

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleResend}
                disabled={cooldown > 0 || isResending}
                className={`flex items-center gap-1.5 text-sm transition-colors ${
                  cooldown > 0 || isResending
                    ? 'text-neutral-400 cursor-not-allowed'
                    : 'text-brand-600 hover:text-brand-700'
                }`}
              >
                <RotateCcw className={`size-3.5 ${isResending ? 'animate-spin' : ''}`} />
                {cooldown > 0
                  ? `Renvoyer dans ${formatCooldown(cooldown)}`
                  : isResending
                    ? 'Envoi en cours...'
                    : 'Renvoyer le code'
                }
              </button>
            </div>

            <button
              onClick={() => {
                if (otpPurpose === 'password_reset') {
                  setView('forgot-password')
                } else {
                  setView('login')
                }
              }}
              className="w-full flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              {isEmailOtp ? 'Changer l\'email' : 'Modifier le numéro'}
            </button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
