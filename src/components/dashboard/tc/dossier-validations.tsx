'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FolderOpen, User, Home, Building2, ClipboardCheck, Clock,
  Check, FileText, Loader2, ChevronRight, RotateCcw,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { usePagination } from '@/hooks/use-pagination'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { toast } from 'sonner'

// ─── Types ──────────────────────────────────────────────────────────────────

export type FilterKey = 'all' | 'locataire' | 'proprietaire' | 'agence'

interface UnifiedItem {
  id: string
  category: FilterKey
  name: string
  detail: string
  status: string
  createdAt: string
  tenantId?: string
  type?: string
  previouslyRejected?: boolean
  lastRejectedAt?: string | null
}

interface TcStats {
  pendingRentalFiles: number
  pendingOwnerDocs: number
  pendingAgencyDocs: number
  totalReviewed: number
  overdueSlas: number
  slaCompliance: number
}

interface ApiTcResponse { stats?: TcStats }

const defaultStats: TcStats = {
  pendingRentalFiles: 0, pendingOwnerDocs: 0, pendingAgencyDocs: 0,
  totalReviewed: 0, overdueSlas: 0, slaCompliance: 100,
}

const CATEGORIES = [
  { key: 'all' as FilterKey, label: 'Tous', icon: ClipboardCheck, color: 'text-brand-600', bg: 'bg-brand-50', ring: 'ring-brand-400' },
  { key: 'locataire' as FilterKey, label: 'Locataires', icon: User, color: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-400' },
  { key: 'proprietaire' as FilterKey, label: 'Propriétaires', icon: Home, color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-400' },
  { key: 'agence' as FilterKey, label: 'Agences', icon: Building2, color: 'text-rose-600', bg: 'bg-rose-50', ring: 'ring-rose-400' },
]

type StatusFilter = 'ALL' | 'SUBMITTED' | 'PENDING' | 'TC_REVIEW' | 'VALIDATED' | 'REJECTED'

const STATUS_FILTERS: { key: StatusFilter; label: string; color: string; bg: string; ring: string }[] = [
  { key: 'ALL', label: 'Tous', color: 'text-brand-600', bg: 'bg-brand-50', ring: 'ring-brand-400' },
  { key: 'SUBMITTED', label: 'Soumis', color: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-400' },
  { key: 'PENDING', label: 'En attente', color: 'text-yellow-600', bg: 'bg-yellow-50', ring: 'ring-yellow-400' },
  { key: 'TC_REVIEW', label: 'En revue', color: 'text-orange-600', bg: 'bg-orange-50', ring: 'ring-orange-400' },
  { key: 'VALIDATED', label: 'Validé', color: 'text-green-600', bg: 'bg-green-50', ring: 'ring-green-400' },
  { key: 'REJECTED', label: 'Rejeté', color: 'text-red-600', bg: 'bg-red-50', ring: 'ring-red-400' },
]

const CATEGORY_BADGE: Record<FilterKey, { label: string; class: string }> = {
  all: { label: '', class: '' },
  locataire: { label: 'Locataire', class: 'bg-amber-50 text-amber-700 border-amber-200' },
  proprietaire: { label: 'Propriétaire', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  agence: { label: 'Agence', class: 'bg-rose-50 text-rose-700 border-rose-200' },
}

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  SUBMITTED: { label: 'Soumis', class: 'bg-amber-50 text-amber-700 border-amber-200' },
  TC_REVIEW: { label: 'En revue', class: 'bg-orange-50 text-orange-700 border-orange-200' },
  PENDING: { label: 'En attente', class: 'bg-amber-50 text-amber-700 border-amber-200' },
  VALIDATED: { label: 'Validé', class: 'bg-green-50 text-green-700 border-green-200' },
  APPROVED: { label: 'Validé', class: 'bg-green-50 text-green-700 border-green-200' },
  REJECTED: { label: 'Rejeté', class: 'bg-red-50 text-red-700 border-red-200' },
  EXPIRED: { label: 'Expiré', class: 'bg-gray-50 text-gray-500 border-gray-200' },
}

function isActionable(status: string) {
  return status === 'SUBMITTED' || status === 'TC_REVIEW' || status === 'PENDING'
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DossierValidations({ defaultFilter, onFilterConsumed }: { defaultFilter?: FilterKey; onFilterConsumed?: () => void }) {
  const { isAuthenticated, selectedItemId, setSelectedItemId, setDashboardSection } = useAuthStore()
  const [filter, setFilter] = useState<FilterKey>(defaultFilter || 'all')

  useEffect(() => { onFilterConsumed?.() }, [])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [stats, setStats] = useState<TcStats>(defaultStats)
  const [items, setItems] = useState<UnifiedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return }
    try {
      const d = await authFetch<ApiTcResponse>('/api/dashboard/tc')
      if (d.stats) setStats(d.stats)
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) return
      console.error('Erreur chargement stats:', err)
    }
  }, [isAuthenticated])

  const fetchItems = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return }
    setLoading(true)
    try {
      const [rentalRes, ownerRes, ownerFileRes] = await Promise.all([
        authFetch<{ files: any[] }>('/api/tc/rental-files?limit=200&status=ALL'),
        authFetch<{ docs: any[] }>('/api/tc/ownership-docs?limit=200&status=ALL'),
        authFetch<{ files: any[] }>('/api/tc/owner-files?status=ALL'),
      ])

      const unified: UnifiedItem[] = [
        ...(rentalRes.files ?? []).map((f: any) => ({
          id: f.id,
          category: 'locataire' as FilterKey,
          name: `${f.tenant?.firstName ?? ''} ${f.tenant?.lastName ?? ''}`.trim() || 'N/A',
          detail: `${f.monthlyIncome?.toLocaleString('fr-FR') ?? '—'} FCFA/mois`,
          status: f.status,
          createdAt: f.createdAt,
          previouslyRejected: f.previouslyRejected,
          lastRejectedAt: f.lastRejectedAt,
        })),
        ...(ownerRes.docs ?? []).map((d: any) => {
          const isAgency = d.type === 'AGREMENT' || d.type === 'RCCM'
          return {
            id: d.id,
            category: isAgency ? 'agence' as FilterKey : 'proprietaire' as FilterKey,
            name: `${d.owner?.firstName ?? ''} ${d.owner?.lastName ?? ''}`.trim() || 'N/A',
            detail: d.type?.replace(/_/g, ' ') ?? 'Document',
            status: d.status,
            createdAt: d.createdAt,
            type: d.type,
          }
        }),
        ...(ownerFileRes.files ?? []).map((f: any) => ({
          id: f.id,
          category: 'proprietaire' as FilterKey,
          name: `${f.owner?.firstName ?? ''} ${f.owner?.lastName ?? ''}`.trim() || 'N/A',
          detail: 'Dossier propriétaire',
          status: f.status,
          createdAt: f.createdAt,
          previouslyRejected: f.previouslyRejected,
          lastRejectedAt: f.lastRejectedAt,
        })),
      ]

      setItems(unified.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) return
      console.error('Erreur chargement items:', err)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => { fetchStats(); fetchItems() }, [fetchStats, fetchItems])

  // Auto-navigate to detail when selectedItemId matches a loaded item
  useEffect(() => {
    if (!selectedItemId || items.length === 0) return
    const match = items.find(i => i.id === selectedItemId)
    if (!match) return
    if (match.category === 'locataire') {
      setDashboardSection('rental-file-detail')
    } else if (match.category === 'agence') {
      setDashboardSection('agency-detail')
    } else if (!match.type) {
      setDashboardSection('owner-file-detail')
    }
  }, [selectedItemId, items, setDashboardSection])

  const filteredItems = useMemo(
    () => {
      let result = filter === 'all' ? items : items.filter(i => i.category === filter)
      if (statusFilter !== 'ALL') {
        result = result.filter(i => i.status === statusFilter || (statusFilter === 'VALIDATED' && i.status === 'APPROVED'))
      }
      return result
    },
    [items, filter, statusFilter]
  )

  const {
    paginatedItems: pagedItems,
    page,
    totalPages,
    total,
    pageSize,
    setPage,
  } = usePagination({
    items: filteredItems,
    pageSize: 10,
    resetSignal: `${filter}|${statusFilter}`,
  })

  const getCount = (key: FilterKey) => {
    if (key === 'all') return items.length
    return items.filter(i => i.category === key).length
  }

  const handleQuickValidate = async (item: UnifiedItem) => {
    setActionLoading(item.id)
    try {
      if (item.category === 'locataire') {
        await authFetch('/api/tc/rental-files', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileIds: [item.id], action: 'APPROVE', comment: '' }),
        })
      } else if (item.type) {
        await authFetch('/api/tc/ownership-docs', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ docIds: [item.id], action: 'APPROVE', comment: '' }),
        })
      } else {
        await authFetch('/api/tc/owner-files', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileIds: [item.id], action: 'APPROVE', comment: '' }),
        })
      }
      toast.success('Document validé')
      fetchItems()
      fetchStats()
    } catch {
      toast.error('Erreur lors de la validation')
    } finally {
      setActionLoading(null)
    }
  }

  const handleViewDetail = (item: UnifiedItem) => {
    if (item.category === 'locataire') {
      setSelectedItemId(item.id)
      setDashboardSection('rental-file-detail')
    } else if (item.category === 'agence') {
      setSelectedItemId(item.id)
      setDashboardSection('agency-detail')
    } else if (!item.type) {
      setSelectedItemId(item.id)
      setDashboardSection('owner-file-detail')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 rounded-xl bg-muted animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
        </div>
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <Card className="border-border bg-gradient-to-r from-brand-500/10 to-transparent">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-brand-100 shrink-0">
              <FolderOpen className="size-6 text-brand-600" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Dossiers de validation</h1>
              <p className="text-muted-foreground text-sm">Validez et suivez les dossiers en attente</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge className="bg-brand-50 text-brand-700 border-brand-200 border text-[10px]">
                  <ClipboardCheck className="size-3 mr-0.5" /> {items.length} dossier{items.length !== 1 ? 's' : ''}
                </Badge>
                <Badge className={cn(
                  'border text-[10px]',
                  stats.overdueSlas > 0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
                )}>
                  <Clock className="size-3 mr-0.5" />
                  {stats.overdueSlas} SLA dépassé{stats.overdueSlas > 1 ? 's' : ''}
                </Badge>
                <Badge className="bg-brand-50 text-brand-700 border-brand-200 border text-[10px]">
                  {stats.slaCompliance}% conformité
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Filtres ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon
          const count = getCount(cat.key)
          return (
            <Card
              key={cat.key}
              className={cn(
                'border-border cursor-pointer transition-all hover:shadow-sm',
                filter === cat.key && cn(cat.ring, 'ring-1', cat.bg)
              )}
              onClick={() => setFilter(cat.key)}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-3">
                  <div className={cn('flex size-10 items-center justify-center rounded-lg shrink-0', cat.bg)}>
                    <Icon className={cn('size-5', cat.color)} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl sm:text-2xl font-bold leading-tight text-foreground">{count}</p>
                    <p className="text-xs text-muted-foreground truncate">{cat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* SLA bar */}
      <div className="flex items-center gap-3 -mt-1">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              stats.slaCompliance >= 90 ? 'bg-green-500' : stats.slaCompliance >= 70 ? 'bg-amber-500' : 'bg-red-500'
            )}
            style={{ width: `${stats.slaCompliance}%` }}
          />
        </div>
        <span className={cn(
          'text-[10px] font-bold shrink-0',
          stats.slaCompliance >= 90 ? 'text-green-600' : stats.slaCompliance >= 70 ? 'text-amber-600' : 'text-red-600'
        )}>
          {stats.slaCompliance}%
        </span>
      </div>

      {/* ─── Filtres par statut ──────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((sf) => (
          <button
            key={sf.key}
            onClick={() => setStatusFilter(sf.key)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
              statusFilter === sf.key
                ? cn(sf.ring, 'ring-1', sf.bg, 'border-transparent')
                : 'bg-background text-muted-foreground border-border hover:bg-muted/50'
            )}
          >
            {sf.label}
          </button>
        ))}
      </div>

      {/* ─── Liste unifiée ──────────────────────────────────────── */}
      <Card className="border-border">
        <CardContent className="p-0 divide-y divide-border/40">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="size-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground font-medium">Aucun dossier en attente</p>
              <p className="text-xs text-muted-foreground mt-0.5">Tous les dossiers ont été traités ✓</p>
            </div>
          ) : (
            pagedItems.map((item) => {
              const cat = CATEGORIES.find(c => c.key === item.category)!
              const Icon = cat.icon
              const badge = CATEGORY_BADGE[item.category]
              const statusCfg = STATUS_CONFIG[item.status] ?? { label: item.status, class: 'bg-gray-50 text-gray-600 border-gray-200' }
              const actionable = isActionable(item.status)
              const hasDetail = item.category === 'locataire' || item.category === 'agence' || (item.category === 'proprietaire' && !item.type)
              return (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center gap-3 px-4 sm:px-6 py-3.5 transition-colors',
                    hasDetail && 'cursor-pointer hover:bg-muted/30'
                  )}
                  onClick={() => hasDetail && handleViewDetail(item)}
                  role={hasDetail ? 'button' : undefined}
                  tabIndex={hasDetail ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (hasDetail && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault()
                      handleViewDetail(item)
                    }
                  }}
                >
                  <div className={cn('flex size-9 items-center justify-center rounded-lg shrink-0', cat.bg)}>
                    <Icon className={cn('size-4', cat.color)} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium text-foreground truncate">{item.name}</span>
                      <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', badge.class)}>
                        {badge.label}
                      </Badge>
                      <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', statusCfg.class)}>
                        {statusCfg.label}
                      </Badge>
                      {item.previouslyRejected && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-orange-50 text-orange-700 border-orange-200 gap-0.5">
                          <RotateCcw className="size-2.5" /> Resoumis
                          {item.lastRejectedAt && (
                            <span className="ml-0.5 opacity-75">({new Date(item.lastRejectedAt).toLocaleDateString('fr-FR')})</span>
                          )}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{item.detail}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground hidden sm:inline">
                      {new Date(item.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                    {actionable && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                        disabled={actionLoading === item.id}
                        onClick={(e) => { e.stopPropagation(); handleQuickValidate(item) }}
                        title="Valider"
                      >
                        {actionLoading === item.id
                          ? <Loader2 className="size-3.5 animate-spin" />
                          : <Check className="size-3.5" />
                        }
                      </Button>
                    )}
                    {hasDetail && <ChevronRight className="size-4 text-muted-foreground/50" />}
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
        <div className="px-4 pb-3">
          <PaginationControls
            page={page}
            totalPages={totalPages}
            total={total}
            limit={pageSize}
            onPageChange={setPage}
          />
        </div>
      </Card>
    </motion.div>
  )
}
