'use client'

import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Building2, Clock, CheckCircle2, AlertCircle, ChevronRight, UserCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { useRealtimeApplications } from '@/hooks/use-realtime-applications'
import { motion } from 'framer-motion'
import { PaginationControls } from '@/components/ui/pagination-controls'

// ─── Types ──────────────────────────────────────────────────────────────────
interface TimelineStep {
  status: string
  label: string
  completed: boolean
  active: boolean
}

interface ApplicationItem {
  id: string
  status: string
  monthlyIncome: number | null
  employer: string | null
  employmentType: string | null
  guarantorName: string | null
  rejectionReason: string | null
  tcComment: string | null
  reviewedAt: string | null
  validUntil: string | null
  createdAt: string
  updatedAt: string
  statusTimeline: TimelineStep[]
  linkedProperty: {
    id: string
    title: string
    address: string
    city: string
    type: string
    price: number
    currency: string
    images: Array<{ url: string }>
    owner: { id: string; firstName: string; lastName: string }
  } | null
  documentProgress: {
    total: number
    validated: number
    rejected: number
    pending: number
  }
  reviewedBy: { id: string; firstName: string; lastName: string } | null
}

interface ApplicationsResponse {
  data: ApplicationItem[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
  stats: Record<string, number>
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  DRAFT: { label: 'Brouillon', color: 'bg-muted text-muted-foreground', icon: FileText },
  SUBMITTED: { label: 'Soumis', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  ACCEPTED: { label: 'Accepté', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  REJECTED: { label: 'Rejeté', color: 'bg-red-50 text-red-700 border-red-200', icon: AlertCircle },
  EXPIRED: { label: 'Expiré', color: 'bg-muted text-muted-foreground border-border', icon: Clock },
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
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

interface ApplicationsProps {
  onDetail: (id: string) => void
}

export function Applications({ onDetail }: ApplicationsProps) {
  const { user, isAuthenticated, setDashboardSection } = useAuthStore()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const limit = 10

  const queryKey = ['applications']

  const { data, isLoading, error } = useQuery<ApplicationsResponse>({
    queryKey,
    queryFn: async () => {
      const result = await authFetch<ApplicationsResponse>('/api/applications')
      return result
    },
    enabled: isAuthenticated,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  })

  const applications = data?.data ?? []
  const stats = data?.stats ?? {}

  const filteredApplications = useMemo(() => {
    if (!statusFilter) return applications
    return applications.filter((a) => a.status === statusFilter)
  }, [applications, statusFilter])

  const paginatedApplications = useMemo(() => {
    const start = (page - 1) * limit
    return filteredApplications.slice(start, start + limit)
  }, [filteredApplications, page, limit])

  const handleStatusFilter = (status: string | null) => {
    setStatusFilter(status)
    setPage(1)
  }

  // Realtime subscription for applications
  useRealtimeApplications({
    userId: user?.id,
    onApplicationChange: async () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const handleEditRentalFile = () => {
    setDashboardSection('rental-file')
  }

  // ─── Loading skeleton ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-56 bg-muted animate-pulse rounded mt-2" />
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  // ─── Error state ───────────────────────────────────────────────────────
  if (error && !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Mes Candidatures</h1>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-sm text-amber-700">Impossible de charger vos candidatures. Veuillez réessayer.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants} className="bg-gradient-to-r from-brand-500/10 to-transparent rounded-xl p-4 sm:p-6 -mx-4 sm:-mx-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-brand-100 shrink-0">
            <FileText className="size-6 text-brand-500" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Mes Candidatures</h1>
            <p className="text-muted-foreground mt-0.5">Suivez vos candidatures de location</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge variant="secondary" className="bg-brand-50 text-brand-700">
            <FileText className="size-3 mr-1" /> {applications.length} candidature{applications.length > 1 ? 's' : ''}
          </Badge>
          {(stats.SUBMITTED ?? 0) > 0 && (
            <Badge variant="secondary" className="bg-amber-50 text-amber-700">
              {stats.SUBMITTED} en attente
            </Badge>
          )}
          {(stats.ACCEPTED ?? 0) > 0 && (
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
              {stats.ACCEPTED} acceptée{(stats.ACCEPTED ?? 0) > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </motion.div>

      {/* Status filter pills */}
      <motion.div variants={itemVariants} className="flex flex-wrap gap-2">
        <button
          onClick={() => handleStatusFilter(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            statusFilter === null
              ? 'bg-brand-500 text-white shadow-sm'
              : 'bg-muted text-muted-foreground hover:bg-neutral-200'
          }`}
        >
          Toutes ({applications.length})
        </button>
        {Object.entries(statusConfig).map(([status, cfg]) => {
          const count = stats[status] ?? 0
          if (count === 0 && statusFilter !== status) return null
          const Icon = cfg.icon
          return (
            <button
              key={status}
              onClick={() => handleStatusFilter(status)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                statusFilter === status
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-neutral-200'
              }`}
            >
              <Icon className="size-3" />
              {cfg.label} ({count})
            </button>
          )
        })}
      </motion.div>

      {filteredApplications.length === 0 && applications.length === 0 ? (
        /* Empty State (no applications at all) */
        <>
          <motion.div variants={itemVariants}>
            <Card className="border-dashed border-border bg-muted/50">
              <CardContent className="py-12 flex flex-col items-center text-center">
                <div className="flex size-16 items-center justify-center rounded-full bg-brand-50 mb-4">
                  <UserCheck className="size-7 text-brand-500" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  Aucune candidature en cours
                </h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                  {user?.firstName}, créez votre dossier locatif pour postuler aux logements.
                </p>
                <Button
                  onClick={handleEditRentalFile}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <FileText className="size-4 mr-2" />
                  Créer mon dossier
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* How it works */}
          <motion.div variants={itemVariants}>
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                  <UserCheck className="size-4 text-brand-500" />
                  Comment ça marche ?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  'Trouvez un bien qui vous correspond',
                  'Soumettez votre dossier de candidature',
                  "Suivez l'avancement en temps réel ici",
                ].map((text, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white text-xs font-bold">
                      {i + 1}
                    </div>
                    <p className="text-sm text-muted-foreground">{text}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </>
      ) : filteredApplications.length === 0 ? (
        /* Empty filter results */
        <motion.div variants={itemVariants}>
          <Card className="border-dashed border-border bg-muted/50">
            <CardContent className="py-12 flex flex-col items-center text-center">
              <AlertCircle className="size-10 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-1">
                Aucune candidature avec ce statut
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Essayez de sélectionner un autre filtre.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        /* Applications List */
        <motion.div variants={containerVariants} className="space-y-3">
          {paginatedApplications.map((app) => {
            const config = statusConfig[app.status] || statusConfig.DRAFT
            const StatusIcon = config.icon
            const property = app.linkedProperty
            const dp = app.documentProgress

            return (
              <motion.div key={app.id} variants={itemVariants}>
                <Card
                  className="border-border hover:shadow-sm transition-shadow cursor-pointer"
                  onClick={() => onDetail(app.id)}
                >
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start gap-3 sm:gap-4">
                      {/* Property image or icon */}
                      <div className="size-12 sm:size-14 shrink-0 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                        {property?.images?.[0]?.url ? (
                          <img src={property.images[0].url} alt="" className="size-full object-cover" />
                        ) : (
                          <Building2 className="size-6 text-neutral-300" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Top row: title + status */}
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {property?.title || 'Candidature'}
                          </p>
                          <Badge variant="outline" className={`shrink-0 text-[10px] px-2 py-0.5 border ${config.color}`}>
                            <StatusIcon className="size-3 mr-1" />
                            {config.label}
                          </Badge>
                        </div>

                        {property && (
                          <p className="text-xs text-muted-foreground mb-2 truncate">
                            {property.address}, {property.city}
                          </p>
                        )}

                        {/* Status Timeline - full on desktop, simplified on mobile */}
                        <div className="hidden sm:flex items-center gap-1 mb-3">
                          {app.statusTimeline.map((step, i) => (
                            <div key={step.status} className="flex items-center gap-1">
                              <div className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium ${
                                step.completed
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : step.active
                                    ? 'bg-brand-50 text-brand-600 ring-1 ring-brand-200'
                                    : 'bg-muted text-muted-foreground'
                              }`}>
                                {step.completed ? (
                                  <CheckCircle2 className="size-3" />
                                ) : step.active ? (
                                  <ChevronRight className="size-3" />
                                ) : (
                                  <div className="size-1.5 rounded-full bg-neutral-300" />
                                )}
                                {step.label}
                              </div>
                              {i < app.statusTimeline.length - 1 && (
                                <div className={`w-4 h-px ${step.completed ? 'bg-emerald-300' : 'bg-neutral-200'}`} />
                              )}
                            </div>
                          ))}
                        </div>
                        {/* Simplified mobile timeline - current step only */}
                        <div className="sm:hidden flex items-center gap-2 mb-3">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-500 rounded-full transition-all"
                              style={{
                                width: `${app.statusTimeline.length > 0
                                  ? ((app.statusTimeline.filter(s => s.completed).length) / app.statusTimeline.length) * 100
                                  : 0}%`
                              }}
                            />
                          </div>
                          {(() => {
                            const current = app.statusTimeline.find(s => s.active) || app.statusTimeline.filter(s => s.completed).pop()
                            return current ? (
                              <span className="text-[10px] font-medium text-brand-600 shrink-0">
                                {current.label}
                              </span>
                            ) : null
                          })()}
                        </div>

                        {/* Document Progress */}
                        {dp.total > 0 && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="hidden sm:inline">Documents :</span>
                            <div className="flex-1 min-w-[80px] max-w-[160px] sm:max-w-[200px] h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all"
                                style={{ width: `${dp.total > 0 ? (dp.validated / dp.total) * 100 : 0}%` }}
                              />
                            </div>
                            <span className="text-[10px]">
                              {dp.validated}/{dp.total} validé{dp.validated > 1 ? 's' : ''}
                            </span>
                          </div>
                        )}

                        {/* Rejection reason */}
                        {app.rejectionReason && (
                          <div className="mt-2 p-2 rounded bg-red-50 border border-red-100">
                            <p className="text-xs text-red-600 line-clamp-1">
                              <AlertCircle className="size-3 inline mr-1" />
                              {app.rejectionReason}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Chevron */}
                      <ChevronRight className="size-5 text-neutral-300 shrink-0 self-center" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {/* Pagination */}
      {filteredApplications.length > limit && (
        <PaginationControls
          page={page}
          totalPages={Math.ceil(filteredApplications.length / limit)}
          onPageChange={setPage}
        />
      )}
    </motion.div>
  )
}
