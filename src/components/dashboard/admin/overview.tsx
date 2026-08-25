'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { 
  Users, Building2, FileSignature, AlertTriangle, TrendingUp, DollarSign, 
  Shield, Activity, Flag, ArrowRight,
  Search, CheckCircle2, XCircle,
  Clock, Database, Server, HardDrive, MapPin, Layers,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { useRealtimeUsers } from '@/hooks/use-realtime-users'
import { useRealtimeProperties } from '@/hooks/use-realtime-properties'
import { useRealtimeDisputes } from '@/hooks/use-realtime-disputes'
import { useRealtimeSignalements } from '@/hooks/use-realtime-signalements'
import { motion } from 'framer-motion'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ModerationItem {
  id: string
  title: string
  type: string
  price: number
  city: string
  commune: string | null
  createdAt: string
  owner: { firstName: string; lastName: string } | null
}

interface SystemActivity {
  id: string
  action: string
  entity: string
  entityId: string
  createdAt: string
}

interface HeatmapPoint {
  city: string
  commune: string | null
  lat: number
  lng: number
  count: number
}

interface AdminData {
  stats: {
    totalUsers: number
    totalProperties: number
    totalLeases: number
    totalDisputes: number
    totalRevenue: number
    usersByRole: Record<string, number>
  }
  signalements: {
    byStatus: Record<string, number>
    pendingCount: number
  }
  monthlyNewUsers: Array<{ month: string; count: number }>
  systemHealth: { database: string; api: string; storage: string }
  errorRate: number
  failedLogins: number
  recentUsers: Array<{
    id: string; firstName: string; lastName: string; phone: string; role: string; isActive: boolean; createdAt: string
  }>
  disputes: Array<{
    id: string; type: string; description: string; status: string; createdAt: string
    reportedBy: { firstName: string; lastName: string }
    lease: { property: { title: string } }
  }>
  moderationQueue: ModerationItem[]
  recentSystemActivities: SystemActivity[]
  heatmapData: HeatmapPoint[]
}

interface ApiAdminResponse {
  stats?: {
    totalUsers?: number
    totalProperties?: number
    totalLeases?: number
    totalDisputes?: number
    totalRevenue?: number
    usersByRole?: Record<string, number>
  }
  signalements?: {
    byStatus?: Record<string, number>
    pendingCount?: number
  }
  monthlyNewUsers?: Array<{ month: string; count: number }>
  systemHealth?: { database: string; api: string; storage: string }
  errorRate?: number
  failedLogins?: number
  recentUsers?: Array<{
    id: string; firstName: string; lastName: string; phone: string; role: string; isActive: boolean; createdAt: string
  }>
  disputes?: Array<{
    id: string; type: string; description: string; status: string; createdAt: string
    reportedBy: { firstName: string; lastName: string }
    lease: { property: { title: string } }
  }>
  moderationQueue?: ModerationItem[]
  recentSystemActivities?: SystemActivity[]
  heatmapData?: HeatmapPoint[]
}

const defaultData: AdminData = {
  stats: { totalUsers: 0, totalProperties: 0, totalLeases: 0, totalDisputes: 0, totalRevenue: 0, usersByRole: {} },
  signalements: { byStatus: {}, pendingCount: 0 },
  monthlyNewUsers: [],
  systemHealth: { database: 'OK', api: 'OK', storage: 'OK' },
  errorRate: 0,
  failedLogins: 0,
  recentUsers: [],
  disputes: [],
  moderationQueue: [],
  recentSystemActivities: [],
  heatmapData: [],
}

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } }
const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }

function RoleBadge({ role }: { role: string }) {
  const config: Record<string, { label: string; className: string }> = {
    LOCATAIRE: { label: 'Locataire', className: 'bg-teal-100 text-teal-700' },
    PROPRIETAIRE: { label: 'Propriétaire', className: 'bg-green-100 text-green-700' },
    TIERS_CONFIANCE: { label: 'TC', className: 'bg-amber-100 text-amber-700' },
    ADMIN: { label: 'Admin', className: 'bg-rose-100 text-rose-700' },
    AGENCE: { label: 'Agence', className: 'bg-orange-100 text-orange-700' },
  }
  const c = config[role] || { label: role, className: 'bg-neutral-100 text-neutral-700' }
  return <Badge className={c.className}>{c.label}</Badge>
}

