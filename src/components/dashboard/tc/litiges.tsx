'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle, Search, Eye, User, FileText, Clock, ShieldCheck,
  CheckCircle2, XCircle, Loader2, HandMetal, Scale, AlertOctagon, CircleDot, Calendar,
  ArrowUpRight, Paperclip, MessageSquare, Flame, ChevronDown, Link2, ChevronsUpDown, Check,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { usePagination } from '@/hooks/use-pagination'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { useAuthStore } from '@/lib/auth-store'
import { useRealtimeDisputes } from '@/hooks/use-realtime-disputes'
import { ViewModeToggle, type ViewMode } from './view-mode-toggle'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useInAppBrowser } from '@/hooks/capacitor'

// ─── Types ──────────────────────────────────────────────────────────────────

type DisputeType = 'UNPAID_RENT' | 'PROPERTY_DAMAGE' | 'HARASSMENT' | 'FRAUD' | 'OTHER'
type DisputeStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED'
type DossierPriority = 'NORMAL' | 'HIGH' | 'URGENT'

interface Dispute {
  id: string
  type: DisputeType
  description: string
  status: DisputeStatus
  priority: DossierPriority
  tcComment: string | null
  resolution: string | null
  investigationNotes: string | null
  evidenceUrls: string
  isEscalated: boolean
  escalatedAt: string | null
  escalationReason: string | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  lease: {
    id: string
    startDate: string
    endDate: string
    monthlyRent: number
    property: {
      id: string
      title: string
      address: string
      commune: string
      city: string
    }
    tenant: {
      id: string
      firstName: string
      lastName: string
      email: string
    }
    owner: {
      id: string
      firstName: string
      lastName: string
      email: string
    }
  } | null
  reporter: {
    id: string
    firstName: string
    lastName: string
    email: string
    role: string
  } | null
  handler: {
    id: string
    firstName: string
    lastName: string
    email: string
    role: string
  } | null
}

// ─── Labels & Colors ────────────────────────────────────────────────────────

const typeLabels: Record<DisputeType, string> = {
  UNPAID_RENT: 'Loyer impayé',
  PROPERTY_DAMAGE: 'Dégât matériel',
  HARASSMENT: 'Harcèlement',
  FRAUD: 'Fraude',
  OTHER: 'Autre',
}

const typeBadgeColors: Record<DisputeType, string> = {
  UNPAID_RENT: 'bg-red-100 text-red-700',
  PROPERTY_DAMAGE: 'bg-orange-100 text-orange-700',
  HARASSMENT: 'bg-rose-100 text-rose-700',
  FRAUD: 'bg-red-100 text-red-700',
  OTHER: 'bg-gray-100 text-gray-600',
}

const typeIcons: Record<DisputeType, React.ElementType> = {
  UNPAID_RENT: AlertOctagon,
  PROPERTY_DAMAGE: AlertTriangle,
  HARASSMENT: HandMetal,
  FRAUD: Scale,
  OTHER: CircleDot,
}

const typeIconColors: Record<DisputeType, { bg: string; text: string }> = {
  UNPAID_RENT: { bg: 'bg-red-50', text: 'text-red-600' },
  PROPERTY_DAMAGE: { bg: 'bg-orange-50', text: 'text-orange-600' },
  HARASSMENT: { bg: 'bg-rose-50', text: 'text-rose-600' },
  FRAUD: { bg: 'bg-red-50', text: 'text-red-600' },
  OTHER: { bg: 'bg-gray-50', text: 'text-gray-600' },
}

const statusLabels: Record<DisputeStatus, string> = {
  OPEN: 'Ouvert',
  IN_REVIEW: 'En cours',
  RESOLVED: 'Résolu',
  CLOSED: 'Fermé',
}

const statusColors: Record<DisputeStatus, string> = {
  OPEN: 'bg-red-100 text-red-700',
  IN_REVIEW: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-500',
}

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

// ─── Priority Badge Component ───────────────────────────────────────────────

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

