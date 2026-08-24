'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  TrendingUp, Clock, AlertTriangle, Percent,
  Building2, ChevronRight, Send, CreditCard,
  Calendar, ArrowUpRight, User
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { useRealtimePayments } from '@/hooks/use-realtime-payments'
import { apiFetch } from '@/lib/capacitor'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { PaginationControls } from '@/components/ui/pagination-controls'

// ─── Types ──────────────────────────────────────────────────────────────────
interface MonthlyRevenue {
  month: string
  revenue: number
  collected: number
  pending: number
  late: number
}

interface PaymentReminder {
  paymentId: string
  amount: number
  dueDate: string
  daysLate: number
  tenant: { id: string; name: string; phone: string | null }
  property: { id: string; title: string }
  reference: string | null
}

interface RevenuePerProperty {
  propertyId: string
  propertyTitle: string
  city: string
  monthlyRent: number
  isRented: boolean
  collected: number
  pending: number
  late: number
  netRevenue: number
  commission: number
}

interface CommissionMandat {
  mandatId: string
  mandatType: string
  propertyTitle: string
  agencyName: string
  commissionRate: number
  commissionType: string
  totalCollected: number
  commissionAmount: number
  period: string
}

interface RecentPayment {
  id: string
  amount: number
  status: string
  dueDate: string
  paidAt: string | null
  reference: string | null
  createdAt: string
  lease: {
    id: string
    monthlyRent: number
    property: { id: string; title: string; city: string }
    tenant: { id: string; firstName: string; lastName: string }
  }
}

