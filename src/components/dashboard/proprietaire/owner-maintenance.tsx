'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Wrench,
  AlertTriangle,
  Clock,
  CheckCircle2,
  X,
  ImageIcon,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Filter,
  Play,
  Ban,
  FileCheck2,
  XCircle,
  Send,
  User,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { useRealtimeMaintenance } from '@/hooks/use-realtime-maintenance'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Types ──────────────────────────────────────────────────────────────────
interface MaintenanceItem {
  id: string
  title: string
  description: string
  status: string
  priority: string
  images: string // JSON string
  resolution: string | null
  rejectionReason: string | null
  createdAt: string
  updatedAt: string
  lease: {
    id: string
    startDate: string
    endDate: string
    monthlyRent: number
    property: {
      id: string
      title: string
      address: string
      city: string
      images: Array<{ url: string }>
    }
    tenant: { id: string; firstName: string; lastName: string; avatarUrl: string | null }
    owner: { id: string; firstName: string; lastName: string }
  }
}

interface CommentItem {
  id: string
  content: string
  createdAt: string
  author: {
    id: string
    firstName: string
    lastName: string
    role: string
    avatarUrl: string | null
  }
}

interface MaintenanceResponse {
  data: MaintenanceItem[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
  stats: Record<string, number>
}

interface CommentsResponse {
  data: CommentItem[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  PENDING: { label: 'En attente', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  IN_PROGRESS: { label: 'En cours', color: 'bg-brand-50 text-brand-600 border-brand-200', icon: Wrench },
  RESOLVED: { label: 'Résolu', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  CLOSED: { label: 'Fermé', color: 'bg-muted text-muted-foreground border-border', icon: X },
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Faible', color: 'bg-muted text-muted-foreground border-border' },
  MEDIUM: { label: 'Moyenne', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  HIGH: { label: 'Haute', color: 'bg-brand-50 text-brand-600 border-brand-200' },
  URGENT: { label: 'Urgente', color: 'bg-red-50 text-red-700 border-red-200' },
}

const filterOptions: Record<string, string> = {
  ALL: 'Tous',
  PENDING: 'En attente',
  IN_PROGRESS: 'En cours',
  RESOLVED: 'Résolu',
  CLOSED: 'Fermé',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function parseImages(imagesJson: string): string[] {
  try {
    const parsed = JSON.parse(imagesJson)
    if (Array.isArray(parsed)) return parsed.filter((url: unknown) => typeof url === 'string')
  } catch {
    // Invalid JSON
  }
  return []
}

// ─── Animation Variants ────────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}
const commentVariants = {
  hidden: { opacity: 0, height: 0 },
  show: { opacity: 1, height: 'auto', transition: { duration: 0.3 } },
  exit: { opacity: 0, height: 0, transition: { duration: 0.2 } },
}

// ─── Component ──────────────────────────────────────────────────────────────
export function OwnerMaintenance() {
  const { user, isAuthenticated } = useAuthStore()
  const [requests, setRequests] = useState<MaintenanceItem[]>([])
  const [stats, setStats] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('ALL')

  // Comments state per request
  const [commentsMap, setCommentsMap] = useState<Record<string, CommentItem[]>>({})
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({})
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({})

  // Dialog state
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false)
  const [rejectionTarget, setRejectionTarget] = useState<MaintenanceItem | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  const [resolutionDialogOpen, setResolutionDialogOpen] = useState(false)
  const [resolutionTarget, setResolutionTarget] = useState<MaintenanceItem | null>(null)
  const [resolutionText, setResolutionText] = useState('')
  const [resolving, setResolving] = useState(false)

  const [commentDialogOpen, setCommentDialogOpen] = useState(false)
  const [commentTarget, setCommentTarget] = useState<MaintenanceItem | null>(null)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchMaintenance = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    try {
      const result = await authFetch<MaintenanceResponse>('/api/maintenance')
      setRequests(result.data ?? [])
      setStats(result.stats ?? {})
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) {
        setRequests([])
        return
      }
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    fetchMaintenance()
  }, [fetchMaintenance])

  // Derive owner lease IDs from existing requests for Realtime filtering
  const ownerLeaseIds = requests.map((r) => r.lease?.id).filter(Boolean) as string[]

  // Realtime subscription for maintenance
  useRealtimeMaintenance({
    userId: user?.id,
    ownerLeaseIds,
    onMaintenanceChange: (event, req) => {
      if (event === 'INSERT') {
        fetchMaintenance()
      } else {
        setRequests((prev) =>
          prev.map((r) =>
            r.id === req.id
              ? { ...r, status: req.status, priority: req.priority, resolution: req.resolution, updatedAt: req.updated_at }
              : r
          )
        )
      }
    },
  })

  // ── Comments ───────────────────────────────────────────────────────────────
  const fetchComments = useCallback(
    async (requestId: string) => {
      setLoadingComments((prev) => ({ ...prev, [requestId]: true }))
      try {
        const result = await authFetch<CommentsResponse>(
          `/api/maintenance/${requestId}/comments`
        )
        setCommentsMap((prev) => ({ ...prev, [requestId]: result.data ?? [] }))
      } catch {
        // Silently fail — comments are supplementary
        setCommentsMap((prev) => ({ ...prev, [requestId]: [] }))
      } finally {
        setLoadingComments((prev) => ({ ...prev, [requestId]: false }))
      }
    },
    []
  )

  const toggleComments = (requestId: string) => {
    setExpandedComments((prev) => {
      const next = !prev[requestId]
      if (next && !commentsMap[requestId]) {
        fetchComments(requestId)
      }
      return { ...prev, [requestId]: next }
    })
  }

  // ── Status updates ─────────────────────────────────────────────────────────
  const updateStatus = async (
    item: MaintenanceItem,
    newStatus: string,
    extra?: Record<string, string>
  ) => {
    try {
      await authFetch(`/api/maintenance/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, ...extra }),
      })
      toast.success('Statut mis à jour avec succès')
      fetchMaintenance()
    } catch (err) {
      if (err instanceof AuthError) {
        toast.error(err.message)
      } else {
        toast.error("Erreur lors de la mise à jour")
      }
    }
  }

  const handleTakeCharge = (item: MaintenanceItem) => {
    updateStatus(item, 'IN_PROGRESS')
  }

  const handleCloseDirect = (item: MaintenanceItem) => {
    updateStatus(item, 'CLOSED')
  }

  // ── Rejection ──────────────────────────────────────────────────────────────
  const handleRejectClick = (item: MaintenanceItem) => {
    setRejectionTarget(item)
    setRejectionReason('')
    setRejectionDialogOpen(true)
  }

  const handleRejectConfirm = async () => {
    if (!rejectionTarget) return
    if (!rejectionReason.trim()) {
      toast.error('Veuillez indiquer une raison de refus')
      return
    }
    setRejecting(true)
    try {
      await authFetch(`/api/maintenance/${rejectionTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'CLOSED',
          rejectionReason: rejectionReason.trim(),
        }),
      })
      toast.success('Demande refusée')
      setRejectionDialogOpen(false)
      setRejectionTarget(null)
      fetchMaintenance()
    } catch (err) {
      if (err instanceof AuthError) {
        toast.error(err.message)
      } else {
        toast.error('Erreur lors du refus')
      }
    } finally {
      setRejecting(false)
    }
  }

