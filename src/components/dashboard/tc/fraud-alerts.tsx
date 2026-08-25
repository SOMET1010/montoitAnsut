'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle, Plus, Search, Eye, ShieldAlert, Search as SearchIcon,
  Check, XCircle, Loader2, User, Bot, UserCheck, Zap,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { useRealtimeFraudAlerts } from '@/hooks/use-realtime-fraud-alerts'
import { ViewModeToggle, type ViewMode } from './view-mode-toggle'
import { usePagination } from '@/hooks/use-pagination'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface FraudSuspect {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
}

interface FraudAlert {
  id: string
  status: string
  description: string
  autoDetected: boolean
  resolution: string | null
  createdAt: string
  updatedAt: string
  suspect: FraudSuspect
  reporter: { id: string; firstName: string; lastName: string }
}

interface FraudStats {
  OPEN: number
  INVESTIGATING: number
  CONFIRMED: number
  DISMISSED: number
}

// ─── Label maps ─────────────────────────────────────────────────────────────

const statusLabels: Record<string, string> = {
  OPEN: 'Ouvert',
  INVESTIGATING: 'En investigation',
  CONFIRMED: 'Fraude confirmée',
  DISMISSED: 'Écarté',
}

const statusColors: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-700',
  INVESTIGATING: 'bg-amber-100 text-amber-700',
  CONFIRMED: 'bg-rose-100 text-rose-700',
  DISMISSED: 'bg-gray-100 text-gray-500',
}

const statusFilterOptions = [
  { value: 'ALL', label: 'Tous' },
  { value: 'OPEN', label: 'Ouvert' },
  { value: 'INVESTIGATING', label: 'En investigation' },
  { value: 'CONFIRMED', label: 'Fraude confirmée' },
  { value: 'DISMISSED', label: 'Écarté' },
]

// ─── Component ──────────────────────────────────────────────────────────────

