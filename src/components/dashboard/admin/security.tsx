'use client'

import { useCallback, useEffect, useState } from 'react'
import { Shield, AlertTriangle, Clock, Ban, Lock, FileText, Settings, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { useRealtimeUsers } from '@/hooks/use-realtime-users'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

interface AuditEntry {
  id: string
  action: string
  entity: string
  details: string | null
  createdAt: string
  user: { firstName: string; lastName: string; email: string }
}

interface SecurityData {
  failedLogins: AuditEntry[]
  adminActions: AuditEntry[]
}

export function AdminSecurity() {
  const { isAuthenticated, user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [failedLogins, setFailedLogins] = useState<AuditEntry[]>([])
  const [adminActions, setAdminActions] = useState<AuditEntry[]>([])
  const [sessionDuration, setSessionDuration] = useState('30')
  const [maxAttempts, setMaxAttempts] = useState('5')
  const [ipWhitelist, setIpWhitelist] = useState('')
  const [ipBlacklist, setIpBlacklist] = useState('')
  const [whitelistIps, setWhitelistIps] = useState<string[]>([])
  const [blacklistIps, setBlacklistIps] = useState<string[]>([])
  const [savingRules, setSavingRules] = useState(false)
  const [savingIp, setSavingIp] = useState(false)

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return }
    try {
      const [auditData, settingsData] = await Promise.all([
        authFetch<SecurityData>('/api/admin/audit-logs?limit=50'),
        authFetch<any>('/api/admin/settings'),
      ])
      setFailedLogins(auditData.failedLogins || [])
      setAdminActions(auditData.adminActions || [])

      // Load IP rules from platform settings
      if (settingsData.ipRules) {
        setWhitelistIps(settingsData.ipRules.whitelist || [])
        setBlacklistIps(settingsData.ipRules.blacklist || [])
      }
      // Load security settings
      if (settingsData.security) {
        setSessionDuration(String(settingsData.security.sessionDurationDays || 30))
        setMaxAttempts(String(settingsData.security.maxLoginAttempts || 5))
      }
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) return
      console.error('Failed to fetch security data:', err)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => { fetchData() }, [fetchData])

  useRealtimeUsers({
    userId: user?.id,
    watchAll: true,
    onUserChange: useCallback(() => {
      fetchData()
    }, [fetchData]),
  })

  if (loading) return <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}</div>

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Sécurité</h1>
        <p className="text-muted-foreground mt-1">Gestion de la sécurité et des accès</p>
      </div>

      <Tabs defaultValue="failed-logins" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 bg-muted">
          <TabsTrigger value="failed-logins" className="text-xs sm:text-sm px-1 sm:px-3">
            <AlertTriangle className="size-3.5 sm:hidden mr-1" />
            <span className="sm:inline">Connexions échouées</span>
          </TabsTrigger>
          <TabsTrigger value="admin-actions" className="text-xs sm:text-sm px-1 sm:px-3">
            <Shield className="size-3.5 sm:hidden mr-1" />
            <span className="sm:inline">Actions admin</span>
          </TabsTrigger>
          <TabsTrigger value="rules" className="text-xs sm:text-sm px-1 sm:px-3">
            <Lock className="size-3.5 sm:hidden mr-1" />
            <span>Règles</span>
          </TabsTrigger>
          <TabsTrigger value="ip" className="text-xs sm:text-sm px-1 sm:px-3">
            <Ban className="size-3.5 sm:hidden mr-1" />
            <span>IP</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="failed-logins" className="mt-4 space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="size-5 text-red-600" />
                Tentatives de connexion échouées
              </CardTitle>
              <CardDescription>Depuis les logs d&apos;audit</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Utilisateur</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Email</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Détails</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failedLogins.map((log) => (
                      <tr key={log.id} className="border-b border-border hover:bg-red-50/50">
                        <td className="py-2 px-3 font-medium text-foreground">{log.user.firstName} {log.user.lastName}</td>
                        <td className="py-2 px-3 text-muted-foreground">{log.user.email}</td>
                        <td className="py-2 px-3 text-muted-foreground">{log.details || '—'}</td>
                        <td className="py-2 px-3 text-muted-foreground">{new Date(log.createdAt).toLocaleString('fr-FR')}</td>
                      </tr>
                    ))}
                    {failedLogins.length === 0 && (
                      <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Aucune tentative échouée</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="admin-actions" className="mt-4 space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Shield className="size-5 text-[#FF6C2F]" />
                Historique des actions administrateur
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {adminActions.map((log) => (
                  <div key={log.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                    <div className={`size-8 rounded-lg flex items-center justify-center ${
                      log.action.includes('BANNED') ? 'bg-red-100 text-red-600' :
                      log.action.includes('ROLE') ? 'bg-amber-100 text-amber-600' :
                      'bg-teal-100 text-teal-600'
                    }`}>
                      {log.action.includes('BANNED') ? <Ban className="size-4" /> : <FileText className="size-4" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{log.action}</p>
                      <p className="text-xs text-muted-foreground">{log.entity} {log.details ? `· ${log.details}` : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-foreground">{log.user.firstName} {log.user.lastName}</p>
                      <p className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString('fr-FR')}</p>
                    </div>
                  </div>
                ))}
                {adminActions.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Aucune action enregistrée</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="mt-4 space-y-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Lock className="size-5 text-[#FF6C2F]" />
                Règles de sécurité
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Durée de session (jours)</Label>
                  <Input type="number" value={sessionDuration} onChange={(e) => setSessionDuration(e.target.value.replace(/\D/g, '').slice(0, 3))} className="w-32" />
                  <p className="text-xs text-muted-foreground">Durée avant expiration de la session</p>
                </div>
                <div className="space-y-2">
                  <Label>Tentatives max avant blocage</Label>
                  <Input type="number" value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value.replace(/\D/g, '').slice(0, 2))} className="w-32" />
                  <p className="text-xs text-muted-foreground">Nombre max de tentatives de connexion</p>
                </div>
              </div>
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                onClick={async () => {
                  setSavingRules(true)
                  try {
                    await authFetch('/api/admin/settings', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        section: 'security',
                        values: { sessionDurationDays: parseInt(sessionDuration) || 30, maxLoginAttempts: parseInt(maxAttempts) || 5 },
                      }),
                    })
                    toast.success('Règles de sécurité mises à jour')
                  } catch {
                    toast.error('Erreur lors de la sauvegarde')
                  } finally {
                    setSavingRules(false)
                  }
                }}
                disabled={savingRules}
              >
                {savingRules ? <Loader2 className="size-4 animate-spin" /> : <Settings className="size-4" />}
                {savingRules ? 'Sauvegarde...' : 'Sauvegarder'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ip" className="mt-4 space-y-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Shield className="size-5 text-green-600" />
                Liste blanche IP
              </CardTitle>
              <CardDescription>Adresses IP autorisées pour l&apos;administration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input placeholder="Adresse IP (ex: 192.168.1.1)" value={ipWhitelist} onChange={(e) => setIpWhitelist(e.target.value)} className="max-w-xs" />
                <Button
                  variant="outline"
                  className="text-green-700 border-green-200 hover:bg-green-50 shrink-0"
                  disabled={!ipWhitelist.trim() || savingIp}
                  onClick={async () => {
                    if (!ipWhitelist.trim()) return
                    setSavingIp(true)
                    const newList = [...whitelistIps, ipWhitelist.trim()]
                    try {
                      await authFetch('/api/admin/settings', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ section: 'ipRules', values: { whitelist: newList, blacklist: blacklistIps } }),
                      })
                      setWhitelistIps(newList)
                      setIpWhitelist('')
                      toast.success('IP ajoutée à la liste blanche')
                    } catch {
                      toast.error('Erreur lors de l\'ajout')
                    } finally {
                      setSavingIp(false)
                    }
                  }}
                >
                  {savingIp ? <Loader2 className="size-4 animate-spin" /> : 'Ajouter'}
                </Button>
              </div>
              <div className="space-y-2">
                {whitelistIps.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">Aucune IP autorisée</p>
                ) : (
                  whitelistIps.map((ip) => (
                    <div key={ip} className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-green-200 bg-green-50/30">
                      <span className="text-sm font-mono text-foreground">{ip}</span>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-100 text-green-700">Autorisé</Badge>
                        <button
                          onClick={async () => {
                            const newList = whitelistIps.filter((i) => i !== ip)
                            try {
                              await authFetch('/api/admin/settings', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ section: 'ipRules', values: { whitelist: newList, blacklist: blacklistIps } }),
                              })
                              setWhitelistIps(newList)
                              toast.success('IP retirée de la liste blanche')
                            } catch { toast.error('Erreur') }
                          }}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Retirer
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Ban className="size-5 text-red-600" />
                Liste noire IP
              </CardTitle>
              <CardDescription>Adresses IP bloquées</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input placeholder="Adresse IP à bloquer" value={ipBlacklist} onChange={(e) => setIpBlacklist(e.target.value)} className="max-w-xs" />
                <Button
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50 shrink-0"
                  disabled={!ipBlacklist.trim() || savingIp}
                  onClick={async () => {
                    if (!ipBlacklist.trim()) return
                    setSavingIp(true)
                    const newList = [...blacklistIps, ipBlacklist.trim()]
                    try {
                      await authFetch('/api/admin/settings', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ section: 'ipRules', values: { whitelist: whitelistIps, blacklist: newList } }),
                      })
                      setBlacklistIps(newList)
                      setIpBlacklist('')
                      toast.success('IP bloquée avec succès')
                    } catch {
                      toast.error('Erreur lors du blocage')
                    } finally {
                      setSavingIp(false)
                    }
                  }}
                >
                  {savingIp ? <Loader2 className="size-4 animate-spin" /> : 'Bloquer'}
                </Button>
              </div>
              <div className="space-y-2">
                {blacklistIps.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">Aucune IP bloquée</p>
                ) : (
                  blacklistIps.map((ip) => (
                    <div key={ip} className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-red-200 bg-red-50/30">
                      <span className="text-sm font-mono text-foreground">{ip}</span>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-red-100 text-red-700">Bloqué</Badge>
                        <button
                          onClick={async () => {
                            const newList = blacklistIps.filter((i) => i !== ip)
                            try {
                              await authFetch('/api/admin/settings', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ section: 'ipRules', values: { whitelist: whitelistIps, blacklist: newList } }),
                              })
                              setBlacklistIps(newList)
                              toast.success('IP retirée de la liste noire')
                            } catch { toast.error('Erreur') }
                          }}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Débloquer
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Security Reports */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="size-5 text-muted-foreground" />
            Rapports de sécurité
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border border-border text-center">
              <p className="text-xl sm:text-2xl font-bold text-red-600">{failedLogins.length}</p>
              <p className="text-xs text-muted-foreground">Tentatives échouées (30j)</p>
            </div>
            <div className="p-4 rounded-lg border border-border text-center">
              <p className="text-xl sm:text-2xl font-bold text-amber-600">—</p>
              <p className="text-xs text-muted-foreground">Comptes bloqués</p>
            </div>
            <div className="p-4 rounded-lg border border-border text-center">
              <p className="text-xl sm:text-2xl font-bold text-green-600">{blacklistIps.length}</p>
              <p className="text-xs text-muted-foreground">IPs bloquées</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
