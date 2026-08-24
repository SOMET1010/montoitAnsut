'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileText, Plus, CheckCircle2, AlertCircle, Clock, ArrowRight, Loader2, Send } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

import type { RentalFileItem } from './rental-file'

const statusConfig: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Brouillon', color: 'bg-muted text-muted-foreground border-border' },
  SUBMITTED: { label: 'Soumis', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  TC_REVIEW: { label: 'En examen TC', color: 'bg-brand-50 text-brand-600 border-brand-200' },
  VALIDATED: { label: 'Validé', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED: { label: 'Rejeté', color: 'bg-red-50 text-red-700 border-red-200' },
  EXPIRED: { label: 'Expiré', color: 'bg-neutral-100 text-neutral-600 border-neutral-200' },
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface RentalFilesResponse {
  data: RentalFileItem[]
  stats: Record<string, number>
}

export function RentalFilesList() {
  const { isAuthenticated, setDashboardSection } = useAuthStore()
  const [files, setFiles] = useState<RentalFileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [creating, setCreating] = useState(false)

  const fetchFiles = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return }
    try {
      // Fetch ALL files including non-DRAFT ones (no status filter)
      const result = await authFetch<RentalFilesResponse>('/api/rental-file')
      setFiles(result.data ?? [])
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) return
      setFiles([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => { fetchFiles() }, [fetchFiles])

  const handleCreateNewDraft = async () => {
    setCreating(true)
    try {
      const raw: any = await authFetch('/api/rental-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (raw?.data?.id) {
        toast.success('Nouveau dossier créé')
        setShowCreateDialog(false)
        fetchFiles()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la création')
    } finally {
      setCreating(false)
    }
  }

  const handleResubmit = async (fileId: string) => {
    try {
      await authFetch('/api/rental-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submit: true }),
      })
      toast.success('Dossier soumis à nouveau')
      fetchFiles()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la soumission')
    }
  }

  const sortedFiles = [...files].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )

  const statusOrder = ['DRAFT', 'SUBMITTED', 'TC_REVIEW', 'VALIDATED', 'REJECTED', 'EXPIRED']
  const groupedFiles = statusOrder
    .map((status) => ({
      status,
      label: statusConfig[status]?.label || status,
      color: statusConfig[status]?.color || '',
      files: sortedFiles.filter((f) => f.status === status),
    }))
    .filter((g) => g.files.length > 0)

  const docCountByStatus = (file: RentalFileItem) => {
    const total = file.documents?.length || 0
    const validated = file.documents?.filter((d) => d.status === 'VALIDATED').length || 0
    return { total, validated }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-32 bg-muted animate-pulse rounded-xl" />
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-500/10 to-transparent rounded-xl p-4 sm:p-6 -mx-4 sm:-mx-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-brand-100 shrink-0">
            <FileText className="size-6 text-brand-500" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Mes dossiers locatifs</h1>
            <p className="text-muted-foreground mt-0.5">
              Créez et gérez plusieurs dossiers pour postuler à différentes annonces
            </p>
          </div>
          {files.filter((f) => f.status === 'DRAFT').length === 0 && (
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shrink-0"
              onClick={handleCreateNewDraft}
              disabled={creating}
            >
              {creating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              <span className="hidden sm:inline">Nouveau dossier</span>
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge variant="secondary" className="bg-brand-50 text-brand-700">
            {files.length} dossier{files.length > 1 ? 's' : ''}
          </Badge>
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
            {files.filter((f) => f.status === 'VALIDATED').length} validé{files.filter((f) => f.status === 'VALIDATED').length > 1 ? 's' : ''}
          </Badge>
          <Badge variant="secondary" className="bg-amber-50 text-amber-700">
            {files.filter((f) => f.status === 'DRAFT').length} brouillon{files.filter((f) => f.status === 'DRAFT').length > 1 ? 's' : ''}
          </Badge>
        </div>
      </div>

      {/* Files list */}
      {sortedFiles.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <FileText className="size-12 text-neutral-300 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">Aucun dossier locatif</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Créez votre premier dossier pour commencer à postuler aux annonces
            </p>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              onClick={handleCreateNewDraft}
              disabled={creating}
            >
              {creating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Créer un dossier
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groupedFiles.map((group) => (
            <div key={group.status}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-block size-2 rounded-full ${
                  group.status === 'DRAFT' ? 'bg-neutral-400' :
                  group.status === 'REJECTED' ? 'bg-red-400' :
                  group.status === 'VALIDATED' ? 'bg-emerald-400' :
                  group.status === 'EXPIRED' ? 'bg-neutral-400' :
                  'bg-amber-400'
                }`} />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {group.label}
                </span>
                <span className="text-[10px] text-muted-foreground">({group.files.length})</span>
              </div>
              {group.files.map((file) => {
                const config = statusConfig[file.status]
                const docs = docCountByStatus(file)
                return (
                  <Card key={file.id} className={`border ${config?.color.split(' ').slice(-1)[0] || 'border-border'} mb-2`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {file.status === 'VALIDATED' ? (
                              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                            ) : file.status === 'REJECTED' ? (
                              <AlertCircle className="size-4 text-red-500 shrink-0" />
                            ) : file.status === 'EXPIRED' ? (
                              <Clock className="size-4 text-neutral-500 shrink-0" />
                            ) : (
                              <FileText className="size-4 text-muted-foreground shrink-0" />
                            )}
                            <span className="text-sm font-semibold text-foreground">
                              Dossier du {formatDate(file.createdAt)}
                            </span>
                            <Badge variant="outline" className={`text-[10px] ${config?.color}`}>
                              {config?.label}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 text-xs">
                            {file.tenantCategory && (
                              <div>
                                <span className="text-muted-foreground">Catégorie</span>
                                <p className="font-medium text-foreground">{file.tenantCategory}</p>
                              </div>
                            )}
                            {file.monthlyIncome && (
                              <div>
                                <span className="text-muted-foreground">Revenus</span>
                                <p className="font-medium text-foreground">
                                  {file.monthlyIncome.toLocaleString('fr-FR')} FCFA/mois
                                </p>
                              </div>
                            )}
                            <div>
                              <span className="text-muted-foreground">Documents</span>
                              <p className="font-medium text-foreground">
                                {docs.validated}/{docs.total} validé{docs.total > 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>

                          {/* Leases linked to this file */}
                          {file.leases && file.leases.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {file.leases.map((lease) => (
                                <Badge key={lease.id} variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700">
                                  Bail : {lease.property?.title || '—'}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {/* Rejection / TC comment */}
                          {file.rejectionReason && (
                            <div className="mt-2 p-2 rounded bg-red-50 border border-red-100">
                              <p className="text-[10px] font-semibold text-red-700">Motif du rejet</p>
                              <p className="text-[10px] text-red-600 mt-0.5">{file.rejectionReason}</p>
                            </div>
                          )}
                          {file.tcComment && !file.rejectionReason && (
                            <div className="mt-2 p-2 rounded bg-amber-50 border border-amber-100">
                              <p className="text-[10px] font-semibold text-amber-700">Commentaire TC</p>
                              <p className="text-[10px] text-amber-600 mt-0.5">{file.tcComment}</p>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-1 shrink-0">
                          {/* Resubmit button for rejected/expired */}
                          {(file.status === 'REJECTED' || file.status === 'EXPIRED') && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs gap-1 border-brand-200 text-brand-600 hover:bg-brand-50"
                              onClick={() => handleResubmit(file.id)}
                            >
                              <Send className="size-3" />
                              Resoumettre
                            </Button>
                          )}
                          {/* Continue editing draft */}
                          {file.status === 'DRAFT' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs gap-1"
                              onClick={() => setDashboardSection('rental-file')}
                            >
                              <ArrowRight className="size-3" />
                              Continuer
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
