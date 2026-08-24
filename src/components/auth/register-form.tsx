'use client'

import { useState } from 'react'
import { UserPlus, ArrowLeft, ArrowRight, Mail, Lock, Eye, EyeOff, Phone, Check, MessageSquare, Home, Building2, Landmark } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useAuthStore, type AuthMethod } from '@/lib/auth-store'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

const passwordRules = [
  { label: 'Au moins 8 caractères', test: (p: string) => p.length >= 8 },
  { label: 'Une majuscule', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Une minuscule', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Un chiffre', test: (p: string) => /[0-9]/.test(p) },
]

const roles = [
  {
    value: 'LOCATAIRE',
    label: 'Locataire',
    description: 'Je cherche un logement à louer',
    icon: Home,
  },
  {
    value: 'PROPRIETAIRE',
    label: 'Propriétaire',
    description: 'Je souhaite publier mes biens en location',
    icon: Building2,
  },
  {
    value: 'AGENCE',
    label: 'Agence',
    description: 'Je gère les biens de mes clients et publie des annonces',
    icon: Landmark,
  },
] as const

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -60 : 60,
    opacity: 0,
  }),
}

export function RegisterForm() {
  const { registerWithEmail, registerWithSms, pendingPhone, pendingRole, authMethod: storeMethod, isLoading, setView, setAuthMethod } = useAuthStore()

  const [step, setStep] = useState<1 | 2>(1)
  const [direction, setDirection] = useState(1)
  const [method, setMethod] = useState<AuthMethod>(storeMethod)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState(pendingPhone || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [role, setRole] = useState(pendingRole || '')
  const [acceptTerms, setAcceptTerms] = useState(false)

  const passwordStrength = passwordRules.filter((r) => r.test(password)).length
  const passwordsMatch = password && confirmPassword && password === confirmPassword

  const handleMethodChange = (m: AuthMethod) => {
    setMethod(m)
    setAuthMethod(m)
  }

  // ─── Step 1 validation ─────────────────────────────────────────────────
  const canGoToStep2 = () => {
    if (!firstName.trim() || !lastName.trim()) return false
    if (method === 'email') {
      if (!email.trim()) return false
      if (passwordStrength < 4) return false
      if (!passwordsMatch) return false
    } else {
      if (!phone.trim()) return false
    }
    return true
  }

  const handleGoToStep2 = () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('Veuillez remplir le prénom et le nom')
      return
    }
    if (method === 'email') {
      if (!email.trim()) {
        toast.error('Veuillez entrer votre adresse email')
        return
      }
      if (passwordStrength < 4) {
        toast.error('Le mot de passe ne respecte pas les critères requis')
        return
      }
      if (!passwordsMatch) {
        toast.error('Les mots de passe ne correspondent pas')
        return
      }
    } else {
      if (!phone.trim()) {
        toast.error('Veuillez entrer votre numéro de téléphone')
        return
      }
    }
    setDirection(1)
    setStep(2)
  }

  const handleBackToStep1 = () => {
    setDirection(-1)
    setStep(1)
  }

  // ─── Step 2: Submit ────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!role) {
      toast.error('Veuillez choisir votre profil')
      return
    }
    if (!acceptTerms) {
      toast.error('Veuillez accepter les conditions d\'utilisation')
      return
    }

    try {
      if (method === 'email') {
        await registerWithEmail({
          email: email.trim(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || undefined,
          role,
        })
        toast.success('Compte créé ! Vérifiez votre email pour continuer.')
      } else {
        await registerWithSms({
          phone: phone.trim(),
          email: email.trim() || undefined,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          role,
        })
        toast.success('Compte créé ! Vérifiez votre numéro par SMS pour continuer.')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de l\'inscription')
    }
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
            <CardTitle className="text-2xl font-bold text-foreground">Inscription</CardTitle>
            <CardDescription className="text-muted-foreground">
              Créez votre compte pour rejoindre Mon Toit
            </CardDescription>

            {/* Step indicator */}
            <div className="flex items-center justify-center gap-3 mt-4">
              <div className="flex items-center gap-2">
                <div className={`flex items-center justify-center size-7 rounded-full text-xs font-bold transition-colors ${
                  step === 1 ? 'bg-brand-500 text-white' : 'bg-emerald-500 text-white'
                }`}>
                  {step > 1 ? <Check className="size-4" /> : '1'}
                </div>
                <span className={`text-xs font-medium ${step === 1 ? 'text-brand-500' : 'text-emerald-500'}`}>
                  Informations
                </span>
              </div>
              <div className={`h-0.5 w-8 rounded-full transition-colors ${step > 1 ? 'bg-emerald-500' : 'bg-neutral-200'}`} />
              <div className="flex items-center gap-2">
                <div className={`flex items-center justify-center size-7 rounded-full text-xs font-bold transition-colors ${
                  step === 2 ? 'bg-brand-500 text-white' : 'bg-neutral-200 text-neutral-400'
                }`}>
                  2
                </div>
                <span className={`text-xs font-medium ${step === 2 ? 'text-brand-500' : 'text-neutral-400'}`}>
                  Profil
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <AnimatePresence mode="wait" custom={direction}>
              {step === 1 ? (
                <motion.div
                  key="step1"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="space-y-4"
                >
                  {/* Method toggle */}
                  <div className="flex rounded-lg border border-border p-1 bg-muted">
                    <button
                      type="button"
                      onClick={() => handleMethodChange('email')}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-md py-2.5 text-sm font-medium transition-all ${
                        method === 'email'
                          ? 'bg-background text-brand-500 shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Mail className="size-4" />
                      Email
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMethodChange('sms')}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-md py-2.5 text-sm font-medium transition-all ${
                        method === 'sms'
                          ? 'bg-background text-brand-500 shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <MessageSquare className="size-4" />
                      SMS
                    </button>
                  </div>

                  {/* ────── Email: Step 1 fields ────── */}
                  {method === 'email' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="reg-firstName">Prénom *</Label>
                          <Input
                            id="reg-firstName"
                            placeholder="Prénom"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            disabled={isLoading}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="reg-lastName">Nom *</Label>
                          <Input
                            id="reg-lastName"
                            placeholder="Nom"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            disabled={isLoading}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reg-email">Adresse email *</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
                          <Input
                            id="reg-email"
                            type="email"
                            placeholder="votre@email.ci"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="h-11 pl-9"
                            disabled={isLoading}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reg-password">Mot de passe *</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
                          <Input
                            id="reg-password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="h-11 pl-9 pr-10"
                            disabled={isLoading}
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
                        {password && (
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
                                    rule.test(password) ? 'text-emerald-600' : 'text-neutral-400'
                                  }`}
                                >
                                  <Check className={`size-3 ${rule.test(password) ? 'opacity-100' : 'opacity-0'}`} />
                                  {rule.label}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reg-confirm">Confirmer le mot de passe *</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
                          <Input
                            id="reg-confirm"
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
                            disabled={isLoading}
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
                    </div>
                  )}

                  {/* ────── SMS: Step 1 fields ────── */}
                  {method === 'sms' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="sms-firstName">Prénom *</Label>
                          <Input
                            id="sms-firstName"
                            placeholder="Prénom"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            disabled={isLoading}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="sms-lastName">Nom *</Label>
                          <Input
                            id="sms-lastName"
                            placeholder="Nom"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            disabled={isLoading}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="sms-phone">Numéro de téléphone *</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
                          <Input
                            id="sms-phone"
                            type="tel"
                            placeholder="01 23 45 67 89"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                            className="h-11 pl-9"
                            disabled={isLoading || !!pendingPhone}
                          />
                        </div>
                        <p className="text-xs text-neutral-400">Un code OTP sera envoyé pour vérifier ce numéro</p>
                      </div>

                    </div>
                  )}

                  {/* Continue button */}
                  <Button
                    type="button"
                    onClick={handleGoToStep2}
                    className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground text-base font-semibold"
                    disabled={!canGoToStep2()}
                  >
                    <span className="flex items-center gap-2">
                      Continuer
                      <ArrowRight className="size-4" />
                    </span>
                  </Button>
                </motion.div>
              ) : (
                /* ────── Step 2: Role selection ────── */
                <motion.div
                  key="step2"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Summary of step 1 */}
                    <div className="rounded-lg bg-brand-50 border border-brand-100 p-3">
                      <p className="text-xs font-medium text-brand-600 mb-1.5">Vos informations</p>
                      <p className="text-sm text-foreground font-medium">{firstName} {lastName}</p>
                      <p className="text-xs text-muted-foreground">
                        {method === 'email' ? email : phone}
                      </p>
                    </div>

                    {/* Role selection cards */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Choisissez votre profil *</Label>
                      <div className="grid grid-cols-1 gap-3">
                        {roles.map((r) => {
                          const Icon = r.icon
                          const isSelected = role === r.value
                          return (
                            <button
                              key={r.value}
                              type="button"
                              onClick={() => setRole(r.value)}
                              className={`w-full flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                                isSelected
                                  ? 'border-brand-500 bg-brand-50 shadow-sm'
                                  : 'border-border bg-card hover:border-brand-200 hover:bg-brand-50/50'
                              }`}
                            >
                              <div className={`flex items-center justify-center size-12 rounded-lg transition-colors ${
                                isSelected ? 'bg-brand-500' : 'bg-muted'
                              }`}>
                                <Icon className={`size-6 ${isSelected ? 'text-white' : 'text-neutral-400'}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-semibold ${isSelected ? 'text-brand-600' : 'text-foreground'}`}>
                                  {r.label}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
                              </div>
                              <div className={`flex items-center justify-center size-6 rounded-full border-2 transition-colors ${
                                isSelected
                                  ? 'border-brand-500 bg-brand-500'
                                  : 'border-neutral-300'
                              }`}>
                                {isSelected && <Check className="size-3.5 text-white" />}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Terms */}
                    <div className="rounded-lg border border-border bg-muted p-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="accept-terms"
                          checked={acceptTerms}
                          onCheckedChange={(checked) => setAcceptTerms(checked === true)}
                          className="mt-0.5 data-[state=checked]:bg-brand-500 data-[state=checked]:border-brand-500"
                        />
                        <Label htmlFor="accept-terms" className="text-sm text-muted-foreground font-normal leading-snug cursor-pointer">
                          J&apos;accepte les{' '}
                          <span className="text-brand-500 hover:underline cursor-pointer font-medium" onClick={() => setView('cgu')}>conditions d&apos;utilisation</span>{' '}
                          et la{' '}
                          <span className="text-brand-500 hover:underline cursor-pointer font-medium" onClick={() => setView('confidentialite')}>politique de confidentialité</span>
                        </Label>
                      </div>
                    </div>

                    {/* Submit */}
                    <Button
                      type="submit"
                      className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground text-base font-semibold"
                      disabled={isLoading || !role || !acceptTerms}
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Inscription...
                        </span>
                      ) : (
                        'Créer mon compte'
                      )}
                    </Button>

                    {/* Back to step 1 */}
                    <button
                      type="button"
                      onClick={handleBackToStep1}
                      className="w-full flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="size-3.5" />
                      Retour aux informations
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Back to login — always visible */}
            {step === 1 && (
              <button
                onClick={() => setView('login')}
                className="w-full flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground mt-4"
              >
                <ArrowLeft className="size-3.5" />
                Retour à la connexion
              </button>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
