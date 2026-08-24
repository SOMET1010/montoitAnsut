'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Building2, Eye, FileSignature, TrendingUp, Home, User,
  CheckCircle2, AlertTriangle, Hourglass, CreditCard,
  ArrowRight, BarChart3, Calendar, Clock, Star, Heart,
  Send, Percent, ChevronRight
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useRealtimeProperties } from '@/hooks/use-realtime-properties'
import { useRealtimeVisits } from '@/hooks/use-realtime-visits'
import { useRealtimeLeases } from '@/hooks/use-realtime-leases'
import { useRealtimePayments } from '@/hooks/use-realtime-payments'
import { useRealtimeRentalFiles } from '@/hooks/use-realtime-rental-files'
import { useRealtimeMaintenance } from '@/hooks/use-realtime-maintenance'
import { useRealtimeMandats } from '@/hooks/use-realtime-mandats'
import { useRealtimeNotifications } from '@/hooks/use-realtime-notifications'
import { apiFetch } from '@/lib/capacitor'
import { toast } from 'sonner'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProprietaireData {
  stats: {
    totalProperties: number; activeProperties: number; pendingVisits: number
    activeLeases: number; totalRevenue: number; totalRevenueFromPayments: number
    latePaymentsCount: number; totalViews: number; totalFavorites: number
    conversionRate: number; occupancyRate: number; expiringContractsCount: number
    occupiedProperties: number; availableProperties: number
    monthlyRevenue: Array<{ month: string; revenue: number }>
    recentPayments: Array<PayRecord>
    housingTypeDistribution: Record<string, number>
  }
  monthlyRevenue: Array<{ month: string; revenue: number }>
  properties: Array<PropSummary>
  visitRequests: Array<VisitSummary>
  activeLeases: Array<LeaseSummary>
  expiringContracts: Array<ContractSummary>
}

interface PropSummary {
  id: string; title: string; type: string; price: number
  city: string; status: string; rentalStatus?: string; bedrooms?: number
  images: Array<{ url: string }>
}
interface VisitSummary {
  id: string; status: string; requestedDate: string; timeSlot: string
  tenant: { firstName: string; lastName: string; phone: string }
  property: { title: string; city: string }
}
interface LeaseSummary {
  id: string; status: string; monthlyRent: number; charges: number
  startDate: string; endDate: string; paymentStatus: 'up_to_date' | 'late' | 'pending'
  latePaymentsCount: number; totalPaid: number
  nextPayment: { id: string; amount: number; dueDate: string; status: string } | null
  tenant: { id: string; firstName: string; lastName: string; avatarUrl: string | null; phone: string }
  property: { title: string; city: string; address: string; images: Array<{ url: string }> }
  payments: Array<{ id: string; amount: number; status: string; dueDate: string; paidAt: string | null }>
}
interface ContractSummary {
  id: string; monthlyRent: number; startDate: string; endDate: string
  property: { title: string } | null; tenant: { firstName: string; lastName: string } | null
  contractStatus: string
}
interface PayRecord {
  id: string; amount: number; status: string; dueDate: string; paidAt: string | null
  tenant: { firstName: string; lastName: string } | null
  property: { title: string } | null
}

interface FinancesData {
  summary: { totalCollected: number; totalPending: number; totalLate: number; totalCommissionDue: number; netRevenue: number; propertiesCount: number; rentedPropertiesCount: number }
  monthlyRevenueHistory: Array<{ month: string; revenue: number; collected: number; pending: number; late: number }>
  paymentReminders: Array<{ paymentId: string; amount: number; dueDate: string; daysLate: number; tenant: { id: string; name: string; phone: string | null }; property: { id: string; title: string }; reference: string | null }>
  paymentStatusBreakdown: Record<string, { count: number; amount: number }>
  revenuePerProperty: Array<{ propertyId: string; propertyTitle: string; city: string; monthlyRent: number; isRented: boolean; collected: number; pending: number; late: number; netRevenue: number; commission: number }>
}

// ─── Defaults & Helpers ─────────────────────────────────────────────────────

