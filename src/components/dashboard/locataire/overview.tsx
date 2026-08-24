'use client'

import { useEffect, useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Eye, MessageSquare, ShieldCheck, Home, MapPin, User, CreditCard,
  Calendar, Clock, CheckCircle2, AlertTriangle, Hourglass, ChevronRight,
  FileSignature, Wrench, FileText, Heart, Star, AlertCircle, Info,
  X, ExternalLink, Bell, Map as MapIcon
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge as SharedStatusBadge, type StatusTone } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { useRealtimeNotifications } from '@/hooks/use-realtime-notifications'
import { useRealtimeLeases } from '@/hooks/use-realtime-leases'
import { useRealtimeVisits } from '@/hooks/use-realtime-visits'
import { useRealtimePayments } from '@/hooks/use-realtime-payments'
import { useRealtimeRentalFiles } from '@/hooks/use-realtime-rental-files'
import { useRealtimeApplications } from '@/hooks/use-realtime-applications'
import { useRealtimeMaintenance } from '@/hooks/use-realtime-maintenance'
import { ContactDialog } from '@/components/messaging/contact-dialog'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface DashboardData {
  stats: {
    totalRentalFiles: number; activeLeases: number; pendingVisits: number
    unreadMessages: number; latePaymentsCount: number; totalPaid: number
    pendingMaintenance: number; inProgressMaintenance: number
    nextPayment: NextPayment | null
  }
  rentalFiles: Array<any>
  visitRequests: Array<any>
  activeLeases: Array<LeaseData>
  conversations: Array<any>
  myDocuments: Array<{ id: string; type: string; url: string; name: string }>
  maintenanceRequests: Array<MaintenanceItem>
  recommendedProperties: Array<Recommendation>
  alerts: Array<AlertItem>
  favoritePropIds: string[]
}

interface LeaseData {
  id: string; monthlyRent: number; charges: number; startDate: string; endDate: string
  property: {
    title: string; address?: string; city: string; commune?: string; type?: string
    bedrooms?: number; area?: number; latitude?: number; longitude?: number
    images: Array<{ url: string }>
  }
  owner: { id: string; firstName: string; lastName: string; avatarUrl?: string }
  paymentStatus: 'up_to_date' | 'late' | 'pending'
  nextPayment: NextPayment | null; latePaymentsCount: number; totalPaid: number
  payments: Array<PayItem>; maintenanceRequests: Array<MaintenanceItem>
}

interface NextPayment { id: string; amount: number; dueDate: string; status: string; leaseId?: string }
interface PayItem { id: string; amount: number; status: string; dueDate: string; paidAt: string | null }
interface MaintenanceItem { id: string; title: string; description: string; status: string; priority: string; createdAt: string }
interface Recommendation { id: string; title: string; type: string; price: number; city: string; commune?: string; bedrooms?: number; area?: number; images: Array<{ url: string }> }
interface AlertItem { type: 'warning' | 'info' | 'error'; title: string; message: string; section: string }

const defaultData: DashboardData = {
  stats: { totalRentalFiles: 0, activeLeases: 0, pendingVisits: 0, unreadMessages: 0, latePaymentsCount: 0, totalPaid: 0, pendingMaintenance: 0, inProgressMaintenance: 0, nextPayment: null },
  rentalFiles: [], visitRequests: [], activeLeases: [], conversations: [],
  myDocuments: [], maintenanceRequests: [], recommendedProperties: [], alerts: [], favoritePropIds: [],
}

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } }
const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; tone: StatusTone }> = {
    DRAFT: { label: 'Brouillon', tone: 'neutral' },
    SUBMITTED: { label: 'Soumis', tone: 'warning' },
    TC_REVIEW: { label: 'En revue', tone: 'warning' },
    VALIDATED: { label: 'Validé', tone: 'success' },
    REJECTED: { label: 'Rejeté', tone: 'danger' },
    PENDING: { label: 'En attente', tone: 'warning' },
    ACCEPTED: { label: 'Accepté', tone: 'success' },
    COMPLETED: { label: 'Terminé', tone: 'info' },
    ACTIVE: { label: 'Actif', tone: 'success' },
    IN_PROGRESS: { label: 'En cours', tone: 'info' },
    RESOLVED: { label: 'Résolu', tone: 'info' },
  }
  const c = config[status] || { label: status, tone: 'neutral' as StatusTone }
  return <SharedStatusBadge tone={c.tone} label={c.label} />
}

