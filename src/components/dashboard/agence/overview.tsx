'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Building2, FileSignature, Users, TrendingUp, CreditCard,
  AlertTriangle, Plus, Calendar, Clock, ChevronRight, Home, User,
  Target, CheckCircle2, MessageSquare, MapPin,
  Eye, Layers,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { useRealtimeProperties } from '@/hooks/use-realtime-properties'
import { useRealtimeRentalFiles } from '@/hooks/use-realtime-rental-files'
import { useRealtimeLeases } from '@/hooks/use-realtime-leases'
import { useRealtimeVisits } from '@/hooks/use-realtime-visits'
import { useRealtimeMandats } from '@/hooks/use-realtime-mandats'
import { useRealtimePayments } from '@/hooks/use-realtime-payments'
import { motion } from 'framer-motion'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PipelineStats {
  leads: number
  visits: number
  negotiations: number
  signatures: number
}

interface TodaysVisit {
  id: string
  timeSlot: string
  status: string
  visitType: string
  tenant: { firstName: string; lastName: string; phone: string } | null
  property: { title: string; city: string; address: string } | null
}

interface ClientDemand {
  id: string
  status: string
  tenantCategory: string
  createdAt: string
  tenant: { firstName: string; lastName: string; phone: string } | null
  property: { title: string } | null
}

interface AgenceData {
  stats: {
    totalProperties: number
    activeProperties: number
    activeMandats: number
    activeLeases: number
    totalAgents: number
    totalCommissions: number
    paidCommissions: number
    pendingCommissions: number
    totalRevenue: number
    pendingVisits: number
    latePaymentsCount: number
    expiringMandatsCount: number
  }
  properties: Array<{
    id: string; title: string; type: string; price: number; city: string; status: string
    images: Array<{ url: string }>; hasMandat: boolean; viewsCount: number
    latitude: number | null; longitude: number | null
  }>
  visitRequests: Array<{
    id: string; status: string; createdAt: string; requestedDate: string; timeSlot: string
    tenant: { firstName: string; lastName: string; phone: string }
    property: { title: string; city: string }
  }>
  activeLeases: Array<{
    id: string; status: string; monthlyRent: number; startDate: string; endDate: string
    tenant: { id: string; firstName: string; lastName: string; avatarUrl: string | null; phone: string }
    property: { title: string; city: string; images: Array<{ url: string }> }
  }>
  expiringMandats: Array<{
    id: string; endDate: string
    property: { title: string }; owner: { firstName: string; lastName: string }
  }>
  todaysVisits: TodaysVisit[]
  pipelineStats: PipelineStats
  clientDemands: ClientDemand[]
}

const defaultPipeline: PipelineStats = { leads: 0, visits: 0, negotiations: 0, signatures: 0 }

const defaultData: AgenceData = {
  stats: { totalProperties: 0, activeProperties: 0, activeMandats: 0, activeLeases: 0, totalAgents: 0, totalCommissions: 0, paidCommissions: 0, pendingCommissions: 0, totalRevenue: 0, pendingVisits: 0, latePaymentsCount: 0, expiringMandatsCount: 0 },
  properties: [], visitRequests: [], activeLeases: [], expiringMandats: [],
  todaysVisits: [], pipelineStats: defaultPipeline, clientDemands: [],
}

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } }
const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }

const timeSlotLabels: Record<string, string> = {
  MORNING: 'Matin (9h-12h)',
  AFTERNOON: 'Après-midi (14h-17h)',
  EVENING: 'Soir (17h-20h)',
}

const pipelineSteps = [
  { key: 'leads', label: 'Nouveaux leads', icon: Target, color: 'bg-orange-100 text-orange-600' },
  { key: 'visits', label: 'Visites', icon: MapPin, color: 'bg-amber-100 text-amber-600' },
  { key: 'negotiations', label: 'Négociations', icon: FileSignature, color: 'bg-emerald-100 text-emerald-600' },
  { key: 'signatures', label: 'Signatures', icon: CheckCircle2, color: 'bg-green-100 text-green-600' },
]

// ─── Component ──────────────────────────────────────────────────────────────

