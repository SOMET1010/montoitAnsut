'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  User, Shield, Bell, Mail, Phone, ShieldCheck, Settings,
  CheckCircle2, XCircle, ScanFace, CreditCard, FileCheck,
  Save, Loader2, MapPin, Users, ArrowRight, Lightbulb, AlertTriangle,
  Info, RefreshCw, Eye, EyeOff, Monitor, Smartphone, Trash2, LogOut,
  Camera, ArrowLeftRight, Building2,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { useAuthStore } from '@/lib/auth-store'
import { cn } from '@/lib/utils'
import { authFetch } from '@/lib/auth-fetch'
import { motion, AnimatePresence } from 'framer-motion'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { CITIES } from '@/lib/cities'
import type { ProfileData, ScoringData, SessionInfo, NotificationPreferences, SettingsTab } from './types'
import type { RentalFileItem } from '@/components/dashboard/locataire/rental-file'
import { ScoreCircle, ScoreComponentCard } from './sub-components'
import { KycVerificationModal } from '@/components/dashboard/locataire/settings/kyc-modal'
import { validateEmail, validatePhoneCI } from '@/lib/validators'
import { toast } from 'sonner'


// ── Animations ──────────────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

// ── Main Settings Component ─────────────────────────────────────────────────

export function SettingsSection({ defaultTab, onTabConsumed }: { defaultTab?: string; onTabConsumed?: () => void }) {
  const { user, setDashboardSection, updateUser, switchRole, logout } = useAuthStore()
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false)
  const [deleteAccountPassword, setDeleteAccountPassword] = useState('')
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [scoring, setScoring] = useState<ScoringData | null>(null)
  const [loading, setLoading] = useState(true)
  const [rentalFile, setRentalFile] = useState<RentalFileItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<SettingsTab>('profil')

  // Apply default tab if provided (e.g. after submitting rental file)
  useEffect(() => {
    if (defaultTab && ['profil', 'verification', 'notifications', 'securite'].includes(defaultTab)) {
      setActiveTab(defaultTab as SettingsTab)
      onTabConsumed?.()
    }
  }, [defaultTab, onTabConsumed])

  // KYC modal state
  const [kycModalOpen, setKycModalOpen] = useState(false)

  // Role switch confirmation modal state
  const [roleSwitchModalOpen, setRoleSwitchModalOpen] = useState(false)
  const [pendingRole, setPendingRole] = useState<'LOCATAIRE' | 'PROPRIETAIRE' | null>(null)
  const [roleSwitching, setRoleSwitching] = useState(false)
  const [roleSwitchPassword, setRoleSwitchPassword] = useState('')
  const [roleSwitchError, setRoleSwitchError] = useState<string | null>(null)

  // Form state
  const [formState, setFormState] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    gender: '',
    city: '',
    birthDate: '',
    nni: '',
  })

  // Email/Phone verification state
  const [emailValue, setEmailValue] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailOtpSent, setEmailOtpSent] = useState(false)
  const [emailOtpCode, setEmailOtpCode] = useState('')
  const [emailVerifyError, setEmailVerifyError] = useState<string | null>(null)
  const [emailVerifySuccess, setEmailVerifySuccess] = useState<string | null>(null)

  const [phoneSending, setPhoneSending] = useState(false)
  const [phoneOtpSent, setPhoneOtpSent] = useState(false)
  const [phoneOtpCode, setPhoneOtpCode] = useState('')
  const [phoneVerifyError, setPhoneVerifyError] = useState<string | null>(null)
  const [phoneVerifySuccess, setPhoneVerifySuccess] = useState<string | null>(null)

  // ONECI verification state
  const [oneciVerifying, setOneciVerifying] = useState(false)
  const [oneciResult, setOneciResult] = useState<{ verified: boolean; message: string; details?: string } | null>(null)

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

  // Avatar upload state
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // ONECI section ref for scroll
  const oneciSectionRef = useRef<HTMLDivElement>(null)

  // Fetch profile & scoring data
  // Dep sur user?.id (string stable) plutôt que user (nouvelle référence à chaque
  // checkAuth → réécraserait formState à chaque visibilitychange). Voir AppLifecycleManager.
  const userId = user?.id
  const fetchProfileAndScoring = useCallback(async () => {
    if (!userId) return

    try {
      const [profileResult, scoringResult, rentalFileResult] = await Promise.allSettled([
        authFetch<{ user: ProfileData }>('/api/profile'),
        authFetch<ScoringData>('/api/scoring'),
        authFetch<{ data: RentalFileItem[] }>('/api/rental-file'),
      ])

      if (profileResult.status === 'fulfilled') {
        const p = profileResult.value.user
        setProfile(p)
        setFormState({
          firstName: p.firstName || '',
          lastName: p.lastName || '',
          phone: p.phone || '',
          gender: p.gender || '',
          city: p.city || '',
          birthDate: p.birthDate ? new Date(p.birthDate).toISOString().split('T')[0] : '',
          nni: p.nni || '',
        })
        setEmailValue(p.email || '')
      }

      if (scoringResult.status === 'fulfilled') {
        setScoring(scoringResult.value)
      }

      if (rentalFileResult.status === 'fulfilled') {
        const files = rentalFileResult.value.data ?? []
        const submitted = files.find((f) => f.status !== 'DRAFT')
        const draft = files.find((f) => f.status === 'DRAFT')
        setRentalFile(submitted || draft || null)
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchProfileAndScoring()
  }, [fetchProfileAndScoring])

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

  // Auto-clear email/phone verification success
  useEffect(() => {
    if (emailVerifySuccess) {
      const timer = setTimeout(() => setEmailVerifySuccess(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [emailVerifySuccess])

  useEffect(() => {
    if (phoneVerifySuccess) {
      const timer = setTimeout(() => setPhoneVerifySuccess(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [phoneVerifySuccess])

  // Fetch sessions when security tab is active
  useEffect(() => {
    if (activeTab === 'securite' && user) {
      setSessionsLoading(true)
      authFetch<{ sessions: SessionInfo[] }>('/api/settings/sessions')
        .then((data) => setSessions(data.sessions))
        .catch(() => toast.error('Impossible de charger les sessions actives'))
        .finally(() => setSessionsLoading(false))
    }
  }, [activeTab, user])

  // Fetch notification preferences when notifications tab is active
  useEffect(() => {
    if (activeTab === 'notifications' && user) {
      setNotifLoading(true)
      authFetch<{ preferences: NotificationPreferences }>('/api/settings/notifications')
        .then((data) => setNotifPrefs(data.preferences))
        .catch(() => toast.error('Impossible de charger vos préférences de notification'))
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
        updateUser({ passwordUpdatedAt: profileResult.user.passwordUpdatedAt })
      } catch {}
      setTimeout(() => setPasswordModalOpen(false), 1500)
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Erreur lors du changement de mot de passe')
    } finally {
      setPasswordSaving(false)
    }
  }, [currentPassword, newPassword, confirmPassword])

  const handleDeleteAccount = useCallback(async () => {
    setDeleteAccountError(null)
    if (!deleteAccountPassword) {
      setDeleteAccountError('Mot de passe requis')
      return
    }
    setDeletingAccount(true)
    try {
      await authFetch('/api/user/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deleteAccountPassword }),
      })
      await logout()
      window.location.href = '/'
    } catch (err) {
      setDeleteAccountError(err instanceof Error ? err.message : 'Erreur lors de la suppression du compte')
      setDeletingAccount(false)
    }
  }, [deleteAccountPassword, logout])

  // Revoke other sessions handler
  const handleRevokeOtherSessions = useCallback(async () => {
    setRevokingSessions(true)
    try {
      await authFetch('/api/settings/sessions', { method: 'DELETE' })
      setSessions((prev) => prev.filter((s) => s.isCurrent))
      toast.success('Autres sessions déconnectées')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la déconnexion des autres sessions')
    } finally {
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la mise à jour de la préférence')
    } finally {
      setNotifSaving((prev) => ({ ...prev, [key]: false }))
    }
  }, [])

  // ── KYC verified callback ────────────────────────────────────────────────
  const handleKycVerified = useCallback(async () => {
    setKycModalOpen(false)
    // Refresh profile and scoring, then pre-fill form with OCR data
    try {
      const [profileResult, scoringResult] = await Promise.allSettled([
        authFetch<{ user: ProfileData }>('/api/profile'),
        authFetch<ScoringData>('/api/scoring'),
      ])
      if (profileResult.status === 'fulfilled') {
        const p = profileResult.value.user
        setProfile(p)
        updateUser({
          firstName: p.firstName,
          lastName: p.lastName,
          email: p.email,
          phone: p.phone,
          avatarUrl: p.avatarUrl,
        })
        // Pre-fill form with OCR-extracted data (first_name, last_name, gender, nni, birth_date)
        setFormState({
          firstName: p.firstName || '',
          lastName: p.lastName || '',
          phone: p.phone || '',
          gender: p.gender || '',
          city: p.city || '',
          birthDate: p.birthDate ? new Date(p.birthDate).toISOString().split('T')[0] : '',
          nni: p.nni || '',
        })
      }
      if (scoringResult.status === 'fulfilled') setScoring(scoringResult.value)
    } catch {}
  }, [])

  const handleKycRedo = useCallback(async () => {
      const [profileResult, scoringResult, rentalFileResult] = await Promise.allSettled([
        authFetch<{ user: ProfileData }>('/api/profile'),
        authFetch<ScoringData>('/api/scoring'),
        authFetch<{ data: RentalFileItem[] }>('/api/rental-file'),
      ])
    if (profileResult.status === 'fulfilled') {
      const p = profileResult.value.user
      setProfile(p)
      updateUser({
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        phone: p.phone,
        avatarUrl: p.avatarUrl,
      })
    }
    if (scoringResult.status === 'fulfilled') setScoring(scoringResult.value)
  }, [])

  // ── Avatar upload handler ────────────────────────────────────────────────
  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    // Validate file type
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      setError("Format d'image invalide. Utilisez JPG, PNG ou WEBP.")
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError("L'image est trop volumineuse (max 2 Mo).")
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
        img.onerror = () => reject(new Error("Impossible de charger l'image"))
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

  // Save profile
  const handleSave = async () => {
    // Bloque l'enregistrement si email ou téléphone a été MODIFIÉ mais pas
    // (encore) vérifié. L'utilisateur doit cliquer sur "Vérifier" et confirmer
    // l'OTP — ne pas envoyer d'OTP automatiquement au moment du save.
    const phoneChanged = formState.phone.trim() !== (profile?.phone || '').trim()
    const emailChanged = emailValue.trim() !== (profile?.email || '').trim()

    if (emailChanged && emailValue.trim() && !profile?.isEmailVerified) {
      setError('Vérifiez d\'abord votre nouvelle adresse email avant d\'enregistrer (bouton « Vérifier » à côté du champ).')
      return
    }
    if (phoneChanged && formState.phone.trim() && !profile?.isPhoneVerified) {
      setError('Vérifiez d\'abord votre nouveau numéro de téléphone avant d\'enregistrer (bouton « Vérifier » à côté du champ).')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await authFetch<{ user: ProfileData }>('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formState, email: emailValue.trim() || undefined }),
      })

      setProfile(result.user)
      updateUser({
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        email: result.user.email,
        phone: result.user.phone,
        city: result.user.city,
        address: result.user.address,
        avatarUrl: result.user.avatarUrl,
      })
      setSuccess('Profil mis à jour avec succès !')

      // Re-fetch scoring to reflect profile changes
      try {
        const scoringResult = await authFetch<ScoringData>('/api/scoring')
        setScoring(scoringResult)
      } catch {
        // Scoring refresh failed silently
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  // ONECI verification handler
  const handleOneciVerify = async () => {
    setOneciVerifying(true)
    setOneciResult(null)

    // First, save the profile if NNI or birthDate changed
    try {
      await authFetch<{ user: ProfileData }>('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nni: formState.nni,
          birthDate: formState.birthDate || null,
        }),
      })
    } catch {
      // Profile save might fail, but try verification anyway
    }

    try {
      const result = await authFetch<{ verified: boolean; message: string; details?: string; error?: string }>('/api/oneci/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nni: formState.nni,
          birthDate: formState.birthDate || null,
        }),
      })

      setOneciResult({
        verified: result.verified,
        message: result.verified ? result.message : (result.error || result.message),
        details: result.details,
      })

      // If verified, refresh profile and scoring
      if (result.verified) {
      const [profileResult, scoringResult, rentalFileResult] = await Promise.allSettled([
        authFetch<{ user: ProfileData }>('/api/profile'),
        authFetch<ScoringData>('/api/scoring'),
        authFetch<{ data: RentalFileItem[] }>('/api/rental-file'),
      ])
        if (profileResult.status === 'fulfilled') {
          const p = profileResult.value.user
          setProfile(p)
          updateUser({
            firstName: p.firstName,
            lastName: p.lastName,
            email: p.email,
            phone: p.phone,
            avatarUrl: p.avatarUrl,
          })
        }
        if (scoringResult.status === 'fulfilled') {
          setScoring(scoringResult.value)
        }
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

  // ── Email verification handlers ──────────────────────────────────────
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
        const profileResult = await authFetch<{ user: ProfileData }>('/api/profile')
        setProfile(profileResult.user)
        updateUser({ email: profileResult.user.email, isEmailVerified: true })
      }
    } catch (err) {
      setEmailVerifyError(err instanceof Error ? err.message : 'Code invalide ou expiré')
    } finally {
      setEmailSending(false)
    }
  }, [emailOtpCode, emailValue, updateUser])

  // ── Phone verification handlers ──────────────────────────────────────
  const handleSendPhoneVerification = useCallback(async () => {
    const validation = validatePhoneCI(formState.phone)
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

  const statusBadgeClass = scoring
    ? scoring.statusColor === 'emerald'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : scoring.statusColor === 'amber'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-red-50 text-red-700 border-red-200'
    : 'bg-muted text-muted-foreground border-border'

  // Scoring tab navigation items
  const tabs = [
    { id: 'profil' as const, label: 'Mon Profil', icon: User },
    { id: 'verification' as const, label: 'Vérifications', icon: ShieldCheck },
    { id: 'securite' as const, label: 'Sécurité', icon: Shield },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
  ]

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-500/10 to-transparent -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 rounded-none">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-brand-100">
            <Settings className="size-6 text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Paramètres</h1>
            <p className="text-muted-foreground mt-1">Gérez votre compte et vos préférences</p>
          </div>
        </div>
      </div>

      {/* User Info Card with integrated scoring + role switch */}
      <motion.div variants={itemVariants}>
        <Card className="border-border overflow-hidden">
          <CardContent className="p-6 pb-3">
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
              {/* Trust Score circle */}
              {scoring && (
                <button
                  onClick={() => setActiveTab('verification')}
                  className="flex flex-col items-center gap-1 shrink-0 group"
                >
                  <ScoreCircle score={scoring.score} statusColor={scoring.statusColor} size="md" />
                  <span className="text-[9px] font-medium text-muted-foreground group-hover:text-brand-500 transition-colors">
                    Trust Score
                  </span>
                </button>
              )}
            </div>
          </CardContent>

          {/* ── Role Switch Button at bottom of profile card ──────────── */}
          {(() => {
            const effectiveRole = user?.activeRole || user?.role
            const canSwitch = ['LOCATAIRE', 'PROPRIETAIRE', 'AGENCE'].includes(user?.role || '') || ['LOCATAIRE', 'PROPRIETAIRE', 'AGENCE'].includes(user?.activeRole || user?.role || '')
            if (!canSwitch) return null
            const targetRole = effectiveRole === 'LOCATAIRE' ? 'PROPRIETAIRE' : 'LOCATAIRE'
            const isTargetProprietaire = targetRole === 'PROPRIETAIRE'
            return (
              <div className="px-6 pb-4 pt-1">
                <button
                  onClick={() => {
                    setPendingRole(targetRole)
                    setRoleSwitchPassword('')
                    setRoleSwitchError(null)
                    setRoleSwitchModalOpen(true)
                  }}
                  className={cn(
                    'w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-semibold transition-all shadow-sm',
                    isTargetProprietaire
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-amber-600 hover:bg-amber-700 text-white'
                  )}
                >
                  {isTargetProprietaire ? (
                    <Building2 className="size-4.5" />
                  ) : (
                    <User className="size-4.5" />
                  )}
                  Tableau de bord {isTargetProprietaire ? 'propriétaire' : 'locataire'}
                  <ArrowRight className="size-4 ml-0.5 opacity-70" />
                </button>
              </div>
            )
          })()}
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
            {/* Profile completion summary */}
            {scoring && (
              <Card className="border-brand-100 bg-gradient-to-r from-brand-50/50 to-white overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-foreground">Complétion du profil</span>
                        <Badge className={`border text-[10px] font-semibold px-2 py-0 ${statusBadgeClass}`}>
                          {scoring.statusLabel}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        {scoring.breakdown.profile.score}/{scoring.breakdown.profile.max} points — Remplissez tous les champs pour maximiser votre score
                      </p>
                      <Progress
                        value={(scoring.breakdown.profile.score / scoring.breakdown.profile.max) * 100}
                        className="h-2"
                      />
                      <div className="flex gap-4 mt-2">
                        {scoring.breakdown.profile.fields.map((field) => (
                          <span key={field.key} className={`text-[10px] font-medium ${field.filled ? 'text-emerald-600' : 'text-red-400'}`}>
                            {field.filled ? '✓' : '✗'} {field.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Role Switch Confirmation Modal */}
            <Dialog open={roleSwitchModalOpen} onOpenChange={setRoleSwitchModalOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ArrowLeftRight className="size-5 text-brand-500" />
                    Confirmer le changement de rôle
                  </DialogTitle>
                  <DialogDescription>
                    Vous allez basculer vers le mode {pendingRole === 'LOCATAIRE' ? 'Locataire' : 'Propriétaire'}
                  </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                  <div className="flex items-center justify-center gap-4 mb-6">
                    {/* Current role */}
                    <div className={cn(
                      'flex flex-col items-center gap-2 px-4 py-3 rounded-xl border-2 min-w-[100px]',
                      'opacity-50'
                    )}>
                      {(() => {
                        const currentRole = user?.activeRole || user?.role
                        if (currentRole === 'LOCATAIRE') {
                          return <User className="size-8 text-amber-500" />
                        }
                        return <Building2 className="size-8 text-emerald-500" />
                      })()}
                      <span className="text-xs font-medium text-muted-foreground">
                        {(() => {
                          const currentRole = user?.activeRole || user?.role
                          return currentRole === 'LOCATAIRE' ? 'Locataire' : 'Propriétaire'
                        })()}
                      </span>
                    </div>
                    {/* Arrow */}
                    <div className="flex items-center">
                      <ArrowRight className="size-6 text-brand-500" />
                    </div>
                    {/* Target role */}
                    <div className={cn(
                      'flex flex-col items-center gap-2 px-4 py-3 rounded-xl border-2 min-w-[100px]',
                      pendingRole === 'LOCATAIRE'
                        ? 'border-amber-300 bg-amber-50'
                        : 'border-emerald-300 bg-emerald-50'
                    )}>
                      {pendingRole === 'LOCATAIRE' ? (
                        <User className="size-8 text-amber-500" />
                      ) : (
                        <Building2 className="size-8 text-emerald-500" />
                      )}
                      <span className={cn(
                        'text-xs font-semibold',
                        pendingRole === 'LOCATAIRE' ? 'text-amber-700' : 'text-emerald-700'
                      )}>
                        {pendingRole === 'LOCATAIRE' ? 'Locataire' : 'Propriétaire'}
                      </span>
                    </div>
                  </div>

                  <div className={cn(
                    'p-3 rounded-lg border',
                    pendingRole === 'LOCATAIRE'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-emerald-50 border-emerald-200'
                  )}>
                    <div className="flex items-start gap-2">
                      <Info className={cn(
                        'size-4 shrink-0 mt-0.5',
                        pendingRole === 'LOCATAIRE' ? 'text-amber-500' : 'text-emerald-500'
                      )} />
                      <div>
                        <p className={cn(
                          'text-xs font-medium',
                          pendingRole === 'LOCATAIRE' ? 'text-amber-700' : 'text-emerald-700'
                        )}>
                          {pendingRole === 'LOCATAIRE'
                            ? 'En mode Locataire, vous pourrez :'
                            : 'En mode Propriétaire, vous pourrez :'}
                        </p>
                        <ul className={cn(
                          'text-[11px] mt-1 space-y-0.5 list-disc list-inside',
                          pendingRole === 'LOCATAIRE' ? 'text-amber-600' : 'text-emerald-600'
                        )}>
                          {pendingRole === 'LOCATAIRE' ? (
                            <>
                              <li>Chercher et sauvegarder des biens</li>
                              <li>Soumettre des candidatures de location</li>
                              <li>Planifier des visites</li>
                              <li>Gérer vos paiements et baux</li>
                            </>
                          ) : (
                            <>
                              <li>Publier et gérer vos biens</li>
                              <li>Traiter les demandes de visite</li>
                              <li>Gérer les dossiers locatifs</li>
                              <li>Suivre vos baux et paiements</li>
                            </>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground text-center mt-3">
                    Vous pouvez revenir à votre rôle actuel à tout moment depuis les paramètres.
                  </p>

                  <div className="mt-4 space-y-1.5">
                    <Label htmlFor="settingsSwitchRolePassword" className="text-xs font-medium text-foreground">
                      Confirmez avec votre mot de passe
                    </Label>
                    <Input
                      id="settingsSwitchRolePassword"
                      type="password"
                      value={roleSwitchPassword}
                      onChange={(e) => setRoleSwitchPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-9 text-sm"
                    />
                    {roleSwitchError && (
                      <p className="text-xs text-red-600">{roleSwitchError}</p>
                    )}
                  </div>
                </div>

                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setRoleSwitchModalOpen(false)
                      setPendingRole(null)
                    }}
                    disabled={roleSwitching}
                    className="border-border"
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!pendingRole || !roleSwitchPassword) return
                      setRoleSwitchError(null)
                      setRoleSwitching(true)
                      try {
                        await switchRole(pendingRole, roleSwitchPassword)
                        setSuccess(`Mode ${pendingRole === 'LOCATAIRE' ? 'Locataire' : 'Propriétaire'} activé`)
                        setRoleSwitchModalOpen(false)
                        setPendingRole(null)
                        setRoleSwitchPassword('')
                      } catch (err) {
                        setRoleSwitchError(err instanceof Error ? err.message : 'Erreur lors du changement de rôle')
                      } finally {
                        setRoleSwitching(false)
                      }
                    }}
                    disabled={roleSwitching || !roleSwitchPassword}
                    className={cn(
                      pendingRole === 'LOCATAIRE'
                        ? 'bg-amber-500 hover:bg-amber-600 text-white'
                        : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    )}
                  >
                    {roleSwitching ? (
                      <>
                        <Loader2 className="size-4 mr-1.5 animate-spin" />
                        Changement...
                      </>
                    ) : (
                      <>
                        <ArrowLeftRight className="size-4 mr-1.5" />
                        Confirmer
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Profile Form */}
            <Card className="border-border">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <User className="size-4 text-brand-500" />
                  Informations personnelles
                </CardTitle>
                <CardDescription>Ces informations contribuent à votre Trust Score (5%)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* First Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName" className="text-xs font-medium text-foreground">
                      Prénom <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="firstName"
                      value={formState.firstName}
                      onChange={(e) => setFormState((prev) => ({ ...prev, firstName: e.target.value }))}
                      placeholder="Votre prénom"
                      className="h-9 text-sm"
                    />
                  </div>
                  {/* Last Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName" className="text-xs font-medium text-foreground">
                      Nom <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="lastName"
                      value={formState.lastName}
                      onChange={(e) => setFormState((prev) => ({ ...prev, lastName: e.target.value }))}
                      placeholder="Votre nom"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Gender */}
                  <div className="space-y-1.5">
                    <Label htmlFor="gender" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Users className="size-3" /> Genre
                    </Label>
                    <Select
                      value={formState.gender || '_empty'}
                      onValueChange={(val) => setFormState((prev) => ({ ...prev, gender: val === '_empty' ? '' : val }))}
                    >
                      <SelectTrigger id="gender" className="h-9 text-sm w-full">
                        <SelectValue placeholder="Sélectionnez" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_empty">— Non renseigné —</SelectItem>
                        <SelectItem value="HOMME">Masculin</SelectItem>
                        <SelectItem value="FEMME">Féminin</SelectItem>
                        <SelectItem value="AUTRE">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* City */}
                  <div className="space-y-1.5">
                    <Label htmlFor="city" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <MapPin className="size-3" /> Ville
                    </Label>
                    <SearchableSelect
                      id="city"
                      options={CITIES.map((c) => ({ value: c.name, label: c.name }))}
                      value={formState.city}
                      onChange={(v) => setFormState((prev) => ({ ...prev, city: v }))}
                      placeholder="Sélectionnez une ville"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Phone */}
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Phone className="size-3" /> Téléphone
                      {profile?.isPhoneVerified && (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] px-1 py-0 border">
                          <CheckCircle2 className="size-2.5 mr-0.5" /> Vérifié
                        </Badge>
                      )}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="phone"
                        value={formState.phone}
                        onChange={(e) => setFormState((prev) => ({ ...prev, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                        placeholder="07 00 00 00 00"
                        className="h-9 text-sm flex-1"
                      />
                      {!profile?.isPhoneVerified && formState.phone && (
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
                    <Label htmlFor="email" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Mail className="size-3" /> Email
                      {profile?.isEmailVerified && (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] px-1 py-0 border">
                          <CheckCircle2 className="size-2.5 mr-0.5" /> Vérifié
                        </Badge>
                      )}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="email"
                        value={emailValue}
                        onChange={(e) => {
                          setEmailValue(e.target.value)
                          setEmailVerifyError(null)
                          setEmailVerifySuccess(null)
                          setEmailOtpSent(false)
                          setEmailOtpCode('')
                        }}
                        placeholder="email@exemple.ci"
                        className="h-9 text-sm flex-1"
                        disabled={emailSending}
                      />
                      {(!profile?.isEmailVerified || emailValue !== (profile?.email || user?.email || '')) && emailValue && (
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

                    {emailOtpSent && !profile?.isEmailVerified && (
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

        {/* ── VERIFICATION TAB ──────────────────────────────────────────── */}
        {activeTab === 'verification' && scoring && (
          <motion.div
            key="verification"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >


            {/* Score breakdown components */}
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
                icon={FileCheck}
                label={scoring.breakdown.roleSpecific.label}
                weight={scoring.breakdown.roleSpecific.weight}
                score={scoring.breakdown.roleSpecific.score}
                max={scoring.breakdown.roleSpecific.max}
                statusColor={scoring.statusColor}
                details={scoring.breakdown.roleSpecific.hasFile && !scoring.breakdown.roleSpecific.approved ? <span className="text-amber-500 font-semibold">En cours de validation</span> : scoring.breakdown.roleSpecific.description}
                actionLabel={scoring.breakdown.roleSpecific.hasFile ? "Voir le détail" : "Commencer"}
                onAction={() => {
                  const effectiveRole = user?.activeRole || user?.role
                  setDashboardSection(effectiveRole === 'PROPRIETAIRE' || effectiveRole === 'AGENCE' ? 'owner-file' : 'rental-file')
                }}
              />
            </div>

            {/* ONECI Verification form */}
            <Card className="border-border" ref={oneciSectionRef}>
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <CreditCard className="size-4 text-brand-500" />
                  Vérification d&apos;identité ONECI
                </CardTitle>
                <CardDescription>
                  Renseignez votre NNI et date de naissance pour vérifier votre carte d&apos;identité nationale auprès de l&apos;ONECI (+25% Trust Score)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* NNI */}
                  <div className="space-y-1.5">
                    <Label htmlFor="nni-scoring" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      NNI
                      {profile?.oneciVerified && (
                        <CheckCircle2 className="size-3 text-emerald-500" />
                      )}
                    </Label>
                    <Input
                      id="nni-scoring"
                      value={formState.nni}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 11)
                        setFormState((prev) => ({ ...prev, nni: val }))
                      }}
                      placeholder="Numéro National d'Identification"
                      className="h-9 text-sm"
                      disabled={oneciVerifying}
                      maxLength={11}
                    />
                    <p className="text-[10px] text-muted-foreground">10 à 11 chiffres — requis pour la vérification ONECI</p>
                  </div>
                  {/* Birth Date */}
                  <div className="space-y-1.5">
                    <Label htmlFor="birthDate-scoring" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      Date de naissance
                    </Label>
                    <Input
                      id="birthDate-scoring"
                      type="date"
                      value={formState.birthDate}
                      onChange={(e) => setFormState((prev) => ({ ...prev, birthDate: e.target.value }))}
                      className="h-9 text-sm"
                      disabled={oneciVerifying}
                    />
                  </div>
                </div>

                {/* Verify button */}
                <div className="flex justify-end">
                  <Button
                    onClick={handleOneciVerify}
                    disabled={oneciVerifying || !formState.nni || formState.nni.length < 10}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {oneciVerifying ? (
                      <><Loader2 className="size-4 mr-2 animate-spin" /> Vérification en cours...</>
                    ) : (
                      <><CreditCard className="size-4 mr-2" /> Vérifier mon identité</>
                    )}
                  </Button>
                </div>

                {/* ONECI result */}
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
              profile={profile}
              onVerified={handleKycVerified}
              onRedo={handleKycRedo}
            />


          </motion.div>
        )}

        {/* ── SECURITY TAB ──────────────────────────────────────────────── */}
        {activeTab === 'securite' && (
          <motion.div
            key="securite"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Password */}
            <Card className="border-border">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Shield className="size-4 text-brand-500" />
                  Mot de passe
                </CardTitle>
                <CardDescription>
                  Dernière modification : {profile?.passwordUpdatedAt
                    ? new Date(profile.passwordUpdatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                    : 'Jamais'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={() => {
                    setPasswordModalOpen(true)
                    setPasswordError(null)
                    setPasswordSuccess(null)
                  }}
                  className="border-brand-200 text-brand-600 hover:bg-brand-50"
                >
                  <Shield className="size-4 mr-2" />
                  Modifier le mot de passe
                </Button>
              </CardContent>
            </Card>

            {/* Password change modal */}
            <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Shield className="size-5 text-brand-500" />
                    Changer le mot de passe
                  </DialogTitle>
                  <DialogDescription>
                    Minimum 8 caractères, avec une majuscule, une minuscule et un chiffre.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  {/* Current password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="currentPassword" className="text-xs font-medium text-foreground">
                      Mot de passe actuel
                    </Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-9 text-sm pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showCurrentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  {/* New password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="newPassword" className="text-xs font-medium text-foreground">
                      Nouveau mot de passe
                    </Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-9 text-sm pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword" className="text-xs font-medium text-foreground">
                      Confirmer le nouveau mot de passe
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-9 text-sm"
                    />
                  </div>

                  {/* Password strength indicator */}
                  {newPassword.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        {['has-min', 'has-maj', 'has-chiffre'].map((criteria) => {
                          const met = criteria === 'has-min'
                            ? /[a-z]/.test(newPassword) && newPassword.length >= 8
                            : criteria === 'has-maj'
                              ? /[A-Z]/.test(newPassword)
                              : /[0-9]/.test(newPassword)
                          return (
                            <div
                              key={criteria}
                              className={`h-1 flex-1 rounded-full transition-colors ${
                                met ? 'bg-emerald-400' : 'bg-muted'
                              }`}
                            />
                          )}
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {newPassword.length >= 8 && /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword)
                          ? 'Mot de passe fort'
                          : '8+ caractères, majuscule, minuscule, chiffre'}
                      </p>
                    </div>
                  )}

                  {passwordError && (
                    <div className="p-2.5 rounded-lg bg-red-50 border border-red-200">
                      <p className="text-xs text-red-600">{passwordError}</p>
                    </div>
                  )}
                  {passwordSuccess && (
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                      <p className="text-xs text-emerald-600">{passwordSuccess}</p>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setPasswordModalOpen(false)}
                    disabled={passwordSaving}
                    className="border-border"
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={handlePasswordChange}
                    disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {passwordSaving ? (
                      <><Loader2 className="size-4 mr-1.5 animate-spin" /> Enregistrement...</>
                    ) : (
                      'Enregistrer'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Vérifications */}
            <Card className="border-border">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ShieldCheck className="size-4 text-brand-500" />
                  Vérifications
                </CardTitle>
                <CardDescription>Statut de vos vérifications de compte</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <Mail className="size-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">Email</span>
                  </div>
                  {profile?.isEmailVerified ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      <CheckCircle2 className="size-3 mr-1" /> Vérifié
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-50 text-amber-700 border-amber-200">
                      <AlertTriangle className="size-3 mr-1" /> Non vérifié
                    </Badge>
                  )}
                </div>
                <Separator />
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <Phone className="size-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">Téléphone</span>
                  </div>
                  {profile?.isPhoneVerified ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      <CheckCircle2 className="size-3 mr-1" /> Vérifié
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-50 text-amber-700 border-amber-200">
                      <AlertTriangle className="size-3 mr-1" /> Non vérifié
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Sessions */}
            <Card className="border-border">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Monitor className="size-4 text-brand-500" />
                      Sessions actives
                    </CardTitle>
                    <CardDescription>Appareils connectés à votre compte</CardDescription>
                  </div>
                  {sessions.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRevokeOtherSessions}
                      disabled={revokingSessions}
                      className="h-8 text-xs border-red-200 text-red-600 hover:bg-red-50"
                    >
                      {revokingSessions ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <><LogOut className="size-3.5 mr-1" /> Déconnecter les autres</>
                      )}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {sessionsLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : sessions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aucune session active</p>
                ) : (
                  <div className="space-y-2">
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex size-8 items-center justify-center rounded-lg ${
                            session.isCurrent ? 'bg-brand-50 text-brand-500' : 'bg-muted text-muted-foreground'
                          }`}>
                            {session.isCurrent ? <Smartphone className="size-4" /> : <Monitor className="size-4" />}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-foreground">
                              {session.isCurrent ? 'Cette session (actuelle)' : `Session #${session.id.slice(0, 8)}`}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              Connecté le {new Date(session.createdAt).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                        </div>
                        {session.isCurrent && (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                            Actuelle
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Danger zone */}
            <Card className="border-red-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2 text-red-600">
                  <AlertTriangle className="size-4" />
                  Zone de danger
                </CardTitle>
                <CardDescription>
                  Supprimer définitivement votre compte et vos données personnelles.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => { setDeleteAccountError(null); setDeleteAccountPassword(''); setDeleteAccountModalOpen(true) }}
                >
                  <Trash2 className="size-4 mr-2" />
                  Supprimer mon compte
                </Button>
              </CardContent>
            </Card>

            {/* Delete account confirmation modal */}
            <Dialog open={deleteAccountModalOpen} onOpenChange={setDeleteAccountModalOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="size-5" />
                    Supprimer mon compte
                  </DialogTitle>
                  <DialogDescription>
                    Cette action est irréversible. Vos données personnelles seront supprimées et vous serez déconnecté.
                    {' '}Impossible si vous avez un bail actif ou en attente de signature.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="deleteAccountPassword" className="text-xs font-medium text-foreground">
                      Confirmez avec votre mot de passe
                    </Label>
                    <Input
                      id="deleteAccountPassword"
                      type="password"
                      value={deleteAccountPassword}
                      onChange={(e) => setDeleteAccountPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-9 text-sm"
                    />
                  </div>
                  {deleteAccountError && (
                    <p className="text-xs text-red-600">{deleteAccountError}</p>
                  )}
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="outline" onClick={() => setDeleteAccountModalOpen(false)} disabled={deletingAccount}>
                    Annuler
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={deletingAccount || !deleteAccountPassword}
                  >
                    {deletingAccount ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Trash2 className="size-4 mr-2" />}
                    Supprimer définitivement
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

          </motion.div>
        )}

        {/* ── NOTIFICATIONS TAB ──────────────────────────────────────────── */}
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
                <CardDescription>Choisissez les notifications que vous souhaitez recevoir</CardDescription>
              </CardHeader>
              <CardContent>
                {notifLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                        <div className="h-6 w-10 bg-muted rounded-full animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : notifPrefs ? (
                  <div className="space-y-1">
                    {[
                      { key: 'messages' as const, label: 'Nouveaux messages', icon: Mail },
                      { key: 'dossierUpdates' as const, label: 'Mises à jour de dossier', icon: FileCheck },
                      { key: 'visitReminders' as const, label: 'Rappels de visite', icon: MapPin },
                      { key: 'paymentAlerts' as const, label: 'Alertes de paiement', icon: CreditCard },
                      { key: 'promotions' as const, label: 'Promotions', icon: Lightbulb },
                    ].map(({ key, label, icon: Icon }) => (
                      <div
                        key={key}
                        className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <Icon className="size-4" />
                          </div>
                          <div>
                            <span className="text-sm font-medium text-foreground">{label}</span>
                          </div>
                        </div>
                        <Switch
                          checked={notifPrefs[key]}
                          onCheckedChange={(checked) => handleToggleNotif(key, checked)}
                          disabled={notifSaving[key]}
                          className="data-[state=checked]:bg-brand-500"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Impossible de charger les préférences.</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
