'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ClipboardCheck,
  FileText,
  Check,
  X,
  Search,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Eye,
  User,
  Building2,
  Calendar,
  FileCheck,
  Pause,
  Play,
  AlertTriangle,
  Flame,
  CircleDot,
  Loader2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { useAuthStore } from '@/lib/auth-store'
import { useRealtimeRentalFiles } from '@/hooks/use-realtime-rental-files'
import { ViewModeToggle, type ViewMode } from './view-mode-toggle'
import { DocumentPreviewDialog } from './document-preview-dialog'
import { usePagination } from '@/hooks/use-pagination'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

type DossierPriority = 'NORMAL' | 'HIGH' | 'URGENT'

interface RentalFile {
  id: string
  status: 'DRAFT' | 'SUBMITTED' | 'TC_REVIEW' | 'VALIDATED' | 'REJECTED' | 'EXPIRED'
  priority: DossierPriority
  onHold: boolean
  onHoldReason: string | null
  tenantCategory: string | null
  monthlyIncome: number | null
  employer: string | null
  employmentType: string | null
  guarantorName: string | null
  guarantorPhone: string | null
  rejectionReason: string | null
  tcComment: string | null
  reviewedAt: string | null
  createdAt: string
  tenant: {
    id: string
    firstName: string
    lastName: string
    phone: string
    email: string
    avatarUrl: string | null
  }
  documents: Array<{
    id: string
    type: string
    url: string
    name: string
    status: 'PENDING' | 'VALIDATED' | 'REJECTED'
    tcComment: string | null
    createdAt: string
  }>
  sla: {
    id: string
    submittedAt: string
    deadlineAt: string
    isOverdue: boolean
  } | null
}

interface ApiPagination {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

interface ApiResponse {
  files: RentalFile[]
  pagination: ApiPagination
}

// ─── Status helpers ─────────────────────────────────────────────────────────

const statusLabels: Record<RentalFile['status'], string> = {
  DRAFT: 'Brouillon',
  SUBMITTED: 'Soumis',
  TC_REVIEW: 'En revue TC',
  VALIDATED: 'Validé',
  REJECTED: 'Rejeté',
  EXPIRED: 'Expiré',
}

const statusColors: Record<RentalFile['status'], string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-amber-100 text-amber-700',
  TC_REVIEW: 'bg-orange-100 text-orange-700',
  VALIDATED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-gray-100 text-gray-500',
}

const docStatusColors: Record<RentalFile['documents'][0]['status'], string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  VALIDATED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}

const docStatusLabels: Record<RentalFile['documents'][0]['status'], string> = {
  PENDING: 'En attente',
  VALIDATED: 'Validé',
  REJECTED: 'Rejeté',
}

const filterableStatuses: RentalFile['status'][] = [
  'SUBMITTED',
  'TC_REVIEW',
  'VALIDATED',
  'REJECTED',
]

const priorityLabels: Record<DossierPriority, string> = {
  NORMAL: 'Normale',
  HIGH: 'Haute',
  URGENT: 'Urgente',
}

const priorityColors: Record<DossierPriority, string> = {
  NORMAL: 'bg-gray-100 text-gray-600',
  HIGH: 'bg-amber-100 text-amber-700',
  URGENT: 'bg-red-100 text-red-700',
}

const priorityIcons: Record<DossierPriority, React.ElementType> = {
  NORMAL: CircleDot,
  HIGH: AlertTriangle,
  URGENT: Flame,
}

// ─── Priority Badge ─────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: DossierPriority }) {
  const Icon = priorityIcons[priority]
  return (
    <Badge className={cn('gap-1 text-xs', priorityColors[priority])}>
      <Icon className="size-3" />
      {priorityLabels[priority]}
    </Badge>
  )
}

  // ─── Component ──────────────────────────────────────────────────────────────

