'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Users, UserPlus, Search, Pencil, Trash2, Power, PowerOff,
  Phone, Mail, User, ShieldCheck, Loader2, Star, ExternalLink,
  Clock, CheckCircle2, Calendar, FileText, MessageSquare, ChevronRight,
  TrendingUp, BarChart3,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { usePagination } from '@/hooks/use-pagination'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { useAuthStore } from '@/lib/auth-store'
import { useRealtimeUsers } from '@/hooks/use-realtime-users'
import { ViewModeToggle, type ViewMode } from './view-mode-toggle'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useInAppBrowser } from '@/hooks/capacitor'

// ─── Types ──────────────────────────────────────────────────────────────────

interface UpcomingMission {
  id: string
  scheduledAt: string
  status: string
  type: string
  propertyTitle: string
}

interface AgentReport {
  id: string
  reportUrl: string
  propertyTitle: string
  completedAt: string | null
}

interface RecentFeedback {
  id: string
  rating: number
  comment: string | null
  createdAt: string
}

interface Agent {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  isActive: boolean
  createdAt: string
  _count?: {
    missions: number
  }
  // Enhanced fields from updated API
  performance?: {
    totalMissions: number
    completedCount: number
    successRate: number
    avgCompletionHours: number
    lastMissionDate: string | null
  }
  feedbackSummary?: {
    avgRating: number
    totalFeedbacks: number
    recentFeedbacks: RecentFeedback[]
  }
  availability?: {
    upcomingMissions: UpcomingMission[]
    missionCountNext7Days: number
  }
  reports?: AgentReport[]
}

interface AgentFormData {
  firstName: string
  lastName: string
  email: string
  phone: string
}

// API returns array directly

// ─── Validation ─────────────────────────────────────────────────────────────

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateForm(data: AgentFormData): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!data.firstName.trim()) errors.firstName = 'Le prénom est requis'
  if (!data.lastName.trim()) errors.lastName = 'Le nom est requis'
  if (!data.email.trim()) errors.email = "L'email est requis"
  else if (!emailRegex.test(data.email)) errors.email = "Format d'email invalide"
  return errors
}

// ─── Availability Dot Component ─────────────────────────────────────────────