const defaultData: ProprietaireData = {
  stats: {
    totalProperties: 0, activeProperties: 0, pendingVisits: 0, activeLeases: 0,
    totalRevenue: 0, totalRevenueFromPayments: 0, latePaymentsCount: 0,
    totalViews: 0, totalFavorites: 0, conversionRate: 0, occupancyRate: 0,
    expiringContractsCount: 0, occupiedProperties: 0, availableProperties: 0,
    monthlyRevenue: [], recentPayments: [], housingTypeDistribution: {}
  },
  monthlyRevenue: [], properties: [], visitRequests: [], activeLeases: [], expiringContracts: [],
}

const defaultFinances: FinancesData = {
  summary: { totalCollected: 0, totalPending: 0, totalLate: 0, totalCommissionDue: 0, netRevenue: 0, propertiesCount: 0, rentedPropertiesCount: 0 },
  monthlyRevenueHistory: [],
  paymentReminders: [],
  paymentStatusBreakdown: { PAID: { count: 0, amount: 0 }, PENDING: { count: 0, amount: 0 }, LATE: { count: 0, amount: 0 }, PARTIAL: { count: 0, amount: 0 }, CANCELLED: { count: 0, amount: 0 } },
  revenuePerProperty: [],
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('fr-FR') + ' FCFA'
}

function formatShortMonth(monthStr: string): string {
  const parts = monthStr.split(' ')
  if (parts.length >= 1) {
    return parts[0].substring(0, 3).charAt(0).toUpperCase() + parts[0].substring(1, 3)
  }
  return monthStr
}

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } }
const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }

