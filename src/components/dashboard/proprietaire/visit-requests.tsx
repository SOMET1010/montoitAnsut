'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import {
  Eye, Check, X, Clock, MapPin, Calendar, User, Phone, Mail,
  Building2, Search, ChevronDown, MessageSquare, FileText,
  CalendarDays, Home, ArrowRight, Loader2, ShieldCheck, XCircle,
  CheckCircle2, AlertTriangle, PenLine
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useRealtimeVisits } from '@/hooks/use-realtime-visits'

// ─── Types ──────────────────────────────────────────────────────────────────

interface VisitProperty {
  id: string; title: string; address?: string; city: string
  type?: string; price?: number; currency?: string
  images: Array<{ url: string }>
}

interface VisitTenant {
  id: string; firstName: string; lastName: string
  phone: string | null; email: string | null
}

interface VisitItem {
  id: string; visitType: string; requestedDate: string; timeSlot: string
  status: string; counterDate: string | null; counterTimeSlot: string | null
  ownerComment: string | null; tenantMessage: string | null
  createdAt: string; updatedAt: string
  propertyId: string; tenantId: string
  property?: VisitProperty; tenant?: VisitTenant
}

interface RentalFileTenant {
  id: string; firstName: string; lastName: string; phone: string | null; email: string
}
interface RentalFileDoc {
  id: string; type: string; name: string; status: string
}
interface RentalFileLease {
  id: string; property: { id: string; title: string; city: string; address: string; images: Array<{ url: string }> }
}
interface RentalFileItem {
  id: string; status: string; tenantCategory: string | null
  monthlyIncome: number | null; employer: string | null
  guarantorName: string | null; rejectionReason: string | null
  createdAt: string
  tenant: RentalFileTenant; documents: RentalFileDoc[]; leases: RentalFileLease[]
  tenantPaymentScore: number | null
}

// ─── Constants ──────────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING: { label: 'En attente', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  ACCEPTED: { label: 'Acceptée', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  REJECTED: { label: 'Refusée', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  COUNTER_PROPOSED: { label: 'Contre-proposition', color: 'bg-brand-50 text-brand-700 border-brand-200', icon: Calendar },
  COMPLETED: { label: 'Terminée', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: ShieldCheck },
  CANCELLED: { label: 'Annulée', color: 'bg-neutral-100 text-neutral-600 border-neutral-200', icon: X },
}

const rentalFileStatusConfig: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Brouillon', color: 'bg-neutral-100 text-neutral-600' },
  SUBMITTED: { label: 'Soumis', color: 'bg-amber-100 text-amber-700' },
  TC_REVIEW: { label: 'En revue TC', color: 'bg-amber-100 text-amber-700' },
  VALIDATED: { label: 'Validé', color: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: 'Refusé', color: 'bg-red-100 text-red-700' },
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Component ──────────────────────────────────────────────────────────────

