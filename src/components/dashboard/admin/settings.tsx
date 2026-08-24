'use client'

import { useState, useEffect, useCallback } from 'react'
import { Settings, Shield, Bell, Globe, Save, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }
const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }

interface AdminSecuritySettings {
  otpRequired: boolean
  otpExpiryMinutes: number
  sessionPersistent: boolean
  sessionDurationDays: number
  maxLoginAttempts: number
}

interface AdminNotificationSettings {
  emailEnabled: boolean
  smsEnabled: boolean
  pushEnabled: boolean
}

interface AdminSlaSettings {
  tcValidationHours: number
  ownerResponseHours: number
  signalementHours: number
  autoValidationEnabled: boolean
  autoValidationThreshold: number
}

export function AdminSettings() {
  const { isAuthenticated } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'securite' | 'notifications' | 'sla'>('securite')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [security, setSecurity] = useState<AdminSecuritySettings>({
    otpRequired: true,
    otpExpiryMinutes: 5,
    sessionPersistent: true,
    sessionDurationDays: 30,
    maxLoginAttempts: 5,
  })
  const [notifications, setNotifications] = useState<AdminNotificationSettings>({
    emailEnabled: true,
    smsEnabled: false,
    pushEnabled: true,
  })
  const [sla, setSla] = useState<AdminSlaSettings>({
    tcValidationHours: 48,
    ownerResponseHours: 24,
    signalementHours: 72,
    autoValidationEnabled: true,
    autoValidationThreshold: 70,
  })

  const fetchSettings = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return }
    try {
      const data = await authFetch<{
        security: AdminSecuritySettings
        notifications: AdminNotificationSettings
        sla: AdminSlaSettings
      }>('/api/admin/settings')
      if (data.security) setSecurity(data.security)
      if (data.notifications) setNotifications(data.notifications)
      if (data.sla) setSla(data.sla)
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) return
      console.error('Failed to fetch admin settings:', err)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const handleSave = async (section: string, values: any) => {
    setSaving(true)
    try {
      await authFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, values }),
      })
      toast.success('Paramètres sauvegardés')
    } catch {
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted rounded-lg animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'securite' as const, label: 'Sécurité', icon: Shield },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'sla' as const, label: 'SLA & Délais', icon: Globe },
  ]

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={itemVariants}>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="size-5 sm:size-6 text-brand-500" /> Paramètres
        </h1>
        <p className="text-muted-foreground mt-1">Configuration de la plateforme Mon Toit</p>
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

      {/* Tab Content */}
      <AnimatePresence mode="wait">
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
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Shield className="size-4 text-brand-500" />
                  Authentification
                </CardTitle>
                <CardDescription>Paramètres de sécurité liés aux connexions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">OTP obligatoire</p>
                    <p className="text-xs text-muted-foreground">Exiger un code OTP pour chaque connexion</p>
                  </div>
                  <Switch
                    checked={security.otpRequired}
                    onCheckedChange={(v) => setSecurity({ ...security, otpRequired: v })}
                  />
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">Expiration OTP (minutes)</p>
                    <p className="text-xs text-muted-foreground">Durée de validité du code OTP</p>
                  </div>
                  <Input
                    type="number"
                    value={security.otpExpiryMinutes}
                    onChange={(e) => setSecurity({ ...security, otpExpiryMinutes: parseInt(e.target.value) || 5 })}
                    className="w-20 h-9 text-sm"
                    min={1}
                    max={60}
                  />
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">Session persistante</p>
                    <p className="text-xs text-muted-foreground">Maintenir la session active après fermeture du navigateur</p>
                  </div>
                  <Switch
                    checked={security.sessionPersistent}
                    onCheckedChange={(v) => setSecurity({ ...security, sessionPersistent: v })}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                onClick={() => handleSave('security', security)}
                disabled={saving}
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Sauvegarder
              </Button>
            </div>
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
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Bell className="size-4 text-brand-500" />
                  Canaux de notification
                </CardTitle>
                <CardDescription>Configurer les canaux de notification système</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">Notifications email</p>
                    <p className="text-xs text-muted-foreground">Envoyer des alertes par email</p>
                  </div>
                  <Switch
                    checked={notifications.emailEnabled}
                    onCheckedChange={(v) => setNotifications({ ...notifications, emailEnabled: v })}
                  />
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">Notifications SMS</p>
                    <p className="text-xs text-muted-foreground">Envoyer des alertes par SMS</p>
                  </div>
                  <Switch
                    checked={notifications.smsEnabled}
                    onCheckedChange={(v) => setNotifications({ ...notifications, smsEnabled: v })}
                  />
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">Notifications push</p>
                    <p className="text-xs text-muted-foreground">Envoyer des notifications dans l'application</p>
                  </div>
                  <Switch
                    checked={notifications.pushEnabled}
                    onCheckedChange={(v) => setNotifications({ ...notifications, pushEnabled: v })}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                onClick={() => handleSave('notifications', notifications)}
                disabled={saving}
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Sauvegarder
              </Button>
            </div>
          </motion.div>
        )}

        {/* ── SLA & DÉLAIS TAB ──────────────────────────────────────────── */}
        {activeTab === 'sla' && (
          <motion.div
            key="sla"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Globe className="size-4 text-brand-500" />
                  Délais de traitement
                </CardTitle>
                <CardDescription>Configurer les délais SLA pour les traitements</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-foreground">Délai de validation TC (heures)</Label>
                  <Input
                    type="number"
                    value={sla.tcValidationHours}
                    onChange={(e) => setSla({ ...sla, tcValidationHours: parseInt(e.target.value) || 48 })}
                    className="w-32 h-9 text-sm"
                    min={1}
                    max={720}
                  />
                  <p className="text-[10px] text-muted-foreground">Temps maximum pour qu'un TC valide un dossier</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-foreground">Délai de réponse propriétaire (heures)</Label>
                  <Input
                    type="number"
                    value={sla.ownerResponseHours}
                    onChange={(e) => setSla({ ...sla, ownerResponseHours: parseInt(e.target.value) || 24 })}
                    className="w-32 h-9 text-sm"
                    min={1}
                    max={720}
                  />
                  <p className="text-[10px] text-muted-foreground">Temps maximum pour qu'un propriétaire réponde</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-foreground">Délai de traitement des signalements (heures)</Label>
                  <Input
                    type="number"
                    value={sla.signalementHours}
                    onChange={(e) => setSla({ ...sla, signalementHours: parseInt(e.target.value) || 72 })}
                    className="w-32 h-9 text-sm"
                    min={1}
                    max={720}
                  />
                  <p className="text-[10px] text-muted-foreground">Temps maximum pour traiter un signalement</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Globe className="size-4 text-brand-500" />
                  Règles de validation
                </CardTitle>
                <CardDescription>Configuration des seuils de validation automatique</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">Validation automatique des dossiers</p>
                    <p className="text-xs text-muted-foreground">Approuver automatiquement les dossiers avec Trust Score ≥ seuil</p>
                  </div>
                  <Switch
                    checked={sla.autoValidationEnabled}
                    onCheckedChange={(v) => setSla({ ...sla, autoValidationEnabled: v })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-foreground">Seuil Trust Score pour auto-validation</Label>
                  <Input
                    type="number"
                    value={sla.autoValidationThreshold}
                    onChange={(e) => setSla({ ...sla, autoValidationThreshold: parseInt(e.target.value) || 70 })}
                    className="w-20 h-9 text-sm"
                    min={0}
                    max={100}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                onClick={() => handleSave('sla', sla)}
                disabled={saving}
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Sauvegarder
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