export function FraudAlertsManagement() {
  const { isAuthenticated, user } = useAuthStore()
  const [alerts, setAlerts] = useState<FraudAlert[]>([])
  const [stats, setStats] = useState<FraudStats>({ OPEN: 0, INVESTIGATING: 0, CONFIRMED: 0, DISMISSED: 0 })
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Create alert dialog
  const [createDialog, setCreateDialog] = useState(false)
  const [createForm, setCreateForm] = useState({ suspectId: '', description: '' })
  const [userSearch, setUserSearch] = useState('')
  const [userResults, setUserResults] = useState<FraudSuspect[]>([])
  const [userSearchLoading, setUserSearchLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Resolution dialog
  const [resolutionDialog, setResolutionDialog] = useState<{
    open: boolean
    alertId: string
    action: 'CONFIRM' | 'DISMISS'
  }>({ open: false, alertId: '', action: 'CONFIRM' })
  const [resolution, setResolution] = useState('')

  // ─── Fetch ─────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (search.trim()) params.set('search', search.trim())

      const data = await authFetch<{ alerts: FraudAlert[]; stats: FraudStats }>(
        `/api/tc/fraud-alerts?${params.toString()}`
      )
      setAlerts(data.alerts || [])
      setStats(data.stats || { OPEN: 0, INVESTIGATING: 0, CONFIRMED: 0, DISMISSED: 0 })
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) {
        setAlerts([])
        return
      }
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, statusFilter, search])

  // ─── Realtime subscription (TC watches all fraud alerts) ─────────
  useRealtimeFraudAlerts({
    userId: user?.id,
    watchAll: true,
    onFraudAlertChange: () => { fetchData() },
  })

  const {
    paginatedItems: pagedAlerts,
    page: alertsPage,
    totalPages: alertsTotalPages,
    total: alertsTotal,
    pageSize: alertsPageSize,
    setPage: setAlertsPage,
  } = usePagination({
    items: alerts,
    pageSize: 10,
    resetSignal: `${search}|${statusFilter}`,
  })

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ─── User search for create dialog ───────────────────────────────────

  useEffect(() => {
    if (!userSearch.trim()) {
      setUserResults([])
      return
    }

    const timer = setTimeout(async () => {
      setUserSearchLoading(true)
      try {
        const data = await authFetch<{ users: FraudSuspect[] }>(
          `/api/tc/oneci?search=${encodeURIComponent(userSearch.trim())}`
        )
        setUserResults(Array.isArray(data.users) ? data.users : [])
      } catch {
        setUserResults([])
      } finally {
        setUserSearchLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [userSearch])

  // ─── Actions ──────────────────────────────────────────────────────────

  const handleStatusChange = async (alertId: string, action: string, res?: string) => {
    setActionLoading(alertId)
    try {
      await authFetch('/api/tc/fraud-alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: alertId, action, resolution: res || undefined }),
      })
      toast.success(
        action === 'INVESTIGATE' ? 'Alerte mise en investigation' :
        action === 'CONFIRM' ? 'Fraude confirmée' : 'Alerte écartée'
      )
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCreate = async () => {
    if (!createForm.suspectId) {
      toast.error('Veuillez sélectionner un suspect')
      return
    }
    if (!createForm.description.trim()) {
      toast.error('La description est requise')
      return
    }
    setSubmitting(true)
    try {
      await authFetch('/api/tc/fraud-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suspectId: createForm.suspectId,
          description: createForm.description.trim(),
        }),
      })
      toast.success('Alerte de fraude créée')
      setCreateDialog(false)
      setCreateForm({ suspectId: '', description: '' })
      setUserSearch('')
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  const getSelectedUserName = () => {
    if (!createForm.suspectId) return ''
    const u = userResults.find((r) => r.id === createForm.suspectId)
    return u ? `${u.firstName} ${u.lastName}` : ''
  }

  // ─── Loading ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <Card className="border-border bg-gradient-to-r from-brand-500/10 to-transparent">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-brand-100">
                <AlertTriangle className="size-6 text-brand-600" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">Alertes fraude</h1>
                <p className="text-muted-foreground text-sm">Gérez les alertes de fraude et les investigations</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 border text-[10px]">
                    <AlertTriangle className="size-3 mr-0.5" /> {stats.OPEN} ouverte{stats.OPEN !== 1 ? 's' : ''}
                  </Badge>
                  <Badge className="bg-orange-50 text-orange-700 border-orange-200 border text-[10px]">
                    <ShieldAlert className="size-3 mr-0.5" /> {stats.INVESTIGATING} en investigation
                  </Badge>
                  <Badge className="bg-red-50 text-red-700 border-red-200 border text-[10px]">
                    {stats.CONFIRMED} confirmée{stats.CONFIRMED !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>
            </div>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shrink-0 shadow-sm"
              onClick={() => setCreateDialog(true)}
            >
              <Plus className="size-4" /> Nouvelle alerte
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Row — cliquable pour filtrer */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card
          className={cn('border-border cursor-pointer transition-all hover:border-red-300 hover:shadow-sm', statusFilter === 'OPEN' && 'ring-1 ring-red-400 bg-red-50/20')}
          onClick={() => setStatusFilter(statusFilter === 'OPEN' ? 'ALL' : 'OPEN')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-red-50">
                <AlertTriangle className="size-5 text-red-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-red-600">{stats.OPEN}</p>
                <p className="text-xs text-muted-foreground">Ouvert</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn('border-border cursor-pointer transition-all hover:border-amber-300 hover:shadow-sm', statusFilter === 'INVESTIGATING' && 'ring-1 ring-amber-400 bg-amber-50/20')}
          onClick={() => setStatusFilter(statusFilter === 'INVESTIGATING' ? 'ALL' : 'INVESTIGATING')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50">
                <SearchIcon className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-amber-600">{stats.INVESTIGATING}</p>
                <p className="text-xs text-muted-foreground">En investigation</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn('border-border cursor-pointer transition-all hover:border-rose-300 hover:shadow-sm', statusFilter === 'CONFIRMED' && 'ring-1 ring-rose-400 bg-rose-50/20')}
          onClick={() => setStatusFilter(statusFilter === 'CONFIRMED' ? 'ALL' : 'CONFIRMED')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-rose-50">
                <ShieldAlert className="size-5 text-rose-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-rose-600">{stats.CONFIRMED}</p>
                <p className="text-xs text-muted-foreground">Fraude confirmée</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn('border-border cursor-pointer transition-all hover:border-gray-300 hover:shadow-sm', statusFilter === 'DISMISSED' && 'ring-1 ring-gray-400 bg-gray-50/20')}
          onClick={() => setStatusFilter(statusFilter === 'DISMISSED' ? 'ALL' : 'DISMISSED')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-gray-50">
                <XCircle className="size-5 text-gray-500" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-gray-500">{stats.DISMISSED}</p>
                <p className="text-xs text-muted-foreground">Écarté</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par suspect, description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
        </div>
        <div className="flex flex-wrap gap-2">
          {statusFilterOptions.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={statusFilter === opt.value ? 'default' : 'outline'}
              className={cn(
                'text-xs',
                statusFilter === opt.value
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  : 'hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200'
              )}
              onClick={() => setStatusFilter(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {alerts.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="size-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">Aucune alerte de fraude</p>
            <p className="text-sm text-muted-foreground mt-1">
              Les alertes de fraude apparaîtront ici
            </p>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 mt-4"
              onClick={() => setCreateDialog(true)}
            >
              <Plus className="size-4" /> Créer une alerte
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === 'card' ? (
        /* ─── Card View ──────────────────────────────────────────── */
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          <AnimatePresence mode="popLayout" initial={false} key={`page-${alertsPage}`}>
            {pagedAlerts.map((alert) => (
              <motion.div
                key={alert.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <Card className={cn(
                  'border hover:shadow-md transition-shadow',
                  alert.status === 'OPEN' ? 'border-red-200' :
                  alert.status === 'INVESTIGATING' ? 'border-amber-200' : 'border-border'
                )}>
                  <CardContent className="p-4 sm:p-5">
                    {/* Top row: status + auto/manual */}
                    <div className="flex items-start justify-between mb-3">
                      <Badge className={statusColors[alert.status] || 'bg-gray-100 text-gray-700'}>
                        {statusLabels[alert.status] || alert.status}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs gap-1',
                          alert.autoDetected ? 'border-amber-200 text-amber-700' : 'border-brand-200 text-brand-700'
                        )}
                      >
                        {alert.autoDetected ? <Bot className="size-3" /> : <UserCheck className="size-3" />}
                        {alert.autoDetected ? 'Auto' : 'Manuel'}
                      </Badge>
                    </div>

                    {/* Suspect info */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn(
                        'size-8 rounded-full flex items-center justify-center shrink-0',
                        alert.status === 'CONFIRMED' ? 'bg-rose-50' : 'bg-amber-50'
                      )}>
                        <User className={cn(
                          'size-4',
                          alert.status === 'CONFIRMED' ? 'text-rose-600' : 'text-amber-600'
                        )} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {alert.suspect.firstName} {alert.suspect.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{alert.suspect.email}</p>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {alert.description}
                    </p>

                    {/* Date */}
                    <p className="text-xs text-muted-foreground mb-3">
                      {new Date(alert.createdAt).toLocaleDateString('fr-FR', {
                        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>

                    {/* Resolution (if resolved) */}
                    {alert.resolution && (
                      <div className="bg-muted p-2 rounded-lg mb-3">
                        <p className="text-xs text-muted-foreground">Résolution : {alert.resolution}</p>
                      </div>
                    )}

                    {/* Actions based on status */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                      {alert.status === 'OPEN' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-amber-700 border-amber-200 hover:bg-amber-50"
                          onClick={() => handleStatusChange(alert.id, 'INVESTIGATE')}
                          disabled={actionLoading === alert.id}
                        >
                          {actionLoading === alert.id ? <Loader2 className="size-3.5 animate-spin" /> : <SearchIcon className="size-3.5" />}
                          Investiguer
                        </Button>
                      )}
                      {alert.status === 'INVESTIGATING' && (
                        <>
                          <Button
                            size="sm"
                            className="bg-rose-600 hover:bg-rose-700 text-white gap-1"
                            onClick={() => setResolutionDialog({ open: true, alertId: alert.id, action: 'CONFIRM' })}
                            disabled={actionLoading === alert.id}
                          >
                            <ShieldAlert className="size-3.5" /> Confirmer fraude
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-gray-600 border-gray-200 hover:bg-gray-50"
                            onClick={() => setResolutionDialog({ open: true, alertId: alert.id, action: 'DISMISS' })}
                            disabled={actionLoading === alert.id}
                          >
                            <XCircle className="size-3.5" /> Écarter
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
          <PaginationControls
            page={alertsPage}
            totalPages={alertsTotalPages}
            total={alertsTotal}
            limit={alertsPageSize}
            onPageChange={setAlertsPage}
            className="sm:col-span-2"
          />
        </div>
      ) : (
        /* ─── List View ──────────────────────────────────────────── */
        <Card className="border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left font-medium text-muted-foreground p-3">Suspect</th>
                  <th className="text-center font-medium text-muted-foreground p-3">Statut</th>
                  <th className="text-left font-medium text-muted-foreground p-3 hidden sm:table-cell">Détection</th>
                  <th className="text-left font-medium text-muted-foreground p-3 hidden md:table-cell">Description</th>
                  <th className="text-left font-medium text-muted-foreground p-3 hidden lg:table-cell">Date</th>
                  <th className="text-right font-medium text-muted-foreground p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout" initial={false} key={`page-${alertsPage}`}>
                  {pagedAlerts.map((alert) => (
                    <motion.tr
                      key={alert.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="border-b border-border hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="size-8 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                            <User className="size-4 text-amber-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {alert.suspect.firstName} {alert.suspect.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{alert.suspect.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <Badge className={statusColors[alert.status] || 'bg-gray-100 text-gray-700'}>
                          {statusLabels[alert.status] || alert.status}
                        </Badge>
                      </td>
                      <td className="p-3 hidden sm:table-cell">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs gap-1',
                            alert.autoDetected ? 'border-amber-200 text-amber-700' : 'border-brand-200 text-brand-700'
                          )}
                        >
                          {alert.autoDetected ? <Bot className="size-3" /> : <UserCheck className="size-3" />}
                          {alert.autoDetected ? 'Auto' : 'Manuel'}
                        </Badge>
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        <span className="text-muted-foreground line-clamp-1 max-w-[200px] block">
                          {alert.description}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground hidden lg:table-cell">
                        {new Date(alert.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          {alert.status === 'OPEN' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 h-8 w-8 p-0"
                              onClick={() => handleStatusChange(alert.id, 'INVESTIGATE')}
                              disabled={actionLoading === alert.id}
                              title="Investiguer"
                            >
                              <SearchIcon className="size-4" />
                            </Button>
                          )}
                          {alert.status === 'INVESTIGATING' && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-8 w-8 p-0"
                                onClick={() => setResolutionDialog({ open: true, alertId: alert.id, action: 'CONFIRM' })}
                                disabled={actionLoading === alert.id}
                                title="Confirmer fraude"
                              >
                                <ShieldAlert className="size-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-gray-500 hover:text-gray-700 hover:bg-gray-50 h-8 w-8 p-0"
                                onClick={() => setResolutionDialog({ open: true, alertId: alert.id, action: 'DISMISS' })}
                                disabled={actionLoading === alert.id}
                                title="Écarter"
                              >
                                <XCircle className="size-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-3">
            <PaginationControls
              page={alertsPage}
              totalPages={alertsTotalPages}
              total={alertsTotal}
              limit={alertsPageSize}
              onPageChange={setAlertsPage}
            />
          </div>
        </Card>
      )}

      {/* ─── Create Fraud Alert Dialog ────────────────────────────── */}
      <Dialog open={createDialog} onOpenChange={(open) => { if (!open) setCreateDialog(false) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle alerte de fraude</DialogTitle>
            <DialogDescription>Signalez un cas de fraude suspecté</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Suspect search */}
            <div className="space-y-2">
              <Label>Suspect *</Label>
              {createForm.suspectId ? (
                <div className="flex items-center justify-between p-2 rounded-lg bg-red-50 border border-red-200">
                  <span className="text-sm font-medium text-foreground">{getSelectedUserName()}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600"
                    aria-label="Effacer le suspect sélectionné"
                    onClick={() => setCreateForm((prev) => ({ ...prev, suspectId: '' }))}
                  >
                    <XCircle className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher un utilisateur..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-9"
                    />
                    {userSearchLoading && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground animate-spin" />
                    )}
                  </div>
                  {userResults.length > 0 && (
                    <div className="max-h-32 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                      {userResults.map((u) => (
                        <button
                          key={u.id}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                          onClick={() => {
                            setCreateForm((prev) => ({ ...prev, suspectId: u.id }))
                            setUserSearch('')
                            setUserResults([])
                          }}
                        >
                          <span className="font-medium text-foreground">{u.firstName} {u.lastName}</span>
                          <span className="text-muted-foreground ml-2">{u.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                placeholder="Décrivez la fraude suspectée..."
                value={createForm.description}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateDialog(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleCreate}
              disabled={submitting || !createForm.suspectId || !createForm.description.trim()}
            >
              {submitting && <Loader2 className="size-4 animate-spin mr-2" />}
              Créer l&apos;alerte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Resolution Dialog ─────────────────────────────────────── */}
      <Dialog
        open={resolutionDialog.open}
        onOpenChange={(open) => {
          if (!open) { setResolutionDialog({ open: false, alertId: '', action: 'CONFIRM' }); setResolution('') }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {resolutionDialog.action === 'CONFIRM' ? 'Confirmer la fraude' : 'Écarter l\'alerte'}
            </DialogTitle>
            <DialogDescription>
              {resolutionDialog.action === 'CONFIRM'
                ? 'Confirmez cette alerte comme fraude avérée'
                : 'Écartez cette alerte si elle est infondée'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Textarea
              placeholder={resolutionDialog.action === 'CONFIRM' ? 'Détails de la résolution...' : 'Raison de l\'écartement...'}
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setResolutionDialog({ open: false, alertId: '', action: 'CONFIRM' }); setResolution('') }}
            >
              Annuler
            </Button>
            <Button
              className={cn(
                'text-white',
                resolutionDialog.action === 'CONFIRM'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-gray-600 hover:bg-gray-700'
              )}
              onClick={() => {
                handleStatusChange(resolutionDialog.alertId, resolutionDialog.action, resolution.trim() || undefined)
                setResolutionDialog({ open: false, alertId: '', action: 'CONFIRM' })
                setResolution('')
              }}
            >
              {resolutionDialog.action === 'CONFIRM' ? 'Confirmer la fraude' : 'Écarter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