export function VisitRequests() {
  const { user, isAuthenticated, setDashboardSection } = useAuthStore()
  const [visits, setVisits] = useState<VisitItem[]>([])
  const [rentalFiles, setRentalFiles] = useState<RentalFileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [propertyFilter, setPropertyFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const limit = 12

  // Detail modal
  const [detailVisit, setDetailVisit] = useState<VisitItem | null>(null)
  const [detailRentalFile, setDetailRentalFile] = useState<any>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  // Action dialogs
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectComment, setRejectComment] = useState('')
  const [counterOpen, setCounterOpen] = useState(false)
  const [counterDate, setCounterDate] = useState('')
  const [counterTimeSlot, setCounterTimeSlot] = useState('')
  const [counterComment, setCounterComment] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Rental file action dialogs
  const [acceptFileOpen, setAcceptFileOpen] = useState(false)
  const [rejectFileOpen, setRejectFileOpen] = useState(false)
  const [rejectFileReason, setRejectFileReason] = useState('')
  const [selectedFileId, setSelectedFileId] = useState<string>('')

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return }
    setError(null)
    try {
      const [visitsRes, rentalRes] = await Promise.all([
        authFetch<{ data: VisitItem[] }>('/api/visits'),
        authFetch<{ data: RentalFileItem[] }>('/api/owner/rental-files').catch(() => ({ data: [] as RentalFileItem[] })),
      ])
      setVisits(visitsRes.data || [])
      setRentalFiles(rentalRes.data || [])
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) {
        setVisits([]); setRentalFiles([]); return
      }
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setVisits([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => { fetchData() }, [fetchData])

  // ─── Realtime subscription for visit changes ────────────────────
  const ownedPropertyIds = visits
    .map((v) => v.propertyId)
    .filter((id, i, arr) => arr.indexOf(id) === i)

  useRealtimeVisits({
    userId: user?.id,
    ownedPropertyIds,
    onVisitChange: (event, payload) => {
      if (event === 'UPDATE') {
        setVisits((prev) =>
          prev.map((v) =>
            v.id === payload.id
              ? {
                  ...v,
                  status: payload.status,
                  requestedDate: payload.requested_date,
                  timeSlot: payload.time_slot,
                  counterDate: payload.counter_date,
                  counterTimeSlot: payload.counter_time_slot,
                  ownerComment: payload.owner_comment,
                  tenantMessage: payload.tenant_message,
                  updatedAt: payload.updated_at,
                }
              : v
          )
        )
      } else if (event === 'INSERT') {
        // Re-fetch to get full visit data for new requests
        fetchData()
      }
    },
  })

  // ─── Derived data ────────────────────────────────────────────────────────

  const properties = [...new Map(visits.map((v) => [v.propertyId, v.property])).values()].filter(Boolean) as VisitProperty[]

  const filteredVisits = visits.filter((v) => {
    if (statusFilter !== 'ALL' && v.status !== statusFilter) return false
    if (propertyFilter !== 'ALL' && v.propertyId !== propertyFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const tenantName = v.tenant ? `${v.tenant.firstName} ${v.tenant.lastName}`.toLowerCase() : ''
      const propTitle = v.property?.title.toLowerCase() || ''
      if (!tenantName.includes(q) && !propTitle.includes(q)) return false
    }
    return true
  })

  const paginatedVisits = useMemo(() => {
    const start = (page - 1) * limit
    return filteredVisits.slice(start, start + limit)
  }, [filteredVisits, page, limit])

  // Reset page on filter change
  useEffect(() => { setPage(1) }, [statusFilter, propertyFilter, search])

  const stats = {
    total: visits.length,
    PENDING: visits.filter((v) => v.status === 'PENDING').length,
    ACCEPTED: visits.filter((v) => v.status === 'ACCEPTED').length,
    COMPLETED: visits.filter((v) => v.status === 'COMPLETED').length,
    REJECTED: visits.filter((v) => v.status === 'REJECTED' || v.status === 'CANCELLED').length,
  }

  const tabs = [
    { key: 'ALL', label: 'Toutes', count: stats.total },
    { key: 'PENDING', label: 'En attente', count: stats.PENDING },
    { key: 'ACCEPTED', label: 'Acceptées', count: stats.ACCEPTED },
    { key: 'COMPLETED', label: 'Terminées', count: stats.COMPLETED },
    { key: 'REJECTED', label: 'Refusées', count: stats.REJECTED },
  ]

  // Find matching rental file for a visit
  const findRentalFile = (visit: VisitItem): RentalFileItem | undefined => {
    return rentalFiles.find((rf) =>
      rf.tenant.id === visit.tenantId &&
      rf.leases.some((l) => l.property.id === visit.propertyId)
    )
  }

  // ─── Open detail modal with rental file info ────────────────────────────

  const openDetail = async (visit: VisitItem) => {
    setDetailVisit(visit)
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailRentalFile(null)

    try {
      const res = await authFetch<{ data: any }>(`/api/visits/${visit.id}`)
      if (res.data?.rentalFile) {
        setDetailRentalFile(res.data.rentalFile)
      }
    } catch {
      // Rental file info unavailable — continue without it
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setDetailOpen(false)
    setDetailVisit(null)
    setDetailRentalFile(null)
  }

  // ─── Visit actions ───────────────────────────────────────────────────────

  const updateVisitStatus = async (id: string, body: Record<string, unknown>) => {
    setActionLoading(true)
    try {
      await authFetch(`/api/visits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      toast.success('Statut mis à jour')
      setDetailOpen(false)
      setDetailVisit(null)
      setRejectOpen(false)
      setCounterOpen(false)
      setRejectComment('')
      setCounterDate('')
      setCounterTimeSlot('')
      setCounterComment('')
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setActionLoading(false)
    }
  }

  const handleAccept = () => {
    if (!detailVisit) return
    updateVisitStatus(detailVisit.id, { status: 'ACCEPTED' })
  }

  const handleReject = () => {
    if (!detailVisit) return
    updateVisitStatus(detailVisit.id, { status: 'REJECTED', ownerComment: rejectComment || undefined })
  }

  const handleCounterPropose = () => {
    if (!detailVisit || !counterDate || !counterTimeSlot) {
      toast.error('Veuillez remplir la date et le créneau')
      return
    }
    updateVisitStatus(detailVisit.id, {
      status: 'COUNTER_PROPOSED',
      counterDate,
      counterTimeSlot,
      ownerComment: counterComment || undefined,
    })
  }

  // ─── Rental file actions ─────────────────────────────────────────────────

  const handleAcceptFile = async () => {
    if (!selectedFileId) return
    setActionLoading(true)
    try {
      await authFetch(`/api/rental-files/${selectedFileId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
      })
      toast.success('Candidature transmise au Tiers de Confiance pour vérification')
      setAcceptFileOpen(false)
      setDetailOpen(false)
      setDetailVisit(null)
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRejectFile = async () => {
    if (!selectedFileId || !rejectFileReason.trim()) {
      toast.error('Veuillez fournir une raison')
      return
    }
    setActionLoading(true)
    try {
      await authFetch(`/api/rental-files/${selectedFileId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', rejectionReason: rejectFileReason.trim() }),
      })
      toast.success('Candidature refusée')
      setRejectFileOpen(false)
      setRejectFileReason('')
      setDetailOpen(false)
      setDetailVisit(null)
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setActionLoading(false)
    }
  }

  // ─── Loading state ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div><div className="h-8 w-56 bg-muted animate-pulse rounded" /><div className="h-4 w-72 bg-muted animate-pulse rounded mt-2" /></div>
        <div className="flex gap-2">{[1,2,3,4,5].map((i) => <div key={i} className="h-9 w-24 bg-muted animate-pulse rounded-lg" />)}</div>
        {[1,2,3].map((i) => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}
      </div>
    )
  }

  if (error) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div><h1 className="text-xl sm:text-2xl font-bold text-foreground">Demandes de visite</h1><p className="text-muted-foreground mt-1">Gérez les demandes de visite de vos biens</p></div>
        <Card className="border-amber-200 bg-amber-50"><CardContent className="p-4"><p className="text-sm text-amber-700">Impossible de charger les demandes. Veuillez réessayer.</p></CardContent></Card>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Demandes de visite</h1>
        <p className="text-muted-foreground mt-1">Gérez les demandes de visite et consultez les candidatures associées</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={cn(
              'p-3 rounded-xl border text-left transition-all',
              statusFilter === tab.key
                ? 'border-brand-500 bg-brand-50 shadow-sm'
                : 'border-border bg-card hover:bg-muted/50'
            )}
          >
            <p className={cn(
              'text-2xl font-bold',
              statusFilter === tab.key ? 'text-brand-600' : 'text-foreground'
            )}>{tab.count}</p>
            <p className={cn(
              'text-xs mt-0.5',
              statusFilter === tab.key ? 'text-brand-600 font-medium' : 'text-muted-foreground'
            )}>{tab.label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par locataire ou bien..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <Select value={propertyFilter} onValueChange={setPropertyFilter}>
          <SelectTrigger className="w-full sm:w-[220px] h-10">
            <Building2 className="size-4 mr-2 shrink-0" />
            <SelectValue placeholder="Tous les biens" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous les biens</SelectItem>
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors',
              statusFilter === tab.key
                ? 'bg-brand-500 text-white'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            )}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Visit list */}
      {filteredVisits.length === 0 ? (
        <Card className="border-dashed border-border bg-muted/50">
          <CardContent className="py-12 flex flex-col items-center text-center">
            <Eye className="size-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">
              {search || propertyFilter !== 'ALL'
                ? 'Aucune visite trouvée'
                : statusFilter === 'PENDING'
                  ? 'Aucune demande en attente'
                  : 'Aucune visite'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {search || propertyFilter !== 'ALL'
                ? 'Essayez de modifier vos filtres de recherche.'
                : 'Les nouvelles demandes de visite apparaîtront ici.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={statusFilter + propertyFilter + search}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            {paginatedVisits.map((visit) => {
              const config = statusConfig[visit.status] || statusConfig.PENDING
              const StatusIcon = config.icon
              const matchingFile = findRentalFile(visit)

              return (
                <motion.div
                  key={visit.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  layout
                >
                  <Card
                    className={cn(
                      'border-border hover:shadow-md transition-all cursor-pointer',
                      visit.status === 'PENDING' && 'border-amber-200/50'
                    )}
                    onClick={() => openDetail(visit) }
                  >
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-start gap-4">
                        {/* Property thumbnail */}
                        <div className="hidden sm:flex size-14 rounded-lg bg-muted overflow-hidden shrink-0">
                          {visit.property?.images[0]?.url ? (
                            <img src={visit.property.images[0].url} alt="" className="size-full object-cover" />
                          ) : (
                            <div className="size-full flex items-center justify-center"><Building2 className="size-6 text-muted-foreground/40" /></div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Top row */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                            <div className="min-w-0">
                              <h3 className="font-semibold text-foreground truncate">
                                {visit.property?.title || 'Bien sans titre'}
                              </h3>
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <MapPin className="size-3" />
                                {visit.property?.city || ''}
                              </p>
                            </div>
                            <Badge className={cn('shrink-0 text-xs w-fit', config.color)}>
                              <StatusIcon className="size-3 mr-1" />
                              {config.label}
                            </Badge>
                          </div>

                          {/* Info rows */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <User className="size-3.5 shrink-0" />
                              <span className="truncate">{visit.tenant?.firstName} {visit.tenant?.lastName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="size-3.5 shrink-0" />
                              <span>{formatShort(visit.requestedDate)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="size-3.5 shrink-0" />
                              <span>{visit.timeSlot}</span>
                            </div>
                          </div>

                          {/* Rental file indicator */}
                          {matchingFile && (
                            <div className="mt-2 flex items-center gap-2">
                              <div className={cn(
                                'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium',
                                matchingFile.status === 'VALIDATED' ? 'bg-emerald-50 text-emerald-700' :
                                matchingFile.status === 'SUBMITTED' || matchingFile.status === 'TC_REVIEW' ? 'bg-amber-50 text-amber-700' :
                                matchingFile.status === 'REJECTED' ? 'bg-red-50 text-red-700' :
                                'bg-neutral-50 text-neutral-600'
                              )}>
                                <FileText className="size-3" />
                                Candidature : {rentalFileStatusConfig[matchingFile.status]?.label || matchingFile.status}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Quick action for PENDING */}
                        {visit.status === 'PENDING' && (
                          <div className="hidden sm:flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                              onClick={(e) => { e.stopPropagation(); openDetail(visit); setTimeout(() => handleAccept(), 100) }}
                            >
                              <Check className="size-3.5" />
                              <span className="hidden lg:inline">Accepter</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 border-red-200 text-red-600 hover:bg-red-50 gap-1"
                              onClick={(e) => { e.stopPropagation(); setDetailVisit(visit); setRejectOpen(true); setDetailOpen(true) }}
                            >
                              <X className="size-3.5" />
                              <span className="hidden lg:inline">Refuser</span>
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </motion.div>
          {filteredVisits.length > limit && (
            <PaginationControls
              page={page}
              totalPages={Math.ceil(filteredVisits.length / limit)}
              onPageChange={setPage}
            />
          )}
        </AnimatePresence>
      )}

      {/* ════════════════════════════════════════════════════════════════
         DETAIL MODAL
         ════════════════════════════════════════════════════════════════ */}
      <Dialog open={detailOpen} onOpenChange={(open) => { if (!open) closeDetail() }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          {detailVisit && (() => {
            const config = statusConfig[detailVisit.status] || statusConfig.PENDING
            const StatusIcon = config.icon
            const matchingFile = detailRentalFile
            const prop = detailVisit.property
            const tenant = detailVisit.tenant

            return (
              <>
                <DialogHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <DialogTitle className="text-lg flex items-center gap-2">
                        <Home className="size-5 text-brand-500 shrink-0" />
                        <span className="truncate">{prop?.title || 'Bien sans titre'}</span>
                      </DialogTitle>
                      {prop && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="size-3" />
                          {prop.address ? `${prop.address}, ` : ''}{prop.city}
                        </p>
                      )}
                    </div>
                    <Badge className={cn('shrink-0 text-xs', config.color)}>
                      <StatusIcon className="size-3 mr-1" />
                      {config.label}
                    </Badge>
                  </div>
                </DialogHeader>

                <ScrollArea className="flex-1 pr-3">
                  <div className="space-y-5 py-2">

                    {/* ── Tenant info ── */}
                    <Card className="border-border">
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><User className="size-4 text-brand-500" />Locataire</CardTitle></CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div className="flex items-center gap-2 text-foreground">
                            <User className="size-3.5 text-muted-foreground" />
                            {tenant?.firstName} {tenant?.lastName}
                          </div>
                          {tenant?.phone && (
                            <div className="flex items-center gap-2 text-foreground">
                              <Phone className="size-3.5 text-muted-foreground" />
                              {tenant.phone}
                            </div>
                          )}
                          {tenant?.email && (
                            <div className="flex items-center gap-2 text-foreground sm:col-span-2">
                              <Mail className="size-3.5 text-muted-foreground" />
                              {tenant.email}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* ── Visit details ── */}
                    <Card className="border-border">
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><CalendarDays className="size-4 text-brand-500" />Détails de la visite</CardTitle></CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                            <Calendar className="size-5 text-brand-500 shrink-0" />
                            <div>
                              <p className="text-[11px] text-muted-foreground">Date demandée</p>
                              <p className="text-sm font-semibold text-foreground capitalize">{formatDate(detailVisit.requestedDate)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                            <Clock className="size-5 text-brand-500 shrink-0" />
                            <div>
                              <p className="text-[11px] text-muted-foreground">Créneau horaire</p>
                              <p className="text-sm font-semibold text-foreground">{detailVisit.timeSlot}</p>
                            </div>
                          </div>
                        </div>

                        {/* Tenant message */}
                        {detailVisit.tenantMessage && (
                          <div className="p-3 rounded-lg bg-brand-50 border border-brand-100">
                            <p className="text-[11px] font-medium text-brand-600 mb-1">Message du locataire</p>
                            <p className="text-sm text-brand-800 italic">&ldquo;{detailVisit.tenantMessage}&rdquo;</p>
                          </div>
                        )}

                        {/* Counter-proposal display */}
                        {detailVisit.status === 'COUNTER_PROPOSED' && detailVisit.counterDate && (
                          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                            <div className="flex items-center gap-2 mb-1">
                              <Calendar className="size-4 text-amber-600" />
                              <p className="text-xs font-semibold text-amber-700">Votre contre-proposition</p>
                            </div>
                            <p className="text-sm font-medium text-amber-800 capitalize">{formatDate(detailVisit.counterDate)}</p>
                            {detailVisit.counterTimeSlot && (
                              <p className="text-sm text-amber-700">{detailVisit.counterTimeSlot}</p>
                            )}
                            {detailVisit.ownerComment && (
                              <p className="text-xs text-amber-600 mt-1 italic">&ldquo;{detailVisit.ownerComment}&rdquo;</p>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* ── Candidature (rental file) ── */}
                    <Card className={cn(
                      'border-border',
                      matchingFile?.status === 'SUBMITTED' || matchingFile?.status === 'TC_REVIEW' ? 'border-amber-200' :
                      matchingFile?.status === 'VALIDATED' ? 'border-emerald-200' :
                      matchingFile?.status === 'REJECTED' ? 'border-red-200' : ''
                    )}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <FileText className="size-4 text-brand-500" />
                          Candidature
                          {matchingFile && (
                            <Badge className={cn('text-[10px]', rentalFileStatusConfig[matchingFile.status]?.color || 'bg-neutral-100 text-neutral-600')}>
                              {rentalFileStatusConfig[matchingFile.status]?.label || matchingFile.status}
                            </Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {!matchingFile ? (
                          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                            <FileText className="size-4 text-muted-foreground/50" />
                            <p className="text-sm text-muted-foreground">Aucune candidature déposée pour ce bien</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {/* File summary */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                              {matchingFile.tenantCategory && (
                                <div>
                                  <p className="text-[11px] text-muted-foreground">Catégorie</p>
                                  <p className="font-medium text-foreground">{matchingFile.tenantCategory}</p>
                                </div>
                              )}
                              {matchingFile.monthlyIncome && (
                                <div>
                                  <p className="text-[11px] text-muted-foreground">Revenus</p>
                                  <p className="font-medium text-foreground">{matchingFile.monthlyIncome.toLocaleString('fr-FR')} FCFA</p>
                                </div>
                              )}
                              {matchingFile.employer && (
                                <div>
                                  <p className="text-[11px] text-muted-foreground">Employeur</p>
                                  <p className="font-medium text-foreground truncate">{matchingFile.employer}</p>
                                </div>
                              )}
                              <div>
                                <p className="text-[11px] text-muted-foreground">Soumis le</p>
                                <p className="font-medium text-foreground">{formatShort(matchingFile.createdAt)}</p>
                              </div>
                              {matchingFile.guarantorName && (
                                <div>
                                  <p className="text-[11px] text-muted-foreground">Garant</p>
                                  <p className="font-medium text-foreground">{matchingFile.guarantorName}</p>
                                </div>
                              )}
                            </div>

                            {/* Documents count */}
                            {matchingFile.documents.length > 0 && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <FileText className="size-3" />
                                {matchingFile.documents.length} document{matchingFile.documents.length > 1 ? 's' : ''} fourni{matchingFile.documents.length > 1 ? 's' : ''}
                              </div>
                            )}

                            {/* Rejection reason */}
                            {matchingFile.status === 'REJECTED' && matchingFile.rejectionReason && (
                              <div className="p-2 rounded-lg bg-red-50 border border-red-200">
                                <p className="text-xs font-medium text-red-700">Raison du refus</p>
                                <p className="text-xs text-red-600 mt-0.5">{matchingFile.rejectionReason}</p>
                              </div>
                            )}

                            {/* Actions for pending files */}
                            {['SUBMITTED', 'TC_REVIEW'].includes(matchingFile.status) && (
                              <div className="flex items-center gap-2 pt-1">
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                                  onClick={() => { setSelectedFileId(matchingFile.id); setAcceptFileOpen(true) }}
                                >
                                  <CheckCircle2 className="size-3.5" />
                                  Accepter la candidature
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-red-200 text-red-600 hover:bg-red-50 gap-1.5"
                                  onClick={() => { setSelectedFileId(matchingFile.id); setRejectFileOpen(true) }}
                                >
                                  <XCircle className="size-3.5" />
                                  Refuser
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* ── Actions ── */}
                    {detailVisit.status === 'PENDING' && (
                      <div className="space-y-3 pt-2">
                        <Separator />
                        <div className="flex flex-col sm:flex-row gap-2 justify-end">
                          <Button
                            variant="outline"
                            className="gap-2 border-red-200 text-red-600 hover:bg-red-50"
                            onClick={() => setRejectOpen(true)}
                          >
                            <X className="size-4" /> Refuser
                          </Button>
                          <Button
                            variant="outline"
                            className="gap-2 border-brand-200 text-brand-600 hover:bg-brand-50"
                            onClick={() => setCounterOpen(true)}
                          >
                            <Calendar className="size-4" /> Proposer une autre date
                          </Button>
                          <Button
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                            onClick={handleAccept}
                            disabled={actionLoading}
                          >
                            {actionLoading ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                            Accepter
                          </Button>
                        </div>
                      </div>
                    )}

                    {detailVisit.status === 'ACCEPTED' && (
                      <div className="pt-2">
                        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
                          <CheckCircle2 className="size-5 text-emerald-600 mx-auto mb-1" />
                          <p className="text-sm font-medium text-emerald-700">Visite acceptée</p>
                          <p className="text-xs text-emerald-600 mt-0.5">Le locataire a été notifié. Vous pouvez modifier le statut si nécessaire.</p>
                        </div>
                      </div>
                    )}

                    {detailVisit.status === 'COUNTER_PROPOSED' && (
                      <div className="pt-2">
                        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-center">
                          <Calendar className="size-5 text-amber-600 mx-auto mb-1" />
                          <p className="text-sm font-medium text-amber-700">Contre-proposition envoyée</p>
                          <p className="text-xs text-amber-600 mt-0.5">En attente de la réponse du locataire.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════
         REJECT DIALOG (inside modal)
         ════════════════════════════════════════════════════════════════ */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><XCircle className="size-5 text-red-500" />Refuser la visite</DialogTitle>
            <DialogDescription>Le locataire sera notifié du refus.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-sm font-medium text-foreground mb-2 block">Commentaire (optionnel)</label>
            <Textarea
              placeholder="Expliquez le motif du refus..."
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setRejectOpen(false); setRejectComment('') }}>Annuler</Button>
            <Button onClick={handleReject} disabled={actionLoading} className="bg-red-600 hover:bg-red-700 text-white gap-2">
              {actionLoading ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════
         COUNTER-PROPOSE DIALOG
         ════════════════════════════════════════════════════════════════ */}
      <Dialog open={counterOpen} onOpenChange={setCounterOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Calendar className="size-5 text-brand-500" />Proposer une autre date</DialogTitle>
            <DialogDescription>Proposez une date et un créneau alternatif au locataire.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Nouvelle date <span className="text-red-500">*</span></label>
              <Input type="date" value={counterDate} onChange={(e) => setCounterDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Nouveau créneau <span className="text-red-500">*</span></label>
              <Input
                placeholder="ex: 10h00 - 12h00"
                value={counterTimeSlot}
                onChange={(e) => setCounterTimeSlot(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Commentaire (optionnel)</label>
              <Textarea
                placeholder="Ajoutez un message au locataire..."
                value={counterComment}
                onChange={(e) => setCounterComment(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCounterOpen(false); setCounterDate(''); setCounterTimeSlot(''); setCounterComment('') }}>
              Annuler
            </Button>
            <Button
              onClick={handleCounterPropose}
              disabled={actionLoading || !counterDate || !counterTimeSlot}
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              {actionLoading ? <Loader2 className="size-4 animate-spin" /> : <Calendar className="size-4" />}
              Envoyer la proposition
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════
         ACCEPT CANDIDATURE DIALOG
         ════════════════════════════════════════════════════════════════ */}
      <Dialog open={acceptFileOpen} onOpenChange={setAcceptFileOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="size-5 text-emerald-600" />Accepter la candidature</DialogTitle>
            <DialogDescription>Le dossier sera transmis au Tiers de Confiance pour vérification avant validation finale.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-4">
            <Button variant="outline" onClick={() => setAcceptFileOpen(false)}>Annuler</Button>
            <Button onClick={handleAcceptFile} disabled={actionLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              {actionLoading ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Confirmer l&apos;acceptation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════
         REJECT CANDIDATURE DIALOG
         ════════════════════════════════════════════════════════════════ */}
      <Dialog open={rejectFileOpen} onOpenChange={setRejectFileOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><XCircle className="size-5 text-red-500" />Refuser la candidature</DialogTitle>
            <DialogDescription>Le locataire sera notifié du refus avec la raison indiquée.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-sm font-medium text-foreground mb-2 block">Raison du refus <span className="text-red-500">*</span></label>
            <Textarea
              placeholder="Expliquez pourquoi cette candidature est refusée..."
              value={rejectFileReason}
              onChange={(e) => setRejectFileReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setRejectFileOpen(false); setRejectFileReason('') }}>Annuler</Button>
            <Button
              onClick={handleRejectFile}
              disabled={actionLoading || !rejectFileReason.trim()}
              className="bg-red-600 hover:bg-red-700 text-white gap-2"
            >
              {actionLoading ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
