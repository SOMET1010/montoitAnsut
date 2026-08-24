'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  FileText,
  Eye,
  Calendar,
  PenLine,
  Key,
  Building2,
  MapPin,
  Filter,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { useRealtimeInventoryReports } from '@/hooks/use-realtime-inventory-reports'
import { ViewModeToggle, type ViewMode } from './view-mode-toggle'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ReportDetailDialog, typeLabels, statusConfig, formatDate } from './report-detail-dialog'
import type { InventoryReport } from './report-detail-dialog'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface ReportsResponse {
  reports: InventoryReport[]
  pagination: PaginationInfo
}

// ─── Main Component ──────────────────────────────────────────────────────────────

export function InventoryReportsList() {
  const { user, isAuthenticated, setSelectedItemId, setDashboardSection, setSelectedPropertyId } =
    useAuthStore()
  const [reports, setReports] = useState<InventoryReport[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [filterType, setFilterType] = useState<'ALL' | 'INVENTORY_ENTRANCE' | 'INVENTORY_EXIT'>(
    'ALL'
  )
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [detailReport, setDetailReport] = useState<InventoryReport | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // ─── Fetch ───────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    try {
      const params = new URLSearchParams()
      if (filterType !== 'ALL') params.set('type', filterType)
      if (filterStatus !== 'ALL') params.set('status', filterStatus)
      const qs = params.toString()
      const url = `/api/tc/inventory-reports${qs ? `?${qs}` : ''}`

      const d = await authFetch<ReportsResponse>(url)
      setReports(d.reports || [])
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) {
        setReports([])
        return
      }
      setReports([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, filterType, filterStatus])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useRealtimeInventoryReports({
    userId: user?.id,
    watchAll: true,
    onInventoryReportChange: () => { fetchData() },
  })

  const {
    paginatedItems: pagedReports,
    page: reportsPage,
    totalPages: reportsTotalPages,
    total: reportsTotal,
    pageSize: reportsPageSize,
    setPage: setReportsPage,
  } = usePagination({
    items: reports,
    pageSize: 10,
    resetSignal: `${filterType}|${filterStatus}`,
  })

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleEditDraft = (report: InventoryReport) => {
    // Pass the report ID so the form can load existing data via PATCH
    setSelectedItemId(report.id)
    setSelectedPropertyId(report.propertyId)
    setDashboardSection('inventory-report-form')
  }

  const handleViewDetail = (report: InventoryReport) => {
    setDetailReport(report)
    setDetailOpen(true)
  }

  const handleReportClick = (report: InventoryReport) => {
    if (report.status === 'DRAFT') {
      handleEditDraft(report)
    } else {
      handleViewDetail(report)
    }
  }

  // ─── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header + View toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="bg-gradient-to-r from-brand-500/10 to-transparent rounded-xl p-4 sm:p-6 -mx-4 sm:-mx-6 flex-1">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-brand-100 shrink-0">
              <FileText className="size-6 text-brand-500" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                Rapports d&apos;état des lieux
              </h1>
              <p className="text-muted-foreground mt-0.5">
                Consultez et gérez les rapports existants
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="secondary" className="bg-brand-50 text-brand-700">
              <FileText className="size-3 mr-1" /> {reports.length} rapport{reports.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </div>
        <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
      </div>

      {/* Filters */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Type filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Filter className="size-3.5 text-muted-foreground mr-1" />
              <span className="text-xs font-medium text-muted-foreground mr-1">Type:</span>
              {(['ALL', 'INVENTORY_ENTRANCE', 'INVENTORY_EXIT'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    filterType === type
                      ? 'bg-brand-500 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {type === 'ALL' ? 'Tous' : typeLabels[type]}
                </button>
              ))}
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground mr-1">Statut:</span>
              {(
                ['ALL', 'DRAFT', 'COMPLETED', 'SIGNED_OWNER', 'SIGNED_TENANT', 'SIGNED_BOTH'] as const
              ).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    filterStatus === status
                      ? 'bg-brand-500 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {status === 'ALL' ? 'Tous' : statusConfig[status]?.label || status}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Empty state */}
      {reports.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <FileText className="size-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">
              Aucun rapport d&apos;état des lieux
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Les rapports créés apparaîtront ici
            </p>
          </CardContent>
        </Card>
      ) : (
        <AnimatePresence mode="wait">
          {viewMode === 'card' ? (
            <motion.div
              key="card-view"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {pagedReports.map((report, idx) => {
                const config = statusConfig[report.status] || statusConfig.DRAFT
                const StatusIcon = config.icon
                const isDraft = report.status === 'DRAFT'

                return (
                  <motion.div
                    key={report.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.04 }}
                  >
                    <Card className="border-border hover:shadow-md transition-all duration-200 h-full">
                      <CardContent className="p-4 flex flex-col h-full">
                        {/* Top — Icon + Title */}
                        <div className="flex items-start gap-3 flex-1">
                          <div className="size-10 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                            <FileText className="size-5 text-brand-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground truncate text-sm">
                              {report.property?.title || 'Bien sans titre'}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                              <MapPin className="size-3 shrink-0" />
                              <span className="truncate">
                                {report.property?.address}
                                {report.property?.city ? `, ${report.property.city}` : ''}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          <Badge variant="outline" className="text-[11px]">
                            {typeLabels[report.type] || report.type}
                          </Badge>
                          <Badge className={cn('text-[11px]', config.className)}>
                            <StatusIcon className="size-3 mr-1" />
                            {config.label}
                          </Badge>
                        </div>

                        {/* Meta row */}
                        <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3" />
                            {formatDate(report.createdAt)}
                          </span>
                          <span>
                            {report.items?.length || 0} élément(s)
                          </span>
                          {report.totalKeys != null && report.totalKeys > 0 && (
                            <span className="flex items-center gap-1">
                              <Key className="size-3" />
                              {report.totalKeys} clé(s)
                            </span>
                          )}
                        </div>

                        {/* Action */}
                        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
                          <Button
                            size="sm"
                            variant={isDraft ? 'default' : 'outline'}
                            className={cn(
                              'gap-1.5 text-xs h-8',
                              isDraft &&
                                'bg-primary hover:bg-primary/90 text-primary-foreground'
                            )}
                            onClick={() => handleReportClick(report)}
                          >
                            {isDraft ? (
                              <>
                                <PenLine className="size-3.5" />
                                Modifier
                              </>
                            ) : (
                              <>
                                <Eye className="size-3.5" />
                                Voir le détail
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
              <PaginationControls
                page={reportsPage}
                totalPages={reportsTotalPages}
                total={reportsTotal}
                limit={reportsPageSize}
                onPageChange={setReportsPage}
                className="sm:col-span-2 lg:col-span-3"
              />
            </motion.div>
          ) : (
            <motion.div
              key="list-view"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="border-border overflow-hidden">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="text-xs font-bold">Bien</TableHead>
                      <TableHead className="text-xs font-bold hidden sm:table-cell">Type</TableHead>
                      <TableHead className="text-xs font-bold">Statut</TableHead>
                      <TableHead className="text-xs font-bold hidden md:table-cell">Date</TableHead>
                      <TableHead className="text-xs font-bold text-center hidden md:table-cell">Éléments</TableHead>
                      <TableHead className="text-xs font-bold text-center hidden lg:table-cell">Clés</TableHead>
                      <TableHead className="text-xs font-bold text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedReports.map((report, idx) => {
                      const config = statusConfig[report.status] || statusConfig.DRAFT
                      const StatusIcon = config.icon
                      const isDraft = report.status === 'DRAFT'

                      return (
                        <motion.tr
                          key={report.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.15, delay: idx * 0.03 }}
                          className="hover:bg-muted/30 transition-colors border-b border-border"
                        >
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="size-8 rounded-md bg-brand-50 flex items-center justify-center shrink-0">
                                <FileText className="size-4 text-brand-500" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate max-w-[180px]">
                                  {report.property?.title || 'Bien sans titre'}
                                </p>
                                <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                                  {report.property?.city}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant="outline" className="text-[11px]">
                              {typeLabels[report.type] || report.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn('text-[11px]', config.className)}>
                              <StatusIcon className="size-3 mr-1" />
                              {config.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap hidden md:table-cell">
                            {formatDate(report.createdAt)}
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground hidden md:table-cell">
                            {report.items?.length || 0}
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground hidden lg:table-cell">
                            {report.totalKeys != null && report.totalKeys > 0 ? (
                              <span className="flex items-center justify-center gap-1">
                                <Key className="size-3" />
                                {report.totalKeys}
                              </span>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant={isDraft ? 'default' : 'outline'}
                              className={cn(
                                'gap-1.5 text-xs h-7',
                                isDraft &&
                                  'bg-primary hover:bg-primary/90 text-primary-foreground'
                              )}
                              onClick={() => handleReportClick(report)}
                            >
                              {isDraft ? (
                                <>
                                  <PenLine className="size-3" />
                                  Modifier
                                </>
                              ) : (
                                <>
                                  <Eye className="size-3" />
                                  Voir
                                </>
                              )}
                            </Button>
                          </TableCell>
                        </motion.tr>
                      )
                    })}
                  </TableBody>
                </Table>
                </div>
                <div className="px-4 pb-3">
                  <PaginationControls
                    page={reportsPage}
                    totalPages={reportsTotalPages}
                    total={reportsTotal}
                    limit={reportsPageSize}
                    onPageChange={setReportsPage}
                  />
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Detail dialog for non-DRAFT reports */}
      <ReportDetailDialog
        report={detailReport}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </motion.div>
  )
}