export function RentalFilesQueue({ showHeaderAndStats = true }: { showHeaderAndStats?: boolean }) {
  const { user, isAuthenticated, setSelectedItemId, setDashboardSection } = useAuthStore()

  // Data
  const [files, setFiles] = useState<RentalFile[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // View
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<RentalFile['status'] | 'ALL'>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<DossierPriority | 'ALL'>('ALL')
  const [onHoldFilter, setOnHoldFilter] = useState<'all' | 'active' | 'onHold'>('active')
  const [overdueOnly, setOverdueOnly] = useState(false)

  // Expanded cards
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Dialogs
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; file: RentalFile | null }>({
    open: false,
    file: null,
  })
  const [requestInfoDialog, setRequestInfoDialog] = useState<{ open: boolean; file: RentalFile | null }>({
    open: false,
    file: null,
  })
  const [onHoldDialog, setOnHoldDialog] = useState<{ open: boolean; file: RentalFile | null }>({
    open: false,
    file: null,
  })
  const [dialogComment, setDialogComment] = useState('')

  // Document preview
  const [previewDoc, setPreviewDoc] = useState<{
    open: boolean
    url: string
    name: string
    type?: string
  }>({ open: false, url: '', name: '' })

  // ─── Fetch ──────────────────────────────────────────────────────────────

  const fetchData = useCallback(async (skipCache?: boolean) => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (search.trim()) params.set('search', search.trim())
      if (priorityFilter !== 'ALL') params.set('priority', priorityFilter)
      if (onHoldFilter === 'onHold') params.set('onHold', 'true')
      else if (onHoldFilter === 'active') params.set('onHold', 'false')
      if (overdueOnly) params.set('overdue', 'true')
      params.set('limit', '50')

      const qs = params.toString()
      const url = `/api/tc/rental-files${qs ? `?${qs}` : ''}`

      const data = await authFetch<ApiResponse>(url, skipCache ? { skipCache: true } : undefined)
      setFiles(data.files || [])
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) {
        setFiles([])
        return
      }
      setFiles([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, statusFilter, search, priorityFilter, onHoldFilter, overdueOnly])

  // ─── Realtime subscription (TC watches all files) ──────────────
  useRealtimeRentalFiles({
    userId: user?.id,
    watchAll: true,
    onRentalFileChange: () => { fetchData(true) },
  })

  const {
    paginatedItems: pagedFiles,
    page: filesPage,
    totalPages: filesTotalPages,
    total: filesTotal,
    pageSize: filesPageSize,
    setPage: setFilesPage,
  } = usePagination({
    items: files,
    pageSize: 10,
    resetSignal: `${statusFilter}|${search}|${priorityFilter}|${onHoldFilter}|${overdueOnly}`,
  })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData()
  }, [fetchData])

  // ─── Actions ────────────────────────────────────────────────────────────

  const handleAction = useCallback(
    async (fileId: string, action: 'APPROVE' | 'REJECT' | 'REQUEST_INFO', comment?: string) => {
      setActionLoading(fileId)
      try {
        await authFetch('/api/tc/rental-files', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileIds: [fileId], action, comment: comment || '' }),
        })
        toast.success(
          action === 'APPROVE'
            ? 'Dossier validé avec succès !'
            : action === 'REJECT'
              ? 'Dossier rejeté.'
              : 'Demande d\'information envoyée.'
        )
        await fetchData(true)
      } catch (err) {
        if (err instanceof AuthError) {
          toast.error(err.message)
        } else {
          toast.error('Erreur lors de l\'action.')
        }
      } finally {
        setActionLoading(null)
      }
    },
    [fetchData]
  )

  const handleValidate = useCallback(
    (fileId: string) => handleAction(fileId, 'APPROVE'),
    [handleAction]
  )

  const handleRejectConfirm = useCallback(() => {
    if (rejectDialog.file) {
      handleAction(rejectDialog.file.id, 'REJECT', dialogComment)
      setRejectDialog({ open: false, file: null })
      setDialogComment('')
    }
  }, [rejectDialog.file, dialogComment, handleAction])

  const handleRequestInfoConfirm = useCallback(() => {
    if (requestInfoDialog.file) {
      handleAction(requestInfoDialog.file.id, 'REQUEST_INFO', dialogComment)
      setRequestInfoDialog({ open: false, file: null })
      setDialogComment('')
    }
  }, [requestInfoDialog.file, dialogComment, handleAction])

  const handlePriorityChange = async (fileId: string, priority: DossierPriority) => {
    try {
      await authFetch('/api/tc/rental-files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: fileId, priority }),
      })
      toast.success(`Priorité mise à jour : ${priorityLabels[priority]}`)
      await fetchData(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const handleOnHold = async () => {
    if (!onHoldDialog.file) return
    setActionLoading(onHoldDialog.file.id)
    try {
      await authFetch('/api/tc/rental-files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: onHoldDialog.file.id,
          onHold: true,
          onHoldReason: dialogComment.trim(),
        }),
      })
      toast.success('Dossier mis en attente')
      setOnHoldDialog({ open: false, file: null })
      setDialogComment('')
      await fetchData(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setActionLoading(null)
    }
  }

  const handleResume = async (fileId: string) => {
    try {
      await authFetch('/api/tc/rental-files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: fileId, onHold: false }),
      })
      toast.success('Dossier repris')
      await fetchData(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
  }

  // ─── Toggle expand ─────────────────────────────────────────────────────

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ─── Detail navigation ────────────────────────────────────────────────

  const handleViewDetail = (fileId: string) => {
    setSelectedItemId(fileId)
    setDashboardSection('rental-file-detail')
  }

  // ─── Document preview ──────────────────────────────────────────────────

  const openDocPreview = (doc: RentalFile['documents'][0]) => {
    setPreviewDoc({ open: true, url: doc.url, name: doc.name, type: doc.type })
  }

  // ─── Loading skeleton ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
{showHeaderAndStats && (
        <>
      {/* Header */}
      <Card className="border-border bg-gradient-to-r from-brand-500/10 to-transparent">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-brand-100">
                <ClipboardCheck className="size-6 text-brand-600" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">Dossiers à valider</h1>
                <p className="text-muted-foreground text-sm">File d&apos;attente des dossiers locatifs — validez, rejetez ou demandez des informations</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 border text-[10px]">
                    <ClipboardCheck className="size-3 mr-0.5" /> {files.length} dossier{files.length !== 1 ? 's' : ''}
                  </Badge>
                  <Badge className="bg-red-50 text-red-700 border-red-200 border text-[10px]">
                    <Flame className="size-3 mr-0.5" /> {files.filter(f => f.priority === 'URGENT').length} urgent{files.filter(f => f.priority === 'URGENT').length !== 1 ? 's' : ''}
                  </Badge>
                  <Badge className="bg-slate-50 text-slate-700 border-slate-200 border text-[10px]">
                    <Pause className="size-3 mr-0.5" /> {files.filter(f => f.onHold).length} en attente
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card
          className={cn('border-border cursor-pointer transition-all hover:shadow-sm', statusFilter === 'ALL' && 'ring-1 ring-brand-400 bg-brand-50/20')}
          onClick={() => setStatusFilter('ALL')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50">
                <ClipboardCheck className="size-5 text-brand-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">{files.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn('border-border cursor-pointer transition-all hover:shadow-sm', statusFilter === 'SUBMITTED' && 'ring-1 ring-amber-400 bg-amber-50/20')}
          onClick={() => setStatusFilter(statusFilter === 'SUBMITTED' ? 'ALL' : 'SUBMITTED')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50">
                <FileText className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-amber-600">{files.filter(f => f.status === 'SUBMITTED').length}</p>
                <p className="text-xs text-muted-foreground">Soumis</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn('border-border cursor-pointer transition-all hover:shadow-sm', statusFilter === 'TC_REVIEW' && 'ring-1 ring-orange-400 bg-orange-50/20')}
          onClick={() => setStatusFilter(statusFilter === 'TC_REVIEW' ? 'ALL' : 'TC_REVIEW')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-orange-50">
                <Eye className="size-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-orange-600">{files.filter(f => f.status === 'TC_REVIEW').length}</p>
                <p className="text-xs text-muted-foreground">En revue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn('border-border cursor-pointer transition-all hover:shadow-sm', statusFilter === 'VALIDATED' && 'ring-1 ring-green-400 bg-green-50/20')}
          onClick={() => setStatusFilter(statusFilter === 'VALIDATED' ? 'ALL' : 'VALIDATED')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-green-50">
                <Check className="size-5 text-green-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-green-600">{files.filter(f => f.status === 'VALIDATED').length}</p>
                <p className="text-xs text-muted-foreground">Validés</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
        </>
      )}

      {/* Toolbar: Search + Status Filters + View Toggle */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 min-w-0 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un locataire..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Status filter pills with icons */}
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant={statusFilter === 'ALL' ? 'default' : 'outline'}
              className={cn(
                'gap-1.5',
                statusFilter === 'ALL'
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  : 'hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200'
              )}
              onClick={() => setStatusFilter('ALL')}
            >
              <ClipboardCheck className="size-3.5" />
              Tous
            </Button>
            {filterableStatuses.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? 'default' : 'outline'}
                className={cn(
                  'gap-1.5',
                  statusFilter === s
                    ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                    : 'hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200'
                )}
                onClick={() => setStatusFilter(s)}
              >
                {s === 'SUBMITTED' && <FileText className="size-3.5" />}
                {s === 'TC_REVIEW' && <Eye className="size-3.5" />}
                {s === 'VALIDATED' && <Check className="size-3.5" />}
                {s === 'REJECTED' && <X className="size-3.5" />}
                {statusLabels[s]}
              </Button>
            ))}
          </div>
        </div>

        {/* View mode toggle */}
        <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
      </div>

      {/* Priority + OnHold + Overdue Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        {/* Priority filter */}
        <Button
          size="sm"
          variant={priorityFilter === 'ALL' ? 'secondary' : 'ghost'}
          className={priorityFilter === 'ALL' ? 'bg-muted' : ''}
          onClick={() => setPriorityFilter('ALL')}
        >
          Toutes priorités
        </Button>
        {(['NORMAL', 'HIGH', 'URGENT'] as DossierPriority[]).map((p) => {
          const PIcon = priorityIcons[p]
          return (
            <Button
              key={p}
              size="sm"
              variant={priorityFilter === p ? 'secondary' : 'ghost'}
              className={cn('gap-1.5', priorityFilter === p && priorityColors[p])}
              onClick={() => setPriorityFilter(p)}
            >
              <PIcon className="size-3.5" />
              {priorityLabels[p]}
            </Button>
          )
        })}

        <div className="border-l border-border mx-1" />

        {/* OnHold filter */}
        <Button
          size="sm"
          variant={onHoldFilter === 'active' ? 'secondary' : 'ghost'}
          className={onHoldFilter === 'active' ? 'bg-muted' : ''}
          onClick={() => setOnHoldFilter('active')}
        >
          En cours
        </Button>
        <Button
          size="sm"
          variant={onHoldFilter === 'onHold' ? 'secondary' : 'ghost'}
          className={cn('gap-1.5', onHoldFilter === 'onHold' && 'bg-amber-100 text-amber-700')}
          onClick={() => setOnHoldFilter('onHold')}
        >
          <Pause className="size-3.5" /> En attente
        </Button>
        <Button
          size="sm"
          variant={onHoldFilter === 'all' ? 'secondary' : 'ghost'}
          className={onHoldFilter === 'all' ? 'bg-muted' : ''}
          onClick={() => setOnHoldFilter('all')}
        >
          Tous
        </Button>

        <div className="border-l border-border mx-1" />

        {/* Overdue filter */}
        <Button
          size="sm"
          variant={overdueOnly ? 'destructive' : 'ghost'}
          className={cn('gap-1.5', overdueOnly && 'bg-red-600 hover:bg-red-700 text-white')}
          onClick={() => setOverdueOnly(!overdueOnly)}
        >
          <AlertTriangle className="size-3.5" /> En retard
        </Button>
      </div>

      {/* Empty state */}
      {files.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <ClipboardCheck className="size-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">Aucun dossier en attente</p>
          </CardContent>
        </Card>
      ) : viewMode === 'card' ? (
        /* ─── Card View ──────────────────────────────────────────────── */
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          <AnimatePresence mode="popLayout" initial={false} key={`page-${filesPage}`}>
            {pagedFiles.map((rf) => (
              <motion.div
                key={rf.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <Card className={cn(
                  'border-border hover:shadow-md transition-shadow',
                  rf.onHold && 'border-amber-200 bg-amber-50/20',
                  rf.sla?.isOverdue && 'border-red-200 bg-red-50/20',
                  rf.priority === 'URGENT' && !rf.onHold && !rf.sla?.isOverdue && 'border-red-100'
                )}>
                  <CardContent className="p-4 sm:p-6">
                    {/* Tenant info row + badges */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-10 rounded-full bg-brand-500/10 flex items-center justify-center shrink-0">
                          <User className="size-5 text-brand-500" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-foreground truncate">
                            {rf.tenant.firstName} {rf.tenant.lastName}
                          </h3>
                          <p className="text-sm text-muted-foreground truncate">{rf.tenant.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge className={statusColors[rf.status]}>{statusLabels[rf.status]}</Badge>
                        <PriorityBadge priority={rf.priority} />
                        {rf.onHold && (
                          <Badge className="bg-amber-100 text-amber-700 gap-1 text-xs">
                            <Pause className="size-3" /> En attente
                          </Badge>
                        )}
                        {rf.sla?.isOverdue && (
                          <Badge className="bg-red-100 text-red-700 gap-1 text-xs">
                            <AlertTriangle className="size-3" /> En retard
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* On hold reason */}
                    {rf.onHold && rf.onHoldReason && (
                      <div className="text-xs bg-amber-50 text-amber-700 p-2 rounded-lg mb-3">
                        <span className="font-medium">Raison :</span> {rf.onHoldReason}
                      </div>
                    )}

                    {/* Overdue SLA info */}
                    {rf.sla?.isOverdue && (
                      <div className="text-xs bg-red-50 text-red-700 p-2 rounded-lg mb-3 flex items-center gap-1">
                        <AlertTriangle className="size-3 shrink-0" />
                        <span>SLA dépassé — Date limite : {new Date(rf.sla.deadlineAt).toLocaleDateString('fr-FR')}</span>
                      </div>
                    )}

                    {/* View detail button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-brand-500 hover:text-brand-600 hover:bg-brand-50 gap-1 mb-2 text-xs"
                      onClick={() => handleViewDetail(rf.id)}
                    >
                      <Eye className="size-3.5" /> Voir le dossier complet
                    </Button>

                    {/* Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground mb-3">
                      {rf.monthlyIncome != null && (
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground">
                            {rf.monthlyIncome.toLocaleString('fr-FR')} FCFA
                          </span>
                        </div>
                      )}
                      {rf.employer && (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="size-3.5 shrink-0" />
                          <span className="truncate">{rf.employer}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <FileCheck className="size-3.5 shrink-0" />
                        <span>{rf.documents.length} document{rf.documents.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="size-3.5 shrink-0" />
                        <span>{new Date(rf.createdAt).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>

                    {/* Expandable Documents section */}
                    <Collapsible
                      open={expandedIds.has(rf.id)}
                      onOpenChange={() => toggleExpand(rf.id)}
                    >
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-between mb-1 text-muted-foreground hover:text-foreground"
                        >
                          <span className="text-sm font-medium">Documents</span>
                          {expandedIds.has(rf.id) ? (
                            <ChevronUp className="size-4" />
                          ) : (
                            <ChevronDown className="size-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="space-y-2 mb-3">
                          {rf.documents.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-2 text-center">Aucun document</p>
                          ) : (
                            rf.documents.map((doc) => (
                              <div
                                key={doc.id}
                                className="flex items-center justify-between p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                              >
                                <button
                                  type="button"
                                  className="flex items-center gap-2 min-w-0 flex-1 text-left hover:underline"
                                  onClick={() => openDocPreview(doc)}
                                >
                                  <FileText className="size-4 text-brand-500 shrink-0" />
                                  <span className="text-sm text-foreground truncate">{doc.name}</span>
                                  <Eye className="size-3.5 text-muted-foreground shrink-0" />
                                </button>
                                <Badge className={docStatusColors[doc.status]}>
                                  {docStatusLabels[doc.status]}
                                </Badge>
                              </div>
                            ))
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Action buttons */}
                    {(rf.status === 'SUBMITTED' || rf.status === 'TC_REVIEW') && !rf.onHold && (
                      <div className="flex gap-2 pt-2 border-t border-border flex-wrap">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white gap-1 flex-1"
                          disabled={actionLoading === rf.id}
                          onClick={() => handleValidate(rf.id)}
                        >
                          <Check className="size-4" /> Valider
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-orange-600 border-orange-200 hover:bg-orange-50 gap-1 flex-1"
                          disabled={actionLoading === rf.id}
                          onClick={() => {
                            setDialogComment('')
                            setRequestInfoDialog({ open: true, file: rf })
                          }}
                        >
                          <MessageSquare className="size-4" /> Info
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50 gap-1 flex-1"
                          disabled={actionLoading === rf.id}
                          onClick={() => {
                            setDialogComment('')
                            setRejectDialog({ open: true, file: rf })
                          }}
                        >
                          <X className="size-4" /> Rejeter
                        </Button>
                      </div>
                    )}

                    {/* On Hold / Resume / Priority actions */}
                    <div className="flex gap-2 pt-2 flex-wrap">
                      {(rf.status === 'SUBMITTED' || rf.status === 'TC_REVIEW') && !rf.onHold && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 gap-1"
                          onClick={() => {
                            setDialogComment('')
                            setOnHoldDialog({ open: true, file: rf })
                          }}
                        >
                          <Pause className="size-3.5" /> Mettre en attente
                        </Button>
                      )}
                      {rf.onHold && (
                        <Button
                          size="sm"
                          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1"
                          onClick={() => handleResume(rf.id)}
                        >
                          <Play className="size-3.5" /> Reprendre
                        </Button>
                      )}
                      {/* Priority dropdown */}
                      <Select
                        value={rf.priority}
                        onValueChange={(v) => handlePriorityChange(rf.id, v as DossierPriority)}
                      >
                        <SelectTrigger className="h-7 text-xs w-auto border-0 bg-muted/50 px-2 gap-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NORMAL">
                            <span className="flex items-center gap-1.5"><CircleDot className="size-3" /> Normale</span>
                          </SelectItem>
                          <SelectItem value="HIGH">
                            <span className="flex items-center gap-1.5"><AlertTriangle className="size-3" /> Haute</span>
                          </SelectItem>
                          <SelectItem value="URGENT">
                            <span className="flex items-center gap-1.5"><Flame className="size-3" /> Urgente</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Rejection reason display */}
                    {rf.rejectionReason && (
                      <div className="mt-3 p-2 rounded-lg bg-red-50 text-sm text-red-700">
                        <span className="font-medium">Motif de rejet :</span> {rf.rejectionReason}
                      </div>
                    )}

                    {/* TC comment display */}
                    {rf.tcComment && (
                      <div className="mt-2 p-2 rounded-lg bg-brand-500/5 text-sm text-foreground">
                        <span className="font-medium">Commentaire TC :</span> {rf.tcComment}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
          <PaginationControls
            page={filesPage}
            totalPages={filesTotalPages}
            total={filesTotal}
            limit={filesPageSize}
            onPageChange={setFilesPage}
          />
        </div>
      ) : (
        /* ─── List View ──────────────────────────────────────────────── */
        <Card className="border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left font-medium text-muted-foreground p-3">Locataire</th>
                  <th className="text-center font-medium text-muted-foreground p-3 hidden md:table-cell">Priorité</th>
                  <th className="text-left font-medium text-muted-foreground p-3 hidden lg:table-cell">Revenus</th>
                  <th className="text-center font-medium text-muted-foreground p-3">Docs</th>
                  <th className="text-center font-medium text-muted-foreground p-3">Statut</th>
                  <th className="text-left font-medium text-muted-foreground p-3 hidden sm:table-cell">Date</th>
                  <th className="text-right font-medium text-muted-foreground p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout" initial={false} key={`page-${filesPage}`}>
                  {pagedFiles.map((rf) => (
                    <motion.tr
                      key={rf.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className={cn(
                        'border-b border-border hover:bg-muted/30 transition-colors',
                        rf.onHold && 'bg-amber-50/30',
                        rf.sla?.isOverdue && 'bg-red-50/30'
                      )}
                    >
                      {/* Tenant */}
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="size-8 rounded-full bg-brand-500/10 flex items-center justify-center shrink-0">
                            <User className="size-4 text-brand-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {rf.tenant.firstName} {rf.tenant.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{rf.tenant.email}</p>
                            <div className="flex gap-1 mt-0.5">
                              {rf.onHold && (
                                <Badge className="bg-amber-100 text-amber-700 text-[10px] px-1 py-0">
                                  <Pause className="size-2.5" /> Attente
                                </Badge>
                              )}
                              {rf.sla?.isOverdue && (
                                <Badge className="bg-red-100 text-red-700 text-[10px] px-1 py-0">
                                  <AlertTriangle className="size-2.5" /> Retard
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="p-3 text-center hidden md:table-cell">
                        <PriorityBadge priority={rf.priority} />
                      </td>

                      {/* Income */}
                      <td className="p-3 hidden lg:table-cell">
                        {rf.monthlyIncome != null
                          ? `${rf.monthlyIncome.toLocaleString('fr-FR')} FCFA`
                          : '—'}
                      </td>

                      {/* Documents */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <FileText className="size-3.5 text-muted-foreground" />
                          <span>{rf.documents.length}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-3 text-center">
                        <Badge className={statusColors[rf.status]}>{statusLabels[rf.status]}</Badge>
                      </td>

                      {/* Date */}
                      <td className="p-3 hidden sm:table-cell text-muted-foreground">
                        {new Date(rf.createdAt).toLocaleDateString('fr-FR')}
                      </td>

                      {/* Actions */}
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-brand-500 hover:text-brand-600 hover:bg-brand-50 h-8 w-8 p-0"
                            onClick={() => handleViewDetail(rf.id)}
                            title="Voir le dossier"
                          >
                            <Eye className="size-4" />
                          </Button>
                          {(rf.status === 'SUBMITTED' || rf.status === 'TC_REVIEW') && !rf.onHold && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50 h-8 w-8 p-0"
                                disabled={actionLoading === rf.id}
                                onClick={() => handleValidate(rf.id)}
                                title="Valider"
                              >
                                <Check className="size-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 h-8 w-8 p-0"
                                disabled={actionLoading === rf.id}
                                onClick={() => {
                                  setDialogComment('')
                                  setRequestInfoDialog({ open: true, file: rf })
                                }}
                                title="Demander des informations"
                              >
                                <MessageSquare className="size-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                                disabled={actionLoading === rf.id}
                                onClick={() => {
                                  setDialogComment('')
                                  setRejectDialog({ open: true, file: rf })
                                }}
                                title="Rejeter"
                              >
                                <X className="size-4" />
                              </Button>
                            </>
                          )}
                          {rf.onHold && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-brand-500 hover:text-brand-600 hover:bg-brand-50 h-8 px-2"
                              onClick={() => handleResume(rf.id)}
                              title="Reprendre"
                            >
                              <Play className="size-4" />
                            </Button>
                          )}
                          {!rf.onHold && (rf.status === 'SUBMITTED' || rf.status === 'TC_REVIEW') && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-amber-600 hover:text-amber-700 h-8 w-8 p-0"
                              onClick={() => {
                                setDialogComment('')
                                setOnHoldDialog({ open: true, file: rf })
                              }}
                              title="Mettre en attente"
                            >
                              <Pause className="size-4" />
                            </Button>
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
              page={filesPage}
              totalPages={filesTotalPages}
              total={filesTotal}
              limit={filesPageSize}
              onPageChange={setFilesPage}
            />
          </div>
        </Card>
      )}

      {/* ─── Reject Dialog ──────────────────────────────────────────────── */}
      <Dialog
        open={rejectDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setRejectDialog({ open: false, file: null })
            setDialogComment('')
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="sr-only">Rejeter le dossier</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {rejectDialog.file && (
              <p className="text-sm text-muted-foreground">
                Vous allez rejeter le dossier de{' '}
                <span className="font-semibold text-foreground">
                  {rejectDialog.file.tenant.firstName} {rejectDialog.file.tenant.lastName}
                </span>
                . Veuillez indiquer le motif du rejet.
              </p>
            )}
            <Textarea
              placeholder="Motif du rejet..."
              value={dialogComment}
              onChange={(e) => setDialogComment(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialog({ open: false, file: null })
                setDialogComment('')
              }}
            >
              Annuler
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={!dialogComment.trim()}
              onClick={handleRejectConfirm}
            >
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Request Info Dialog ────────────────────────────────────────── */}
      <Dialog
        open={requestInfoDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setRequestInfoDialog({ open: false, file: null })
            setDialogComment('')
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="sr-only">Demander des informations</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {requestInfoDialog.file && (
              <p className="text-sm text-muted-foreground">
                Vous allez demander des informations complémentaires pour le dossier de{' '}
                <span className="font-semibold text-foreground">
                  {requestInfoDialog.file.tenant.firstName} {requestInfoDialog.file.tenant.lastName}
                </span>
                . Précisez ce qui est attendu.
              </p>
            )}
            <Textarea
              placeholder="Informations ou documents attendus..."
              value={dialogComment}
              onChange={(e) => setDialogComment(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRequestInfoDialog({ open: false, file: null })
                setDialogComment('')
              }}
            >
              Annuler
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={!dialogComment.trim()}
              onClick={handleRequestInfoConfirm}
            >
              Envoyer la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── On Hold Dialog ──────────────────────────────────────────────── */}
      <Dialog
        open={onHoldDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setOnHoldDialog({ open: false, file: null })
            setDialogComment('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mettre le dossier en attente</DialogTitle>
            <DialogDescription>
              Le dossier sera suspendu jusqu&apos;à reprise. Indiquez la raison si nécessaire.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {onHoldDialog.file && (
              <p className="text-sm text-muted-foreground">
                Dossier de{' '}
                <span className="font-semibold text-foreground">
                  {onHoldDialog.file.tenant.firstName} {onHoldDialog.file.tenant.lastName}
                </span>
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="onHoldReason">Raison (optionnel)</Label>
              <Textarea
                id="onHoldReason"
                placeholder="Raison de la mise en attente..."
                value={dialogComment}
                onChange={(e) => setDialogComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setOnHoldDialog({ open: false, file: null })
                setDialogComment('')
              }}
            >
              Annuler
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleOnHold}
              disabled={actionLoading !== null}
            >
              {actionLoading !== null && <Loader2 className="size-4 animate-spin mr-2" />}
              Mettre en attente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Document Preview Dialog ────────────────────────────────────── */}
      <DocumentPreviewDialog
        open={previewDoc.open}
        onOpenChange={(open) => setPreviewDoc((prev) => ({ ...prev, open }))}
        document={{ url: previewDoc.url, name: previewDoc.name, type: previewDoc.type }}
      />
    </motion.div>
  )
}
