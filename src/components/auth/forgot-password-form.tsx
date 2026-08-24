'use client'

import { useState, useEffect, useCallback } from 'react'
import { Mail, ArrowLeft, Send, RotateCcw, Check, Eye, EyeOff, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/lib/auth-store'
import { apiFetch } from '@/lib/capacitor'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

type Step = 'request' | 'verify' | 'reset'

const passwordRules = [
  { label: 'Au moins 8 caractères', test: (p: string) => p.length >= 8 },
  { label: 'Une majuscule', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Une minuscule', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Un chiffre', test: (p: string) => /[0-9]/.test(p) },
]

const RESEND_COOLDOWN = 60

const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -60 : 60, opacity: 0 }),
}

export function ForgotPasswordForm() {
  const { isLoading, setView } = useAuthStore()

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [step, setStep] = useState<Step>('request')
  const [direction, setDirection] = useState(1)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [isResending, setIsResending] = useState(false)

  const passwordStrength = passwordRules.filter((r) => r.test(newPassword)).length
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const goToStep = (s: Step, dir: number) => {
    setDirection(dir)
    setStep(s)
  }

  // ─── Step 1: Request reset ────────────────────────────────────────────
  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const identifier = email.trim()
    if (!identifier) {
      setError('Veuillez entrer votre email')
      return
    }

    setSubmitting(true)
    try {
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, method: 'email' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')

      // Start cooldown for resend
      setCooldown(RESEND_COOLDOWN)
      toast.success('Code de réinitialisation envoyé !')
      goToStep('verify', 1)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Step 2: Verify OTP ───────────────────────────────────────────────
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!code.trim() || code.length < 6) {
      setError('Veuillez entrer le code complet à 6 chiffres')
      return
    }

    // Verify the code against the API before moving to reset step
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/auth/verify-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
          purpose: 'password_reset',
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Code invalide')
      }

      if (data.valid) {
        toast.success('Code vérifié ! Créez votre nouveau mot de passe.')
        goToStep('reset', 1)
      } else {
        setError('Code invalide ou expiré')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Code invalide')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || isResending) return
    setIsResending(true)
    try {
      const res = await apiFetch('/api/auth/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), purpose: 'password_reset' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')

      setCooldown(RESEND_COOLDOWN)
      toast.success('Nouveau code envoyé !')
    } catch {
      toast.error('Erreur lors du renvoi')
    } finally {
      setIsResending(false)
    }
  }, [cooldown, isResending, email])

  // ─── Step 3: Reset password ───────────────────────────────────────────
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (passwordStrength < 4) {
      setError('Le mot de passe ne respecte pas les critères requis')
      return
    }
    if (!passwordsMatch) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    setSubmitting(true)
    try {
      const res = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
          newPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')

      toast.success('Votre mot de passe a été réinitialisé avec succès, veuillez vous connecter.')
      setView('login')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  const formatCooldown = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const stepIndicator = (
    <div className="flex items-center justify-center gap-3 mt-4">
      {(['request', 'verify', 'reset'] as Step[]).map((s, i) => {
        const stepIndex = { request: 0, verify: 1, reset: 2 }[s]
        const currentIndex = { request: 0, verify: 1, reset: 2 }[step]
        const labels = ['Identification', 'Vérification', 'Nouveau mot de passe']
        const isCompleted = stepIndex < currentIndex
        const isCurrent = stepIndex === currentIndex

        return (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && (
              <div className={`h-0.5 w-6 rounded-full transition-colors ${isCompleted || isCurrent ? 'bg-emerald-500' : 'bg-neutral-200'}`} />
            )}
            <div className="flex items-center gap-1.5">
              <div className={`flex items-center justify-center size-6 rounded-full text-xs font-bold transition-colors ${
                isCurrent ? 'bg-brand-500 text-white'
                  : isCompleted ? 'bg-emerald-500 text-white'
                    : 'bg-neutral-200 text-neutral-400'
              }`}>
                {isCompleted ? <Check className="size-3.5" /> : i + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:inline ${
                isCurrent ? 'text-brand-500' : isCompleted ? 'text-emerald-500' : 'text-neutral-400'
              }`}>
                {labels[i]}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )

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
            <CardTitle className="text-2xl font-bold text-foreground">Mot de passe oublié</CardTitle>
            <CardDescription className="text-muted-foreground">
              {step === 'request' && 'Entrez votre email pour recevoir un code de réinitialisation'}
              {step === 'verify' && 'Entrez le code de vérification reçu'}
              {step === 'reset' && 'Créez votre nouveau mot de passe'}
            </CardDescription>
            {stepIndicator}
          </CardHeader>

          <CardContent>
            <AnimatePresence mode="wait" custom={direction}>
              {/* ────── Step 1: Request reset ────── */}
              {step === 'request' && (
                <motion.div
                  key="request"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                  <form onSubmit={handleRequest} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="fp-email">Adresse email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
                        <Input
                          id="fp-email"
                          type="email"
                          placeholder="votre@email.ci"
                          value={email}
                          onChange={(e) => { setError(''); setEmail(e.target.value) }}
                          className="h-11 pl-9"
                          disabled={submitting}
                          required
                          autoFocus
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground text-base font-semibold"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <span className="flex items-center gap-2">
                          <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Envoi en cours...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Send className="size-4" />
                          Envoyer le code
                        </span>
                      )}
                    </Button>
                    {error && (
                      <p className="text-sm text-red-500 text-center">{error}</p>
                    )}
                  </form>
                </motion.div>
              )}

              {/* ────── Step 2: Verify OTP ────── */}
              {step === 'verify' && (
                <motion.div
                  key="verify"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                  <form onSubmit={handleVerify} className="space-y-4">
                    <div className="rounded-lg bg-brand-50 border border-brand-100 p-3 mb-2">
                      <p className="text-xs text-muted-foreground">
                        Code envoyé à <span className="font-semibold text-foreground">{email}</span>
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="fp-code">Code de vérification</Label>
                      <Input
                        id="fp-code"
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
                        disabled={submitting}
                        autoFocus
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground text-base font-semibold"
                      disabled={submitting || code.length < 6}
                    >
                      {submitting ? (
                        <span className="flex items-center gap-2">
                          <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Vérification...
                        </span>
                      ) : (
                        'Vérifier le code'
                      )}
                    </Button>
                    {error && (
                      <p className="text-sm text-red-500 text-center">{error}</p>
                    )}

                    {/* Resend */}
                    <div className="flex items-center justify-center">
                      <button
                        type="button"
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
                      type="button"
                      onClick={() => goToStep('request', -1)}
                      className="w-full flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="size-3.5" />
                      Retour
                    </button>
                  </form>
                </motion.div>
              )}

              {/* ────── Step 3: Reset password ────── */}
              {step === 'reset' && (
                <motion.div
                  key="reset"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                  <form onSubmit={handleReset} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="fp-new-password">Nouveau mot de passe</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
                        <Input
                          id="fp-new-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={newPassword}
                          onChange={(e) => { setError(''); setNewPassword(e.target.value) }}
                          className="h-11 pl-9 pr-10"
                          disabled={submitting}
                          required
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-muted-foreground"
                          aria-label={showPassword ? 'Masquer' : 'Afficher'}
                        >
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                      {newPassword && (
                        <div className="space-y-1.5">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4].map((level) => (
                              <div
                                key={level}
                                className={`h-1 flex-1 rounded-full transition-colors ${
                                  passwordStrength >= level
                                    ? passwordStrength <= 1 ? 'bg-red-400'
                                      : passwordStrength <= 2 ? 'bg-amber-400'
                                      : passwordStrength <= 3 ? 'bg-yellow-400'
                                      : 'bg-emerald-500'
                                    : 'bg-neutral-200'
                                }`}
                              />
                            ))}
                          </div>
                          <ul className="space-y-0.5">
                            {passwordRules.map((rule) => (
                              <li
                                key={rule.label}
                                className={`flex items-center gap-1.5 text-xs transition-colors ${
                                  rule.test(newPassword) ? 'text-emerald-600' : 'text-neutral-400'
                                }`}
                              >
                                <Check className={`size-3 ${rule.test(newPassword) ? 'opacity-100' : 'opacity-0'}`} />
                                {rule.label}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="fp-confirm-password">Confirmer le mot de passe</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
                        <Input
                          id="fp-confirm-password"
                          type={showConfirm ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className={`h-11 pl-9 pr-10 ${
                            confirmPassword && !passwordsMatch
                              ? 'border-red-300 focus-visible:border-red-500 focus-visible:ring-red-500/30'
                              : confirmPassword && passwordsMatch
                                ? 'border-emerald-300 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30'
                                : ''
                          }`}
                          disabled={submitting}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm(!showConfirm)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-muted-foreground"
                          aria-label={showConfirm ? 'Masquer' : 'Afficher'}
                        >
                          {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                      {confirmPassword && !passwordsMatch && (
                        <p className="text-xs text-red-500">Les mots de passe ne correspondent pas</p>
                      )}
                      {confirmPassword && passwordsMatch && (
                        <p className="text-xs text-emerald-600">Les mots de passe correspondent</p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground text-base font-semibold"
                      disabled={submitting || !passwordsMatch || passwordStrength < 4}
                    >
                      {submitting ? (
                        <span className="flex items-center gap-2">
                          <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Réinitialisation...
                        </span>
                      ) : (
                        'Réinitialiser le mot de passe'
                      )}
                    </Button>
                    {error && (
                      <p className="text-sm text-red-500 text-center">{error}</p>
                    )}

                    <button
                      type="button"
                      onClick={() => goToStep('verify', -1)}
                      className="w-full flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="size-3.5" />
                      Retour
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Back to login — always visible */}
            <button
              onClick={() => setView('login')}
              className="w-full flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground mt-4"
            >
              <ArrowLeft className="size-3.5" />
              Retour à la connexion
            </button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