export function AgenceOverview() {
  const { user, isAuthenticated, setDashboardSection } = useAuthStore()
  const [data, setData] = useState<AgenceData>(defaultData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return }
    try {
      const d = await authFetch<AgenceData>('/api/dashboard/agence')
      setData({ ...defaultData, ...d, pipelineStats: d.pipelineStats || defaultPipeline })
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) { setData(defaultData); return }
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally { setLoading(false) }
  }, [isAuthenticated])

  useEffect(() => { fetchData() }, [fetchData])

  const propertyIds = data.properties.map(p => p.id)

  useRealtimeProperties({
    userId: user?.id,
    onPropertyChange: () => { fetchData() },
  })
  useRealtimeRentalFiles({
    userId: user?.id,
    watchAll: true,
    onRentalFileChange: () => { fetchData() },
  })
  useRealtimeLeases({
    userId: user?.id,
    onLeaseChange: () => { fetchData() },
  })
  useRealtimeVisits({
    userId: user?.id,
    ownedPropertyIds: propertyIds,
    onVisitChange: () => { fetchData() },
  })
  useRealtimeMandats({
    userId: user?.id,
    onMandatChange: () => { fetchData() },
  })
  useRealtimePayments({
    userId: user?.id,
    onPaymentChange: () => { fetchData() },
  })

  // ─── Leaflet map for agency properties ───────────────────────────────────
  useEffect(() => {
    if (data.properties.length === 0 || !mapRef.current) return
    let map: any = null
    import('leaflet').then((L) => {
      if (!mapRef.current) return
      map = L.map(mapRef.current, { zoomControl: true }).setView([5.317066, -4.028636], 11)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 18,
      }).addTo(map)

      const markersLayer = L.layerGroup().addTo(map)
      const propertiesWithCoords = data.properties.filter(p => p.latitude != null && p.longitude != null)
      if (propertiesWithCoords.length > 0) {
        // Auto-fit map to show all markers
        const bounds = L.latLngBounds(propertiesWithCoords.map(p => [p.latitude!, p.longitude!]))
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
      }
      data.properties.forEach((p) => {
        if (p.latitude != null && p.longitude != null) {
          const marker = L.marker([p.latitude, p.longitude], {
            icon: L.divIcon({
              className: 'custom-marker',
              html: `<div style="background:#FF6C2F;color:white;padding:4px 8px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.15)">${p.title?.substring(0, 12) || 'Bien'}</div>`,
            }),
          })
          marker.bindPopup(`<b>${p.title}</b><br/>${p.city}<br/>${p.price.toLocaleString('fr-FR')} FCFA`)
          marker.on('click', () => setDashboardSection('portfolio'))
          markersLayer.addLayer(marker)
        }
      })
    }).catch(console.error)
    return () => { if (map) map.remove() }
  }, [data.properties, setDashboardSection])

  if (loading) return <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}</div>

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Bonjour, {user?.firstName} 👋</h1>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4"><p className="text-sm text-amber-700">Impossible de charger vos données. Veuillez réessayer.</p></CardContent>
        </Card>
      </div>
    )
  }

  const pipeline = data.pipelineStats || defaultPipeline
  const maxPipeline = Math.max(pipeline.leads, pipeline.visits, pipeline.negotiations, pipeline.signatures, 1)
  const activeLeasesOnly = data.activeLeases.filter((l) => l.status === 'ACTIVE')

  const kpis = [
    { label: 'Biens gérés', value: data.stats.totalProperties, icon: Building2, color: 'text-orange-600 bg-orange-50' },
    { label: 'Mandats actifs', value: data.stats.activeMandats, icon: FileSignature, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Baux signés', value: data.stats.activeLeases, icon: Home, color: 'text-teal-600 bg-teal-50' },
    { label: 'CA mensuel', value: `${(data.stats.totalRevenue / 1000).toFixed(0)}k`, icon: TrendingUp, color: 'text-amber-600 bg-amber-50' },
    { label: 'Agents', value: data.stats.totalAgents, icon: Users, color: 'text-rose-600 bg-rose-50' },
    { label: 'Commissions', value: `${(data.stats.totalCommissions / 1000).toFixed(0)}k`, icon: CreditCard, color: 'text-violet-600 bg-violet-50' },
  ]

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      {/* Header with gradient */}
      <motion.div variants={itemVariants} className="relative overflow-hidden rounded-xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 p-6 sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(0,0,0,0.08),transparent_50%)]" />
        <div className="relative z-10">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">Bonjour, {user?.firstName} 👋</h1>
          <p className="text-brand-100 mt-1.5 text-sm sm:text-base">Espace Agence — Portefeuille, clients et performances</p>
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 text-white text-xs font-medium backdrop-blur-sm">
              <Building2 className="size-3.5" />
              {data.stats.totalProperties} bien{data.stats.totalProperties !== 1 ? 's' : ''} géré{data.stats.totalProperties !== 1 ? 's' : ''}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 text-white text-xs font-medium backdrop-blur-sm">
              <FileSignature className="size-3.5" />
              {data.stats.activeMandats} mandat{data.stats.activeMandats !== 1 ? 's' : ''} actif{data.stats.activeMandats !== 1 ? 's' : ''}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 text-white text-xs font-medium backdrop-blur-sm">
              <TrendingUp className="size-3.5" />
              {data.stats.totalRevenue.toLocaleString('fr-FR')} FCFA/mois
            </span>
          </div>
        </div>
      </motion.div>

      {/* ─── KPIs ────────────────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.label} className="border-border">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <div className={`flex size-9 items-center justify-center rounded-lg ${kpi.color}`}>
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-lg sm:text-xl font-bold text-foreground">{kpi.value}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">{kpi.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </motion.div>

      {/* ─── Pipeline commercial ──────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="border-border overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="size-5 text-[#FF6C2F]" />
                <CardTitle className="text-base font-semibold">Pipeline commercial</CardTitle>
              </div>
              <Badge className="bg-[#FF6C2F]/10 text-[#FF6C2F] border-0">
                {pipeline.leads + pipeline.visits + pipeline.negotiations + pipeline.signatures} total
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row items-stretch gap-4">
              {pipelineSteps.map((step, idx) => {
                const Icon = step.icon
                const count = pipeline[step.key as keyof typeof pipeline] || 0
                const pct = maxPipeline > 0 ? (count / maxPipeline) * 100 : 0
                return (
                  <div key={step.key} className="flex-1 relative">
                    {idx < pipelineSteps.length - 1 && (
                      <div className="hidden sm:block absolute top-5 left-[calc(50%+20px)] right-0 h-[2px] bg-border z-0" />
                    )}
                    <div className="flex flex-col items-center text-center gap-2 relative z-10">
                      <div className={`flex size-10 items-center justify-center rounded-full ${step.color}`}>
                        <Icon className="size-5" />
                      </div>
                      <div>
                        <p className="text-xl font-bold text-foreground">{count}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">{step.label}</p>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${step.color.split(' ')[0]}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── Quick Actions ─────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="flex flex-wrap gap-2">
        <Button onClick={() => setDashboardSection('portfolio')} className="bg-[#FF6C2F] hover:bg-[#e55e27] text-white gap-2">
          <Plus className="size-4" /> Ajouter un bien
        </Button>
        <Button onClick={() => setDashboardSection('mandats')} variant="outline" className="gap-2 border-[#FF6C2F] text-[#FF6C2F] hover:bg-orange-50">
          <FileSignature className="size-4" /> Nouveau mandat
        </Button>
        <Button onClick={() => setDashboardSection('visits')} variant="outline" className="gap-2">
          <Calendar className="size-4" /> Planifier visite
        </Button>
      </motion.div>

      {/* ─── Alertes ───────────────────────────────────────────────────────── */}
      {(data.stats.expiringMandatsCount > 0 || data.stats.latePaymentsCount > 0) && (
        <motion.div variants={itemVariants} className="space-y-2">
          {data.stats.expiringMandatsCount > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-3 flex items-center gap-3">
                <AlertTriangle className="size-5 text-amber-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">{data.stats.expiringMandatsCount} mandat(s) expirant bientôt</p>
                  <p className="text-xs text-amber-600">Pensez à les renouveler pour éviter toute interruption</p>
                </div>
                <Button size="sm" variant="outline" className="ml-auto text-amber-700 border-amber-300 hover:bg-amber-100" onClick={() => setDashboardSection('mandats')}>
                  Voir
                </Button>
              </CardContent>
            </Card>
          )}
          {data.stats.latePaymentsCount > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-3 flex items-center gap-3">
                <AlertTriangle className="size-5 text-red-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800">{data.stats.latePaymentsCount} paiement(s) en retard</p>
                  <p className="text-xs text-red-600">Un suivi est nécessaire pour les loyers impayés</p>
                </div>
                <Button size="sm" variant="outline" className="ml-auto text-red-700 border-red-300 hover:bg-red-100" onClick={() => setDashboardSection('finances')}>
                  Voir
                </Button>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      {/* ─── 2-col: Agenda + Annonces ───────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Agenda - Visites du jour */}
        <motion.div variants={itemVariants}>
          <Card className="border-border h-full">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="size-5 text-[#FF6C2F]" />
                  <CardTitle className="text-base font-semibold">Aujourd&apos;hui</CardTitle>
                </div>
                <Badge variant="outline" className="text-muted-foreground">
                  {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {data.todaysVisits.length === 0 ? (
                <div className="py-6 text-center">
                  <Calendar className="size-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Aucune visite aujourd&apos;hui</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => setDashboardSection('visits')}>
                    Planifier une visite
                  </Button>
                </div>
              ) : (
                data.todaysVisits.map((v) => (
                  <div key={v.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                    <div className="flex size-10 items-center justify-center rounded-full bg-orange-50 shrink-0">
                      <Clock className="size-5 text-[#FF6C2F]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {v.tenant?.firstName} {v.tenant?.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">{v.property?.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className="bg-brand-50 text-brand-700 text-[10px]">
                          {timeSlotLabels[v.timeSlot] || v.timeSlot}
                        </Badge>
                        {v.tenant?.phone && (
                          <span className="text-[10px] text-muted-foreground">📞 {v.tenant.phone}</span>
                        )}
                      </div>
                    </div>
                    <Badge className={v.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                      {v.status === 'CONFIRMED' ? 'Confirmée' : v.status === 'PENDING' ? 'En attente' : v.status}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Mes annonces */}
        <motion.div variants={itemVariants}>
          <Card className="border-border h-full">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="size-5 text-[#FF6C2F]" />
                  <CardTitle className="text-base font-semibold">Mes annonces</CardTitle>
                </div>
                <Button variant="ghost" size="sm" className="text-[#FF6C2F] gap-1" onClick={() => setDashboardSection('portfolio')}>
                  Gérer <ChevronRight className="size-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-3 mb-3">
                {[
                  { label: 'Actives', count: data.properties.filter(p => p.status === 'ACTIVE').length, color: 'bg-green-50 text-green-600 border-green-200' },
                  { label: 'Louées', count: data.properties.filter(p => p.status === 'RENTED').length, color: 'bg-orange-50 text-orange-600 border-orange-200' },
                  { label: 'Suspendues', count: data.properties.filter(p => p.status !== 'ACTIVE' && p.status !== 'RENTED').length, color: 'bg-neutral-50 text-neutral-600 border-neutral-200' },
                ].map((cat) => (
                  <div key={cat.label} className={`flex flex-col items-center p-3 rounded-lg border ${cat.color} cursor-pointer hover:shadow-sm transition-shadow`}
                    onClick={() => setDashboardSection('portfolio')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setDashboardSection('portfolio')
                      }
                    }}>
                    <p className="text-lg font-bold">{cat.count}</p>
                    <p className="text-[10px] font-medium">{cat.label}</p>
                  </div>
                ))}
              </div>

              {data.properties.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Aucun bien pour le moment</p>
              ) : (
                data.properties.slice(0, 4).map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => setDashboardSection('portfolio')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setDashboardSection('portfolio')
                      }
                    }}>
                    <div className="flex items-center gap-3 min-w-0">
                      {p.images?.[0] ? (
                        <img src={p.images[0].url} alt="" className="size-10 rounded-lg object-cover" />
                      ) : (
                        <div className="size-10 rounded-lg bg-orange-50 flex items-center justify-center">
                          <Building2 className="size-4 text-[#FF6C2F]" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.title || 'Sans titre'}</p>
                        <p className="text-xs text-muted-foreground">{p.city} · {p.price.toLocaleString('fr-FR')} FCFA</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Eye className="size-3" />
                        {p.viewsCount || 0}
                      </div>
                      <Badge className={p.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : p.status === 'RENTED' ? 'bg-orange-100 text-orange-700' : 'bg-neutral-100 text-neutral-600'}>
                        {p.status === 'ACTIVE' ? 'Actif' : p.status === 'RENTED' ? 'Loué' : 'Inactif'}
                      </Badge>
                    </div>
                  </div>
                ))
              )}

              {data.properties.length > 4 && (
                <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setDashboardSection('portfolio')}>
                  Voir les {data.properties.length} biens
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ─── 2-col: Demandes clients + Carte ───────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Demandes clients */}
        <motion.div variants={itemVariants}>
          <Card className="border-border h-full">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="size-5 text-[#FF6C2F]" />
                  <CardTitle className="text-base font-semibold">Demandes clients</CardTitle>
                </div>
                <Button variant="ghost" size="sm" className="text-[#FF6C2F] gap-1" onClick={() => setDashboardSection('candidatures')}>
                  Voir tout <ChevronRight className="size-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-2 max-h-64 overflow-y-auto">
              {(data.clientDemands?.length || 0) === 0 ? (
                <div className="py-6 text-center">
                  <MessageSquare className="size-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Aucune demande client en attente</p>
                </div>
              ) : (
                data.clientDemands.map((d) => (
                  <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => setDashboardSection('candidatures')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setDashboardSection('candidatures')
                      }
                    }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-8 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                        <User className="size-4 text-amber-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {d.tenant?.firstName} {d.tenant?.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {d.property?.title || 'Bien non assigné'} · {new Date(d.createdAt).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </div>
                    <Badge className={d.status === 'SUBMITTED' ? 'bg-amber-100 text-amber-700' : 'bg-brand-100 text-brand-700'}>
                      {d.status === 'SUBMITTED' ? 'Soumis' : d.status === 'TC_REVIEW' ? 'En revue' : d.status}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Carte */}
        <motion.div variants={itemVariants}>
          <Card className="border-border h-full overflow-hidden">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="size-5 text-[#FF6C2F]" />
                  <CardTitle className="text-base font-semibold">Carte des biens</CardTitle>
                </div>
                <Button variant="ghost" size="sm" className="text-[#FF6C2F] gap-1" onClick={() => setDashboardSection('portfolio')}>
                  Voir tout <ChevronRight className="size-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div ref={mapRef} className="h-64 w-full" />
              {data.properties.length === 0 && (
                <div className="h-64 flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="size-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Aucun bien à afficher</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ─── Locations en cours ────────────────────────────────────────────── */}
      {activeLeasesOnly.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-border overflow-hidden">
            <div className="bg-gradient-to-r from-[#FF6C2F] to-[#ff8a55] p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Home className="size-5 text-white" />
                    <h2 className="text-base font-semibold text-white">Locations en cours</h2>
                  </div>
                  <p className="text-sm text-white/80">
                    {activeLeasesOnly.length} bail{activeLeasesOnly.length > 1 ? 'x' : ''} actif{activeLeasesOnly.length > 1 ? 's' : ''}
                  </p>
                </div>
                <Badge className="bg-white/20 text-white border-0 text-sm px-3 py-1">
                  {data.stats.totalRevenue.toLocaleString('fr-FR')} FCFA/mois
                </Badge>
              </div>
            </div>
            <CardContent className="p-4 sm:p-5 space-y-3 max-h-64 overflow-y-auto">
              {activeLeasesOnly.slice(0, 5).map((lease) => (
                <div key={lease.id} className="flex flex-col sm:flex-row gap-3 p-3 rounded-xl border border-border hover:bg-accent/50 transition-colors">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="shrink-0">
                      {lease.tenant.avatarUrl ? (
                        <img src={lease.tenant.avatarUrl} alt="" className="size-9 rounded-full object-cover" />
                      ) : (
                        <div className="size-9 rounded-full bg-orange-50 flex items-center justify-center">
                          <User className="size-4 text-[#FF6C2F]" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{lease.tenant.firstName} {lease.tenant.lastName}</p>
                      <p className="text-xs text-muted-foreground truncate">{lease.property.title}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                    <div className="flex items-center gap-1.5">
                      <CreditCard className="size-3.5 text-[#FF6C2F] shrink-0" />
                      <p className="text-sm font-semibold text-foreground whitespace-nowrap">{lease.monthlyRent.toLocaleString('fr-FR')} FCFA</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="size-3.5 text-muted-foreground shrink-0" />
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(lease.startDate).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })} → {new Date(lease.endDate).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

    </motion.div>
  )
}