const monthLabels: Record<string, string> = {
  '01': 'Jan', '02': 'Fév', '03': 'Mar', '04': 'Avr', '05': 'Mai', '06': 'Juin',
  '07': 'Juil', '08': 'Août', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Déc',
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ProprietaireOverview() {
  const { user, isAuthenticated, setDashboardSection } = useAuthStore()
  const [data, setData] = useState<ProprietaireData>(defaultData)
  const [finances, setFinances] = useState<FinancesData>(defaultFinances)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sendingReminder, setSendingReminder] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return }
    try {
      const [d, f] = await Promise.all([
        authFetch<ProprietaireData>('/api/dashboard/proprietaire'),
        authFetch<FinancesData>('/api/owner/finances'),
      ])
      setData(d)
      setFinances(f)
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) { setData(defaultData); return }
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally { setLoading(false) }
  }, [isAuthenticated])

  useEffect(() => { fetchData() }, [fetchData])

  useRealtimeProperties({ userId: user?.id, onPropertyChange: () => { fetchData() } })
  useRealtimeVisits({ userId: user?.id, onVisitChange: () => { fetchData() } })
  useRealtimeLeases({ userId: user?.id, onLeaseChange: () => { fetchData() } })
  useRealtimePayments({ userId: user?.id, onPaymentChange: () => { fetchData() } })
  useRealtimeRentalFiles({ userId: user?.id, onRentalFileChange: () => { fetchData() } })
  useRealtimeMaintenance({ userId: user?.id, onMaintenanceChange: () => { fetchData() } })
  useRealtimeMandats({ userId: user?.id, onMandatChange: () => { fetchData() } })
  useRealtimeNotifications({ userId: user?.id, onNotificationChange: () => { fetchData() } })

  const handleSendReminder = async (reminder: FinancesData['paymentReminders'][0]) => {
    setSendingReminder(reminder.paymentId)
    try {
      await apiFetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: reminder.tenant.id,
          type: 'PAYMENT_ALERT',
          title: 'Rappel de paiement',
          message: `Votre paiement de ${formatCurrency(reminder.amount)} pour le bien "${reminder.property.title}" est en retard de ${reminder.daysLate} jour${reminder.daysLate > 1 ? 's' : ''}. Veuillez régulariser votre situation.`,
          entityId: reminder.paymentId,
        }),
      })
      toast.success(`Rappel envoyé à ${reminder.tenant.name}`)
    } catch {
      toast.error("Erreur lors de l'envoi du rappel")
    } finally {
      setSendingReminder(null)
    }
  }

  if (loading) return <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}</div>
  if (error) return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold text-foreground">Bonjour, {user?.firstName} 👋</h1>
      <Card className="border-amber-200 bg-amber-50"><CardContent className="p-4"><p className="text-sm text-amber-700">Impossible de charger vos données.</p></CardContent></Card>
    </div>
  )

  const { summary: finSummary, monthlyRevenueHistory, paymentReminders, revenuePerProperty } = finances
  const activeLeasesOnly = data.activeLeases.filter((l) => l.status === 'ACTIVE')
  const revenueHistory = monthlyRevenueHistory.slice(-6)
  const maxRevenue = Math.max(...revenueHistory.map(m => m.collected + m.pending + m.late), 1)

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      {/* ═══════════════════════════════════════════════════════════════════════
          HEADER
         ═══════════════════════════════════════════════════════════════════════ */}
      <motion.div variants={itemVariants} className="relative overflow-hidden rounded-xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 p-6 sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(0,0,0,0.08),transparent_50%)]" />
        <div className="relative z-10">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">Bonjour, {user?.firstName} 👋</h1>
          <p className="text-brand-100 mt-1.5 text-sm sm:text-base">Vue d&apos;ensemble de votre patrimoine immobilier</p>
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 text-white text-xs font-medium backdrop-blur-sm">
              <Building2 className="size-3.5" />
              {data.stats.totalProperties} bien{data.stats.totalProperties !== 1 ? 's' : ''}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 text-white text-xs font-medium backdrop-blur-sm">
              <TrendingUp className="size-3.5" />
              {data.stats.occupancyRate}% occupé{data.stats.occupancyRate !== 1 ? 's' : ''}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 text-white text-xs font-medium backdrop-blur-sm">
              <CreditCard className="size-3.5" />
              {formatCurrency(finSummary.totalCollected)}
            </span>
          </div>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════════
          KPI
         ═══════════════════════════════════════════════════════════════════════ */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-border"><CardContent className="p-4 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50"><TrendingUp className="size-5 text-emerald-600" /></div>
          <div><p className="text-xl font-bold text-emerald-600">{formatCurrency(finSummary.totalCollected)}</p><p className="text-xs text-muted-foreground">Collecté</p></div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-4 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50"><Clock className="size-5 text-amber-600" /></div>
          <div><p className="text-xl font-bold text-amber-600">{formatCurrency(finSummary.totalPending)}</p><p className="text-xs text-muted-foreground">En attente</p></div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-4 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-red-50"><AlertTriangle className="size-5 text-red-600" /></div>
          <div><p className="text-xl font-bold text-red-600">{formatCurrency(finSummary.totalLate)}</p><p className="text-xs text-muted-foreground">Impayés</p></div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-4 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50"><Building2 className="size-5 text-brand-600" /></div>
          <div><p className="text-xl font-bold text-foreground">{data.stats.totalProperties}</p><p className="text-xs text-muted-foreground">Biens</p></div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-4 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50"><FileSignature className="size-5 text-blue-600" /></div>
          <div><p className="text-xl font-bold text-foreground">{data.stats.activeLeases}</p><p className="text-xs text-muted-foreground">Contrats</p></div>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-4 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-purple-50"><Percent className="size-5 text-purple-600" /></div>
          <div><p className="text-xl font-bold text-foreground">{formatCurrency(finSummary.totalCommissionDue)}</p><p className="text-xs text-muted-foreground">Commissions</p></div>
        </CardContent></Card>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════════
          RAPPELS DE PAIEMENT
         ═══════════════════════════════════════════════════════════════════════ */}
      {paymentReminders.length > 0 && (
        <motion.div variants={itemVariants}>
          <div className="flex items-center gap-2 mb-3"><AlertTriangle className="size-5 text-red-500" /><h2 className="text-base font-semibold text-foreground">Rappels de paiement</h2></div>
          <div className="space-y-2">
            {paymentReminders.slice(0, 4).map((reminder) => (
              <Card key={reminder.paymentId} className="border-red-200 bg-red-50/30">
                <CardContent className="p-4">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-100">
                      <AlertTriangle className="size-4 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-foreground truncate">{reminder.tenant.name}</p>
                        <Badge className="bg-red-100 text-red-600 border-red-200 text-[10px] px-1.5">{reminder.daysLate}j retard</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {reminder.property.title} · {formatCurrency(reminder.amount)} · Échéance {new Date(reminder.dueDate).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
                      disabled={sendingReminder === reminder.paymentId}
                      onClick={() => handleSendReminder(reminder)}
                    >
                      <Send className="size-3.5" />
                      {sendingReminder === reminder.paymentId ? '...' : 'Rappel'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          REVENUS (graphique empilé)
         ═══════════════════════════════════════════════════════════════════════ */}
      {revenueHistory.some(m => m.collected > 0 || m.pending > 0 || m.late > 0) && (
        <motion.div variants={itemVariants}>
          <div className="flex items-center gap-2 mb-3"><TrendingUp className="size-5 text-brand-500" /><h2 className="text-base font-semibold text-foreground">Revenus</h2></div>
          <Card className="border-border">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-end gap-2 sm:gap-3 h-40 sm:h-48">
                {revenueHistory.map((month, idx) => {
                  const total = month.collected + month.pending + month.late
                  const totalH = maxRevenue > 0 ? (total / maxRevenue) * 100 : 0
                  const collectedH = total > 0 ? (month.collected / total) * totalH : 0
                  const pendingH = total > 0 ? (month.pending / total) * totalH : 0
                  const lateH = total > 0 ? (month.late / total) * totalH : 0
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                      <p className="text-[10px] font-medium text-muted-foreground mb-1">
                        {month.collected > 0 ? `${(month.collected / 1000).toFixed(0)}k` : ''}
                      </p>
                      <div className="w-full flex flex-col justify-end h-[calc(100%-2rem)]">
                        {lateH > 0 && <div className="w-full bg-red-300 rounded-t-sm" style={{ height: `${lateH}%` }} />}
                        {pendingH > 0 && <div className="w-full bg-amber-300" style={{ height: `${pendingH}%` }} />}
                        <div className="w-full bg-brand-500 rounded-t-md min-h-[2px]" style={{ height: `${Math.max(collectedH, 1)}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 truncate w-full text-center">{formatShortMonth(month.month)}</p>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center justify-center gap-4 mt-3">
                <div className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-brand-500" /><span className="text-xs text-muted-foreground">Collecté</span></div>
                <div className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-amber-300" /><span className="text-xs text-muted-foreground">En attente</span></div>
                <div className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-red-300" /><span className="text-xs text-muted-foreground">En retard</span></div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          PAIEMENTS RÉCENTS
         ═══════════════════════════════════════════════════════════════════════ */}
      {data.stats.recentPayments.length > 0 && (
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><CreditCard className="size-5 text-brand-500" /><h2 className="text-base font-semibold text-foreground">Paiements récents</h2></div>
            <Button variant="ghost" size="sm" className="text-brand-500 gap-1" onClick={() => setDashboardSection('payments')}>
              Voir tout <ArrowRight className="size-3" />
            </Button>
          </div>
          <Card className="border-border">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-[11px] text-muted-foreground font-medium">Locataire</th>
                    <th className="text-left py-3 px-4 text-[11px] text-muted-foreground font-medium">Bien</th>
                    <th className="text-right py-3 px-4 text-[11px] text-muted-foreground font-medium">Montant</th>
                    <th className="text-right py-3 px-4 text-[11px] text-muted-foreground font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stats.recentPayments.slice(0, 5).map((p) => (
                    <tr key={p.id} className="border-b border-border hover:bg-accent/50 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-medium text-foreground">{p.tenant ? `${p.tenant.firstName} ${p.tenant.lastName}` : '—'}</span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{p.property?.title || '—'}</td>
                      <td className="py-3 px-4 text-right font-semibold text-foreground">{p.amount.toLocaleString('fr-FR')}</td>
                      <td className="py-3 px-4 text-right">
                        <Badge className={p.status === 'PAID' ? 'bg-green-100 text-green-700' :
                          p.status === 'LATE' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>
                          {p.status === 'PAID' ? 'Payé' : p.status === 'LATE' ? 'Retard' : 'Attente'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          LOCATIONS + DEMANDES DE VISITE (2 colonnes)
         ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          <Card className="border-border h-full">
            <div className="bg-gradient-to-r from-brand-500 to-brand-600 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Home className="size-5 text-white" /><h3 className="text-base font-semibold text-white">Locations en cours</h3></div>
                <Badge className="bg-white/20 text-white border-0">{activeLeasesOnly.length}</Badge>
              </div>
            </div>
            <CardContent className="p-4 space-y-3 max-h-72 overflow-y-auto">
              {activeLeasesOnly.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Aucune location active</p>
              ) : activeLeasesOnly.slice(0, 4).map((lease) => (
                <div key={lease.id} className="p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors space-y-2">
                  <div className="flex items-start sm:items-center gap-3">
                    {lease.tenant.avatarUrl ? (
                      <img src={lease.tenant.avatarUrl} alt="" className="size-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="size-9 rounded-full bg-brand-50 flex items-center justify-center shrink-0"><User className="size-4 text-brand-500" /></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{lease.tenant.firstName} {lease.tenant.lastName}</p>
                      <p className="text-xs text-muted-foreground truncate">{lease.property?.title ?? 'Propriété'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-foreground">{lease.monthlyRent.toLocaleString('fr-FR')}</p>
                      {lease.paymentStatus === 'up_to_date' && <div className="flex items-center gap-1.5 justify-end"><CheckCircle2 className="size-3.5 text-emerald-500" /><span className="text-[10px] font-medium text-emerald-600">À jour</span></div>}
                      {lease.paymentStatus === 'late' && <div className="flex items-center gap-1.5 justify-end"><AlertTriangle className="size-3.5 text-red-500" /><span className="text-[10px] font-medium text-red-600">Retard</span></div>}
                      {lease.paymentStatus === 'pending' && <div className="flex items-center gap-1.5 justify-end"><Hourglass className="size-3.5 text-amber-500" /><span className="text-[10px] font-medium text-amber-600">Attente</span></div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Calendar className="size-3" />
                    {new Date(lease.startDate).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })} → {new Date(lease.endDate).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-border h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div><CardTitle className="text-base font-semibold">Demandes de visite</CardTitle><CardDescription>{data.visitRequests.length} demande(s)</CardDescription></div>
                <Button variant="ghost" size="sm" className="text-brand-500 gap-1" onClick={() => setDashboardSection('visit-requests')}>Voir <ArrowRight className="size-3" /></Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 max-h-64 overflow-y-auto">
              {data.visitRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Aucune demande</p>
              ) : data.visitRequests.slice(0, 5).map((vr) => (
                <div key={vr.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50">
                  <div>
                    <p className="text-sm font-medium text-foreground">{vr.tenant.firstName} {vr.tenant.lastName}</p>
                    <p className="text-xs text-muted-foreground">{vr.property.title} · {new Date(vr.requestedDate).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <Badge className={vr.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : vr.status === 'ACCEPTED' ? 'bg-green-100 text-green-700' : vr.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'}>
                    {vr.status === 'PENDING' ? 'En attente' : vr.status === 'ACCEPTED' ? 'Accepté' : vr.status === 'COMPLETED' ? 'Terminée' : vr.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          CONTRATS EXPIRANTS
         ═══════════════════════════════════════════════════════════════════════ */}
      {data.expiringContracts.length > 0 && (
        <motion.div variants={itemVariants}>
          <div className="flex items-center gap-2 mb-3"><Calendar className="size-5 text-amber-500" /><h2 className="text-base font-semibold text-foreground">Contrats expirant bientôt</h2></div>
          <Card className="border-amber-200 bg-amber-50/30">
            <CardContent className="p-4 space-y-2">
              {data.expiringContracts.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-white border border-amber-100">
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.property?.title || 'Bien'}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.tenant ? `${c.tenant.firstName} ${c.tenant.lastName}` : '—'} · Expire le {new Date(c.endDate).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="text-amber-700 border-amber-200 hover:bg-amber-50 text-xs"
                    onClick={() => setDashboardSection('my-tenants')}>
                    Renouveler <ArrowRight className="size-3" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}


    </motion.div>
  )
}
