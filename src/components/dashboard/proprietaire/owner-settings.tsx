'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Settings, User, Bell, Mail, Phone, ShieldCheck,
  CheckCircle2, Save, Loader2,
  Eye, EyeOff, Camera, FileText,
  DollarSign, CalendarDays,
  Trash2, Lock, ScanFace, CreditCard, FileCheck,
  AlertTriangle, XCircle, RefreshCw, Award,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch } from '@/lib/auth-fetch'
import { motion, AnimatePresence } from 'framer-motion'
import { OwnerSecurity } from './security'
import { ScoreCircle, ScoreComponentCard } from '@/components/dashboard/locataire/settings/sub-components'
import { KycVerificationModal } from '@/components/dashboard/locataire/settings/kyc-modal'
import type { ScoringData } from '@/components/dashboard/locataire/settings/types'
import { toast } from 'sonner'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { CITIES } from '@/lib/cities'
import { validateEmail, validatePhoneCI } from '@/lib/validators'

// ── Types ───────────────────────────────────────────────────────────────────

interface OwnerProfileData {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  avatarUrl: string | null
  showPhone: boolean
  showEmail: boolean
  isEmailVerified: boolean
  isPhoneVerified: boolean
  role: string
  birthDate: string | null
  nni: string | null
  oneciVerified: boolean
  oneciVerifiedAt: string | null
  neofaceVerified: boolean
  neofaceVerifiedAt: string | null
  kycDocumentId: string | null
  passwordUpdatedAt: string | null
  gender: string | null
  city: string | null
  address: string | null
  createdAt: string
}

interface NotificationPreferences {
  id: string
  messages: boolean
  dossierUpdates: boolean
  visitReminders: boolean
  paymentAlerts: boolean
  promotions: boolean
}

// ── Animations ──────────────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

// ── Main Owner Settings Component ───────────────────────────────────────────

