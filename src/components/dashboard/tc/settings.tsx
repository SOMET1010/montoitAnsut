'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  User, Shield, Bell, Mail, Phone, ShieldCheck,
  CheckCircle2, XCircle, Save, Loader2, MapPin, Users,
  Eye, EyeOff, Monitor, Smartphone, Trash2, LogOut,
  Camera, CreditCard, FileCheck, AlertTriangle, Info, Lightbulb, History,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch } from '@/lib/auth-fetch'
import { motion, AnimatePresence } from 'framer-motion'
import { ActivityHistory } from '@/components/dashboard/locataire/history'

// ── Types ───────────────────────────────────────────────────────────────────

interface ProfileData {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  gender: string | null
  city: string | null
  address: string | null
  avatarUrl: string | null
  isEmailVerified: boolean
  isPhoneVerified: boolean
  passwordUpdatedAt: string | null
  role: string
  createdAt: string
}

interface SessionInfo {
  id: string
  isCurrent: boolean
  createdAt: string
  expiresAt: string
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

// ── Main TC Settings Component ──────────────────────────────────────────────

export function TcSettings() {
  const { user, updateUser } = useAuthStore()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'profil' | 'securite' | 'notifications' | 'history'>('profil')

  // Form state (NO nni, NO birthDate)
  const [formState, setFormState] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    gender: '',
    city: '',
  })

  // Security tab state
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)

  // Sessions state
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [revokingSessions, setRevokingSessions] = useState(false)

  // Notification preferences state
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences | null>(null)
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifSaving, setNotifSaving] = useState<Record<string, boolean>>({})

  // ── Phone verification state ─────────────────────────────────────────────
  const [phoneOtpSent, setPhoneOtpSent] = useState(false)
  const [phoneOtpCode, setPhoneOtpCode] = useState('')
  const [phoneSending, setPhoneSending] = useState(false)
  const [phoneVerifyError, setPhoneVerifyError] = useState<string | null>(null)
  const [phoneVerifySuccess, setPhoneVerifySuccess] = useState<string | null>(null)

  // ── Email verification state ─────────────────────────────────────────────
  const [emailOtpSent, setEmailOtpSent] = useState(false)
  const [emailOtpCode, setEmailOtpCode] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailVerifyError, setEmailVerifyError] = useState<string | null>(null)
  const [emailVerifySuccess, setEmailVerifySuccess] = useState<string | null>(null)
  const [emailFormValue, setEmailFormValue] = useState('')

  // Avatar upload state
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // ── Fetch profile data (NO scoring) ──────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    if (!user) return

    try {
      const result = await authFetch<{ user: ProfileData }>('/api/profile')
      const p = result.user
      setProfile(p)
      setFormState({
        firstName: p.firstName || '',
        lastName: p.lastName || '',
        phone: p.phone || '',
        gender: p.gender || '',
        city: p.city || '',
      })
      setEmailFormValue(p.email || '')
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  // Auto-clear success message
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [success])

  // Auto-clear password success
  useEffect(() => {
    if (passwordSuccess) {
      const timer = setTimeout(() => setPasswordSuccess(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [passwordSuccess])

  // Fetch sessions when security tab is active
  useEffect(() => {
    if (activeTab === 'securite' && user) {
      setSessionsLoading(true)
      authFetch<{ sessions: SessionInfo[] }>('/api/settings/sessions')
        .then((data) => setSessions(data.sessions))
        .catch(() => {})
        .finally(() => setSessionsLoading(false))
    }
  }, [activeTab, user])

  // Fetch notification preferences when notifications tab is active
  useEffect(() => {
    if (activeTab === 'notifications' && user) {
      setNotifLoading(true)
      authFetch<{ preferences: NotificationPreferences }>('/api/settings/notifications')
        .then((data) => setNotifPrefs(data.preferences))
        .catch(() => {})
        .finally(() => setNotifLoading(false))
    }
  }, [activeTab, user])

  // Password change handler
  const handlePasswordChange = useCallback(async () => {
    setPasswordError(null)
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Tous les champs sont requis')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas')
      return
    }
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPasswordError('Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule et un chiffre')
      return
    }

    setPasswordSaving(true)
    try {
      await authFetch('/api/settings/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      setPasswordSuccess('Mot de passe mis à jour avec succès !')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      // Refresh profile to get updated passwordUpdatedAt
      try {
        const profileResult = await authFetch<{ user: ProfileData }>('/api/profile')
        setProfile(profileResult.user)
      } catch {}
      setTimeout(() => setPasswordModalOpen(false), 1500)
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Erreur lors du changement de mot de passe')
    } finally {
      setPasswordSaving(false)
    }
  }, [currentPassword, newPassword, confirmPassword])

  // Revoke other sessions handler
  const handleRevokeOtherSessions = useCallback(async () => {
    setRevokingSessions(true)
    try {
      await authFetch('/api/settings/sessions', { method: 'DELETE' })
      setSessions((prev) => prev.filter((s) => s.isCurrent))
    } catch {} finally {
      setRevokingSessions(false)
    }
  }, [])

  // Toggle notification preference
  const handleToggleNotif = useCallback(async (key: keyof NotificationPreferences, value: boolean) => {
    if (key === 'id') return
    setNotifSaving((prev) => ({ ...prev, [key]: true }))
    try {
      await authFetch('/api/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      })
      setNotifPrefs((prev) => prev ? { ...prev, [key]: value } : prev)
    } catch {} finally {
      setNotifSaving((prev) => ({ ...prev, [key]: false }))
    }
  }, [])

  // ── Avatar upload handler ────────────────────────────────────────────────
  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    // Validate file type
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Format d\'image invalide. Utilisez JPG, PNG ou WEBP.')
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('L\'image est trop volumineuse (max 2 Mo).')
      return
    }

    setAvatarUploading(true)
    setError(null)

    try {
      // Resize image to 200x200 and convert to data URL
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const SIZE = 200
          canvas.width = SIZE
          canvas.height = SIZE

          const ctx = canvas.getContext('2d')
          if (!ctx) { reject(new Error('Canvas non supporté')); return }

          // Crop to square (center crop)
          const sourceSize = Math.min(img.width, img.height)
          const sx = (img.width - sourceSize) / 2
          const sy = (img.height - sourceSize) / 2

          ctx.drawImage(img, sx, sy, sourceSize, sourceSize, 0, 0, SIZE, SIZE)
          resolve(canvas.toDataURL('image/jpeg', 0.85))
        }
        img.onerror = () => reject(new Error('Impossible de charger l\'image'))
        img.src = URL.createObjectURL(file)
      })

      // Upload to server
      const result = await authFetch<{ user: { avatarUrl: string | null; id: string; firstName: string; lastName: string; email: string | null; phone: string | null; role: string; isActive: boolean; isEmailVerified: boolean } }>('/api/profile/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: dataUrl }),
      })

      // Update local state
      setProfile((prev) => prev ? { ...prev, avatarUrl: result.user.avatarUrl } : prev)
      updateUser({ avatarUrl: result.user.avatarUrl })
      setSuccess('Photo de profil mise à jour !')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement de la photo')
    } finally {
      setAvatarUploading(false)
    }
  }, [updateUser])

  // ── Avatar delete handler ────────────────────────────────────────────────
  const handleAvatarDelete = useCallback(async () => {
    setAvatarUploading(true)
    try {
      await authFetch('/api/profile/avatar', { method: 'DELETE' })
      setProfile((prev) => prev ? { ...prev, avatarUrl: null } : prev)
      updateUser({ avatarUrl: null })
      setSuccess('Photo de profil supprimée')
    } catch {
      setError('Erreur lors de la suppression de la photo')
    } finally {
      setAvatarUploading(false)
    }
  }, [updateUser])

  // ── Phone verification handlers ──────────────────────────────────────────
  const handleSendPhoneVerification = useCallback(async () => {
    if (!formState.phone.trim()) return
    setPhoneSending(true)
    setPhoneVerifyError(null)
    setPhoneVerifySuccess(null)
    setPhoneOtpSent(false)
    try {
      await authFetch('/api/profile/change-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPhone: formState.phone.trim() }),
      })
      setPhoneOtpSent(true)
      setPhoneVerifySuccess('Code de vérification envoyé par SMS au ' + formState.phone.trim())
    } catch (err) {
      setPhoneVerifyError(err instanceof Error ? err.message : "Erreur lors de l'envoi du code")
    } finally {
      setPhoneSending(false)
    }
  }, [formState.phone])

  const handleVerifyPhoneCode = useCallback(async () => {
    if (!phoneOtpCode.trim() || !formState.phone.trim()) return
    setPhoneSending(true)
    setPhoneVerifyError(null)
    try {
      const result = await authFetch<{ verified: boolean; phone: string }>('/api/profile/change-phone/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPhone: formState.phone.trim(), code: phoneOtpCode.trim() }),
      })
      if (result.verified) {
        setPhoneVerifySuccess('Numéro de téléphone vérifié avec succès !')
        setPhoneOtpSent(false)
        setPhoneOtpCode('')
        const profileResult = await authFetch<{ user: ProfileData }>('/api/profile')
        setProfile(profileResult.user)
        updateUser({ phone: profileResult.user.phone, isPhoneVerified: true })
      }
    } catch (err) {
      setPhoneVerifyError(err instanceof Error ? err.message : 'Code invalide ou expiré')
    } finally {
      setPhoneSending(false)
    }
  }, [phoneOtpCode, formState.phone, updateUser])

  // ── Email verification handlers ──────────────────────────────────────────
  const handleSendEmailVerification = useCallback(async () => {
    if (!emailFormValue.trim()) return
    setEmailSending(true)
    setEmailVerifyError(null)
    setEmailVerifySuccess(null)
    setEmailOtpSent(false)
    try {
      await authFetch('/api/profile/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: emailFormValue.trim() }),
      })
      setEmailOtpSent(true)
      setEmailVerifySuccess('Code de vérification envoyé à ' + emailFormValue.trim())
    } catch (err) {
      setEmailVerifyError(err instanceof Error ? err.message : "Erreur lors de l'envoi du code")
    } finally {
      setEmailSending(false)
    }
  }, [emailFormValue])

  const handleVerifyEmailCode = useCallback(async () => {
    if (!emailOtpCode.trim() || !emailFormValue.trim()) return
    setEmailSending(true)
    setEmailVerifyError(null)
    try {
      const result = await authFetch<{ verified: boolean; email: string }>('/api/profile/change-email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: emailFormValue.trim(), code: emailOtpCode.trim() }),
      })
      if (result.verified) {
        setEmailVerifySuccess('Adresse email vérifiée avec succès !')
        setEmailOtpSent(false)
        setEmailOtpCode('')
        const profileResult = await authFetch<{ user: ProfileData }>('/api/profile')
        setProfile(profileResult.user)
        updateUser({ email: profileResult.user.email, isEmailVerified: true })
      }
    } catch (err) {
      setEmailVerifyError(err instanceof Error ? err.message : 'Code invalide ou expiré')
    } finally {
      setEmailSending(false)
    }
  }, [emailOtpCode, emailFormValue, updateUser])

  // Save profile
  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { phone: _phone, ...saveData } = formState
      const result = await authFetch<{ user: ProfileData }>('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saveData),
      })

      setProfile(result.user)
      setSuccess('Profil mis à jour avec succès !')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  // Loading state
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
    { id: 'history' as const, label: 'Activité', icon: History },
    { id: 'profil' as const, label: 'Mon Profil', icon: User },
    { id: 'securite' as const, label: 'Sécurité', icon: Shield },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
  ]

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants}>
        <Card className="border-border bg-gradient-to-r from-brand-500/10 to-transparent">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-brand-100">
                <Shield className="size-6 text-brand-600" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">Paramètres</h1>
                <p className="text-muted-foreground text-sm">Gérez votre compte Tiers de Confiance</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge className="bg-brand-50 text-brand-700 border-brand-200 border text-[10px]">
                    <ShieldCheck className="size-3 mr-0.5" /> Tiers de Confiance
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* User Info Card — NO Trust Score circle, NO role switch */}
      <motion.div variants={itemVariants}>
        <Card className="border-border overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              {/* Avatar — clickable to upload */}
              <div className="relative shrink-0 group">
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="relative size-14 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2"
                  title="Changer la photo de profil"
                >
                  {profile?.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt="Photo de profil"
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-brand-50 text-brand-500">
                      <span className="text-lg font-bold">
                        {profile?.firstName?.charAt(0)?.toUpperCase() || user?.firstName?.charAt(0)?.toUpperCase() || 'U'}
                        {profile?.lastName?.charAt(0)?.toUpperCase() || user?.lastName?.charAt(0)?.toUpperCase() || ''}
                      </span>
                    </div>
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {avatarUploading ? (
                      <Loader2 className="size-5 animate-spin text-white" />
                    ) : (
                      <Camera className="size-5 text-white" />
                    )}
                  </div>
                </button>
                {/* Delete button */}
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
              {/* TC Badge */}
              <Badge className="bg-brand-50 text-brand-700 border-brand-200 border text-xs font-semibold px-3 py-1 shrink-0">
                <ShieldCheck className="size-3.5 mr-1" />
                Tiers de Confiance
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tab Navigation */}
      <motion.div variants={itemVariants}>
        <div className="flex gap-1 p-1 bg-muted rounded-xl">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${
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
        {/* ── ACTIVITÉ TAB ──────────────────────────────────────────────── */}
        {activeTab === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <ActivityHistory />
          </motion.div>
        )}

        {/* ── PROFIL TAB ────────────────────────────────────────────────── */}
        {activeTab === 'profil' && (
          <motion.div
            key="profil"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Profile Form — NO NNI, NO birthDate, NO ONECI, NO scoring summary */}
            <Card className="border-border">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <User className="size-4 text-brand-500" />
                  Informations personnelles
                </CardTitle>
                <CardDescription>Vos informations de base en tant que Tiers de Confiance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* First Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="tc-firstName" className="text-xs font-medium text-foreground">
                      Prénom <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="tc-firstName"
                      value={formState.firstName}
                      onChange={(e) => setFormState((prev) => ({ ...prev, firstName: e.target.value }))}
                      placeholder="Votre prénom"
                      className="h-9 text-sm"
                    />
                  </div>
                  {/* Last Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="tc-lastName" className="text-xs font-medium text-foreground">
                      Nom <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="tc-lastName"
                      value={formState.lastName}
                      onChange={(e) => setFormState((prev) => ({ ...prev, lastName: e.target.value }))}
                      placeholder="Votre nom"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Phone */}
                  <div className="space-y-1.5">
                    <Label htmlFor="tc-phone" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Phone className="size-3" /> Téléphone
                      {profile?.isPhoneVerified && (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] px-1 py-0 border">
                          <CheckCircle2 className="size-2.5 mr-0.5" /> Vérifié
                        </Badge>
                      )}
                    </Label>
                    <Input
                      id="tc-phone"
                      value={formState.phone}
                      onChange={(e) => setFormState((prev) => ({ ...prev, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                      placeholder="07 00 00 00 00"
                      className="h-9 text-sm"
                    />
                    {!phoneOtpSent ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 mt-1"
                        onClick={handleSendPhoneVerification}
                        disabled={phoneSending || !formState.phone.trim()}
                      >
                        {phoneSending ? <Loader2 className="size-3 mr-1 animate-spin" /> : <Phone className="size-3 mr-1" />}
                        Vérifier le téléphone
                      </Button>
                    ) : (
                      <div className="flex gap-2 mt-2">
                        <Input
                          value={phoneOtpCode}
                          onChange={(e) => setPhoneOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="Code à 6 chiffres"
                          className="h-8 text-sm max-w-[140px]"
                        />
                        <Button
                          size="sm"
                          className="text-xs h-8 bg-primary hover:bg-primary/90 text-primary-foreground"
                          onClick={handleVerifyPhoneCode}
                          disabled={phoneSending || phoneOtpCode.length < 6}
                        >
                          {phoneSending ? <Loader2 className="size-3 animate-spin" /> : 'Valider'}
                        </Button>
                      </div>
                    )}
                    {phoneVerifyError && <p className="text-[10px] text-red-500">{phoneVerifyError}</p>}
                    {phoneVerifySuccess && <p className="text-[10px] text-emerald-600">{phoneVerifySuccess}</p>}
                  </div>
                  {/* Gender */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Users className="size-3" /> Genre
                    </Label>
                    <Select
                      value={formState.gender || '_empty'}
                      onValueChange={(val) => setFormState((prev) => ({ ...prev, gender: val === '_empty' ? '' : val }))}
                    >
                      <SelectTrigger className="h-9 text-sm w-full">
                        <SelectValue placeholder="Sélectionnez" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_empty">— Non renseigné —</SelectItem>
                        <SelectItem value="M">Masculin</SelectItem>
                        <SelectItem value="F">Féminin</SelectItem>
                        <SelectItem value="AUTRE">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* City */}
                  <div className="space-y-1.5">
                    <Label htmlFor="tc-city" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <MapPin className="size-3" /> Ville
                    </Label>
                    <Input
                      id="tc-city"
                      value={formState.city}
                      onChange={(e) => setFormState((prev) => ({ ...prev, city: e.target.value }))}
                      placeholder="Ex: Abidjan"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                {/* Email (editable with verification) */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Mail className="size-3" /> Email
                    {profile?.isEmailVerified && (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] px-1 py-0 border">
                        <CheckCircle2 className="size-2.5 mr-0.5" /> Vérifié
                      </Badge>
                    )}
                  </Label>
                  <Input
                    value={emailFormValue}
                    onChange={(e) => setEmailFormValue(e.target.value)}
                    placeholder={profile?.email || user?.email || 'Votre email'}
                    className="h-9 text-sm"
                  />
                  {!emailOtpSent ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 mt-1"
                      onClick={handleSendEmailVerification}
                      disabled={emailSending || !emailFormValue.trim()}
                    >
                      {emailSending ? <Loader2 className="size-3 mr-1 animate-spin" /> : <Mail className="size-3 mr-1" />}
                      Vérifier l&apos;email
                    </Button>
                  ) : (
                    <div className="flex gap-2 mt-2">
                      <Input
                        value={emailOtpCode}
                        onChange={(e) => setEmailOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="Code à 6 chiffres"
                        className="h-8 text-sm max-w-[140px]"
                      />
                      <Button
                        size="sm"
                        className="text-xs h-8 bg-primary hover:bg-primary/90 text-primary-foreground"
                        onClick={handleVerifyEmailCode}
                        disabled={emailSending || emailOtpCode.length < 6}
                      >
                        {emailSending ? <Loader2 className="size-3 animate-spin" /> : 'Valider'}
                      </Button>
                    </div>
                  )}
                  {emailVerifyError && <p className="text-[10px] text-red-500">{emailVerifyError}</p>}
                  {emailVerifySuccess && <p className="text-[10px] text-emerald-600">{emailVerifySuccess}</p>}
                </div>

                {/* Error / Success messages */}
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-xs text-red-600">{error}</p>
                  </div>
                )}
                {success && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <p className="text-xs text-emerald-600">{success}</p>
                  </div>
                )}

                {/* Save button */}
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {saving ? (
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

        {/* ── SÉCURITÉ TAB ──────────────────────────────────────────────── */}
        {activeTab === 'securite' && (
          <motion.div
            key="securite"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Password change card */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Shield className="size-4 text-brand-500" />
                  Mot de passe
                </CardTitle>
                <CardDescription>Modifiez votre mot de passe pour sécuriser votre compte</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 rounded-xl border border-border hover:bg-accent transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                      <Shield className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Mot de passe</p>
                      <p className="text-xs text-muted-foreground">
                        {profile?.passwordUpdatedAt
                          ? `Dernière modification : ${new Date(profile.passwordUpdatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
                          : 'Jamais modifié depuis la création du compte'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 border-brand-200 text-brand-600 hover:bg-brand-50"
                    onClick={() => {
                      setCurrentPassword('')
                      setNewPassword('')
                      setConfirmPassword('')
                      setPasswordError(null)
                      setPasswordSuccess(null)
                      setPasswordModalOpen(true)
                    }}
                  >
                    Modifier
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Verification status card */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ShieldCheck className="size-4 text-brand-500" />
                  Vérifications
                </CardTitle>
                <CardDescription>Statut de vérification de vos coordonnées</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Email verification */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-border hover:bg-accent transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`flex size-9 items-center justify-center rounded-lg ${profile?.isEmailVerified ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                      <Mail className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Adresse email</p>
                      <p className="text-xs text-muted-foreground">{profile?.email || 'Non renseigné'}</p>
                    </div>
                  </div>
                  <Badge className={profile?.isEmailVerified ? 'bg-emerald-50 text-emerald-700 border-emerald-200 border' : 'bg-red-50 text-red-600 border-red-200 border'}>
                    {profile?.isEmailVerified ? (
                      <><CheckCircle2 className="size-3 mr-0.5" /> Vérifié</>
                    ) : (
                      <><XCircle className="size-3 mr-0.5" /> Non vérifié</>
                    )}
                  </Badge>
                </div>

                {/* Phone verification */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-border hover:bg-accent transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`flex size-9 items-center justify-center rounded-lg ${profile?.isPhoneVerified ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-500'}`}>
                      <Phone className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Numéro de téléphone</p>
                      <p className="text-xs text-muted-foreground">{profile?.phone || 'Non renseigné'}</p>
                    </div>
                  </div>
                  <Badge className={profile?.isPhoneVerified ? 'bg-emerald-50 text-emerald-700 border-emerald-200 border' : 'bg-amber-50 text-amber-700 border-amber-200 border'}>
                    {profile?.isPhoneVerified ? (
                      <><CheckCircle2 className="size-3 mr-0.5" /> Vérifié</>
                    ) : (
                      <><AlertTriangle className="size-3 mr-0.5" /> Non vérifié</>
                    )}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Active sessions card */}
            <Card className="border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Monitor className="size-4 text-brand-500" />
                      Sessions actives
                    </CardTitle>
                    <CardDescription>Appareils connectés à votre compte</CardDescription>
                  </div>
                  {sessions.filter((s) => !s.isCurrent).length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 text-red-600 border-red-200 hover:bg-red-50"
                      onClick={handleRevokeOtherSessions}
                      disabled={revokingSessions}
                    >
                      {revokingSessions ? (
                        <><Loader2 className="size-3 mr-1 animate-spin" /> Révocation...</>
                      ) : (
                        <><LogOut className="size-3 mr-1" /> Déconnecter tout</>
                      )}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {sessionsLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : sessions.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Aucune session active trouvée</p>
                ) : (
                  <div className="space-y-3">
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                          session.isCurrent
                            ? 'border-emerald-200 bg-emerald-50/30'
                            : 'border-border hover:bg-accent'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex size-9 items-center justify-center rounded-lg ${
                            session.isCurrent ? 'bg-emerald-50 text-emerald-600' : 'bg-muted text-muted-foreground'
                          }`}>
                            <Smartphone className="size-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground">
                                {session.isCurrent ? 'Cet appareil' : 'Autre appareil'}
                              </p>
                              {session.isCurrent && (
                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] px-1.5 py-0 border font-semibold">
                                  Actif
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              Connecté le {new Date(session.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        {!session.isCurrent && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={async () => {
                              try {
                                await authFetch('/api/settings/sessions', {
                                  method: 'DELETE',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ sessionIds: [session.id] }),
                                })
                                setSessions((prev) => prev.filter((s) => s.id !== session.id))
                              } catch {}
                            }}
                          >
                            <Trash2 className="size-3 mr-1" />
                            Révoquer
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Password Change Modal */}
            <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Shield className="size-5 text-brand-500" />
                    Changer le mot de passe
                  </DialogTitle>
                  <DialogDescription>
                    Entrez votre mot de passe actuel puis choisissez un nouveau mot de passe
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  {/* Current password */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground">Mot de passe actuel</Label>
                    <div className="relative">
                      <Input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-9 text-sm pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                      >
                        {showCurrentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                  <Separator />
                  {/* New password */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground">Nouveau mot de passe</Label>
                    <div className="relative">
                      <Input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min. 8 caractères"
                        className="h-9 text-sm pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                      >
                        {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    {newPassword && (
                      <div className="space-y-1 mt-1.5">
                        <div className="flex gap-1">
                          {[/[A-Z]/, /[a-z]/, /[0-9]/, /.{8,}/].map((regex, i) => (
                            <div
                              key={i}
                              className={`h-1 flex-1 rounded-full ${
                                regex.test(newPassword) ? 'bg-emerald-400' : 'bg-neutral-200'
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          8+ caractères, 1 majuscule, 1 minuscule, 1 chiffre
                        </p>
                      </div>
                    )}
                  </div>
                  {/* Confirm password */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground">Confirmer le nouveau mot de passe</Label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`h-9 text-sm ${confirmPassword && newPassword !== confirmPassword ? 'border-red-300 focus:border-red-400' : ''}`}
                    />
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-[10px] text-red-500">Les mots de passe ne correspondent pas</p>
                    )}
                  </div>
                  {/* Error */}
                  {passwordError && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                      <p className="text-xs text-red-600">{passwordError}</p>
                    </div>
                  )}
                  {/* Success */}
                  {passwordSuccess && (
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                      <p className="text-xs text-emerald-600">{passwordSuccess}</p>
                    </div>
                  )}
                </div>
                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPasswordModalOpen(false)}
                    disabled={passwordSaving}
                    className="text-xs h-9"
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={handlePasswordChange}
                    disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-9"
                  >
                    {passwordSaving ? (
                      <><Loader2 className="size-3.5 mr-1.5 animate-spin" /> Enregistrement...</>
                    ) : (
                      <><Save className="size-3.5 mr-1.5" /> Changer le mot de passe</>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </motion.div>
        )}

        {/* ── NOTIFICATIONS TAB ─────────────────────────────────────────── */}
        {activeTab === 'notifications' && (
          <motion.div
            key="notifications"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Notification toggles */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Bell className="size-4 text-brand-500" />
                  Préférences de notifications
                </CardTitle>
                <CardDescription>Choisissez les notifications que vous souhaitez recevoir</CardDescription>
              </CardHeader>
              <CardContent>
                {notifLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-border">
                        <div className="space-y-2">
                          <div className="h-4 w-40 bg-muted rounded animate-pulse" />
                          <div className="h-3 w-56 bg-muted rounded animate-pulse" />
                        </div>
                        <div className="h-5 w-9 bg-muted rounded-full animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : notifPrefs ? (
                  <div className="space-y-1">
                    {([
                      { key: 'messages' as const, label: 'Nouveaux messages', desc: 'Recevez une notification pour chaque nouveau message', icon: Mail, color: 'bg-brand-50 text-brand-500' },
                      { key: 'dossierUpdates' as const, label: 'Mises à jour de dossier', desc: 'Soyez informé des changements de statut des dossiers', icon: FileCheck, color: 'bg-emerald-50 text-emerald-600' },
                      { key: 'visitReminders' as const, label: 'Rappels de visite', desc: 'Recevez les rappels de vos visites planifiées', icon: Bell, color: 'bg-amber-50 text-amber-600' },
                      { key: 'paymentAlerts' as const, label: 'Alertes de paiement', desc: 'Rappels pour les paiements à venir et les reçus', icon: CreditCard, color: 'bg-purple-50 text-purple-600' },
                      { key: 'promotions' as const, label: 'Promotions', desc: 'Offres spéciales et nouveautés de Mon Toit', icon: Lightbulb, color: 'bg-muted text-muted-foreground' },
                    ]).map((item) => {
                      const Icon = item.icon
                      const isEnabled = notifPrefs[item.key]
                      const isSaving = notifSaving[item.key]
                      return (
                        <div
                          key={item.key}
                          className="flex items-center justify-between p-4 rounded-xl border border-border hover:bg-accent transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`flex size-9 items-center justify-center rounded-lg ${item.color}`}>
                              <Icon className="size-4" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{item.label}</p>
                              <p className="text-xs text-muted-foreground">{item.desc}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isSaving && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                            <Switch
                              checked={isEnabled}
                              onCheckedChange={(checked) => handleToggleNotif(item.key, checked)}
                              disabled={isSaving}
                              className="data-[state=checked]:bg-brand-500"
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">Impossible de charger les préférences</p>
                )}
              </CardContent>
            </Card>

            {/* Info card about notifications */}
            <Card className="border-border bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Info className="size-4 text-brand-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Comment fonctionnent les notifications ?</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Les notifications vous informent en temps réel des événements importants sur votre compte Mon Toit.
                      Vous pouvez activer ou désactiver chaque catégorie individuellement.
                      Les notifications critiques de sécurité sont toujours actives.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