export function LitigesManagement() {
  const { isAuthenticated, setDashboardSection, user, selectedItemId, setSelectedItemId } = useAuthStore()

  // Data
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [resolvedDisputes, setResolvedDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // View
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [activeTab, setActiveTab] = useState<string>('active')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<DisputeStatus | 'ALL' | 'ESCALATED'>('ALL')
  const [typeFilter, setTypeFilter] = useState<DisputeType | 'ALL'>('ALL')
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false)
  const [priorityFilter, setPriorityFilter] = useState<DossierPriority | 'ALL'>('ALL')

  // Dialogs
  const [detailDialog, setDetailDialog] = useState<{ open: boolean; dispute: Dispute | null }>({
    open: false, dispute: null,
  })
  const [resolveDialog, setResolveDialog] = useState<{ open: boolean; dispute: Dispute | null }>({
    open: false, dispute: null,
  })
  const [escalateDialog, setEscalateDialog] = useState<{ open: boolean; dispute: Dispute | null }>({
    open: false, dispute: null,
  })
  const [resolutionComment, setResolutionComment] = useState('')
  const [escalationReason, setEscalationReason] = useState('')

  // Investigation notes editing
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')

  const { openInWebView } = useInAppBrowser()

  // Evidence URL input
  const [newEvidenceUrl, setNewEvidenceUrl] = useState('')

  // ─── Fetch ──────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    try {
      const [activeData, resolvedData] = await Promise.all([
        authFetch<Dispute[]>('/api/tc/litiges'),
        authFetch<Dispute[]>('/api/tc/litiges?resolved=true'),
      ])
      setDisputes(Array.isArray(activeData) ? activeData : [])
      setResolvedDisputes(Array.isArray(resolvedData) ? resolvedData : [])
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) {
        setDisputes([])
        setResolvedDisputes([])
        return
      }
      setDisputes([])
      setResolvedDisputes([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  // ─── Realtime subscription (TC watches all disputes) ────────────
  useRealtimeDisputes({
    userId: user?.id,
    watchAll: true,
    onDisputeChange: () => { fetchData() },
  })

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-navigate to dispute detail when selectedItemId matches
  useEffect(() => {
    if (!selectedItemId || disputes.length === 0) return
    const match = disputes.find(d => d.id === selectedItemId)
    if (!match) return
    setSelectedItemId('')
    setDetailDialog({ open: true, dispute: match })
  }, [selectedItemId, disputes, setSelectedItemId])

  // ─── Stats ─────────────────────────────────────────────────────────────

  const openCount = disputes.filter((d) => d.status === 'OPEN').length
  const inReviewCount = disputes.filter((d) => d.status === 'IN_REVIEW').length
  const resolvedCount = disputes.filter((d) => d.status === 'RESOLVED').length
  const escalatedCount = disputes.filter((d) => d.isEscalated).length
  const totalCount = disputes.length + resolvedDisputes.length

  // ─── Filtered disputes ────────────────────────────────────────────────

  const currentList = activeTab === 'resolved' ? resolvedDisputes : disputes

  const filteredDisputes = currentList.filter((d) => {
    if (statusFilter !== 'ALL' && statusFilter !== 'ESCALATED' && d.status !== statusFilter) return false
    if (statusFilter === 'ESCALATED' && !d.isEscalated) return false
    if (typeFilter !== 'ALL' && d.type !== typeFilter) return false
    if (priorityFilter !== 'ALL' && d.priority !== priorityFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        d.description.toLowerCase().includes(q) ||
        typeLabels[d.type].toLowerCase().includes(q) ||
        (d.lease?.property.title.toLowerCase().includes(q)) ||
        (d.reporter && `${d.reporter.firstName} ${d.reporter.lastName}`.toLowerCase().includes(q))
      )
    }
    return true
  })

  const {
    paginatedItems: pagedDisputes,
    page: disputesPage,
    totalPages: disputesTotalPages,
    total: disputesTotal,
    pageSize: disputesPageSize,
    setPage: setDisputesPage,
  } = usePagination({
    items: filteredDisputes,
    pageSize: 10,
    resetSignal: `${activeTab}|${search}|${statusFilter}|${typeFilter}|${priorityFilter}`,
  })

  // ─── Actions ───────────────────────────────────────────────────────────

  const handleTakeCharge = async (disputeId: string) => {
    setActionLoading(disputeId)
    try {
      await authFetch('/api/tc/litiges', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: disputeId, status: 'IN_REVIEW' }),
      })
      toast.success('Litige pris en charge !')
      await fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setActionLoading(null)
    }
  }

  const handleResolve = async () => {
    if (!resolveDialog.dispute) return
    setActionLoading(resolveDialog.dispute.id)
    try {
      await authFetch('/api/tc/litiges', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: resolveDialog.dispute.id,
          status: 'RESOLVED',
          resolution: resolutionComment,
        }),
      })
      toast.success('Litige résolu !')
      setResolveDialog({ open: false, dispute: null })
      setResolutionComment('')
      await fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setActionLoading(null)
    }
  }

  const handleClose = async (disputeId: string) => {
    setActionLoading(disputeId)
    try {
      await authFetch('/api/tc/litiges', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: disputeId, status: 'CLOSED' }),
      })
      toast.success('Litige fermé')
      await fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setActionLoading(null)
    }
  }

  const handlePriorityChange = async (disputeId: string, priority: DossierPriority) => {
    try {
      await authFetch('/api/tc/litiges', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: disputeId, priority }),
      })
      toast.success(`Priorité mise à jour : ${priorityLabels[priority]}`)
      await fetchData()
      // Update detail dialog if open
      setDetailDialog((prev) => {
        if (prev.dispute?.id === disputeId) {
          return { ...prev, dispute: { ...prev.dispute, priority } as Dispute }
        }
        return prev
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const handleEscalate = async () => {
    if (!escalateDialog.dispute) return
    setActionLoading(escalateDialog.dispute.id)
    try {
      await authFetch('/api/tc/litiges', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: escalateDialog.dispute.id,
          isEscalated: true,
          escalationReason: escalationReason.trim(),
        }),
      })
      toast.success('Litige escaladé !')
      setEscalateDialog({ open: false, dispute: null })
      setEscalationReason('')
      await fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setActionLoading(null)
    }
  }

  const handleSaveInvestigationNotes = async () => {
    if (!detailDialog.dispute) return
    setActionLoading(detailDialog.dispute.id)
    try {
      await authFetch('/api/tc/litiges', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: detailDialog.dispute.id,
          investigationNotes: notesValue,
        }),
      })
      toast.success('Notes d\'investigation sauvegardées !')
      setEditingNotes(false)
      await fetchData()
      setDetailDialog((prev) => {
        if (prev.dispute) {
          return { ...prev, dispute: { ...prev.dispute, investigationNotes: notesValue } as Dispute }
        }
        return prev
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setActionLoading(null)
    }
  }

  const handleAddEvidence = async () => {
    if (!detailDialog.dispute || !newEvidenceUrl.trim()) return
    setActionLoading(detailDialog.dispute.id)
    try {
      await authFetch('/api/tc/litiges', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: detailDialog.dispute.id,
          evidenceUrls: [newEvidenceUrl.trim()],
        }),
      })
      toast.success('Preuve ajoutée !')
      const oldUrls: string[] = JSON.parse(detailDialog.dispute.evidenceUrls || '[]')
      const updatedUrls = [...oldUrls, newEvidenceUrl.trim()]
      setNewEvidenceUrl('')
      setDetailDialog((prev) => {
        if (prev.dispute) {
          return { ...prev, dispute: { ...prev.dispute, evidenceUrls: JSON.stringify(updatedUrls) } as Dispute }
        }
        return prev
      })
      await fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setActionLoading(null)
    }
  }

  // ─── Action button by status ──────────────────────────────────────────

  const getActionButton = (dispute: Dispute) => {
    switch (dispute.status) {
      case 'OPEN':
        return (
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1"
            onClick={(e) => { e.stopPropagation(); handleTakeCharge(dispute.id) }}
            disabled={actionLoading === dispute.id}
          >
            {actionLoading === dispute.id ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="size-3.5" />
            )}
            Prendre en charge
          </Button>
        )
      case 'IN_REVIEW':
        return (
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white gap-1"
              onClick={(e) => {
                e.stopPropagation()
                setResolutionComment('')
                setResolveDialog({ open: true, dispute })
              }}
              disabled={actionLoading === dispute.id}
            >
              <CheckCircle2 className="size-3.5" />
              Résoudre
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50 gap-1"
              onClick={(e) => {
                e.stopPropagation()
                setEscalationReason('')
                setEscalateDialog({ open: true, dispute })
              }}
            >
              <ArrowUpRight className="size-3.5" />
              Escalader
            </Button>
          </div>
        )
      case 'RESOLVED':
        return (
          <Button
            size="sm"
            variant="outline"
            className="text-gray-600 border-gray-200 hover:bg-gray-50 gap-1"
            onClick={(e) => { e.stopPropagation(); handleClose(dispute.id) }}
            disabled={actionLoading === dispute.id}
          >
            {actionLoading === dispute.id ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <XCircle className="size-3.5" />
            )}
            Fermer
          </Button>
        )
      case 'CLOSED':
        return null
      default:
        return null
    }
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
      {/* Header */}
      <Card className="border-border bg-gradient-to-r from-brand-500/10 to-transparent">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-rose-100">
                <AlertTriangle className="size-6 text-rose-600" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">Gestion des litiges</h1>
                <p className="text-muted-foreground text-sm">Traitez et résolvez les litiges signalés</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge className="bg-red-50 text-red-700 border-red-200 border text-[10px]">
                    <AlertTriangle className="size-3 mr-0.5" /> {openCount} ouverts
                  </Badge>
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 border text-[10px]">
                    <Clock className="size-3 mr-0.5" /> {inReviewCount} en cours
                  </Badge>
                  <Badge className="bg-green-50 text-green-700 border-green-200 border text-[10px]">
                    <CheckCircle2 className="size-3 mr-0.5" /> {resolvedCount} résolus
                  </Badge>
                  <Badge className="bg-slate-50 text-slate-700 border-slate-200 border text-[10px]">
                    <FileText className="size-3 mr-0.5" /> {totalCount} total
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card
          className={cn('border-border cursor-pointer transition-all hover:shadow-sm', statusFilter === 'OPEN' && 'ring-1 ring-red-400 bg-red-50/20')}
          onClick={() => setStatusFilter(statusFilter === 'OPEN' ? 'ALL' : 'OPEN')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-red-50">
                <AlertTriangle className="size-5 text-red-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-red-600">{openCount}</p>
                <p className="text-xs text-muted-foreground">Ouverts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn('border-border cursor-pointer transition-all hover:shadow-sm', statusFilter === 'IN_REVIEW' && 'ring-1 ring-amber-400 bg-amber-50/20')}
          onClick={() => setStatusFilter(statusFilter === 'IN_REVIEW' ? 'ALL' : 'IN_REVIEW')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50">
                <Clock className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-amber-600">{inReviewCount}</p>
                <p className="text-xs text-muted-foreground">En cours</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn('border-border cursor-pointer transition-all hover:shadow-sm', statusFilter === 'RESOLVED' && 'ring-1 ring-green-400 bg-green-50/20')}
          onClick={() => setStatusFilter(statusFilter === 'RESOLVED' ? 'ALL' : 'RESOLVED')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-green-50">
                <CheckCircle2 className="size-5 text-green-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-green-600">{resolvedCount}</p>
                <p className="text-xs text-muted-foreground">Résolus</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn('border-border cursor-pointer transition-all hover:shadow-sm', statusFilter === 'ESCALATED' && 'ring-1 ring-rose-400 bg-rose-50/20')}
          onClick={() => setStatusFilter(statusFilter === 'ESCALATED' ? 'ALL' : 'ESCALATED')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-rose-50">
                <ArrowUpRight className="size-5 text-rose-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-rose-600">{escalatedCount}</p>
                <p className="text-xs text-muted-foreground">Escaladés</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn('border-border cursor-pointer transition-all hover:shadow-sm', statusFilter === 'ALL' && 'ring-1 ring-brand-400 bg-brand-50/20')}
          onClick={() => setStatusFilter('ALL')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50">
                <FileText className="size-5 text-brand-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">{totalCount}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Toggle: Active / Résolus */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full sm:w-auto">
            <TabsList className="bg-muted">
              <TabsTrigger value="active" className="gap-1.5">
                En cours <Badge className="bg-brand-100 text-brand-700 text-[10px] px-1.5 py-0 ml-1">{disputes.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="resolved" className="gap-1.5">
                Activité <Badge className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0 ml-1">{resolvedDisputes.length}</Badge>
              </TabsTrigger>
            </TabsList>

            {/* Search */}
            <div className="relative flex-1 min-w-0 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un litige..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap mt-3">
          {/* Status filter */}
          <Button
            size="sm"
            variant={statusFilter === 'ALL' ? 'default' : 'outline'}
            className={statusFilter === 'ALL' ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : ''}
            onClick={() => setStatusFilter('ALL')}
          >
            Tous statuts
          </Button>
          {(Object.keys(statusLabels) as DisputeStatus[]).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? 'default' : 'outline'}
              className={statusFilter === s ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : ''}
              onClick={() => setStatusFilter(s)}
            >
              {statusLabels[s]}
            </Button>
          ))}

          {/* Priority filter */}
          <div className="border-l border-border mx-1" />
          <Button
            size="sm"
            variant={priorityFilter === 'ALL' ? 'secondary' : 'ghost'}
            className={priorityFilter === 'ALL' ? 'bg-muted' : ''}
            onClick={() => setPriorityFilter('ALL')}
          >
            Toutes priorités
          </Button>
          {(Object.keys(priorityLabels) as DossierPriority[]).map((p) => {
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
        </div>

        {/* Type filter — searchable dropdown */}
        <div className="flex gap-2 flex-wrap mt-2 items-center">
          <Popover open={typeDropdownOpen} onOpenChange={setTypeDropdownOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={typeDropdownOpen}
                className="gap-1.5 text-xs justify-between min-w-[140px]"
              >
                {typeFilter === 'ALL'
                  ? 'Tous les types'
                  : typeLabels[typeFilter]
                }
                <ChevronsUpDown className="size-3.5 opacity-50 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Rechercher un type..." />
                <CommandList>
                  <CommandEmpty>Aucun type trouvé</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="Tous les types"
                      onSelect={() => {
                        setTypeFilter('ALL')
                        setTypeDropdownOpen(false)
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 size-4',
                          typeFilter === 'ALL' ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      Tous les types
                    </CommandItem>
                    {(Object.keys(typeLabels) as DisputeType[]).map((t) => (
                      <CommandItem
                        key={t}
                        value={typeLabels[t]}
                        onSelect={() => {
                          setTypeFilter(t)
                          setTypeDropdownOpen(false)
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 size-4',
                            typeFilter === t ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        {typeLabels[t]}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* ─── Dispute List ──────────────────────────────────────────── */}
        <TabsContent value="active" className="mt-4">
          {filteredDisputes.length === 0 ? (
            <Card className="border-border">
              <CardContent className="py-12 text-center">
                <ShieldCheck className="size-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">
                  {disputes.length === 0 ? 'Aucun litige signalé' : 'Aucun litige trouvé'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {disputes.length === 0
                    ? 'Les litiges signalés apparaîtront ici'
                    : 'Essayez un autre filtre ou recherche'}
                </p>
              </CardContent>
            </Card>
          ) : viewMode === 'card' ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              <AnimatePresence mode="popLayout" initial={false} key={`page-${disputesPage}-${activeTab}`}>
                {pagedDisputes.map((dispute) => {
                  const TypeIcon = typeIcons[dispute.type]
                  const iconColor = typeIconColors[dispute.type]
                  return (
                    <motion.div
                      key={dispute.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card className={cn(
                        'border-border hover:shadow-md transition-shadow',
                        dispute.isEscalated && 'border-rose-200 bg-rose-50/30',
                        dispute.priority === 'URGENT' && !dispute.isEscalated && 'border-red-200'
                      )}>
                        <CardContent className="p-4 sm:p-6">
                          {/* Header: Type icon + label + Priority + Status */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                              <div className={cn(
                                'flex size-10 items-center justify-center rounded-lg shrink-0',
                                iconColor.bg
                              )}>
                                <TypeIcon className={cn('size-5', iconColor.text)} />
                              </div>
                              <div className="min-w-0 flex flex-col gap-1">
                                <Badge className={typeBadgeColors[dispute.type]}>
                                  {typeLabels[dispute.type]}
                                </Badge>
                                <PriorityBadge priority={dispute.priority} />
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge className={statusColors[dispute.status]}>
                                {statusLabels[dispute.status]}
                              </Badge>
                              {dispute.isEscalated && (
                                <Badge className="bg-rose-100 text-rose-700 gap-1 text-xs">
                                  <ArrowUpRight className="size-3" />
                                  Escaladé
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Description */}
                          <p className="text-sm text-foreground line-clamp-2 mb-3">
                            {dispute.description}
                          </p>

                          {/* Lease info */}
                          {dispute.lease && (
                            <div className="text-xs text-muted-foreground mb-2">
                              <span className="font-medium">Bail :</span>{' '}
                              {dispute.lease.property.title} — {dispute.lease.property.commune || dispute.lease.property.city}
                            </div>
                          )}

                          {/* Reporter + handler */}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                            {dispute.reporter && (
                              <div className="flex items-center gap-1">
                                <User className="size-3 shrink-0" />
                                <span>{dispute.reporter.firstName} {dispute.reporter.lastName}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <Calendar className="size-3 shrink-0" />
                              <span>{new Date(dispute.createdAt).toLocaleDateString('fr-FR')}</span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 pt-2 border-t border-border">
                            {getActionButton(dispute)}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground hover:text-foreground gap-1 ml-auto"
                              onClick={() => setDetailDialog({ open: true, dispute })}
                            >
                              <Eye className="size-3.5" /> Détails
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
              <PaginationControls
                page={disputesPage}
                totalPages={disputesTotalPages}
                total={disputesTotal}
                limit={disputesPageSize}
                onPageChange={setDisputesPage}
                className="sm:col-span-2"
              />
            </div>
          ) : (
            /* ─── List View ────────────────────────────────────────── */
            <Card className="border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left font-medium text-muted-foreground p-3">Type</th>
                      <th className="text-left font-medium text-muted-foreground p-3">Description</th>
                      <th className="text-center font-medium text-muted-foreground p-3 hidden md:table-cell">Priorité</th>
                      <th className="text-center font-medium text-muted-foreground p-3">Statut</th>
                      <th className="text-left font-medium text-muted-foreground p-3 hidden lg:table-cell">Bail</th>
                      <th className="text-left font-medium text-muted-foreground p-3 hidden md:table-cell">Déclarant</th>
                      <th className="text-left font-medium text-muted-foreground p-3 hidden sm:table-cell">Date</th>
                      <th className="text-right font-medium text-muted-foreground p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence mode="popLayout" initial={false} key={`page-${disputesPage}-${activeTab}`}>
                      {pagedDisputes.map((dispute) => {
                        const TypeIcon = typeIcons[dispute.type]
                        const iconColor = typeIconColors[dispute.type]
                        return (
                          <motion.tr
                            key={dispute.id}
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className={cn(
                              'border-b border-border hover:bg-muted/30 transition-colors',
                              dispute.isEscalated && 'bg-rose-50/50'
                            )}
                          >
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className={cn('size-7 rounded flex items-center justify-center shrink-0', iconColor.bg)}>
                                  <TypeIcon className={cn('size-3.5', iconColor.text)} />
                                </div>
                                <span className="text-xs font-medium text-foreground whitespace-nowrap">
                                  {typeLabels[dispute.type]}
                                </span>
                              </div>
                            </td>
                            <td className="p-3">
                              <p className="text-foreground truncate max-w-[200px]">{dispute.description}</p>
                            </td>
                            <td className="p-3 text-center hidden md:table-cell">
                              <PriorityBadge priority={dispute.priority} />
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <Badge className={statusColors[dispute.status]}>
                                  {statusLabels[dispute.status]}
                                </Badge>
                                {dispute.isEscalated && (
                                  <Badge className="bg-rose-100 text-rose-700 text-[10px] px-1 py-0">
                                    Escaladé
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="p-3 hidden lg:table-cell">
                              {dispute.lease ? (
                                <span className="text-muted-foreground truncate block max-w-[150px]">
                                  {dispute.lease.property.title}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="p-3 hidden md:table-cell">
                              {dispute.reporter ? (
                                <span className="text-muted-foreground">
                                  {dispute.reporter.firstName} {dispute.reporter.lastName}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="p-3 text-muted-foreground hidden sm:table-cell">
                              {new Date(dispute.createdAt).toLocaleDateString('fr-FR')}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center justify-end gap-1">
                                {getActionButton(dispute)}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-muted-foreground hover:text-foreground h-8 w-8 p-0"
                                  onClick={() => setDetailDialog({ open: true, dispute })}
                                  title="Voir les détails"
                                >
                                  <Eye className="size-4" />
                                </Button>
                              </div>
                            </td>
                          </motion.tr>
                        )
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
              <div className="px-4 pb-3">
                <PaginationControls
                  page={disputesPage}
                  totalPages={disputesTotalPages}
                  total={disputesTotal}
                  limit={disputesPageSize}
                  onPageChange={setDisputesPage}
                />
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ─── Resolved History Tab ──────────────────────────────────── */}
        <TabsContent value="resolved" className="mt-4">
          {filteredDisputes.length === 0 ? (
            <Card className="border-border">
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="size-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">Aucun litige résolu</p>
                <p className="text-sm text-muted-foreground mt-1">Les litiges résolus et fermés apparaîtront ici</p>
              </CardContent>
            </Card>
          ) : viewMode === 'card' ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              <AnimatePresence mode="popLayout" initial={false} key={`page-${disputesPage}-${activeTab}`}>
                {pagedDisputes.map((dispute) => {
                  const TypeIcon = typeIcons[dispute.type]
                  const iconColor = typeIconColors[dispute.type]
                  return (
                    <motion.div
                      key={dispute.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card className="border-border hover:shadow-md transition-shadow opacity-80">
                        <CardContent className="p-4 sm:p-6">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                              <div className={cn('flex size-10 items-center justify-center rounded-lg shrink-0', iconColor.bg)}>
                                <TypeIcon className={cn('size-5', iconColor.text)} />
                              </div>
                              <Badge className={typeBadgeColors[dispute.type]}>
                                {typeLabels[dispute.type]}
                              </Badge>
                            </div>
                            <Badge className={statusColors[dispute.status]}>
                              {statusLabels[dispute.status]}
                            </Badge>
                          </div>
                          <p className="text-sm text-foreground line-clamp-2 mb-2">{dispute.description}</p>
                          {dispute.resolution && (
                            <p className="text-xs text-green-700 bg-green-50 p-2 rounded-lg mb-2 line-clamp-2">
                              <span className="font-medium">Résolution :</span> {dispute.resolution}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {dispute.lease && (
                              <span>{dispute.lease.property.title}</span>
                            )}
                            <Calendar className="size-3" />
                            <span>{new Date(dispute.createdAt).toLocaleDateString('fr-FR')}</span>
                          </div>
                          <div className="flex gap-2 pt-2 border-t border-border mt-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground hover:text-foreground gap-1 ml-auto"
                              onClick={() => setDetailDialog({ open: true, dispute })}
                            >
                              <Eye className="size-3.5" /> Détails
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
              <PaginationControls
                page={disputesPage}
                totalPages={disputesTotalPages}
                total={disputesTotal}
                limit={disputesPageSize}
                onPageChange={setDisputesPage}
                className="sm:col-span-2"
              />
            </div>
          ) : (
            <Card className="border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left font-medium text-muted-foreground p-3">Type</th>
                      <th className="text-left font-medium text-muted-foreground p-3">Description</th>
                      <th className="text-left font-medium text-muted-foreground p-3 hidden lg:table-cell">Résolution</th>
                      <th className="text-center font-medium text-muted-foreground p-3">Statut</th>
                      <th className="text-left font-medium text-muted-foreground p-3 hidden sm:table-cell">Date</th>
                      <th className="text-right font-medium text-muted-foreground p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedDisputes.map((dispute) => {
                      const TypeIcon = typeIcons[dispute.type]
                      const iconColor = typeIconColors[dispute.type]
                      return (
                        <tr key={dispute.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className={cn('size-7 rounded flex items-center justify-center shrink-0', iconColor.bg)}>
                                <TypeIcon className={cn('size-3.5', iconColor.text)} />
                              </div>
                              <span className="text-xs font-medium">{typeLabels[dispute.type]}</span>
                            </div>
                          </td>
                          <td className="p-3"><p className="truncate max-w-[200px]">{dispute.description}</p></td>
                          <td className="p-3 hidden lg:table-cell">
                            {dispute.resolution ? (
                              <p className="text-green-700 truncate max-w-[200px]">{dispute.resolution}</p>
                            ) : '—'}
                          </td>
                          <td className="p-3 text-center">
                            <Badge className={statusColors[dispute.status]}>{statusLabels[dispute.status]}</Badge>
                          </td>
                          <td className="p-3 text-muted-foreground hidden sm:table-cell">
                            {new Date(dispute.createdAt).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="p-3">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => setDetailDialog({ open: true, dispute })}
                            >
                              <Eye className="size-4" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 pb-3">
                <PaginationControls
                  page={disputesPage}
                  totalPages={disputesTotalPages}
                  total={disputesTotal}
                  limit={disputesPageSize}
                  onPageChange={setDisputesPage}
                />
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Detail Dialog ──────────────────────────────────────────────── */}
      <Dialog
        open={detailDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setDetailDialog({ open: false, dispute: null })
            setEditingNotes(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détail du litige</DialogTitle>
            <DialogDescription>
              {detailDialog.dispute && typeLabels[detailDialog.dispute.type]}
            </DialogDescription>
          </DialogHeader>
          {detailDialog.dispute && (
            <div className="space-y-4 py-2">
              {/* Type + Priority + Escalation + Status */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Badge className={typeBadgeColors[detailDialog.dispute.type]}>
                    {typeLabels[detailDialog.dispute.type]}
                  </Badge>
                  <PriorityBadge priority={detailDialog.dispute.priority} />
                  {detailDialog.dispute.isEscalated && (
                    <Badge className="bg-rose-100 text-rose-700 gap-1">
                      <ArrowUpRight className="size-3" />
                      Escaladé
                    </Badge>
                  )}
                </div>
                <Badge className={statusColors[detailDialog.dispute.status]}>
                  {statusLabels[detailDialog.dispute.status]}
                </Badge>
              </div>

              {/* Priority changer */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Changer priorité :</span>
                {(['NORMAL', 'HIGH', 'URGENT'] as DossierPriority[]).map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    variant={detailDialog.dispute!.priority === p ? 'default' : 'outline'}
                    className={cn(
                      'gap-1 text-xs',
                      detailDialog.dispute!.priority === p && p === 'URGENT' && 'bg-red-600 hover:bg-red-700 text-white',
                      detailDialog.dispute!.priority === p && p === 'HIGH' && 'bg-amber-600 hover:bg-amber-700 text-white',
                      detailDialog.dispute!.priority === p && p === 'NORMAL' && 'bg-gray-600 hover:bg-gray-700 text-white',
                    )}
                    onClick={() => handlePriorityChange(detailDialog.dispute!.id, p)}
                  >
                    {priorityLabels[p]}
                  </Button>
                ))}
              </div>

              {/* Escalation reason */}
              {detailDialog.dispute.isEscalated && detailDialog.dispute.escalationReason && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200">
                  <p className="text-xs font-medium text-rose-700 mb-1">Raison de l&apos;escalade</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{detailDialog.dispute.escalationReason}</p>
                  {detailDialog.dispute.escalatedAt && (
                    <p className="text-xs text-rose-600 mt-1">
                      Escaladé le {new Date(detailDialog.dispute.escalatedAt).toLocaleDateString('fr-FR', {
                        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  )}
                </div>
              )}

              {/* Description */}
              <div className="p-3 rounded-lg border border-border bg-muted/30">
                <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{detailDialog.dispute.description}</p>
              </div>

              {/* Lease info */}
              {detailDialog.dispute.lease && (
                <div className="p-3 rounded-lg border border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Informations du bail</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium text-foreground">{detailDialog.dispute.lease.property.title}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="pl-5">
                        {detailDialog.dispute.lease.property.address}, {detailDialog.dispute.lease.property.commune || detailDialog.dispute.lease.property.city}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground pl-5">
                      <span>Loyer : {detailDialog.dispute.lease.monthlyRent.toLocaleString('fr-FR')} FCFA</span>
                      <span>
                        Du {new Date(detailDialog.dispute.lease.startDate).toLocaleDateString('fr-FR')} au{' '}
                        {new Date(detailDialog.dispute.lease.endDate).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground pl-5 mt-1">
                      <div className="flex items-center gap-1">
                        <User className="size-3" />
                        <span>Locataire : {detailDialog.dispute.lease.tenant.firstName} {detailDialog.dispute.lease.tenant.lastName}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 px-1 text-[10px] text-brand-500 hover:text-brand-600"
                          onClick={() => {
                            setDetailDialog({ open: false, dispute: null })
                            setDashboardSection('messaging')
                          }}
                        >
                          <MessageSquare className="size-3" /> Contacter
                        </Button>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="size-3" />
                        <span>Propriétaire : {detailDialog.dispute.lease.owner.firstName} {detailDialog.dispute.lease.owner.lastName}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 px-1 text-[10px] text-brand-500 hover:text-brand-600"
                          onClick={() => {
                            setDetailDialog({ open: false, dispute: null })
                            setDashboardSection('messaging')
                          }}
                        >
                          <MessageSquare className="size-3" /> Contacter
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Reporter */}
              {detailDialog.dispute.reporter && (
                <div className="flex items-center justify-between p-2 rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                      <User className="size-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {detailDialog.dispute.reporter.firstName} {detailDialog.dispute.reporter.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Déclarant · {detailDialog.dispute.reporter.email}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-brand-500 border-brand-200 hover:bg-brand-50 gap-1 text-xs"
                    onClick={() => {
                      setDetailDialog({ open: false, dispute: null })
                      setDashboardSection('messaging')
                    }}
                  >
                    <MessageSquare className="size-3.5" /> Contacter
                  </Button>
                </div>
              )}

              {/* Handler */}
              {detailDialog.dispute.handler && (
                <div className="flex items-center justify-between p-2 rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-brand-50 flex items-center justify-center shrink-0">
                      <ShieldCheck className="size-4 text-brand-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {detailDialog.dispute.handler.firstName} {detailDialog.dispute.handler.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">En charge du dossier</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-brand-500 border-brand-200 hover:bg-brand-50 gap-1 text-xs"
                    onClick={() => {
                      setDetailDialog({ open: false, dispute: null })
                      setDashboardSection('messaging')
                    }}
                  >
                    <MessageSquare className="size-3.5" /> Contacter
                  </Button>
                </div>
              )}

              {/* ─── Investigation Notes (US-TA-044) ──────────────────── */}
              <div className="p-3 rounded-lg border border-border">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground">Notes d&apos;investigation</p>
                  {!editingNotes && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs text-brand-500 hover:text-brand-600"
                      onClick={() => {
                        setNotesValue(detailDialog.dispute?.investigationNotes || '')
                        setEditingNotes(true)
                      }}
                    >
                      Modifier
                    </Button>
                  )}
                </div>
                {editingNotes ? (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Ajoutez vos notes d'investigation..."
                      value={notesValue}
                      onChange={(e) => setNotesValue(e.target.value)}
                      rows={4}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingNotes(false)}
                      >
                        Annuler
                      </Button>
                      <Button
                        size="sm"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        onClick={handleSaveInvestigationNotes}
                        disabled={actionLoading !== null}
                      >
                        {actionLoading !== null && <Loader2 className="size-3.5 animate-spin mr-1" />}
                        Sauvegarder
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {detailDialog.dispute.investigationNotes || 'Aucune note d\'investigation'}
                  </p>
                )}
              </div>

              {/* ─── Evidence / Pièces jointes (US-TA-041) ───────────── */}
              <div className="p-3 rounded-lg border border-border">
                <p className="text-xs font-medium text-muted-foreground mb-2">Preuves / Pièces jointes</p>
                {(() => {
                  const urls: string[] = JSON.parse(detailDialog.dispute.evidenceUrls || '[]')
                  return (
                    <div className="space-y-2">
                      {urls.length > 0 ? (
                        <div className="space-y-1">
                          {urls.map((url, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm p-1.5 rounded bg-muted/50">
                              <Paperclip className="size-3.5 text-muted-foreground shrink-0" />
                              <button
                                type="button"
                                onClick={() => openInWebView(url)}
                                className="text-brand-500 hover:underline truncate flex-1 text-left"
                              >
                                {url.length > 60 ? url.substring(0, 60) + '...' : url}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Aucune preuve ajoutée</p>
                      )}
                      {/* Add new evidence URL */}
                      <div className="flex gap-2 mt-2">
                        <Input
                          placeholder="Ajouter une URL de preuve..."
                          value={newEvidenceUrl}
                          onChange={(e) => setNewEvidenceUrl(e.target.value)}
                          className="text-sm"
                        />
                        <Button
                          size="sm"
                          className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
                          onClick={handleAddEvidence}
                          disabled={!newEvidenceUrl.trim() || actionLoading !== null}
                        >
                          <Link2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Timeline */}
              <div className="p-3 rounded-lg border border-border bg-muted/30">
                <p className="text-xs font-medium text-muted-foreground mb-2">Activité</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="size-2 rounded-full bg-foreground shrink-0" />
                    <span className="text-muted-foreground">
                      Créé le {new Date(detailDialog.dispute.createdAt).toLocaleDateString('fr-FR', {
                        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                  {detailDialog.dispute.isEscalated && detailDialog.dispute.escalatedAt && (
                    <div className="flex items-center gap-2 text-xs">
                      <div className="size-2 rounded-full bg-rose-500 shrink-0" />
                      <span className="text-rose-600">
                        Escaladé le {new Date(detailDialog.dispute.escalatedAt).toLocaleDateString('fr-FR', {
                          day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                  )}
                  {detailDialog.dispute.resolvedAt && (
                    <div className="flex items-center gap-2 text-xs">
                      <div className="size-2 rounded-full bg-green-500 shrink-0" />
                      <span className="text-muted-foreground">
                        Résolu le {new Date(detailDialog.dispute.resolvedAt).toLocaleDateString('fr-FR', {
                          day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Resolution */}
              {detailDialog.dispute.resolution && (
                <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                  <p className="text-xs font-medium text-green-700 mb-1">Résolution</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{detailDialog.dispute.resolution}</p>
                </div>
              )}

              {/* TC Comment */}
              {detailDialog.dispute.tcComment && (
                <div className="p-3 rounded-lg bg-brand-50 border border-brand-200">
                  <p className="text-xs font-medium text-brand-700 mb-1">Commentaire TC</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{detailDialog.dispute.tcComment}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-2 border-t border-border flex-wrap">
                {getActionButton(detailDialog.dispute)}
                {detailDialog.dispute.status === 'IN_REVIEW' && !detailDialog.dispute.isEscalated && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-rose-600 border-rose-200 hover:bg-rose-50 gap-1"
                    onClick={() => {
                      setEscalationReason('')
                      setEscalateDialog({ open: true, dispute: detailDialog.dispute })
                    }}
                  >
                    <ArrowUpRight className="size-3.5" /> Escalader
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Resolve Dialog ─────────────────────────────────────────────── */}
      <Dialog
        open={resolveDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setResolveDialog({ open: false, dispute: null })
            setResolutionComment('')
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Résoudre le litige</DialogTitle>
            <DialogDescription>
              Décrivez la résolution appliquée. Cette information sera visible par les parties concernées.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {resolveDialog.dispute && (
              <div className="p-3 rounded-lg border border-border bg-muted/30">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={typeBadgeColors[resolveDialog.dispute.type]}>
                    {typeLabels[resolveDialog.dispute.type]}
                  </Badge>
                  <PriorityBadge priority={resolveDialog.dispute.priority} />
                </div>
                <p className="text-sm text-foreground line-clamp-2">{resolveDialog.dispute.description}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="resolution">Résolution *</Label>
              <Textarea
                id="resolution"
                placeholder="Décrivez la résolution du litige..."
                value={resolutionComment}
                onChange={(e) => setResolutionComment(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setResolveDialog({ open: false, dispute: null })
                setResolutionComment('')
              }}
              disabled={actionLoading !== null}
            >
              Annuler
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleResolve}
              disabled={!resolutionComment.trim() || actionLoading !== null}
            >
              {actionLoading !== null && <Loader2 className="size-4 animate-spin mr-2" />}
              Confirmer la résolution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Escalate Dialog ────────────────────────────────────────────── */}
      <Dialog
        open={escalateDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setEscalateDialog({ open: false, dispute: null })
            setEscalationReason('')
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escalader le litige</DialogTitle>
            <DialogDescription>
              L&apos;escalade marque ce litige comme nécessitant une attention prioritaire ou une intervention supérieure.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {escalateDialog.dispute && (
              <div className="p-3 rounded-lg border border-rose-200 bg-rose-50/50">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={typeBadgeColors[escalateDialog.dispute.type]}>
                    {typeLabels[escalateDialog.dispute.type]}
                  </Badge>
                  <PriorityBadge priority={escalateDialog.dispute.priority} />
                </div>
                <p className="text-sm text-foreground line-clamp-2">{escalateDialog.dispute.description}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="escalationReason">Raison de l&apos;escalade *</Label>
              <Textarea
                id="escalationReason"
                placeholder="Pourquoi ce litige nécessite-t-il une escalade ?"
                value={escalationReason}
                onChange={(e) => setEscalationReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEscalateDialog({ open: false, dispute: null })
                setEscalationReason('')
              }}
              disabled={actionLoading !== null}
            >
              Annuler
            </Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={handleEscalate}
              disabled={!escalationReason.trim() || actionLoading !== null}
            >
              {actionLoading !== null && <Loader2 className="size-4 animate-spin mr-2" />}
              Confirmer l&apos;escalade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