  // ── Resolution ─────────────────────────────────────────────────────────────
  const handleResolveClick = (item: MaintenanceItem) => {
    setResolutionTarget(item)
    setResolutionText('')
    setResolutionDialogOpen(true)
  }

  const handleResolveConfirm = async () => {
    if (!resolutionTarget) return
    if (!resolutionText.trim()) {
      toast.error('Veuillez décrire la résolution')
      return
    }
    setResolving(true)
    try {
      await authFetch(`/api/maintenance/${resolutionTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'RESOLVED',
          resolution: resolutionText.trim(),
        }),
      })
      toast.success('Demande marquée comme résolue')
      setResolutionDialogOpen(false)
      setResolutionTarget(null)
      fetchMaintenance()
    } catch (err) {
      if (err instanceof AuthError) {
        toast.error(err.message)
      } else {
        toast.error('Erreur lors de la résolution')
      }
    } finally {
      setResolving(false)
    }
  }

  // ── Comment ────────────────────────────────────────────────────────────────
  const handleCommentClick = (item: MaintenanceItem) => {
    setCommentTarget(item)
    setCommentText('')
    setCommentDialogOpen(true)
  }

  const handleCommentSubmit = async () => {
    if (!commentTarget) return
    if (!commentText.trim()) {
      toast.error('Veuillez écrire un commentaire')
      return
    }
    setSubmittingComment(true)
    try {
      await authFetch(`/api/maintenance/${commentTarget.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText.trim() }),
      })
      toast.success('Commentaire ajouté')
      setCommentDialogOpen(false)
      setCommentTarget(null)
      // Refresh comments if expanded
      if (expandedComments[commentTarget.id]) {
        fetchComments(commentTarget.id)
      }
    } catch (err) {
      if (err instanceof AuthError) {
        toast.error(err.message)
      } else {
        toast.error("Erreur lors de l'ajout du commentaire")
      }
    } finally {
      setSubmittingComment(false)
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────
  const pendingCount = stats.PENDING ?? 0
  const inProgressCount = stats.IN_PROGRESS ?? 0
  const resolvedCount = (stats.RESOLVED ?? 0) + (stats.CLOSED ?? 0)

  const filteredRequests =
    statusFilter === 'ALL'
      ? requests
      : requests.filter((r) => r.status === statusFilter)

  // ─── Loading skeleton ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-48 bg-muted animate-pulse rounded" />
            <div className="h-4 w-64 bg-muted animate-pulse rounded mt-2" />
          </div>
          <div className="h-10 w-40 bg-muted animate-pulse rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  // ─── Error state ───────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Gestion Maintenance</h1>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-sm text-amber-700">
              Impossible de charger les demandes. Veuillez réessayer.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Gestion Maintenance</h1>
          <p className="text-muted-foreground mt-1">
            Suivi et gestion des demandes d&apos;intervention
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="size-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(filterOptions).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-border">
            <CardContent className="p-4 text-center">
              <p className="text-xl sm:text-2xl font-bold text-amber-600">{pendingCount}</p>
              <p className="text-xs text-muted-foreground mt-1">En attente</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4 text-center">
              <p className="text-xl sm:text-2xl font-bold text-brand-600">{inProgressCount}</p>
              <p className="text-xs text-muted-foreground mt-1">En cours</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4 text-center">
              <p className="text-xl sm:text-2xl font-bold text-emerald-600">{resolvedCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Résolues</p>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Requests List or Empty State */}
      {filteredRequests.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card className="border-dashed border-border bg-muted/50">
            <CardContent className="py-12 flex flex-col items-center text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-brand-50 mb-4">
                <Wrench className="size-7 text-brand-500" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {statusFilter === 'ALL'
                  ? 'Aucune demande de maintenance'
                  : `Aucune demande ${filterOptions[statusFilter]?.toLowerCase() ?? ''}`}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {statusFilter === 'ALL'
                  ? `${user?.firstName}, les demandes de maintenance de vos locataires apparaîtront ici.`
                  : 'Modifiez le filtre pour voir d\'autres demandes.'}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div variants={containerVariants} className="space-y-3">
          {filteredRequests.map((req) => {
            const sConfig = statusConfig[req.status] || statusConfig.PENDING
            const pConfig = priorityConfig[req.priority] || priorityConfig.MEDIUM
            const SIcon = sConfig.icon
            const property = req.lease?.property
            const tenant = req.lease?.tenant
            const reqImages = parseImages(req.images)
            const comments = commentsMap[req.id] ?? []
            const isExpanded = expandedComments[req.id] ?? false
            const isLoadingComments = loadingComments[req.id] ?? false

            return (
              <motion.div key={req.id} variants={itemVariants}>
                <Card className="border-border hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Image thumbnail or icon */}
                      {reqImages.length > 0 ? (
                        <div className="relative size-10 shrink-0 rounded-lg overflow-hidden">
                          <img
                            src={reqImages.at(0) || ''}
                            alt={req.title}
                            className="size-full object-cover"
                          />
                          {reqImages.length > 1 && (
                            <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-brand-500 text-[9px] font-bold text-white">
                              {reqImages.length}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div
                          className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                            req.priority === 'URGENT' ? 'bg-red-50' : 'bg-brand-50'
                          }`}
                        >
                          {req.priority === 'URGENT' ? (
                            <AlertTriangle className="size-5 text-red-500" />
                          ) : (
                            <Wrench className="size-5 text-brand-500" />
                          )}
                        </div>
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Title row with badges */}
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {req.title}
                          </p>
                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                            {reqImages.length > 0 && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 border border-brand-200 bg-brand-50 text-brand-600"
                              >
                                <ImageIcon className="size-3 mr-0.5" />
                                {reqImages.length}
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 border ${pConfig.color}`}
                            >
                              {pConfig.label}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 border ${sConfig.color}`}
                            >
                              <SIcon className="size-3 mr-0.5" />
                              {sConfig.label}
                            </Badge>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {req.description}
                        </p>

                        {/* Rejection reason if present */}
                        {req.rejectionReason && req.status === 'CLOSED' && (
                          <div className="mb-2 p-2 rounded-md bg-red-50 border border-red-100">
                            <p className="text-[10px] font-medium text-red-600 mb-0.5">
                              Raison du refus :
                            </p>
                            <p className="text-xs text-red-700">{req.rejectionReason}</p>
                          </div>
                        )}

                        {/* Resolution if present */}
                        {req.resolution && (req.status === 'RESOLVED' || req.status === 'CLOSED') && (
                          <div className="mb-2 p-2 rounded-md bg-emerald-50 border border-emerald-100">
                            <p className="text-[10px] font-medium text-emerald-600 mb-0.5">
                              Résolution :
                            </p>
                            <p className="text-xs text-emerald-700">{req.resolution}</p>
                          </div>
                        )}

                        {/* Property / Tenant / Date info */}
                        <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground mb-3">
                          {property && (
                            <span>
                              {property.title} — {property.city}
                            </span>
                          )}
                          {tenant && (
                            <span className="flex items-center gap-1">
                              <User className="size-3" />
                              {tenant.firstName} {tenant.lastName}
                            </span>
                          )}
                          <span>{formatDate(req.createdAt)}</span>
                        </div>

                        {/* Action buttons row */}
                        <div className="flex flex-wrap items-center gap-2">
                          {/* PENDING actions */}
                          {req.status === 'PENDING' && (
                            <>
                              <Button
                                size="sm"
                                className="h-7 text-[11px] px-3 bg-primary hover:bg-primary/90 text-primary-foreground"
                                onClick={() => handleTakeCharge(req)}
                              >
                                <Play className="size-3 mr-1" />
                                Prendre en charge
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px] px-3 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                onClick={() => handleRejectClick(req)}
                              >
                                <Ban className="size-3 mr-1" />
                                Refuser
                              </Button>
                            </>
                          )}

                          {/* IN_PROGRESS actions */}
                          {req.status === 'IN_PROGRESS' && (
                            <>
                              <Button
                                size="sm"
                                className="h-7 text-[11px] px-3 bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => handleResolveClick(req)}
                              >
                                <FileCheck2 className="size-3 mr-1" />
                                Résolu
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px] px-3 text-muted-foreground border-border hover:bg-muted"
                                onClick={() => handleCloseDirect(req)}
                              >
                                <XCircle className="size-3 mr-1" />
                                Fermer
                              </Button>
                            </>
                          )}

                          {/* RESOLVED actions */}
                          {req.status === 'RESOLVED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px] px-3 text-muted-foreground border-border hover:bg-muted"
                              onClick={() => handleCloseDirect(req)}
                            >
                              <XCircle className="size-3 mr-1" />
                              Fermer
                            </Button>
                          )}

                          {/* Comment button — always available */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] px-3 text-brand-600 border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                            onClick={() => handleCommentClick(req)}
                          >
                            <MessageSquare className="size-3 mr-1" />
                            Commenter
                          </Button>

                          {/* Toggle comments */}
                          {comments.length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleComments(req.id)}
                              className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground hover:text-brand-600 transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronUp className="size-3" />
                              ) : (
                                <ChevronDown className="size-3" />
                              )}
                              Voir {comments.length} commentaire{comments.length > 1 ? 's' : ''}
                            </button>
                          )}
                        </div>

                        {/* Expandable comments section */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              variants={commentVariants}
                              initial="hidden"
                              animate="show"
                              exit="exit"
                              className="overflow-hidden"
                            >
                              <div className="mt-3 space-y-2 border-t border-border pt-3">
                                {isLoadingComments ? (
                                  <div className="space-y-2">
                                    {[1, 2].map((i) => (
                                      <div
                                        key={i}
                                        className="h-12 rounded-lg bg-muted animate-pulse"
                                      />
                                    ))}
                                  </div>
                                ) : comments.length === 0 ? (
                                  <p className="text-xs text-muted-foreground text-center py-2">
                                    Aucun commentaire
                                  </p>
                                ) : (
                                  comments.map((comment) => (
                                    <div
                                      key={comment.id}
                                      className="flex items-start gap-2 p-2 rounded-lg bg-muted/50"
                                    >
                                      <div className="shrink-0 mt-0.5">
                                        {comment.author.avatarUrl ? (
                                          <img
                                            src={comment.author.avatarUrl}
                                            alt={`${comment.author.firstName} ${comment.author.lastName}`}
                                            className="size-6 rounded-full object-cover"
                                          />
                                        ) : (
                                          <div className="size-6 rounded-full bg-brand-50 flex items-center justify-center">
                                            <User className="size-3 text-brand-500" />
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                          <span className="text-[11px] font-semibold text-foreground">
                                            {comment.author.firstName} {comment.author.lastName}
                                          </span>
                                          <Badge
                                            variant="outline"
                                            className="text-[9px] px-1 py-0 border-border text-muted-foreground"
                                          >
                                            {comment.author.role === 'PROPRIETAIRE'
                                              ? 'Propriétaire'
                                              : comment.author.role === 'LOCATAIRE'
                                                ? 'Locataire'
                                                : comment.author.role}
                                          </Badge>
                                          <span className="text-[9px] text-muted-foreground">
                                            {formatDateTime(comment.createdAt)}
                                          </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                          {comment.content}
                                        </p>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {/* ─── Rejection Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={rejectionDialogOpen} onOpenChange={setRejectionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="size-5 text-red-500" />
              Refuser la demande
            </DialogTitle>
            <DialogDescription>
              Indiquez la raison du refus. Le locataire en sera informé.
            </DialogDescription>
          </DialogHeader>
          {rejectionTarget && (
            <div className="py-2">
              <p className="text-sm font-medium text-foreground">
                {rejectionTarget.title}
              </p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {rejectionTarget.description}
              </p>
            </div>
          )}
          <div className="space-y-2 py-2">
            <Label>Raison du refus *</Label>
            <Textarea
              placeholder="Expliquez pourquoi cette demande est refusée..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setRejectionDialogOpen(false)}
              disabled={rejecting}
            >
              Annuler
            </Button>
            <Button
              onClick={handleRejectConfirm}
              disabled={rejecting || !rejectionReason.trim()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {rejecting ? 'Refus en cours...' : 'Confirmer le refus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Resolution Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={resolutionDialogOpen} onOpenChange={setResolutionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck2 className="size-5 text-emerald-600" />
              Marquer comme résolu
            </DialogTitle>
            <DialogDescription>
              Décrivez la résolution apportée au problème.
            </DialogDescription>
          </DialogHeader>
          {resolutionTarget && (
            <div className="py-2">
              <p className="text-sm font-medium text-foreground">
                {resolutionTarget.title}
              </p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {resolutionTarget.description}
              </p>
            </div>
          )}
          <div className="space-y-2 py-2">
            <Label>Détails de la résolution *</Label>
            <Textarea
              placeholder="Décrivez les travaux ou actions réalisés..."
              value={resolutionText}
              onChange={(e) => setResolutionText(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setResolutionDialogOpen(false)}
              disabled={resolving}
            >
              Annuler
            </Button>
            <Button
              onClick={handleResolveConfirm}
              disabled={resolving || !resolutionText.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {resolving ? 'Enregistrement...' : 'Confirmer la résolution'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Comment Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={commentDialogOpen} onOpenChange={setCommentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="size-5 text-brand-500" />
              Ajouter un commentaire
            </DialogTitle>
            <DialogDescription>
              Communiquez avec le locataire à propos de cette demande.
            </DialogDescription>
          </DialogHeader>
          {commentTarget && (
            <div className="py-2">
              <p className="text-sm font-medium text-foreground">
                {commentTarget.title}
              </p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {commentTarget.description}
              </p>
            </div>
          )}
          <div className="space-y-2 py-2">
            <Label>Votre commentaire *</Label>
            <Textarea
              placeholder="Écrivez votre message..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCommentDialogOpen(false)}
              disabled={submittingComment}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCommentSubmit}
              disabled={submittingComment || !commentText.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {submittingComment ? (
                'Envoi...'
              ) : (
                <>
                  <Send className="size-3 mr-1" />
                  Envoyer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