export function OwnerSettings({ defaultTab, onTabConsumed }: { defaultTab?: string; onTabConsumed?: () => void }) {
  const { user, setDashboardSection, updateUser } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'profil' | 'verification' | 'notifications' | 'securite'>('profil')

  // Apply default tab from redirect and consume it
  useEffect(() => {
    if (defaultTab && ['profil', 'verification', 'notifications', 'securite'].includes(defaultTab)) {
      setActiveTab(defaultTab as 'profil' | 'verification' | 'notifications' | 'securite')
      onTabConsumed?.()
    }
  }, [defaultTab, onTabConsumed])

  // Profile state
  const [profile, setProfile] = useState<OwnerProfileData | null>(null)
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    gender: '',
    city: '',
    showPhone: true,
    showEmail: false,
  })
  const [profileSaving, setProfileSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // Notification preferences state
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences | null>(null)
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifSaving, setNotifSaving] = useState<Record<string, boolean>>({})

  // Verification tab state
  const [scoring, setScoring] = useState<ScoringData | null>(null)
  const [kycModalOpen, setKycModalOpen] = useState(false)
  const [oneciVerifying, setOneciVerifying] = useState(false)
  const [oneciResult, setOneciResult] = useState<{ verified: boolean; message: string; details?: string } | null>(null)
  const oneciSectionRef = useRef<HTMLDivElement>(null)

  // Phone verification state
  const [phoneSending, setPhoneSending] = useState(false)
  const [phoneOtpSent, setPhoneOtpSent] = useState(false)
  const [phoneOtpCode, setPhoneOtpCode] = useState('')
  const [phoneVerifyError, setPhoneVerifyError] = useState<string | null>(null)
  const [phoneVerifySuccess, setPhoneVerifySuccess] = useState<string | null>(null)

  // Email verification state
  const [emailValue, setEmailValue] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailOtpSent, setEmailOtpSent] = useState(false)
  const [emailOtpCode, setEmailOtpCode] = useState('')
  const [emailVerifyError, setEmailVerifyError] = useState<string | null>(null)
  const [emailVerifySuccess, setEmailVerifySuccess] = useState<string | null>(null)

  const fetchScoring = useCallback(async () => {
    try {
      const result = await authFetch<ScoringData>('/api/scoring')
      setScoring(result)
    } catch {
      toast.error('Impossible de charger votre score de vérification')
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'verification') {
      fetchScoring()
    }
  }, [activeTab, fetchScoring])

  const handleKycVerified = useCallback(async () => {
    setKycModalOpen(false)
    try {
      const [profileResult, scoringResult] = await Promise.allSettled([
        authFetch<{ user: OwnerProfileData }>('/api/profile'),
        authFetch<ScoringData>('/api/scoring'),
      ])
      if (profileResult.status === 'fulfilled') {
        setProfile(profileResult.value.user)
        updateUser({
          firstName: profileResult.value.user.firstName,
          lastName: profileResult.value.user.lastName,
          email: profileResult.value.user.email,
          phone: profileResult.value.user.phone,
          avatarUrl: profileResult.value.user.avatarUrl,
        })
        setProfileForm((prev) => ({
          ...prev,
          firstName: profileResult.value.user.firstName || '',
          lastName: profileResult.value.user.lastName || '',
          phone: profileResult.value.user.phone || '',
          gender: profileResult.value.user.gender || '',
          city: profileResult.value.user.city || '',
        }))
      }
      if (scoringResult.status === 'fulfilled') setScoring(scoringResult.value)
    } catch {}
  }, [updateUser])

  const handleKycRedo = useCallback(async () => {
    const [profileResult, scoringResult] = await Promise.allSettled([
      authFetch<{ user: OwnerProfileData }>('/api/profile'),
      authFetch<ScoringData>('/api/scoring'),
    ])
    if (profileResult.status === 'fulfilled') {
      setProfile(profileResult.value.user)
      updateUser({
        firstName: profileResult.value.user.firstName,
        lastName: profileResult.value.user.lastName,
        email: profileResult.value.user.email,
        phone: profileResult.value.user.phone,
        avatarUrl: profileResult.value.user.avatarUrl,
      })
    }
    if (scoringResult.status === 'fulfilled') setScoring(scoringResult.value)
  }, [updateUser])

  const handleOneciVerify = async () => {
    setOneciVerifying(true)
    setOneciResult(null)
    try {
      await authFetch<{ user: OwnerProfileData }>('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nni: (profile as any)?.nni || '',
          birthDate: (profile as any)?.birthDate || null,
        }),
      })
    } catch {}
    try {
      const result = await authFetch<{ verified: boolean; message: string; details?: string; error?: string }>('/api/oneci/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nni: (profile as any)?.nni || '',
          birthDate: (profile as any)?.birthDate || null,
        }),
      })
      setOneciResult({
        verified: result.verified,
        message: result.verified ? result.message : (result.error || result.message),
        details: result.details,
      })
      if (result.verified) {
        const [profileResult, scoringResult] = await Promise.allSettled([
          authFetch<{ user: OwnerProfileData }>('/api/profile'),
          authFetch<ScoringData>('/api/scoring'),
        ])
        if (profileResult.status === 'fulfilled') {
          setProfile(profileResult.value.user)
          updateUser({
            firstName: profileResult.value.user.firstName,
            lastName: profileResult.value.user.lastName,
            email: profileResult.value.user.email,
            phone: profileResult.value.user.phone,
            avatarUrl: profileResult.value.user.avatarUrl,
          })
        }
        if (scoringResult.status === 'fulfilled') setScoring(scoringResult.value)
      }
    } catch (err) {
      setOneciResult({
        verified: false,
        message: err instanceof Error ? err.message : 'Erreur lors de la vérification ONECI',
      })
    } finally {
      setOneciVerifying(false)
    }
  }

  // ── Fetch profile data ──────────────────────────────────────────────────
  // Dep sur user?.id (string stable) plutôt que user (nouvelle référence à chaque
  // checkAuth → réécraserait profileForm à chaque visibilitychange).
  const userId = user?.id
  const fetchProfile = useCallback(async () => {
    if (!userId) return
    try {
      const result = await authFetch<{ user: OwnerProfileData }>('/api/profile')
      const p = result.user
      setProfile(p)
      setProfileForm({
        firstName: p.firstName || '',
        lastName: p.lastName || '',
        phone: p.phone || '',
        gender: p.gender || '',
        city: p.city || '',
        showPhone: (p as unknown as Record<string, unknown>).showPhone as boolean ?? true,
        showEmail: (p as unknown as Record<string, unknown>).showEmail as boolean ?? false,
      })
      setEmailValue(p.email || '')
    } catch {
      // Silent
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  // ── Fetch notification preferences ──────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'notifications' && user) {
      setNotifLoading(true)
      authFetch<{ preferences: NotificationPreferences }>('/api/user/notification-preferences')
        .then((data) => setNotifPrefs(data.preferences))
        .catch(() => toast.error('Impossible de charger vos préférences de notification'))
        .finally(() => setNotifLoading(false))
    }
  }, [activeTab, user])

  // ── Save profile ────────────────────────────────────────────────────────
  const handleSaveProfile = useCallback(async () => {
    // Bloque l'enregistrement si le téléphone ou l'email a été MODIFIÉ mais pas
    // (encore) vérifié. L'utilisateur doit cliquer sur le bouton "Vérifier"
    // dédié et confirmer l'OTP — ne pas envoyer l'OTP automatiquement ici.
    const phoneChanged = profileForm.phone.trim() !== (profile?.phone || '').trim()
    const emailChanged = emailValue.trim() !== (profile?.email || '').trim()

    if (phoneChanged && profileForm.phone.trim() && !profile?.isPhoneVerified) {
      toast.error('Vérifiez d\'abord votre nouveau numéro de téléphone avant d\'enregistrer (bouton « Vérifier » à côté du champ).')
      return
    }
    if (emailChanged && emailValue.trim() && !profile?.isEmailVerified) {
      toast.error('Vérifiez d\'abord votre nouvelle adresse email avant d\'enregistrer (bouton « Vérifier » à côté du champ).')
      return
    }

    setProfileSaving(true)
    try {
      const result = await authFetch<{ user: OwnerProfileData }>('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      })
      setProfile(result.user)
      updateUser({
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        avatarUrl: result.user.avatarUrl,
        gender: result.user.gender,
        city: result.user.city,
      })
      toast.success('Profil mis à jour avec succès')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setProfileSaving(false)
    }
  }, [profileForm, emailValue, updateUser, profile])

  // ── Phone verification ──────────────────────────────────────────────────
  const handleSendPhoneVerification = useCallback(async () => {
    const validation = validatePhoneCI(profileForm.phone)
    if (!validation.valid) {
      setPhoneVerifyError(validation.error ?? 'Numéro invalide')
      setPhoneVerifySuccess(null)
      return
    }
    setPhoneSending(true)
    setPhoneVerifyError(null)
    setPhoneVerifySuccess(null)
    setPhoneOtpSent(false)
    try {
      await authFetch('/api/profile/change-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPhone: profileForm.phone.trim() }),
      })
      setPhoneOtpSent(true)
      setPhoneVerifySuccess('Code de vérification envoyé par SMS au ' + profileForm.phone.trim())
    } catch (err) {
      setPhoneVerifyError(err instanceof Error ? err.message : "Erreur lors de l'envoi du code")
    } finally {
      setPhoneSending(false)
    }
  }, [profileForm.phone])

  const handleVerifyPhoneCode = useCallback(async () => {
    if (!phoneOtpCode.trim() || !profileForm.phone.trim()) return
    setPhoneSending(true)
    setPhoneVerifyError(null)
    try {
      const result = await authFetch<{ verified: boolean; phone: string }>('/api/profile/change-phone/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPhone: profileForm.phone.trim(), code: phoneOtpCode.trim() }),
      })
      if (result.verified) {
        setPhoneVerifySuccess('Numéro de téléphone vérifié avec succès !')
        setPhoneOtpSent(false)
        setPhoneOtpCode('')
        const profileResult = await authFetch<{ user: OwnerProfileData }>('/api/profile')
        setProfile(profileResult.user)
        updateUser({ phone: profileResult.user.phone, isPhoneVerified: true })
      }
    } catch (err) {
      setPhoneVerifyError(err instanceof Error ? err.message : 'Code invalide ou expiré')
    } finally {
      setPhoneSending(false)
    }
  }, [phoneOtpCode, profileForm.phone, updateUser])

  // ── Email verification ──────────────────────────────────────────────────
  const handleSendEmailVerification = useCallback(async () => {
    const validation = validateEmail(emailValue)
    if (!validation.valid) {
      setEmailVerifyError(validation.error ?? 'Email invalide')
      setEmailVerifySuccess(null)
      return
    }
    setEmailSending(true)
    setEmailVerifyError(null)
    setEmailVerifySuccess(null)
    setEmailOtpSent(false)
    try {
      await authFetch('/api/profile/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: emailValue.trim() }),
      })
      setEmailOtpSent(true)
      setEmailVerifySuccess('Code de vérification envoyé à ' + emailValue.trim())
    } catch (err) {
      setEmailVerifyError(err instanceof Error ? err.message : "Erreur lors de l'envoi du code")
    } finally {
      setEmailSending(false)
    }
  }, [emailValue])

  const handleVerifyEmailCode = useCallback(async () => {
    if (!emailOtpCode.trim() || !emailValue.trim()) return
    setEmailSending(true)
    setEmailVerifyError(null)
    try {
      const result = await authFetch<{ verified: boolean; email: string }>('/api/profile/change-email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: emailValue.trim(), code: emailOtpCode.trim() }),
      })
      if (result.verified) {
        setEmailVerifySuccess('Adresse email vérifiée avec succès !')
        setEmailOtpSent(false)
        setEmailOtpCode('')
        const profileResult = await authFetch<{ user: OwnerProfileData }>('/api/profile')
        setProfile(profileResult.user)
        updateUser({ email: profileResult.user.email, isEmailVerified: true })
      }
    } catch (err) {
      setEmailVerifyError(err instanceof Error ? err.message : 'Code invalide ou expiré')
    } finally {
      setEmailSending(false)
    }
  }, [emailOtpCode, emailValue, updateUser])

  // ── Toggle notification preference ──────────────────────────────────────
  const handleToggleNotif = useCallback(async (key: keyof NotificationPreferences, value: boolean) => {
    if (key === 'id') return
    setNotifSaving((prev) => ({ ...prev, [key]: true }))
    try {
      await authFetch('/api/user/notification-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      })
      setNotifPrefs((prev) => prev ? { ...prev, [key]: value } : prev)
      toast.success('Préférence mise à jour')
    } catch {
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setNotifSaving((prev) => ({ ...prev, [key]: false }))
    }
  }, [])

  // ── Avatar upload handler ───────────────────────────────────────────────
  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Format d\'image invalide. Utilisez JPG, PNG ou WEBP.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('L\'image est trop volumineuse (max 2 Mo).')
      return
    }

    setAvatarUploading(true)
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const SIZE = 200
          canvas.width = SIZE
          canvas.height = SIZE
          const ctx = canvas.getContext('2d')
          if (!ctx) { reject(new Error('Canvas non supporté')); return }
          const sourceSize = Math.min(img.width, img.height)
          const sx = (img.width - sourceSize) / 2
          const sy = (img.height - sourceSize) / 2
          ctx.drawImage(img, sx, sy, sourceSize, sourceSize, 0, 0, SIZE, SIZE)
          resolve(canvas.toDataURL('image/jpeg', 0.85))
        }
        img.onerror = () => reject(new Error('Impossible de charger l\'image'))
        img.src = URL.createObjectURL(file)
      })

      const result = await authFetch<{ user: { avatarUrl: string | null } }>('/api/profile/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: dataUrl }),
      })

      setProfile((prev) => prev ? { ...prev, avatarUrl: result.user.avatarUrl } : prev)
      updateUser({ avatarUrl: result.user.avatarUrl })
      toast.success('Photo de profil mise à jour !')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du chargement de la photo')
    } finally {
      setAvatarUploading(false)
    }
  }, [updateUser])

  // ── Avatar delete handler ───────────────────────────────────────────────
  const handleAvatarDelete = useCallback(async () => {
    setAvatarUploading(true)
    try {
      await authFetch('/api/profile/avatar', { method: 'DELETE' })
      setProfile((prev) => prev ? { ...prev, avatarUrl: null } : prev)
      updateUser({ avatarUrl: null })
      toast.success('Photo de profil supprimée')
    } catch {
      toast.error('Erreur lors de la suppression de la photo')
    } finally {
      setAvatarUploading(false)
    }
  }, [updateUser])

  // ── Loading state ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted rounded-lg animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  // Tab navigation items
  const tabs = [
    { id: 'profil' as const, label: 'Mon Profil', icon: User },
    { id: 'verification' as const, label: 'Vérifications', icon: ShieldCheck },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'securite' as const, label: 'Sécurité', icon: Lock },
  ]

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Paramètres</h1>
        <p className="text-muted-foreground mt-1">Gérez votre profil propriétaire et vos préférences</p>
      </motion.div>

      {/* User Info Card */}
      <motion.div variants={itemVariants}>
        <Card className="border-border overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="relative shrink-0 group">
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="relative size-14 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2"
                  title="Changer la photo de profil"
                >
                  {profile?.avatarUrl ? (
                    <img src={profile.avatarUrl} alt="Photo de profil" className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-brand-50 text-brand-500">
                      <span className="text-lg font-bold">
                        {profile?.firstName?.charAt(0)?.toUpperCase() || 'P'}
                        {profile?.lastName?.charAt(0)?.toUpperCase() || ''}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {avatarUploading ? <Loader2 className="size-5 animate-spin text-white" /> : <Camera className="size-5 text-white" />}
                  </div>
                </button>
                {profile?.avatarUrl && !avatarUploading && (
                  <button
                    onClick={handleAvatarDelete}
                    className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600 transition-colors"
                    title="Supprimer la photo"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-foreground truncate">
                  {profile?.firstName || user?.firstName} {profile?.lastName || user?.lastName}
                </h3>
                <div className="space-y-1 mt-1.5">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="size-3.5 shrink-0" />
                    <span className="truncate">{profile?.email || user?.email || 'Non renseigné'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="size-3.5 shrink-0" />
                    <span>{profile?.phone || user?.phone || 'Non renseigné'}</span>
                  </div>
                </div>
              </div>
              <Badge className="bg-brand-50 text-brand-700 border-brand-200 border text-xs font-semibold px-3 py-1 shrink-0">
                <ShieldCheck className="size-3.5 mr-1" />
                Propriétaire
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tab Navigation */}
      <motion.div variants={itemVariants}>
        <div className="flex gap-1 p-1 bg-muted rounded-xl overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center whitespace-nowrap ${
                  isActive
                    ? 'bg-card text-brand-600 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </motion.div>

      {/* ── Tab Content ──────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">

        {/* ── PROFIL TAB (US-P-111) ─────────────────────────────────────── */}
        {activeTab === 'profil' && (
          <motion.div
            key="profil"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Profile form */}
            <Card className="border-border">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <User className="size-4 text-brand-500" />
                  Profil public
                </CardTitle>
                <CardDescription>
                  Ces informations sont visibles par les candidats locataires
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Name fields */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="owner-firstName" className="text-xs font-medium text-foreground">
                      Prénom <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="owner-firstName"
                      value={profileForm.firstName}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, firstName: e.target.value }))}
                      placeholder="Votre prénom"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="owner-lastName" className="text-xs font-medium text-foreground">
                      Nom <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="owner-lastName"
                      value={profileForm.lastName}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, lastName: e.target.value }))}
                      placeholder="Votre nom"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                {/* Gender & City */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="owner-gender" className="text-xs font-medium text-foreground">Genre</Label>
                    <Select value={profileForm.gender} onValueChange={(v) => setProfileForm((prev) => ({ ...prev, gender: v }))}>
                      <SelectTrigger id="owner-gender" className="h-9 text-sm w-full"><SelectValue placeholder="Non renseigné" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HOMME">Homme</SelectItem>
                        <SelectItem value="FEMME">Femme</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="owner-city" className="text-xs font-medium text-foreground">Ville</Label>
                    <SearchableSelect
                      id="owner-city"
                      options={CITIES.map((c) => ({ value: c.name, label: c.name }))}
                      value={profileForm.city}
                      onChange={(v) => setProfileForm((prev) => ({ ...prev, city: v }))}
                      placeholder="Sélectionnez une ville"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                {/* Phone & Email */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Phone */}
                  <div className="space-y-1.5">
                    <Label htmlFor="owner-phone" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Phone className="size-3" /> Téléphone
                      {profile?.isPhoneVerified && (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] px-1 py-0 border">
                          <CheckCircle2 className="size-2.5 mr-0.5" /> Vérifié
                        </Badge>
                      )}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="owner-phone"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                        placeholder="07 00 00 00 00"
                        className="h-9 text-sm flex-1"
                      />
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch
                          checked={profileForm.showPhone}
                          onCheckedChange={(val) => setProfileForm((prev) => ({ ...prev, showPhone: val }))}
                        />
                        <span className="text-xs text-muted-foreground">
                          {profileForm.showPhone ? (
                            <Eye className="size-3.5 text-emerald-500" />
                          ) : (
                            <EyeOff className="size-3.5 text-muted-foreground" />
                          )}
                        </span>
                      </div>
                      {!profile?.isPhoneVerified && profileForm.phone && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 text-xs shrink-0 border-brand-200 text-brand-600 hover:bg-brand-50"
                          onClick={handleSendPhoneVerification}
                          disabled={phoneSending}
                        >
                          {phoneSending ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <><CheckCircle2 className="size-3.5 mr-1" /> Vérifier</>
                          )}
                        </Button>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {profileForm.showPhone ? 'Visible par les candidats' : 'Masqué pour les candidats'}
                    </p>

                    {phoneOtpSent && !profile?.isPhoneVerified && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex gap-2"
                      >
                        <Input
                          placeholder="Code de vérification"
                          value={phoneOtpCode}
                          onChange={(e) => setPhoneOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="h-9 text-sm text-center tracking-widest"
                          maxLength={6}
                          disabled={phoneSending}
                        />
                        <Button
                          size="sm"
                          className="h-9 text-xs shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground"
                          onClick={handleVerifyPhoneCode}
                          disabled={phoneSending || phoneOtpCode.length < 4}
                        >
                          {phoneSending ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            'Confirmer'
                          )}
                        </Button>
                      </motion.div>
                    )}

                    {phoneVerifyError && (
                      <p className="text-[10px] text-red-500">{phoneVerifyError}</p>
                    )}
                    {phoneVerifySuccess && (
                      <p className="text-[10px] text-emerald-600">{phoneVerifySuccess}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <Label htmlFor="owner-email" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Mail className="size-3" /> Email
                      {profile?.isEmailVerified && emailValue.trim() === (profile?.email || '').trim() && (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] px-1 py-0 border">
                          <CheckCircle2 className="size-2.5 mr-0.5" /> Vérifié
                        </Badge>
                      )}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="owner-email"
                        value={emailValue}
                        onChange={(e) => {
                          setEmailValue(e.target.value)
                          setEmailVerifyError(null)
                          setEmailVerifySuccess(null)
                          setEmailOtpSent(false)
                          setEmailOtpCode('')
                        }}
                        placeholder="email@exemple.ci"
                        className="h-9 text-sm flex-1 min-w-0"
                        disabled={emailSending}
                      />
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch
                          checked={profileForm.showEmail}
                          onCheckedChange={(val) => setProfileForm((prev) => ({ ...prev, showEmail: val }))}
                        />
                        <span className="text-xs text-muted-foreground">
                          {profileForm.showEmail ? (
                            <Eye className="size-3.5 text-emerald-500" />
                          ) : (
                            <EyeOff className="size-3.5 text-muted-foreground" />
                          )}
                        </span>
                      </div>
                      {(!profile?.isEmailVerified || emailValue.trim() !== (profile?.email || '').trim()) && emailValue && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 text-xs shrink-0 border-brand-200 text-brand-600 hover:bg-brand-50"
                          onClick={handleSendEmailVerification}
                          disabled={emailSending}
                        >
                          {emailSending ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : emailOtpSent ? (
                            'Renvoyer'
                          ) : (
                            <><CheckCircle2 className="size-3.5 mr-1" /> Vérifier</>
                          )}
                        </Button>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {profileForm.showEmail ? 'Visible par les candidats' : 'Masqué pour les candidats'}
                    </p>

                    {emailOtpSent && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex gap-2"
                      >
                        <Input
                          placeholder="Code de vérification"
                          value={emailOtpCode}
                          onChange={(e) => setEmailOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="h-9 text-sm text-center tracking-widest"
                          maxLength={6}
                          disabled={emailSending}
                        />
                        <Button
                          size="sm"
                          className="h-9 text-xs shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground"
                          onClick={handleVerifyEmailCode}
                          disabled={emailSending || emailOtpCode.length < 4}
                        >
                          {emailSending ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            'Confirmer'
                          )}
                        </Button>
                      </motion.div>
                    )}

                    {emailVerifyError && (
                      <p className="text-[10px] text-red-500">{emailVerifyError}</p>
                    )}
                    {emailVerifySuccess && (
                      <p className="text-[10px] text-emerald-600">{emailVerifySuccess}</p>
                    )}
                  </div>
                </div>

                {/* Save button */}
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleSaveProfile}
                    disabled={profileSaving}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {profileSaving ? (
                      <><Loader2 className="size-4 mr-2 animate-spin" /> Enregistrement...</>
                    ) : (
                      <><Save className="size-4 mr-2" /> Enregistrer le profil</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── VERIFICATION TAB ──────────────────────────────────────────── */}
        {activeTab === 'verification' && (
          <motion.div
            key="verification"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Score Overview */}
            

            {/* Score breakdown */}
            {scoring && (
              <div className="grid gap-4 sm:grid-cols-2">
                <ScoreComponentCard
                  icon={User}
                  label="Profil complet"
                  weight={scoring.breakdown.profile.weight}
                  score={scoring.breakdown.profile.score}
                  max={scoring.breakdown.profile.max}
                  statusColor={scoring.statusColor}
                  details="Remplissez toutes vos informations personnelles"
                  actionLabel="Compléter le profil"
                  onAction={() => setActiveTab('profil')}
                />
                <ScoreComponentCard
                  icon={ScanFace}
                  label="KYC"
                  weight={scoring.breakdown.neoface.weight}
                  score={scoring.breakdown.neoface.score}
                  max={scoring.breakdown.neoface.max}
                  statusColor={scoring.statusColor}
                  details="Vérification biométrique obligatoire"
                  actionLabel="Vérification KYC"
                  onAction={() => setKycModalOpen(true)}
                  redoLabel="Refaire la vérification"
                  onRedo={() => setKycModalOpen(true)}
                />
                <ScoreComponentCard
                  icon={CreditCard}
                  label="ONECI"
                  weight={scoring.breakdown.oneci.weight}
                  score={scoring.breakdown.oneci.score}
                  max={scoring.breakdown.oneci.max}
                  statusColor={scoring.statusColor}
                  details="Authentification de votre carte d'identité nationale"
                  actionLabel="Vérifier ma CNI"
                  onAction={() => oneciSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  redoLabel="Refaire la vérification"
                  onRedo={() => oneciSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                />
                <ScoreComponentCard
                  icon={Award}
                  label={scoring.breakdown.roleSpecific.label}
                  weight={scoring.breakdown.roleSpecific.weight}
                  score={scoring.breakdown.roleSpecific.score}
                  max={scoring.breakdown.roleSpecific.max}
                  statusColor={scoring.statusColor}
                  details={scoring.breakdown.roleSpecific.description}
                  actionLabel={scoring.breakdown.roleSpecific.hasFile ? "Voir le détail" : "Commencer"}
                  onAction={() => setDashboardSection('owner-file')}
                  redoLabel="Voir le détail"
                  onRedo={() => setDashboardSection('owner-file')}
                />
              </div>
            )}

            {/* ONECI Verification form */}
            <Card className="border-border" ref={oneciSectionRef}>
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <CreditCard className="size-4 text-brand-500" />
                  Vérification d&apos;identité ONECI
                </CardTitle>
                <CardDescription>
                  Renseignez votre NNI et date de naissance pour vérifier votre carte d&apos;identité nationale auprès de l&apos;ONECI
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="owner-nni" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      NNI
                      {profile?.oneciVerified && (
                        <CheckCircle2 className="size-3 text-emerald-500" />
                      )}
                    </Label>
                    <Input
                      id="owner-nni"
                      value={(profile as any)?.nni || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 11)
                        setProfile((prev) => prev ? { ...prev, nni: val } : prev)
                      }}
                      placeholder="Numéro National d'Identification"
                      className="h-9 text-sm"
                      disabled={oneciVerifying}
                      maxLength={11}
                    />
                    <p className="text-[10px] text-muted-foreground">10 à 11 chiffres — requis pour la vérification ONECI</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="owner-birthDate" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      Date de naissance
                    </Label>
                    <Input
                      id="owner-birthDate"
                      type="date"
                      value={(profile as any)?.birthDate ? new Date((profile as any).birthDate).toISOString().split('T')[0] : ''}
                      onChange={(e) => {
                        setProfile((prev) => prev ? { ...prev, birthDate: e.target.value } : prev)
                      }}
                      className="h-9 text-sm"
                      disabled={oneciVerifying}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleOneciVerify}
                    disabled={oneciVerifying || !(profile as any)?.nni || (profile as any)?.nni?.length < 10}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {oneciVerifying ? (
                      <><Loader2 className="size-4 mr-2 animate-spin" /> Vérification en cours...</>
                    ) : (
                      <><CreditCard className="size-4 mr-2" /> Vérifier mon identité</>
                    )}
                  </Button>
                </div>

                {oneciResult && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-lg border ${
                      oneciResult.verified
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex size-8 items-center justify-center rounded-full shrink-0 ${
                        oneciResult.verified ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'
                      }`}>
                        {oneciResult.verified ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${oneciResult.verified ? 'text-emerald-700' : 'text-red-700'}`}>
                          {oneciResult.verified ? 'Identité vérifiée avec succès' : 'Échec de la vérification'}
                        </p>
                        <p className={`text-xs mt-0.5 ${oneciResult.verified ? 'text-emerald-600' : 'text-red-600'}`}>
                          {oneciResult.message}
                        </p>
                        {oneciResult.details && (
                          <p className="text-[10px] text-muted-foreground mt-1">{oneciResult.details}</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </CardContent>
            </Card>

            {/* KYC Modal */}
            <KycVerificationModal
              open={kycModalOpen}
              onOpenChange={setKycModalOpen}
              profile={profile as any}
              onVerified={handleKycVerified}
              onRedo={handleKycRedo}
            />
          </motion.div>
        )}

        {/* ── NOTIFICATIONS TAB (US-P-110) ──────────────────────────────── */}
        {activeTab === 'notifications' && (
          <motion.div
            key="notifications"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <Card className="border-border">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Bell className="size-4 text-brand-500" />
                  Préférences de notification
                </CardTitle>
                <CardDescription>
                  Choisissez les notifications que vous souhaitez recevoir
                </CardDescription>
              </CardHeader>
              <CardContent>
                {notifLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {[
                      { key: 'messages' as const, label: 'Messages', description: 'Nouveaux messages des candidats', icon: Mail },
                      { key: 'dossierUpdates' as const, label: 'Mises à jour des dossiers', description: 'Changements de statut des dossiers locatifs', icon: FileText },
                      { key: 'visitReminders' as const, label: 'Rappels de visite', description: 'Demandes de visite et rappels', icon: CalendarDays },
                      { key: 'paymentAlerts' as const, label: 'Alertes de paiement', description: 'Paiements reçus et en retard', icon: DollarSign },
                      { key: 'promotions' as const, label: 'Promotions', description: 'Offres spéciales et nouveautés de la plateforme', icon: Settings },
                    ].map(({ key, label, description, icon: Icon }) => (
                      <div
                        key={key}
                        className="flex items-center justify-between p-4 rounded-xl border border-border hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                            <Icon className="size-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{label}</p>
                            <p className="text-xs text-muted-foreground">{description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {notifSaving[key] && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                          <Switch
                            checked={notifPrefs?.[key] ?? true}
                            onCheckedChange={(val) => handleToggleNotif(key, val)}
                            disabled={notifSaving[key]}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── SÉCURITÉ TAB ──────────────────────────────────────────────── */}
        {activeTab === 'securite' && (
          <motion.div
            key="securite"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <OwnerSecurity />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