const monthLabels: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Avr', '05': 'Mai', '06': 'Juin',
  '07': 'Juil', '08': 'Aout', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
}

const actionLabels: Record<string, string> = {
  LOGIN_FAILED: 'Connexion échouée',
  LOGIN_SUCCESS: 'Connexion réussie',
  USER_CREATED: 'Utilisateur créé',
  PROPERTY_CREATED: 'Bien créé',
  PROPERTY_APPROVED: 'Bien approuvé',
  PROPERTY_REJECTED: 'Bien rejeté',
  LEASE_CREATED: 'Bail créé',
  LEASE_SIGNED: 'Bail signé',
  LEASE_TERMINATED: 'Bail résilié',
  PAYMENT_RECEIVED: 'Paiement reçu',
  PAYMENT_FAILED: 'Paiement échoué',
  SIGNALEMENT_CREATED: 'Signalement créé',
  DISPUTE_OPENED: 'Litige ouvert',
}

const actionIcons: Record<string, React.ElementType> = {
  LOGIN_FAILED: XCircle,
  LOGIN_SUCCESS: CheckCircle2,
  USER_CREATED: Users,
  PROPERTY_CREATED: Building2,
  PROPERTY_APPROVED: CheckCircle2,
  PROPERTY_REJECTED: XCircle,
  LEASE_CREATED: FileSignature,
  LEASE_SIGNED: FileSignature,
  LEASE_TERMINATED: XCircle,
  PAYMENT_RECEIVED: DollarSign,
  PAYMENT_FAILED: AlertTriangle,
  SIGNALEMENT_CREATED: Flag,
  DISPUTE_OPENED: AlertTriangle,
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AdminOverview() {
  const { user, isAuthenticated, setDashboardSection } = useAuthStore()
  const [data, setData] = useState<AdminData>(defaultData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const heatmapRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    try {
      const d = await authFetch<ApiAdminResponse>('/api/dashboard/admin')
      setData({
        stats: { ...defaultData.stats, ...d.stats },
        signalements: { ...defaultData.signalements, ...d.signalements },
        monthlyNewUsers: d.monthlyNewUsers ?? [],
        systemHealth: d.systemHealth ?? defaultData.systemHealth,
        errorRate: d.errorRate ?? 0,
        failedLogins: d.failedLogins ?? 0,
        recentUsers: d.recentUsers ?? [],
        disputes: d.disputes ?? [],
        moderationQueue: d.moderationQueue ?? [],
        recentSystemActivities: d.recentSystemActivities ?? [],
        heatmapData: d.heatmapData ?? [],
      })
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) {
        setData(defaultData)
        return
      }
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setData(defaultData)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useRealtimeUsers({ userId: user?.id, watchAll: true, onUserChange: () => { fetchData() } })
  useRealtimeProperties({ userId: user?.id, watchAll: true, onPropertyChange: () => { fetchData() } })
  useRealtimeDisputes({ userId: user?.id, watchAll: true, onDisputeChange: () => { fetchData() } })
  useRealtimeSignalements({ userId: user?.id, watchAll: true, onSignalementChange: () => { fetchData() } })

  useEffect(() => { fetchData() }, [fetchData])

  // ─── Leaflet heatmap ─────────────────────────────────────────────────────
  useEffect(() => {
    if (data.heatmapData.length === 0 || !heatmapRef.current) return
    let map: any = null
    import('leaflet').then((L) => {
      if (!heatmapRef.current) return
      map = L.map(heatmapRef.current, { zoomControl: true }).setView([5.317066, -4.028636], 10)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 18,
      }).addTo(map)

      const maxCount = Math.max(...data.heatmapData.map(p => p.count), 1)
      data.heatmapData.forEach((point) => {
        const radius = 10 + (point.count / maxCount) * 30
        const opacity = 0.4 + (point.count / maxCount) * 0.6
        L.circleMarker([point.lat, point.lng], {
          radius,
          color: '#FF6C2F',
          fillColor: '#FF6C2F',
          fillOpacity: opacity,
          weight: 1,
          opacity: 0.3,
        }).bindPopup(`<b>${point.city}</b>${point.commune ? ' - ' + point.commune : ''}<br/>${point.count} bien(s)`)
          .addTo(map)
      })
    }).catch(console.error)
    return () => { if (map) map.remove() }
  }, [data.heatmapData])

  if (loading) return <div className="space-y-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}</div>

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Tableau de bord Admin</h1>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-sm text-amber-700">Impossible de charger les données. Veuillez réessayer.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const stats = [
    { label: 'Utilisateurs', value: data.stats.totalUsers, icon: Users, color: 'text-teal-600 bg-teal-50' },
    { label: 'Biens immobiliers', value: data.stats.totalProperties, icon: Building2, color: 'text-green-600 bg-green-50' },
    { label: 'Baux actifs', value: data.stats.totalLeases, icon: FileSignature, color: 'text-orange-600 bg-orange-50' },
    { label: 'Litiges ouverts', value: data.stats.totalDisputes, icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
    { label: 'Signalements', value: data.signalements.pendingCount, icon: Flag, color: 'text-amber-600 bg-amber-50' },
    { label: 'Revenus mensuels', value: `${(data.stats.totalRevenue / 1000).toFixed(0)}K`, icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Tentatives échouées', value: data.failedLogins, icon: Shield, color: 'text-rose-600 bg-rose-50' },
    { label: "Taux d'erreur", value: `${data.errorRate}%`, icon: Activity, color: 'text-purple-600 bg-purple-50' },
  ]

  const roleLabels: Record<string, string> = {
    LOCATAIRE: 'Locataires',
    PROPRIETAIRE: 'Propriétaires',
    TIERS_CONFIANCE: 'Tiers de Confiance',
    ADMIN: 'Administrateurs',
    AGENCE: 'Agences',
  }

  const maxBarValue = Math.max(...data.monthlyNewUsers.map((m) => m.count), 1)
  const totalActivities = data.recentSystemActivities.length

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      {/* Header with gradient */}
      <motion.div variants={itemVariants} className="relative overflow-hidden rounded-xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 p-6 sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(0,0,0,0.08),transparent_50%)]" />
        <div className="relative z-10">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">Tableau de bord Admin</h1>
          <p className="text-brand-100 mt-1.5 text-sm sm:text-base">Supervision globale de la plateforme Mon Toit</p>
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 text-white text-xs font-medium backdrop-blur-sm">
              <Users className="size-3.5" />
              {data.stats.totalUsers} utilisateur{data.stats.totalUsers !== 1 ? 's' : ''}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 text-white text-xs font-medium backdrop-blur-sm">
              <Building2 className="size-3.5" />
              {data.stats.totalProperties} bien{data.stats.totalProperties !== 1 ? 's' : ''}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 text-white text-xs font-medium backdrop-blur-sm">
              <FileSignature className="size-3.5" />
              {data.stats.totalLeases} bail{data.stats.totalLeases !== 1 ? 'x' : ''} actif{data.stats.totalLeases !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </motion.div>

      {/* ─── KPIs ────────────────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex size-10 items-center justify-center rounded-lg ${stat.color}`}>
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </motion.div>

      {/* ─── Alertes ───────────────────────────────────────────────────────── */}
      {(data.signalements.pendingCount > 0 || data.stats.totalDisputes > 0 || data.failedLogins > 5) && (
        <motion.div variants={itemVariants}>
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-amber-800 flex items-center gap-2">
                <AlertTriangle className="size-5 text-amber-600" />
                Alertes et actions urgentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.signalements.pendingCount > 0 && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2 rounded-lg bg-white border border-amber-100">
                  <span className="text-sm text-amber-700">{data.signalements.pendingCount} signalement(s) en attente</span>
                  <Button variant="outline" size="sm" className="text-amber-700 border-amber-200 shrink-0" onClick={() => setDashboardSection('signalements')}>Voir <ArrowRight className="size-3 ml-1" /></Button>
                </div>
              )}
              {data.stats.totalDisputes > 0 && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2 rounded-lg bg-white border border-amber-100">
                  <span className="text-sm text-amber-700">{data.stats.totalDisputes} litige(s) ouvert(s)</span>
                  <Button variant="outline" size="sm" className="text-amber-700 border-amber-200 shrink-0" onClick={() => setDashboardSection('disputes')}>Voir <ArrowRight className="size-3 ml-1" /></Button>
                </div>
              )}
              {data.failedLogins > 5 && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2 rounded-lg bg-white border border-amber-100">
                  <span className="text-sm text-amber-700">{data.failedLogins} tentatives de connexion échouées</span>
                  <Button variant="outline" size="sm" className="text-amber-700 border-amber-200 shrink-0" onClick={() => setDashboardSection('users')}>Voir <ArrowRight className="size-3 ml-1" /></Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ─── Quick Actions ─────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <Button className="bg-[#FF6C2F] hover:bg-[#e55f28] text-white gap-2" onClick={() => setDashboardSection('users')}>
                <Users className="size-4" /> Gérer utilisateurs
              </Button>
              <Button variant="outline" className="gap-2 border-orange-200 text-orange-700 hover:bg-orange-50" onClick={() => setDashboardSection('moderation')}>
                <Shield className="size-4" /> Modérer contenu
              </Button>
              <Button variant="outline" className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => setDashboardSection('signalements')}>
                <Flag className="size-4" /> Voir signalements
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── 2-col: Croissance + Repartition ───────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Croissance mensuelle</CardTitle>
              <CardDescription>Nouveaux utilisateurs par mois</CardDescription>
            </CardHeader>
            <CardContent>
              {data.monthlyNewUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Aucune donnée</p>
              ) : (
                <div className="flex items-end gap-2 h-40">
                  {data.monthlyNewUsers.map((m) => {
                    const monthPart = m.month.split('-')[1]
                    const label = monthLabels[monthPart] || monthPart
                    const height = maxBarValue > 0 ? (m.count / maxBarValue) * 100 : 0
                    return (
                      <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs font-medium text-foreground">{m.count}</span>
                        <div className="w-full rounded-t-md bg-gradient-to-t from-[#FF6C2F] to-orange-400 transition-all duration-500" style={{ height: `${Math.max(height, 4)}%` }} />
                        <span className="text-xs text-muted-foreground">{label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Répartition des utilisateurs</CardTitle>
              <CardDescription>Par type de compte</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(data.stats.usersByRole).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Aucune donnée</p>
              ) : (
                Object.entries(data.stats.usersByRole).map(([role, count]) => (
                  <div key={role} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      <RoleBadge role={role} />
                      <span className="text-sm text-foreground">{roleLabels[role] || role}</span>
                    </div>
                    <span className="text-lg font-bold text-foreground">{count}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ─── 2-col: Moderation + Activites systeme ─────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Moderation */}
        <motion.div variants={itemVariants}>
          <Card className="border-border h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="size-5 text-[#FF6C2F]" />
                  <CardTitle className="text-base font-semibold">Modération</CardTitle>
                </div>
                <Badge className={data.moderationQueue.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}>
                  {data.moderationQueue.length} en attente
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 max-h-64 overflow-y-auto">
              {data.moderationQueue.length === 0 ? (
                <div className="py-6 text-center">
                  <Shield className="size-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Aucune annonce à modérer</p>
                </div>
              ) : (
                data.moderationQueue.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => setDashboardSection('moderation')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setDashboardSection('moderation')
                      }
                    }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-8 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                        <Building2 className="size-4 text-orange-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.city} · {item.owner?.firstName} {item.owner?.lastName}</p>
                      </div>
                    </div>
                    <Badge className="bg-amber-100 text-amber-700">{item.type}</Badge>
                  </div>
                ))
              )}
              {data.moderationQueue.length > 5 && (
                <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setDashboardSection('moderation')}>
                  Voir les {data.moderationQueue.length} annonces
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Activites systeme */}
        <motion.div variants={itemVariants}>
          <Card className="border-border h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="size-5 text-[#FF6C2F]" />
                  <CardTitle className="text-base font-semibold">Activités système</CardTitle>
                </div>
                <span className="text-xs text-muted-foreground">{totalActivities} récentes</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-1 max-h-64 overflow-y-auto">
              {totalActivities === 0 ? (
                <div className="py-6 text-center">
                  <Activity className="size-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Aucune activité récente</p>
                </div>
              ) : (
                data.recentSystemActivities.slice(0, 8).map((a) => {
                  const Icon = actionIcons[a.action] || Activity
                  const label = actionLabels[a.action] || a.action
                  return (
                    <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="size-7 rounded-full bg-neutral-50 flex items-center justify-center shrink-0">
                        <Icon className="size-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{label}</p>
                        <p className="text-[10px] text-muted-foreground">{a.entity}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(a.createdAt).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ─── 2-col: Sante systeme + Carte ──────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Santé système */}
        <motion.div variants={itemVariants}>
          <Card className="border-border h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Activity className="size-5 text-green-600" />
                <CardTitle className="text-base font-semibold">Santé du système</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { key: 'database', label: 'Base de données', icon: Database },
                  { key: 'api', label: 'API / Edge Functions', icon: Server },
                  { key: 'storage', label: 'Stockage fichiers', icon: HardDrive },
                ].map(({ key, label, icon: Icon }) => {
                  const value = data.systemHealth[key as keyof typeof data.systemHealth] || 'UNKNOWN'
                  return (
                    <div key={key} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                      <div className={`size-9 flex items-center justify-center rounded-lg ${value === 'OK' ? 'bg-green-50' : value === 'DEGRADED' ? 'bg-amber-50' : 'bg-red-50'}`}>
                        <Icon className={`size-5 ${value === 'OK' ? 'text-green-600' : value === 'DEGRADED' ? 'text-amber-600' : 'text-red-600'}`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{label}</p>
                        <p className="text-xs text-muted-foreground">
                          {value === 'OK' ? 'Opérationnel' : value === 'DEGRADED' ? 'Dégradé' : 'Erreur'}
                        </p>
                      </div>
                      <div className={`size-2.5 rounded-full ${value === 'OK' ? 'bg-green-500' : value === 'DEGRADED' ? 'bg-amber-500' : 'bg-red-500'}`} />
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Carte heatmap */}
        <motion.div variants={itemVariants}>
          <Card className="border-border h-full overflow-hidden">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="size-5 text-[#FF6C2F]" />
                  <CardTitle className="text-base font-semibold">Cartographie des biens</CardTitle>
                </div>
                <span className="text-xs text-muted-foreground">{data.heatmapData.length} zones</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div ref={heatmapRef} className="h-64 w-full" />
              {data.heatmapData.length === 0 && (
                <div className="h-64 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">Aucune donnée de localisation</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ─── Utilisateurs récents ──────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Utilisateurs récents</CardTitle>
              <Button variant="ghost" size="sm" className="text-brand-500 gap-1" onClick={() => setDashboardSection('users')}>
                Gérer <ArrowRight className="size-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {data.recentUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Aucun utilisateur récent</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Nom</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Téléphone</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Rôle</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Statut</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Inscrit le</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentUsers.map((u) => (
                      <tr key={u.id} className="border-b border-border hover:bg-accent">
                        <td className="py-2 px-3 font-medium text-foreground">{u.firstName} {u.lastName}</td>
                        <td className="py-2 px-3 text-muted-foreground">{u.phone || '—'}</td>
                        <td className="py-2 px-3"><RoleBadge role={u.role} /></td>
                        <td className="py-2 px-3">
                          <Badge className={u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                            {u.isActive ? 'Actif' : 'Inactif'}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString('fr-FR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── Accès rapide ──────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {[
                { id: 'users', label: 'Utilisateurs', icon: Users, color: 'bg-teal-50 text-teal-600' },
                { id: 'moderation', label: 'Modération', icon: Shield, color: 'bg-orange-50 text-orange-600' },
                { id: 'signalements', label: 'Signalements', icon: Flag, color: 'bg-amber-50 text-amber-600' },
                { id: 'disputes', label: 'Litiges', icon: AlertTriangle, color: 'bg-red-50 text-red-600' },
                { id: 'system', label: 'Système', icon: Activity, color: 'bg-green-50 text-green-600' },
              ].map((link) => {
                const Icon = link.icon
                return (
                  <button
                    key={link.id}
                    onClick={() => setDashboardSection(link.id)}
                    className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border hover:bg-accent hover:shadow-sm transition-all"
                  >
                    <div className={`flex size-10 items-center justify-center rounded-lg ${link.color}`}>
                      <Icon className="size-5" />
                    </div>
                    <span className="text-xs font-medium text-foreground text-center">{link.label}</span>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