interface FinancesData {
  monthlyRevenueHistory: MonthlyRevenue[]
  paymentStatusBreakdown: {
    PAID: { count: number; amount: number }
    PENDING: { count: number; amount: number }
    LATE: { count: number; amount: number }
    PARTIAL: { count: number; amount: number }
    CANCELLED: { count: number; amount: number }
  }
  commissionTracking: {
    mandats: CommissionMandat[]
    totalCommissionDue: number
  }
  revenuePerProperty: RevenuePerProperty[]
  paymentReminders: PaymentReminder[]
  recentPayments: RecentPayment[]
  summary: {
    totalCollected: number
    totalPending: number
    totalLate: number
    totalCommissionDue: number
    netRevenue: number
    propertiesCount: number
    rentedPropertiesCount: number
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const statusConfig: Record<string, { label: string; color: string; dotColor: string }> = {
  PAID: { label: 'Payé', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dotColor: 'bg-emerald-500' },
  PENDING: { label: 'En attente', color: 'bg-amber-50 text-amber-700 border-amber-200', dotColor: 'bg-amber-500' },
  LATE: { label: 'En retard', color: 'bg-red-50 text-red-700 border-red-200', dotColor: 'bg-red-500' },
  PARTIAL: { label: 'Partiel', color: 'bg-cyan-50 text-cyan-700 border-cyan-200', dotColor: 'bg-cyan-500' },
  CANCELLED: { label: 'Annulé', color: 'bg-muted text-muted-foreground border-border', dotColor: 'bg-neutral-400' },
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('fr-FR') + ' FCFA'
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatShortMonth(monthStr: string): string {
  const parts = monthStr.split(' ')
  if (parts.length >= 1) {
    return parts[0].substring(0, 3).charAt(0).toUpperCase() + parts[0].substring(1, 3)
  }
  return monthStr
}

// ─── Animation Variants ────────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

// ─── Component ──────────────────────────────────────────────────────────────
export function OwnerFinances() {
  const { user, isAuthenticated } = useAuthStore()
  const [data, setData] = useState<FinancesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sendingReminder, setSendingReminder] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const limit = 10

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    try {
      const result = await authFetch<FinancesData>('/api/owner/finances')
      setData(result)
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) {
        setData(null)
        return
      }
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Realtime subscription for payments (re-fetch aggregated data)
  useRealtimePayments({
    userId: user?.id,
    leaseIds: data?.recentPayments?.map((p) => p.lease?.id).filter(Boolean) as string[] | undefined,
    onPaymentChange: () => {
      fetchData()
    },
  })

  const paginatedPayments = useMemo(() => {
    const start = (page - 1) * limit
    return (data?.recentPayments ?? []).slice(start, start + limit)
  }, [data?.recentPayments, page, limit])

  const handleSendReminder = async (reminder: PaymentReminder) => {
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

  // ─── Loading skeleton ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-64 bg-muted animate-pulse rounded mt-2" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
        <div className="h-48 rounded-xl bg-muted animate-pulse" />
        <div className="h-36 rounded-xl bg-muted animate-pulse" />
      </div>
    )
  }

  // ─── Error state ───────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Mes Finances</h1>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-sm text-amber-700">Impossible de charger vos données financières. Veuillez réessayer.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { summary, monthlyRevenueHistory, paymentReminders, revenuePerProperty, paymentStatusBreakdown, recentPayments } = data

  // Last 6 months for the bar chart
  const last6Months = monthlyRevenueHistory.slice(-6)
  const maxRevenue = Math.max(...last6Months.map((m) => m.collected + m.pending + m.late), 1)

  // Payment status totals for progress bars
  const totalPaymentsAmount =
    paymentStatusBreakdown.PAID.amount +
    paymentStatusBreakdown.PENDING.amount +
    paymentStatusBreakdown.LATE.amount +
    paymentStatusBreakdown.PARTIAL.amount

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Mes Finances</h1>
        <p className="text-muted-foreground mt-1">Suivi des revenus, paiements et commissions</p>
      </motion.div>

      {/* ─── Summary Cards ──────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="size-4 text-emerald-500" />
                <p className="text-xs text-muted-foreground">Revenus du mois</p>
              </div>
              <p className="text-lg font-bold text-foreground">
                {formatCurrency(summary.totalCollected)}
              </p>
              <p className="text-xs text-emerald-600 mt-0.5 flex items-center gap-1">
                <ArrowUpRight className="size-3" />
                Collecté
              </p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="size-4 text-amber-500" />
                <p className="text-xs text-muted-foreground">En attente</p>
              </div>
              <p className="text-lg font-bold text-foreground">
                {formatCurrency(summary.totalPending)}
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                {paymentStatusBreakdown.PENDING.count + paymentStatusBreakdown.PARTIAL.count} paiement{(paymentStatusBreakdown.PENDING.count + paymentStatusBreakdown.PARTIAL.count) > 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="size-4 text-red-500" />
                <p className="text-xs text-muted-foreground">En retard</p>
              </div>
              <p className="text-lg font-bold text-red-600">
                {formatCurrency(summary.totalLate)}
              </p>
              <p className="text-xs text-red-500 mt-0.5">
                {paymentStatusBreakdown.LATE.count} retard{paymentStatusBreakdown.LATE.count > 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Percent className="size-4 text-brand-500" />
                <p className="text-xs text-muted-foreground">Commissions dues</p>
              </div>
              <p className="text-lg font-bold text-foreground">
                {formatCurrency(summary.totalCommissionDue)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {data.commissionTracking.mandats.length} mandat{data.commissionTracking.mandats.length > 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* ─── Monthly Revenue Chart ──────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Revenus mensuels</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {last6Months.every((m) => m.revenue === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun revenu enregistré ces 6 derniers mois</p>
            ) : (
              <>
                <div className="flex items-end gap-2 sm:gap-3 h-48">
                  {last6Months.map((month, idx) => {
                    const totalHeight = maxRevenue > 0 ? ((month.collected + month.pending + month.late) / maxRevenue) * 100 : 0
                    const collectedH = maxRevenue > 0 && totalHeight > 0 ? (month.collected / (month.collected + month.pending + month.late || 1)) * totalHeight : 0
                    const pendingH = maxRevenue > 0 && totalHeight > 0 ? (month.pending / (month.collected + month.pending + month.late || 1)) * totalHeight : 0
                    const lateH = maxRevenue > 0 && totalHeight > 0 ? (month.late / (month.collected + month.pending + month.late || 1)) * totalHeight : 0

                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                        {/* Amount label */}
                        <p className="text-[10px] font-medium text-muted-foreground mb-1 truncate w-full text-center">
                          {month.collected > 0 ? `${(month.collected / 1000).toFixed(0)}k` : ''}
                        </p>
                        <div className="w-full flex flex-col justify-end h-36">
                          {/* Late portion (red) */}
                          {lateH > 0 && (
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: `${lateH}%` }}
                              transition={{ duration: 0.6, delay: idx * 0.1 }}
                              className="w-full bg-red-300 rounded-t-sm"
                            />
                          )}
                          {/* Pending portion (amber) */}
                          {pendingH > 0 && (
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: `${pendingH}%` }}
                              transition={{ duration: 0.6, delay: idx * 0.1 }}
                              className="w-full bg-amber-300"
                            />
                          )}
                          {/* Collected portion (brand) */}
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${Math.max(collectedH, 1)}%` }}
                            transition={{ duration: 0.6, delay: idx * 0.1 }}
                            className="w-full bg-brand-500 rounded-t-md min-h-[2px]"
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 truncate w-full text-center">
                          {formatShortMonth(month.month)}
                        </p>
                      </div>
                    )
                  })}
                </div>
                {/* Legend */}
                <div className="flex items-center justify-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-brand-500" />
                    <span className="text-xs text-muted-foreground">Collecté</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-amber-300" />
                    <span className="text-xs text-muted-foreground">En attente</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-red-300" />
                    <span className="text-xs text-muted-foreground">En retard</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── Payment Reminders ──────────────────────────────────────────────── */}
      {paymentReminders.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-red-200 bg-red-50/30">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-red-500" />
                <CardTitle className="text-base font-semibold text-red-700">
                  Rappels de paiement
                </CardTitle>
                <Badge className="bg-red-100 text-red-700 border-red-200 ml-auto">
                  {paymentReminders.length} en retard
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 max-h-72 overflow-y-auto">
              {paymentReminders.map((reminder) => (
                <div
                  key={reminder.paymentId}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border border-red-200 bg-white"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {reminder.tenant.name}
                      </p>
                      <Badge className="bg-red-50 text-red-600 border-red-200 text-[10px] px-1.5">
                        {reminder.daysLate}j retard
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {reminder.property.title} · {formatCurrency(reminder.amount)} · Échéance {formatDate(reminder.dueDate)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
                    disabled={sendingReminder === reminder.paymentId}
                    onClick={() => handleSendReminder(reminder)}
                  >
                    <Send className="size-3.5" />
                    {sendingReminder === reminder.paymentId ? 'Envoi...' : 'Envoyer un rappel'}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ─── Payment Status Breakdown ────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Répartition des paiements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {totalPaymentsAmount > 0 ? (
              <>
                {/* Stacked bar */}
                <div className="h-4 w-full rounded-full overflow-hidden flex bg-muted">
                  {paymentStatusBreakdown.PAID.amount > 0 && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(paymentStatusBreakdown.PAID.amount / totalPaymentsAmount) * 100}%` }}
                      transition={{ duration: 0.8 }}
                      className="bg-emerald-500 h-full"
                    />
                  )}
                  {paymentStatusBreakdown.PENDING.amount > 0 && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(paymentStatusBreakdown.PENDING.amount / totalPaymentsAmount) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.1 }}
                      className="bg-amber-400 h-full"
                    />
                  )}
                  {paymentStatusBreakdown.LATE.amount > 0 && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(paymentStatusBreakdown.LATE.amount / totalPaymentsAmount) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.2 }}
                      className="bg-red-500 h-full"
                    />
                  )}
                  {paymentStatusBreakdown.PARTIAL.amount > 0 && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(paymentStatusBreakdown.PARTIAL.amount / totalPaymentsAmount) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.3 }}
                      className="bg-cyan-400 h-full"
                    />
                  )}
                </div>

                {/* Individual rows */}
                <div className="space-y-3">
                  {[
                    { key: 'PAID', label: 'Payé', color: 'bg-emerald-500', amount: paymentStatusBreakdown.PAID.amount, count: paymentStatusBreakdown.PAID.count },
                    { key: 'PENDING', label: 'En attente', color: 'bg-amber-400', amount: paymentStatusBreakdown.PENDING.amount, count: paymentStatusBreakdown.PENDING.count },
                    { key: 'LATE', label: 'En retard', color: 'bg-red-500', amount: paymentStatusBreakdown.LATE.amount, count: paymentStatusBreakdown.LATE.count },
                    { key: 'PARTIAL', label: 'Partiel', color: 'bg-cyan-400', amount: paymentStatusBreakdown.PARTIAL.amount, count: paymentStatusBreakdown.PARTIAL.count },
                  ].map((item) => {
                    const pct = totalPaymentsAmount > 0 ? Math.round((item.amount / totalPaymentsAmount) * 100) : 0
                    return (
                      <div key={item.key}>
                        <div className="flex items-center gap-3 mb-1">
                          <span className={`size-3 rounded-sm shrink-0 ${item.color}`} />
                          <span className="text-sm text-muted-foreground flex-1">{item.label}</span>
                          <span className="text-sm font-medium text-foreground">{formatCurrency(item.amount)}</span>
                          <span className="text-xs text-muted-foreground w-20 text-right">{pct}% · {item.count}</span>
                        </div>
                        <div className="ml-6 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6 }}
                            className={`h-full rounded-full ${item.color}`}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun paiement enregistré</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── Revenue Per Property Table ──────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Revenus par bien</CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            {revenuePerProperty.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Aucun bien enregistré</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Bien</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Collecté</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">En attente</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">En retard</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Commission</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-brand-600">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenuePerProperty.map((prop) => (
                      <tr key={prop.propertyId} className="border-b border-border last:border-0 hover:bg-accent/50 transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="size-8 rounded bg-brand-50 flex items-center justify-center shrink-0">
                              <Building2 className="size-4 text-brand-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate max-w-[120px] sm:max-w-none">{prop.propertyTitle}</p>
                              <p className="text-xs text-muted-foreground">{prop.city}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-emerald-600">
                          {prop.collected > 0 ? formatCurrency(prop.collected) : '—'}
                        </td>
                        <td className="py-3 px-3 text-right text-amber-600 hidden sm:table-cell">
                          {prop.pending > 0 ? formatCurrency(prop.pending) : '—'}
                        </td>
                        <td className="py-3 px-3 text-right text-red-600 hidden sm:table-cell">
                          {prop.late > 0 ? formatCurrency(prop.late) : '—'}
                        </td>
                        <td className="py-3 px-3 text-right text-muted-foreground hidden md:table-cell">
                          {prop.commission > 0 ? formatCurrency(prop.commission) : '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-brand-600">
                          {formatCurrency(prop.netRevenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── Commission Tracking ──────────────────────────────────────────────── */}
      {data.commissionTracking.mandats.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Percent className="size-4 text-brand-500" />
                <CardTitle className="text-base font-semibold">Suivi des commissions</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.commissionTracking.mandats.map((mandat) => (
                <div key={mandat.mandatId} className="p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-1 gap-1">
                    <p className="text-sm font-medium text-foreground">{mandat.propertyTitle}</p>
                    <Badge className="bg-brand-50 text-brand-700 border-brand-200 text-xs">
                      {mandat.commissionType === 'FIXED' ? 'Fixe' : `${mandat.commissionRate}%`}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Agence</p>
                      <p className="font-medium text-foreground">{mandat.agencyName}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Collecté</p>
                      <p className="font-medium text-foreground">{formatCurrency(mandat.totalCollected)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Commission</p>
                      <p className="font-medium text-brand-600">{formatCurrency(mandat.commissionAmount)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Période</p>
                      <p className="font-medium text-foreground">{mandat.period}</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ─── Recent Payments List ──────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
              <CardTitle className="text-base font-semibold">Derniers paiements</CardTitle>
              <p className="text-xs text-muted-foreground">{summary.propertiesCount} bien{summary.propertiesCount > 1 ? 's' : ''} · {summary.rentedPropertiesCount} loué{summary.rentedPropertiesCount > 1 ? 's' : ''}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 max-h-96 overflow-y-auto">
            {recentPayments.length === 0 ? (
              <div className="flex flex-col items-center text-center py-8">
                <div className="flex size-14 items-center justify-center rounded-full bg-brand-50 mb-3">
                  <CreditCard className="size-6 text-brand-500" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">Aucun paiement enregistré</p>
                <p className="text-xs text-muted-foreground">Vos paiements apparaîtront ici une fois vos baux actifs.</p>
              </div>
            ) : (
              paginatedPayments.map((payment) => {
                const config = statusConfig[payment.status] || statusConfig.PENDING
                const property = payment.lease?.property
                const tenant = payment.lease?.tenant

                return (
                  <div
                    key={payment.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                  >
                    {/* Tenant icon */}
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50">
                      <User className="size-5 text-brand-500" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {tenant ? `${tenant.firstName} ${tenant.lastName}` : 'Locataire'}
                        </p>
                        <Badge variant="outline" className={`shrink-0 text-[10px] px-2 py-0.5 border ${config.color}`}>
                          <span className={`size-1.5 rounded-full ${config.dotColor} mr-1`} />
                          {config.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2 truncate">
                        {property?.title}, {property?.city}
                      </p>
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <p className="text-sm font-bold text-foreground">
                          {formatCurrency(payment.amount)}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="size-3" />
                          <span>Échéance : {formatDate(payment.dueDate)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            {recentPayments.length > limit && (
              <div className="pt-2">
                <PaginationControls
                  page={page}
                  totalPages={Math.ceil(recentPayments.length / limit)}
                  onPageChange={setPage}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
