'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Shield, Key, Smartphone, Monitor, Eye, EyeOff,
  CheckCircle2, XCircle, Loader2, Trash2, LogOut,
  MapPin, Globe, Clock, ShieldCheck, BarChart3,
  Users, Building2, AlertTriangle,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch } from '@/lib/auth-fetch'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

// ── Types ───────────────────────────────────────────────────────────────────

interface ConnectionLogEntry {
  id: string
  ipAddress: string | null
  userAgent: string | null
  device: string | null
  location: string | null
  createdAt: string
}

interface ProfileViewStats {
  totalProfileViews: number
  totalPropertyViews: number
  recentPropertyViews: { propertyId: string; title: string; viewsCount: number }[]
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

// ── Parse User Agent ────────────────────────────────────────────────────────

function parseDevice(ua: string | null): { device: string; browser: string } {
  if (!ua) return { device: 'Inconnu', browser: 'Inconnu' }

  let device = 'Inconnu'
  let browser = 'Inconnu'

  // Detect device type
  if (/iPhone/i.test(ua)) device = 'iPhone'
  else if (/iPad/i.test(ua)) device = 'iPad'
  else if (/Android/i.test(ua)) device = 'Android'
  else if (/Windows/i.test(ua)) device = 'Windows'
  else if (/Macintosh/i.test(ua)) device = 'Mac'
  else if (/Linux/i.test(ua)) device = 'Linux'

  // Detect browser
  if (/Edg/i.test(ua)) browser = 'Edge'
  else if (/Chrome/i.test(ua)) browser = 'Chrome'
  else if (/Firefox/i.test(ua)) browser = 'Firefox'
  else if (/Safari/i.test(ua)) browser = 'Safari'
  else if (/Opera|OPR/i.test(ua)) browser = 'Opera'

  return { device, browser }
}

// ── Main Security Component ─────────────────────────────────────────────────

export function OwnerSecurity() {
  const { user } = useAuthStore()

  // ── Change password state (US-P-120) ────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // ── 2FA state (US-P-121) ────────────────────────────────────────────────
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [twoFactorLoading, setTwoFactorLoading] = useState(false)
  const [twoFactorFetching, setTwoFactorFetching] = useState(true)

  // ── Connection logs state (US-P-122) ────────────────────────────────────
  const [connectionLogs, setConnectionLogs] = useState<ConnectionLogEntry[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [revokeAllLoading, setRevokeAllLoading] = useState(false)

  // ── Profile view tracking state (US-P-123) ──────────────────────────────
  const [viewStats, setViewStats] = useState<ProfileViewStats | null>(null)
  const [viewStatsLoading, setViewStatsLoading] = useState(false)

  // ── Fetch 2FA status on mount ───────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    const fetch2FA = async () => {
      try {
        const profileResult = await authFetch<{ user: Record<string, unknown> }>('/api/profile')
        setTwoFactorEnabled(profileResult.user.twoFactorEnabled as boolean ?? false)
      } catch {
        // Silent
      } finally {
        setTwoFactorFetching(false)
      }
    }
    fetch2FA()
  }, [user])

  // ── Fetch connection logs on mount ──────────────────────────────────────
  useEffect(() => {
    if (!user) return
    setLogsLoading(true)
    authFetch<{ logs: ConnectionLogEntry[] }>('/api/user/connection-logs?limit=20')
      .then((data) => setConnectionLogs(data.logs))
      .catch(() => {})
      .finally(() => setLogsLoading(false))
  }, [user])

  // ── Fetch profile view stats on mount ───────────────────────────────────
  useEffect(() => {
    if (!user) return
    setViewStatsLoading(true)

    // Fetch properties and their view counts
    const fetchViewStats = async () => {
      try {
        const propsResult = await authFetch<{ properties: { id: string; title: string; viewsCount: number }[] }>('/api/properties')
        const properties = propsResult.properties || []
        const totalPropertyViews = properties.reduce((sum, p) => sum + p.viewsCount, 0)
        const recentPropertyViews = properties
          .filter((p) => p.viewsCount > 0)
          .sort((a, b) => b.viewsCount - a.viewsCount)
          .slice(0, 5)
          .map((p) => ({ propertyId: p.id, title: p.title, viewsCount: p.viewsCount }))

        setViewStats({
          totalProfileViews: 0, // No separate profile views model — use 0 as placeholder
          totalPropertyViews,
          recentPropertyViews,
        })
      } catch {
        setViewStats({ totalProfileViews: 0, totalPropertyViews: 0, recentPropertyViews: [] })
      } finally {
        setViewStatsLoading(false)
      }
    }
    fetchViewStats()
  }, [user])

  // ── Change password handler ─────────────────────────────────────────────
  const handleChangePassword = useCallback(async () => {
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
      await authFetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      })
      toast.success('Mot de passe mis à jour avec succès')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Erreur lors du changement de mot de passe')
    } finally {
      setPasswordSaving(false)
    }
  }, [currentPassword, newPassword, confirmPassword])

  // ── Toggle 2FA handler ──────────────────────────────────────────────────
  const handleToggle2FA = useCallback(async (enable: boolean) => {
    setTwoFactorLoading(true)
    try {
      const result = await authFetch<{ message: string; enabled: boolean }>('/api/user/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable }),
      })
      setTwoFactorEnabled(result.enabled)
      toast.success(result.message)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la mise à jour de la 2FA')
    } finally {
      setTwoFactorLoading(false)
    }
  }, [])

  // ── Revoke all sessions handler ─────────────────────────────────────────
  const handleRevokeAllSessions = useCallback(async () => {
    setRevokeAllLoading(true)
    try {
      await authFetch('/api/settings/sessions', { method: 'DELETE' })
      toast.success('Déconnecté de tous les autres appareils')
    } catch {
      toast.error('Erreur lors de la déconnexion')
    } finally {
      setRevokeAllLoading(false)
    }
  }, [])

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Sécurité</h1>
        <p className="text-muted-foreground mt-1">Gérez la sécurité de votre compte propriétaire</p>
      </motion.div>

      {/* ── Change Password (US-P-120) ──────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Key className="size-4 text-brand-500" />
              Changer le mot de passe
            </CardTitle>
            <CardDescription>
              Modifiez votre mot de passe pour sécuriser votre compte
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current password */}
            <div className="space-y-1.5">
              <Label htmlFor="sec-current-pw" className="text-xs font-medium text-foreground">
                Mot de passe actuel
              </Label>
              <div className="relative">
                <Input
                  id="sec-current-pw"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-9 text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Separator />

            {/* New password */}
            <div className="space-y-1.5">
              <Label htmlFor="sec-new-pw" className="text-xs font-medium text-foreground">
                Nouveau mot de passe
              </Label>
              <div className="relative">
                <Input
                  id="sec-new-pw"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 caractères"
                  className="h-9 text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
              <Label htmlFor="sec-confirm-pw" className="text-xs font-medium text-foreground">
                Confirmer le nouveau mot de passe
              </Label>
              <Input
                id="sec-confirm-pw"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className={`h-9 text-sm ${
                  confirmPassword && newPassword !== confirmPassword ? 'border-red-300 focus:border-red-400' : ''
                }`}
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-[10px] text-red-500">Les mots de passe ne correspondent pas</p>
              )}
            </div>

            {/* Error */}
            {passwordError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <div className="flex items-center gap-2">
                  <XCircle className="size-4 text-red-500 shrink-0" />
                  <p className="text-xs text-red-600">{passwordError}</p>
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleChangePassword}
                disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {passwordSaving ? (
                  <><Loader2 className="size-4 mr-2 animate-spin" /> Mise à jour...</>
                ) : (
                  <><Shield className="size-4 mr-2" /> Changer le mot de passe</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Two-Factor Authentication (US-P-121) ────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ShieldCheck className="size-4 text-brand-500" />
              Authentification à deux facteurs
            </CardTitle>
            <CardDescription>
              Ajoutez une couche de sécurité supplémentaire à votre compte
            </CardDescription>
          </CardHeader>
          <CardContent>
            {twoFactorFetching ? (
              <div className="h-20 bg-muted rounded-lg animate-pulse" />
            ) : (
              <div className="space-y-4">
                {/* 2FA Status */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-border hover:bg-accent transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                      twoFactorEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-500'
                    }`}>
                      <ShieldCheck className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Protection 2FA
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {twoFactorEnabled
                          ? 'Votre compte est protégé par authentification à deux facteurs'
                          : 'Activez la 2FA pour sécuriser votre compte'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={
                      twoFactorEnabled
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 border text-[10px]'
                        : 'bg-amber-50 text-amber-700 border-amber-200 border text-[10px]'
                    }>
                      {twoFactorEnabled ? (
                        <><CheckCircle2 className="size-3 mr-0.5" /> Activée</>
                      ) : (
                        <><AlertTriangle className="size-3 mr-0.5" /> Désactivée</>
                      )}
                    </Badge>
                    <div className="flex items-center gap-2">
                      {twoFactorLoading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                      <Switch
                        checked={twoFactorEnabled}
                        onCheckedChange={(checked) => handleToggle2FA(checked)}
                        disabled={twoFactorLoading}
                      />
                    </div>
                  </div>
                </div>

                {/* 2FA info */}
                {!twoFactorEnabled && (
                  <div className="p-3 rounded-lg bg-brand-50 border border-brand-200">
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="size-4 text-brand-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-medium text-brand-700">Comment ça fonctionne ?</p>
                        <p className="text-[11px] text-brand-600 mt-0.5">
                          Lors de chaque connexion, un code de vérification sera envoyé à votre adresse email.
                          Vous devrez saisir ce code pour accéder à votre compte.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {twoFactorEnabled && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-medium text-emerald-700">2FA activée</p>
                        <p className="text-[11px] text-emerald-600 mt-0.5">
                          Un code de vérification est envoyé par email à chaque connexion.
                          Assurez-vous que votre adresse email est à jour et vérifiée.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Connection History (US-P-122) ───────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Monitor className="size-4 text-brand-500" />
                  Historique de connexion
                </CardTitle>
                <CardDescription>
                  Vos connexions récentes et appareils utilisés
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleRevokeAllSessions}
                disabled={revokeAllLoading}
              >
                {revokeAllLoading ? (
                  <><Loader2 className="size-3 mr-1 animate-spin" /> Déconnexion...</>
                ) : (
                  <><LogOut className="size-3 mr-1" /> Se déconnecter de partout</>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : connectionLogs.length === 0 ? (
              <div className="text-center py-8">
                <Monitor className="size-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Aucun historique de connexion</p>
                <p className="text-xs text-muted-foreground mt-1">Les connexions futures apparaîtront ici</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {connectionLogs.map((log) => {
                  const parsed = parseDevice(log.userAgent)
                  return (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Smartphone className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {log.device || parsed.device}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                            {log.ipAddress && (
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Globe className="size-3" /> {log.ipAddress}
                              </span>
                            )}
                            {log.location && (
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <MapPin className="size-3" /> {log.location}
                              </span>
                            )}
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Clock className="size-3" /> {new Date(log.createdAt).toLocaleDateString('fr-FR', {
                                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {parsed.browser} · {parsed.device}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Profile View Tracking (US-P-123) ───────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="size-4 text-brand-500" />
              Statistiques de vues
            </CardTitle>
            <CardDescription>
              Nombre de vues sur vos propriétés et votre profil
            </CardDescription>
          </CardHeader>
          <CardContent>
            {viewStatsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : viewStats ? (
              <div className="space-y-4">
                {/* Stats overview */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="p-4 rounded-xl border border-border bg-accent/30">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                        <Users className="size-4" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Vues du profil</p>
                        <p className="text-xl font-bold text-foreground">{viewStats.totalProfileViews}</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl border border-border bg-accent/30">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                        <Building2 className="size-4" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Vues des propriétés</p>
                        <p className="text-xl font-bold text-foreground">{viewStats.totalPropertyViews}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Most viewed properties */}
                {viewStats.recentPropertyViews.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3">Propriétés les plus vues</h4>
                    <div className="space-y-2">
                      {viewStats.recentPropertyViews.map((prop) => (
                        <div
                          key={prop.propertyId}
                          className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-accent transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                              <Building2 className="size-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{prop.title || 'Sans titre'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Eye className="size-3.5 text-muted-foreground" />
                            <span className="text-sm font-semibold text-foreground">{prop.viewsCount}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {viewStats.totalPropertyViews === 0 && viewStats.totalProfileViews === 0 && (
                  <div className="text-center py-6">
                    <BarChart3 className="size-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Aucune vue pour le moment</p>
                    <p className="text-xs text-muted-foreground mt-1">Les statistiques apparaîtront lorsque vos propriétés seront consultées</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Impossible de charger les statistiques</p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