function AvailabilityDot({ missionCount }: { missionCount: number }) {
  let color = 'bg-emerald-500'
  let label = 'Disponible'
  if (missionCount >= 3) {
    color = 'bg-red-500'
    label = 'Occupé'
  } else if (missionCount >= 1) {
    color = 'bg-amber-500'
    label = 'En mission'
  }
  return (
    <div className="flex items-center gap-1.5" title={label}>
      <span className={cn('size-2.5 rounded-full shrink-0', color)} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

// ─── Star Rating Component ──────────────────────────────────────────────────

function StarRating({
  value,
  onChange,
  readonly = false,
  size = 'sm',
}: {
  value: number
  onChange?: (val: number) => void
  readonly?: boolean
  size?: 'sm' | 'md'
}) {
  const [hover, setHover] = useState(0)
  const iconSize = size === 'md' ? 'size-6' : 'size-4'

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          className={cn(
            'transition-colors',
            readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'
          )}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
        >
          <Star
            className={cn(
              iconSize,
              (hover || value) >= star
                ? 'fill-amber-400 text-amber-400'
                : 'fill-transparent text-muted-foreground/30'
            )}
          />
        </button>
      ))}
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AgentsManagement() {
  const { user, isAuthenticated } = useAuthStore()

  // Data
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // View
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [search, setSearch] = useState('')

  const { openInWebView } = useInAppBrowser()

  // Agent detail
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)

  // Dialogs
  const [formDialog, setFormDialog] = useState<{
    open: boolean
    mode: 'create' | 'edit'
    agent: Agent | null
  }>({ open: false, mode: 'create', agent: null })
  const [formData, setFormData] = useState<AgentFormData>({
    firstName: '', lastName: '', email: '', phone: '',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; agent: Agent | null }>({
    open: false, agent: null,
  })

  // Feedback dialog
  const [feedbackDialog, setFeedbackDialog] = useState<{
    open: boolean
    agent: Agent | null
  }>({ open: false, agent: null })
  const [feedbackRating, setFeedbackRating] = useState(0)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)

  // ─── Fetch ──────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    try {
      const data = await authFetch<Agent[]>('/api/tc/agents')
      setAgents(Array.isArray(data) ? data : [])
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) {
        setAgents([])
        return
      }
      setAgents([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useRealtimeUsers({
    userId: user?.id,
    watchAll: true,
    onUserChange: () => { fetchData() },
  })

  // ─── Filtered agents ──────────────────────────────────────────────────

  const filteredAgents = agents.filter((a) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      a.firstName.toLowerCase().includes(q) ||
      a.lastName.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      (a.phone && a.phone.includes(q))
    )
  })

  const {
    paginatedItems: pagedAgents,
    page: agentsPage,
    totalPages: agentsTotalPages,
    total: agentsTotal,
    pageSize: agentsPageSize,
    setPage: setAgentsPage,
  } = usePagination({
    items: filteredAgents,
    pageSize: 10,
    resetSignal: search,
  })

  // ─── Stats ─────────────────────────────────────────────────────────────

  const totalAgents = agents.length
  const activeAgents = agents.filter((a) => a.isActive).length
  const onMission = agents.filter((a) => (a.availability?.missionCountNext7Days ?? 0) > 0).length
  const completedMissions = agents.reduce((sum, a) => sum + (a.performance?.completedCount ?? 0), 0)

  // ─── Form handlers ─────────────────────────────────────────────────────

  const openCreateDialog = () => {
    setFormData({ firstName: '', lastName: '', email: '', phone: '' })
    setFormErrors({})
    setFormDialog({ open: true, mode: 'create', agent: null })
  }

  const openEditDialog = (agent: Agent) => {
    setFormData({
      firstName: agent.firstName,
      lastName: agent.lastName,
      email: agent.email,
      phone: agent.phone || '',
    })
    setFormErrors({})
    setFormDialog({ open: true, mode: 'edit', agent })
  }

  const handleFormSubmit = async () => {
    const errors = validateForm(formData)
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      if (formDialog.mode === 'create') {
        await authFetch('/api/tc/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
        toast.success('Agent créé avec succès !')
      } else if (formDialog.agent) {
        await authFetch('/api/tc/agents', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: formDialog.agent.id, ...formData }),
        })
        toast.success('Agent mis à jour !')
      }
      setFormDialog({ open: false, mode: 'create', agent: null })
      await fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'opération")
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Toggle active ─────────────────────────────────────────────────────

  const handleToggleActive = async (agent: Agent) => {
    setActionLoading(agent.id)
    try {
      await authFetch('/api/tc/agents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: agent.id, isActive: !agent.isActive }),
      })
      toast.success(agent.isActive ? 'Agent désactivé' : 'Agent activé')
      await fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setActionLoading(null)
    }
  }

  // ─── Delete ────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteDialog.agent) return
    setActionLoading(deleteDialog.agent.id)
    try {
      await authFetch('/api/tc/agents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteDialog.agent.id }),
      })
      toast.success('Agent supprimé')
      setDeleteDialog({ open: false, agent: null })
      await fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression')
    } finally {
      setActionLoading(null)
    }
  }

  // ─── Feedback ──────────────────────────────────────────────────────────

  const openFeedbackDialog = (agent: Agent) => {
    setFeedbackRating(0)
    setFeedbackComment('')
    setFeedbackDialog({ open: true, agent })
  }

  const handleFeedbackSubmit = async () => {
    if (!feedbackDialog.agent) return
    if (feedbackRating === 0) {
      toast.error('Veuillez sélectionner une note')
      return
    }

    setFeedbackSubmitting(true)
    try {
      await authFetch('/api/tc/agent-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: feedbackDialog.agent.id,
          rating: feedbackRating,
          comment: feedbackComment.trim() || null,
        }),
      })
      toast.success('Feedback envoyé !')
      setFeedbackDialog({ open: false, agent: null })
      await fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'envoi du feedback")
    } finally {
      setFeedbackSubmitting(false)
    }
  }

  // ─── Format helpers ────────────────────────────────────────────────────

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  }

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  }

  const formatHours = (hours: number) => {
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    return remainingHours > 0 ? `${days}j ${remainingHours}h` : `${days}j`
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

  // ─── Agent Detail View ────────────────────────────────────────────────

  if (selectedAgent) {
    const agent = selectedAgent
    const perf = agent.performance
    const fb = agent.feedbackSummary
    const avail = agent.availability
    const reports = agent.reports || []

    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        {/* Back button */}
        <Button
          variant="ghost"
          className="gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => setSelectedAgent(null)}
        >
          <ChevronRight className="size-4 rotate-180" />
          Retour aux agents
        </Button>

        {/* Agent Header */}
        <Card className="border-border">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={cn(
                  'size-16 rounded-full flex items-center justify-center shrink-0',
                  agent.isActive ? 'bg-brand-500/10' : 'bg-muted'
                )}>
                  <User className={cn('size-8', agent.isActive ? 'text-brand-500' : 'text-muted-foreground')} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    {agent.firstName} {agent.lastName}
                  </h2>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <Mail className="size-3.5 shrink-0" />
                    <span>{agent.email}</span>
                  </div>
                  {agent.phone && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                      <Phone className="size-3.5 shrink-0" />
                      <span>{agent.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <Badge className={agent.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                      {agent.isActive ? 'Actif' : 'Inactif'}
                    </Badge>
                    {avail && <AvailabilityDot missionCount={avail.missionCountNext7Days} />}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => openFeedbackDialog(agent)}
                >
                  <Star className="size-3.5" /> Feedback
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => openEditDialog(agent)}
                >
                  <Pencil className="size-3.5" /> Modifier
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Metrics (US-TA-053) */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="size-5 text-brand-500" />
            Performance
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50">
                    <BarChart3 className="size-5 text-brand-600" />
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-bold text-foreground">{perf?.totalMissions ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Missions totales</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50">
                    <CheckCircle2 className="size-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-bold text-emerald-600">{perf?.successRate ?? 0}%</p>
                    <p className="text-xs text-muted-foreground">Taux de réussite</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50">
                    <Clock className="size-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-bold text-amber-600">
                      {perf?.avgCompletionHours ? formatHours(perf.avgCompletionHours) : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">Temps moyen</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-rose-50">
                    <Calendar className="size-5 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground">
                      {formatDate(perf?.lastMissionDate ?? null)}
                    </p>
                    <p className="text-xs text-muted-foreground">Dernière mission</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Availability (US-TA-056) & Reports (US-TA-054) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Missions */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="size-4 text-brand-500" />
                Missions à venir (7 prochains jours)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {avail && avail.upcomingMissions.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {avail.upcomingMissions.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {m.propertyTitle}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(m.scheduledAt)}
                        </p>
                      </div>
                      <Badge className={cn(
                        'shrink-0 text-[10px]',
                        m.status === 'IN_PROGRESS'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-brand-100 text-brand-700'
                      )}>
                        {m.status === 'IN_PROGRESS' ? 'En cours' : 'Assignée'}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucune mission prévue cette semaine
                </p>
              )}
            </CardContent>
          </Card>

          {/* Mission Reports (US-TA-054) */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="size-4 text-brand-500" />
                Rapports de mission
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reports.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {reports.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {r.propertyTitle}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(r.completedAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openInWebView(r.reportUrl)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-brand-500 hover:text-brand-600 shrink-0"
                      >
                        Voir <ExternalLink className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun rapport disponible
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Feedback (US-TA-055) */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="size-4 text-brand-500" />
                Feedback
              </CardTitle>
              {fb && fb.avgRating > 0 && (
                <div className="flex items-center gap-1.5">
                  <StarRating value={Math.round(fb.avgRating)} readonly />
                  <span className="text-sm font-medium text-foreground">{fb.avgRating}/5</span>
                  <span className="text-xs text-muted-foreground">({fb.totalFeedbacks})</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {fb && fb.recentFeedbacks.length > 0 ? (
              <div className="space-y-3">
                {fb.recentFeedbacks.map((f) => (
                  <div key={f.id} className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between mb-1">
                      <StarRating value={f.rating} readonly />
                      <span className="text-xs text-muted-foreground">{formatDate(f.createdAt)}</span>
                    </div>
                    {f.comment && (
                      <p className="text-sm text-foreground mt-1">{f.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun feedback pour le moment
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-500/10 to-transparent rounded-xl p-4 sm:p-6 -mx-4 sm:-mx-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-brand-100 shrink-0">
              <Users className="size-6 text-brand-500" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Agents de vérification</h1>
              <p className="text-muted-foreground mt-0.5">Gérez vos agents de vérification terrain</p>
            </div>
          </div>
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shrink-0" onClick={openCreateDialog}>
            <UserPlus className="size-4" /> Nouvel agent
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge variant="secondary" className="bg-brand-50 text-brand-700">
            <Users className="size-3 mr-1" /> {totalAgents} total
          </Badge>
          <Badge variant="secondary" className="bg-green-50 text-green-700">
            <ShieldCheck className="size-3 mr-1" /> {activeAgents} actifs
          </Badge>
          <Badge variant="secondary" className="bg-amber-50 text-amber-700">
            {onMission} en mission
          </Badge>
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
            {completedMissions} missions
          </Badge>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50">
                <Users className="size-5 text-brand-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">{totalAgents}</p>
                <p className="text-xs text-muted-foreground">Total agents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-green-50">
                <ShieldCheck className="size-5 text-green-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-green-600">{activeAgents}</p>
                <p className="text-xs text-muted-foreground">Actifs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50">
                <Users className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-amber-600">{onMission}</p>
                <p className="text-xs text-muted-foreground">En mission</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50">
                <ShieldCheck className="size-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-emerald-600">{completedMissions}</p>
                <p className="text-xs text-muted-foreground">Missions terminées</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar: Search + View Toggle */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 min-w-0 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un agent..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
      </div>

      {/* Empty state */}
      {filteredAgents.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <Users className="size-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">
              {agents.length === 0 ? 'Aucun agent enregistré' : 'Aucun agent trouvé'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {agents.length === 0
                ? 'Ajoutez votre premier agent de vérification'
                : 'Essayez une autre recherche'}
            </p>
            {agents.length === 0 && (
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 mt-4"
                onClick={openCreateDialog}
              >
                <UserPlus className="size-4" /> Ajouter un agent
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'card' ? (
        /* ─── Card View ──────────────────────────────────────────────── */
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          <AnimatePresence mode="popLayout" initial={false} key={`page-${agentsPage}`}>
            {pagedAgents.map((agent) => (
              <motion.div
                key={agent.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <Card className={cn('border hover:shadow-md transition-shadow cursor-pointer', agent.isActive ? 'border-border' : 'border-border opacity-60')}
                  onClick={() => setSelectedAgent(agent)}
                >
                  <CardContent className="p-4 sm:p-6">
                    {/* Agent info row */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          'size-12 rounded-full flex items-center justify-center shrink-0',
                          agent.isActive ? 'bg-brand-500/10' : 'bg-muted'
                        )}>
                          <User className={cn('size-6', agent.isActive ? 'text-brand-500' : 'text-muted-foreground')} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-foreground truncate">
                            {agent.firstName} {agent.lastName}
                          </h3>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Mail className="size-3.5 shrink-0" />
                            <span className="truncate">{agent.email}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge className={agent.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                          {agent.isActive ? 'Actif' : 'Inactif'}
                        </Badge>
                        {agent.availability && (
                          <AvailabilityDot missionCount={agent.availability.missionCountNext7Days} />
                        )}
                      </div>
                    </div>

                    {/* Performance mini-stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-muted-foreground mb-3">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="size-3.5 shrink-0" />
                        <span>{agent.performance?.totalMissions ?? 0} missions</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                        <span>{agent.performance?.successRate ?? 0}%</span>
                      </div>
                      {agent.feedbackSummary && agent.feedbackSummary.avgRating > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />
                          <span>{agent.feedbackSummary.avgRating}/5</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Star className="size-3.5 shrink-0 text-muted-foreground/30" />
                          <span>—</span>
                        </div>
                      )}
                    </div>

                    {/* Availability info */}
                    {agent.availability && agent.availability.missionCountNext7Days > 0 && (
                      <div className="mb-3 text-xs text-muted-foreground bg-muted/50 rounded-md px-2.5 py-1.5">
                        <Calendar className="size-3 inline mr-1" />
                        {agent.availability.missionCountNext7Days === 1
                          ? `En mission le ${formatDate(agent.availability.upcomingMissions[0]?.scheduledAt ?? '')}`
                          : `${agent.availability.missionCountNext7Days} missions cette semaine`
                        }
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-2 border-t border-border" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 flex-1 text-brand-500 hover:text-brand-600 hover:bg-brand-50"
                        onClick={() => openFeedbackDialog(agent)}
                        disabled={actionLoading === agent.id}
                      >
                        <Star className="size-3.5" /> Feedback
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 flex-1 text-muted-foreground hover:text-foreground"
                        onClick={() => openEditDialog(agent)}
                        disabled={actionLoading === agent.id}
                      >
                        <Pencil className="size-3.5" /> Modifier
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className={cn(
                          'gap-1 flex-1',
                          agent.isActive
                            ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                            : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                        )}
                        onClick={() => handleToggleActive(agent)}
                        disabled={actionLoading === agent.id}
                      >
                        {actionLoading === agent.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : agent.isActive ? (
                          <PowerOff className="size-3.5" />
                        ) : (
                          <Power className="size-3.5" />
                        )}
                        {agent.isActive ? 'Désactiver' : 'Activer'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
                        onClick={() => setDeleteDialog({ open: true, agent })}
                        disabled={actionLoading === agent.id}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
          <PaginationControls
            page={agentsPage}
            totalPages={agentsTotalPages}
            total={agentsTotal}
            limit={agentsPageSize}
            onPageChange={setAgentsPage}
            className="md:col-span-2 lg:col-span-3"
          />
        </div>
      ) : (
        /* ─── List View ──────────────────────────────────────────────── */
        <Card className="border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left font-medium text-muted-foreground p-3">Nom</th>
                  <th className="text-left font-medium text-muted-foreground p-3 hidden md:table-cell">Email</th>
                  <th className="text-left font-medium text-muted-foreground p-3 hidden lg:table-cell">Téléphone</th>
                  <th className="text-center font-medium text-muted-foreground p-3">Statut</th>
                  <th className="text-center font-medium text-muted-foreground p-3 hidden sm:table-cell">Missions</th>
                  <th className="text-center font-medium text-muted-foreground p-3 hidden sm:table-cell">Réussite</th>
                  <th className="text-center font-medium text-muted-foreground p-3 hidden md:table-cell">Note</th>
                  <th className="text-center font-medium text-muted-foreground p-3 hidden lg:table-cell">Disponibilité</th>
                  <th className="text-right font-medium text-muted-foreground p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout" initial={false} key={`page-${agentsPage}`}>
                  {pagedAgents.map((agent) => (
                    <motion.tr
                      key={agent.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className={cn(
                        'border-b border-border hover:bg-muted/30 transition-colors cursor-pointer',
                        !agent.isActive && 'opacity-60'
                      )}
                      onClick={() => setSelectedAgent(agent)}
                    >
                      {/* Name */}
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            'size-8 rounded-full flex items-center justify-center shrink-0',
                            agent.isActive ? 'bg-brand-500/10' : 'bg-muted'
                          )}>
                            <User className={cn('size-4', agent.isActive ? 'text-brand-500' : 'text-muted-foreground')} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {agent.firstName} {agent.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate md:hidden">{agent.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="p-3 hidden md:table-cell">
                        <span className="text-muted-foreground truncate block max-w-[200px]">{agent.email}</span>
                      </td>

                      {/* Phone */}
                      <td className="p-3 hidden lg:table-cell text-muted-foreground">
                        {agent.phone || '—'}
                      </td>

                      {/* Status */}
                      <td className="p-3 text-center">
                        <Badge className={agent.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                          {agent.isActive ? 'Actif' : 'Inactif'}
                        </Badge>
                      </td>

                      {/* Missions */}
                      <td className="p-3 text-center hidden sm:table-cell">
                        <span className="font-medium text-foreground">{agent.performance?.totalMissions ?? 0}</span>
                      </td>

                      {/* Success rate */}
                      <td className="p-3 text-center hidden sm:table-cell">
                        <span className={cn(
                          'font-medium',
                          (agent.performance?.successRate ?? 0) >= 80 ? 'text-emerald-600' :
                          (agent.performance?.successRate ?? 0) >= 50 ? 'text-amber-600' : 'text-foreground'
                        )}>
                          {agent.performance?.successRate ?? 0}%
                        </span>
                      </td>

                      {/* Rating */}
                      <td className="p-3 text-center hidden md:table-cell">
                        {agent.feedbackSummary && agent.feedbackSummary.avgRating > 0 ? (
                          <div className="flex items-center justify-center gap-1">
                            <Star className="size-3.5 fill-amber-400 text-amber-400" />
                            <span className="font-medium text-foreground">{agent.feedbackSummary.avgRating}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Availability */}
                      <td className="p-3 text-center hidden lg:table-cell">
                        {agent.availability ? (
                          <AvailabilityDot missionCount={agent.availability.missionCountNext7Days} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-brand-500 hover:text-brand-600 hover:bg-brand-50 h-8 w-8 p-0"
                            onClick={() => openFeedbackDialog(agent)}
                            disabled={actionLoading === agent.id}
                            title="Donner un feedback"
                          >
                            <Star className="size-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-foreground h-8 w-8 p-0"
                            onClick={() => openEditDialog(agent)}
                            disabled={actionLoading === agent.id}
                            title="Modifier"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={cn(
                              'h-8 w-8 p-0',
                              agent.isActive
                                ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                                : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                            )}
                            onClick={() => handleToggleActive(agent)}
                            disabled={actionLoading === agent.id}
                            title={agent.isActive ? 'Désactiver' : 'Activer'}
                          >
                            {actionLoading === agent.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : agent.isActive ? (
                              <PowerOff className="size-4" />
                            ) : (
                              <Power className="size-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                            onClick={() => setDeleteDialog({ open: true, agent })}
                            disabled={actionLoading === agent.id}
                            title="Supprimer"
                          >
                            <Trash2 className="size-4" />
                          </Button>
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
              page={agentsPage}
              totalPages={agentsTotalPages}
              total={agentsTotal}
              limit={agentsPageSize}
              onPageChange={setAgentsPage}
            />
          </div>
        </Card>
      )}

      {/* ─── Add/Edit Agent Dialog ────────────────────────────────────── */}
      <Dialog
        open={formDialog.open}
        onOpenChange={(open) => {
          if (!open) setFormDialog({ open: false, mode: 'create', agent: null })
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {formDialog.mode === 'create' ? 'Nouvel agent' : 'Modifier l\'agent'}
            </DialogTitle>
            <DialogDescription>
              {formDialog.mode === 'create'
                ? 'Ajoutez un nouvel agent de vérification terrain'
                : 'Modifiez les informations de l\'agent'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom *</Label>
                <Input
                  id="firstName"
                  placeholder="Prénom"
                  value={formData.firstName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                  className={formErrors.firstName ? 'border-red-300' : ''}
                />
                {formErrors.firstName && (
                  <p className="text-xs text-red-600">{formErrors.firstName}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom *</Label>
                <Input
                  id="lastName"
                  placeholder="Nom"
                  value={formData.lastName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                  className={formErrors.lastName ? 'border-red-300' : ''}
                />
                {formErrors.lastName && (
                  <p className="text-xs text-red-600">{formErrors.lastName}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="agent@example.com"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                className={formErrors.email ? 'border-red-300' : ''}
              />
              {formErrors.email && (
                <p className="text-xs text-red-600">{formErrors.email}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                placeholder="07 00 00 00 00"
                value={formData.phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setFormDialog({ open: false, mode: 'create', agent: null })}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleFormSubmit}
              disabled={submitting}
            >
              {submitting && <Loader2 className="size-4 animate-spin mr-2" />}
              {formDialog.mode === 'create' ? 'Créer l\'agent' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Feedback Dialog (US-TA-055) ──────────────────────────────── */}
      <Dialog
        open={feedbackDialog.open}
        onOpenChange={(open) => {
          if (!open) setFeedbackDialog({ open: false, agent: null })
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Donner un feedback</DialogTitle>
            <DialogDescription>
              Évaluez la performance de {feedbackDialog.agent?.firstName} {feedbackDialog.agent?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Note *</Label>
              <div className="flex items-center gap-2">
                <StarRating value={feedbackRating} onChange={setFeedbackRating} size="md" />
                {feedbackRating > 0 && (
                  <span className="text-sm font-medium text-foreground ml-2">{feedbackRating}/5</span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedbackComment">Commentaire</Label>
              <Textarea
                id="feedbackComment"
                placeholder="Partagez votre expérience avec cet agent..."
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setFeedbackDialog({ open: false, agent: null })}
              disabled={feedbackSubmitting}
            >
              Annuler
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleFeedbackSubmit}
              disabled={feedbackSubmitting}
            >
              {feedbackSubmitting && <Loader2 className="size-4 animate-spin mr-2" />}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => { if (!open) setDeleteDialog({ open: false, agent: null }) }}
        title="Supprimer l'agent"
        description={`Êtes-vous sûr de vouloir supprimer l'agent ${deleteDialog.agent?.firstName ?? ''} ${deleteDialog.agent?.lastName ?? ''} ? Cette action est irréversible.`}
        confirmLabel={actionLoading !== null ? 'Suppression...' : 'Supprimer'}
        cancelLabel="Annuler"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </motion.div>
  )
}