function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<string, { label: string; tone: StatusTone }> = {
    LOW: { label: 'Basse', tone: 'neutral' },
    MEDIUM: { label: 'Moyenne', tone: 'warning' },
    HIGH: { label: 'Haute', tone: 'warning' },
    URGENT: { label: 'Urgente', tone: 'danger' },
  }
  const c = config[priority] || { label: priority, tone: 'neutral' as StatusTone }
  return <SharedStatusBadge tone={c.tone} label={c.label} />
}

function PaymentStatusIndicator({ status }: { status: 'up_to_date' | 'late' | 'pending' }) {
  if (status === 'up_to_date') return <div className="flex items-center gap-1.5"><CheckCircle2 className="size-4 text-emerald-500" /><span className="text-xs font-medium text-emerald-600">À jour</span></div>
  if (status === 'late') return <div className="flex items-center gap-1.5"><AlertTriangle className="size-4 text-red-500" /><span className="text-xs font-medium text-red-600">En retard</span></div>
  return <div className="flex items-center gap-1.5"><Hourglass className="size-4 text-amber-500" /><span className="text-xs font-medium text-amber-600">En attente</span></div>
}

function AlertIcon({ type }: { type: string }) {
  if (type === 'error') return <AlertCircle className="size-5 text-red-500 shrink-0" />
  if (type === 'warning') return <AlertTriangle className="size-5 text-amber-500 shrink-0" />
  return <Info className="size-5 text-blue-500 shrink-0" />
}

export function LocataireOverview() {
  const { user, isAuthenticated, setDashboardSection, setSelectedItemId } = useAuthStore()
  const queryClient = useQueryClient()
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())
  const mapContainerRef = useRef<HTMLDivElement>(null)

  const queryKey = ['dashboard-locataire']

  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey,
    queryFn: async () => {
      const d = await authFetch<DashboardData>('/api/dashboard/locataire')
      return d ?? defaultData
    },
    enabled: isAuthenticated,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: defaultData,
  })

  const theData = data ?? defaultData

  const invalidate = () => queryClient.invalidateQueries({ queryKey })

  useRealtimeNotifications({ userId: user?.id, onNotificationChange: invalidate })
  useRealtimeLeases({ userId: user?.id, onLeaseChange: invalidate })
  useRealtimeVisits({ userId: user?.id, onVisitChange: invalidate })
  useRealtimePayments({ userId: user?.id, onPaymentChange: invalidate })
  useRealtimeRentalFiles({ userId: user?.id, onRentalFileChange: invalidate })
  useRealtimeApplications({ userId: user?.id, onApplicationChange: invalidate })
  useRealtimeMaintenance({ userId: user?.id, onMaintenanceChange: invalidate })

  // Load map when primary lease has coordinates
  useEffect(() => {
    if (!theData.activeLeases[0]?.property?.latitude || !mapContainerRef.current) return
    let map: any = null
    import('leaflet').then((L) => {
      if (!mapContainerRef.current) return
      map = L.map(mapContainerRef.current).setView(
        [theData.activeLeases[0].property.latitude!, theData.activeLeases[0].property.longitude!], 14
      )
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
      }).addTo(map)
      L.marker([theData.activeLeases[0].property.latitude!, theData.activeLeases[0].property.longitude!])
        .addTo(map)
        .bindPopup(`<b>${theData.activeLeases[0].property.title}</b><br/>${theData.activeLeases[0].property.address || theData.activeLeases[0].property.city}`)
    })
    return () => { if (map) map.remove() }
  }, [theData.activeLeases])

  if (isLoading) return <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}</div>
  if (error && !data) return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold text-foreground">Bonjour, {user?.firstName} 👋</h1>
      <Card className="border-amber-200 bg-amber-50"><CardContent className="p-4"><p className="text-sm text-amber-700">Impossible de charger vos données. Veuillez réessayer.</p></CardContent></Card>
    </div>
  )

  const primaryLease = theData.activeLeases[0] || null

  // Active alerts (not dismissed)
  const activeAlerts = theData.alerts.filter(a => !dismissedAlerts.has(a.title))

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      {/* Header with gradient */}
      <motion.div variants={itemVariants} className="relative overflow-hidden rounded-xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 p-6 sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(0,0,0,0.08),transparent_50%)]" />
        <div className="relative z-10">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">Bonjour, {user?.firstName} 👋</h1>
          <p className="text-brand-100 mt-1.5 text-sm sm:text-base">Bienvenue sur votre espace locataire</p>
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 text-white text-xs font-medium backdrop-blur-sm">
              <Home className="size-3.5" />
              {theData.stats.activeLeases} contrat{theData.stats.activeLeases !== 1 ? 's' : ''} actif{theData.stats.activeLeases !== 1 ? 's' : ''}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 text-white text-xs font-medium backdrop-blur-sm">
              <CreditCard className="size-3.5" />
              {theData.stats.totalPaid.toLocaleString('fr-FR')} FCFA payés
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 text-white text-xs font-medium backdrop-blur-sm">
              <MessageSquare className="size-3.5" />
              {theData.stats.unreadMessages} message{theData.stats.unreadMessages !== 1 ? 's' : ''} non lu{theData.stats.unreadMessages !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </motion.div>

      {/* ─── 1. ALERTES ────────────────────────────────────────────────── */}
      {activeAlerts.length > 0 && (
        <motion.div variants={itemVariants} className="space-y-2">
          {activeAlerts.map((alert) => (
            <Card key={alert.title} className={cn(
              'border-l-4',
              alert.type === 'error' ? 'border-l-red-500 bg-red-50/50' :
              alert.type === 'warning' ? 'border-l-amber-500 bg-amber-50/50' :
              'border-l-blue-500 bg-blue-50/50'
            )}>
              <CardContent className="p-3 flex items-start gap-3">
                <AlertIcon type={alert.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                  <p className="text-xs text-muted-foreground">{alert.message}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDashboardSection(alert.section as any)}>
                    <ExternalLink className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDismissedAlerts(prev => new Set([...prev, alert.title]))}>
                    <X className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}

      {/* ─── 2. MON LOGEMENT ──────────────────────────────────────────── */}
      {primaryLease && (
        <motion.div variants={itemVariants}>
          <div className="flex items-center gap-2 mb-3">
            <Home className="size-5 text-brand-500" />
            <h2 className="text-base font-semibold text-foreground">Mon logement</h2>
          </div>
          <Card className="border-border overflow-hidden">
            <CardContent className="p-0">
              {/* Image hero */}
              <div className="relative h-44 sm:h-48 bg-gradient-to-br from-brand-600 to-brand-800 overflow-hidden">
                {primaryLease.property.images?.[0]?.url ? (
                  <>
                    <img src={primaryLease.property.images[0].url} alt={primaryLease.property.title}
                      className="absolute inset-0 size-full object-cover opacity-60" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center"><Home className="size-16 text-white/30" /></div>
                )}
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-lg sm:text-xl font-bold text-white truncate">{primaryLease.property.title}</h3>
                      <p className="text-xs sm:text-sm text-white/80 flex items-center gap-1 mt-0.5">
                        <MapPin className="size-3 shrink-0" />
                        <span className="truncate">{primaryLease.property.address || primaryLease.property.city}</span>
                      </p>
                    </div>
                    <Badge className="bg-white/20 text-white border-0 text-xs font-semibold px-3 py-1 shrink-0 backdrop-blur-sm">
                      {primaryLease.property.type || 'Appartement'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Infos */}
              <div className="p-4 sm:p-5 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-muted/60 border border-border/50">
                    <p className="text-[10px] text-muted-foreground mb-1">Type</p>
                    <p className="text-sm font-bold text-foreground">{primaryLease.property.type || '—'}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/60 border border-border/50">
                    <p className="text-[10px] text-muted-foreground mb-1">Pièces</p>
                    <p className="text-sm font-bold text-foreground">{primaryLease.property.bedrooms ? `${primaryLease.property.bedrooms} ch.` : '—'}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/60 border border-border/50">
                    <p className="text-[10px] text-muted-foreground mb-1">Surface</p>
                    <p className="text-sm font-bold text-foreground">{primaryLease.property.area ? `${primaryLease.property.area} m²` : '—'}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/60 border border-border/50">
                    <p className="text-[10px] text-muted-foreground mb-1">Statut</p>
                    <p className="text-sm font-bold text-green-600">Occupé</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-full bg-muted shrink-0">
                      <User className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Propriétaire</p>
                      <p className="text-sm font-medium text-foreground truncate">{primaryLease.owner.firstName} {primaryLease.owner.lastName}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ContactDialog
                      defaultRecipientId={primaryLease.owner.id}
                      onMessageSent={() => setDashboardSection('messages')}
                      trigger={<Button variant="outline" size="sm" className="h-8 text-xs gap-1.5"><MessageSquare className="size-3.5" />Contacter</Button>}
                    />
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => {
                      setSelectedItemId(primaryLease.id); setDashboardSection('my-leases')
                    }}>Voir bail <ChevronRight className="size-3" /></Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ─── 3. PAIEMENTS ────────────────────────────────────────────────── */}
      {primaryLease && (
        <motion.div variants={itemVariants}>
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="size-5 text-brand-500" />
            <h2 className="text-base font-semibold text-foreground">Paiements</h2>
          </div>
          <Card className="border-border">
            <CardContent className="p-4 sm:p-5">
              {/* Résumé */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="p-3 rounded-xl bg-muted/60 border border-border/50">
                  <p className="text-[10px] text-muted-foreground">Loyer mensuel</p>
                  <p className="text-lg font-bold text-foreground">{primaryLease.monthlyRent.toLocaleString('fr-FR')}<span className="text-xs font-normal text-muted-foreground"> FCFA</span></p>
                </div>
                <div className="p-3 rounded-xl bg-muted/60 border border-border/50">
                  <p className="text-[10px] text-muted-foreground">Total payé</p>
                  <p className="text-lg font-bold text-green-600">{primaryLease.totalPaid.toLocaleString('fr-FR')}<span className="text-xs font-normal text-muted-foreground"> FCFA</span></p>
                </div>
                <div className="p-3 rounded-xl bg-muted/60 border border-border/50">
                  <p className="text-[10px] text-muted-foreground">Prochain</p>
                  {primaryLease.nextPayment ? (
                    <div>
                      <p className="text-lg font-bold text-foreground">{primaryLease.nextPayment.amount.toLocaleString('fr-FR')}<span className="text-xs font-normal text-muted-foreground"> FCFA</span></p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(primaryLease.nextPayment.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  ) : <p className="text-sm text-muted-foreground">—</p>}
                </div>
                <div className={cn('p-3 rounded-xl border',
                  primaryLease.paymentStatus === 'up_to_date' ? 'bg-emerald-50/60 border-emerald-200/50' :
                  primaryLease.paymentStatus === 'late' ? 'bg-red-50/60 border-red-200/50' :
                  'bg-amber-50/60 border-amber-200/50'
                )}>
                  <p className="text-[10px] text-muted-foreground mb-1">Statut</p>
                  <PaymentStatusIndicator status={primaryLease.paymentStatus} />
                </div>
              </div>

              {/* Historique */}
              {primaryLease.payments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Historique des loyers</p>
                  <div className="max-h-48 overflow-y-auto space-y-1.5">
                    {primaryLease.payments.slice(0, 10).map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border hover:bg-accent/50">
                        <div className="flex items-center gap-2.5">
                          {p.status === 'PAID' ? <CheckCircle2 className="size-4 text-emerald-500" /> :
                           p.status === 'LATE' ? <AlertTriangle className="size-4 text-red-500" /> :
                           <Hourglass className="size-4 text-amber-500" />}
                          <div>
                            <p className="text-sm font-medium text-foreground">{p.amount.toLocaleString('fr-FR')} FCFA</p>
                            <p className="text-[10px] text-muted-foreground">Échéance {new Date(p.dueDate).toLocaleDateString('fr-FR')}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className={p.status === 'PAID' ? 'bg-green-100 text-green-700' :
                            p.status === 'LATE' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'}>
                            {p.status === 'PAID' ? 'Payé' : p.status === 'LATE' ? 'Retard' : 'En attente'}
                          </Badge>
                          {p.status === 'PAID' && p.paidAt && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">le {new Date(p.paidAt).toLocaleDateString('fr-FR')}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={() => setDashboardSection('payments')}>
                    Voir tous mes paiements <ChevronRight className="size-3" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ─── KPI Mini Stats ────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border cursor-pointer hover:shadow-sm transition-shadow"
          onClick={() => setDashboardSection('my-leases')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-green-50"><FileSignature className="size-5 text-green-600" /></div>
            <div><p className="text-xl font-bold text-foreground">{theData.stats.activeLeases}</p><p className="text-xs text-muted-foreground">Contrat actif</p></div>
          </CardContent>
        </Card>
        <Card className="border-border cursor-pointer hover:shadow-sm transition-shadow"
          onClick={() => setDashboardSection('maintenance')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50"><Wrench className="size-5 text-amber-600" /></div>
            <div><p className="text-xl font-bold text-foreground">{theData.stats.pendingMaintenance + theData.stats.inProgressMaintenance}</p><p className="text-xs text-muted-foreground">Demandes en cours</p></div>
          </CardContent>
        </Card>
        <Card className="border-border cursor-pointer hover:shadow-sm transition-shadow"
          onClick={() => setDashboardSection('messages')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50"><MessageSquare className="size-5 text-brand-600" /></div>
            <div><p className="text-xl font-bold text-foreground">{theData.stats.unreadMessages}</p><p className="text-xs text-muted-foreground">Messages</p></div>
          </CardContent>
        </Card>
        <Card className="border-border cursor-pointer hover:shadow-sm transition-shadow"
          onClick={() => setDashboardSection('my-visits')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50"><Eye className="size-5 text-blue-600" /></div>
            <div><p className="text-xl font-bold text-foreground">{theData.stats.pendingVisits}</p><p className="text-xs text-muted-foreground">Visites</p></div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── 4. DEMANDES DE MAINTENANCE ────────────────────────────────── */}
      {theData.maintenanceRequests.length > 0 && (
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wrench className="size-5 text-brand-500" />
              <h2 className="text-base font-semibold text-foreground">Mes demandes</h2>
            </div>
            <Button variant="ghost" size="sm" className="text-brand-500 gap-1" onClick={() => setDashboardSection('maintenance')}>
              Voir tout <ChevronRight className="size-3" />
            </Button>
          </div>
          <Card className="border-border">
            <CardContent className="p-4 space-y-2 max-h-64 overflow-y-auto">
              {theData.maintenanceRequests.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => setDashboardSection('maintenance')}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn('size-8 rounded-full flex items-center justify-center shrink-0',
                      m.status === 'RESOLVED' ? 'bg-green-50' : m.status === 'IN_PROGRESS' ? 'bg-blue-50' : 'bg-amber-50'
                    )}>
                      <Wrench className={cn('size-4',
                        m.status === 'RESOLVED' ? 'text-green-600' : m.status === 'IN_PROGRESS' ? 'text-blue-600' : 'text-amber-600'
                      )} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{m.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StatusBadge status={m.status} />
                        <span className="text-[10px] text-muted-foreground">{new Date(m.createdAt).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>
                  </div>
                  <PriorityBadge priority={m.priority} />
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ─── 5. DOCUMENTS ──────────────────────────────────────────────── */}
      {theData.myDocuments.length > 0 && (
        <motion.div variants={itemVariants}>
          <div className="flex items-center gap-2 mb-3">
            <FileText className="size-5 text-brand-500" />
            <h2 className="text-base font-semibold text-foreground">Mes documents</h2>
          </div>
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {theData.myDocuments.slice(0, 6).map((doc) => (
                  <a key={doc.id} href={doc.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors group">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-brand-50 shrink-0">
                      <FileText className="size-4 text-brand-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">{doc.name || doc.type}</p>
                      <p className="text-[10px] text-muted-foreground">{doc.type}</p>
                    </div>
                    <ExternalLink className="size-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                ))}
              </div>
              <Button variant="outline" size="sm" className="w-full mt-3 text-xs gap-1" onClick={() => setDashboardSection('my-leases')}>
                Voir tous les documents <ChevronRight className="size-3" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ─── 6. RECOMMANDATIONS + FAVORIS ──────────────────────────────── */}
      {(theData.recommendedProperties.length > 0 || theData.favoritePropIds.length > 0) && (
        <motion.div variants={itemVariants}>
          <div className="flex items-center gap-2 mb-3">
            <Star className="size-5 text-brand-500" />
            <h2 className="text-base font-semibold text-foreground">Recommandations</h2>
          </div>
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {theData.recommendedProperties.slice(0, 4).map((rec) => (
                  <div key={rec.id} className="flex gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => { setSelectedItemId(rec.id); setDashboardSection('search-properties') }}>
                    <div className="size-16 rounded-lg bg-muted overflow-hidden shrink-0">
                      {rec.images?.[0]?.url ? (
                        <img src={rec.images[0].url} alt="" className="size-full object-cover" />
                      ) : (
                        <div className="size-full flex items-center justify-center"><Home className="size-5 text-muted-foreground" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{rec.title}</p>
                      <p className="text-xs text-muted-foreground">{rec.city}{rec.commune ? `, ${rec.commune}` : ''}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge className="bg-brand-50 text-brand-700 text-[10px] font-semibold">
                          {rec.price.toLocaleString('fr-FR')} FCFA
                        </Badge>
                        {rec.bedrooms && <span className="text-[10px] text-muted-foreground">{rec.bedrooms} ch.</span>}
                      </div>
                    </div>
                    <Heart className={cn('size-4 shrink-0 mt-1',
                      theData.favoritePropIds.includes(rec.id) ? 'text-red-500 fill-red-500' : 'text-muted-foreground'
                    )} />
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="w-full mt-3 text-xs gap-1" onClick={() => setDashboardSection('search-properties')}>
                Rechercher un logement <ChevronRight className="size-3" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ─── 7. CARTE ──────────────────────────────────────────────────── */}
      {primaryLease?.property?.latitude && primaryLease?.property?.longitude && (
        <motion.div variants={itemVariants}>
          <div className="flex items-center gap-2 mb-3">
            <MapIcon className="size-5 text-brand-500" />
            <h2 className="text-base font-semibold text-foreground">Localisation</h2>
          </div>
          <Card className="border-border overflow-hidden">
            <div ref={mapContainerRef} className="h-48 w-full" />
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="size-3" />
                {primaryLease.property.address || primaryLease.property.city}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  )
}
