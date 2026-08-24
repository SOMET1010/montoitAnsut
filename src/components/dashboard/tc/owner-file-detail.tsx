'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft, User, Mail, Phone, Calendar,
  FileText, Building2, Check, X, MessageSquare,
  Loader2, ChevronRight, Shield, RotateCcw,
} from 'lucide-react'
import { useBackHandler } from '@/hooks/use-back-handler'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { useRealtimeOwnerFiles } from '@/hooks/use-realtime-owner-files'
import { DocumentPreviewDialog } from './document-preview-dialog'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface OwnerDoc {
  id: string
  ownerFileId: string
  type: string
  name: string
  url: string
  status: string
  tcComment: string | null
  createdAt: string
}

interface OwnerFile {
  id: string
  ownerId: string
  status: string
  priority: string
  onHold: boolean
  onHoldReason: string | null
  tcComment: string | null
  rejectionReason: string | null
  reviewedById: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
  owner: {
    id: string
    firstName: string
    lastName: string
    phone: string
    email: string
    avatarUrl: string | null
  } | null
  documents: OwnerDoc[]
  previouslyRejected?: boolean
  lastRejectedAt?: string | null
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Brouillon',
  SUBMITTED: 'Soumis',
  TC_REVIEW: 'Complément demandé',
  VALIDATED: 'Validé',
  REJECTED: 'Rejeté',
  EXPIRED: 'Expiré',
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-amber-100 text-amber-700',
  TC_REVIEW: 'bg-orange-100 text-orange-700',
  VALIDATED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-gray-100 text-gray-500',
}

const docStatusColors: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  VALIDATED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}

const docStatusLabels: Record<string, string> = {
  PENDING: 'En attente',
  VALIDATED: 'Validé',
  REJECTED: 'Rejeté',
}

const typeLabels: Record<string, string> = {
  ID_CARD: "Pièce d'identité",
  PASSPORT: 'Passeport',
  PROPERTY_TITLE: 'Titre de propriété',
  UTILITY_BILL: 'Facture',
  BANK_ACCOUNT_DETAILS: 'Relevé bancaire',
  OTHER: 'Autre',
}

export function OwnerFileDetail() {
  const { user, isAuthenticated, selectedItemId, setDashboardSection, setSelectedItemId } = useAuthStore()

  const [file, setFile] = useState<OwnerFile | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [previewDoc, setPreviewDoc] = useState<{
    open: boolean
    url: string
    name: string
    type?: string
  }>({ open: false, url: '', name: '' })

  const [actionLoading, setActionLoading] = useState(false)

  const [rejectDialog, setRejectDialog] = useState(false)
  const [rejectComment, setRejectComment] = useState('')

  const [requestInfoDialog, setRequestInfoDialog] = useState(false)
  const [requestInfoComment, setRequestInfoComment] = useState('')

  const [onHoldDialog, setOnHoldDialog] = useState(false)
  const [onHoldReason, setOnHoldReason] = useState('')

  const goBack = () => {
    setSelectedItemId('')
    setDashboardSection('dossier-validations')
  }

  useBackHandler('owner-file-detail', goBack)

  /**
   * Fetch the file. Avec `silent=true` (utilisé par le realtime), ne touche
   * pas au loading state ni à `file` → l'UI reste affichée pendant le refresh
   * en arrière-plan, pas de flicker. Le state n'est mis à jour qu'à la fin
   * si la donnée a effectivement changé.
   */
  const fetchFile = useCallback(async (opts?: { skipCache?: boolean; silent?: boolean }) => {
    if (!isAuthenticated || !selectedItemId) {
      setLoading(false)
      setNotFound(true)
      return
    }

    if (!opts?.silent) {
      setLoading(true)
      setNotFound(false)
      setFile(null)
    }

    try {
      const d = await authFetch<{ files: OwnerFile[] }>(
        `/api/tc/owner-files?id=${selectedItemId}`,
        opts?.skipCache ? { skipCache: true } : undefined
      )
      const found = d.files?.[0]
      if (found) {
        setFile((prev) => {
          // Comparaison naïve par updated_at : évite un re-render si rien n'a changé
          if (prev && prev.updatedAt === found.updatedAt) return prev
          return found
        })
      } else if (!opts?.silent) {
        setNotFound(true)
      }
    } catch (err) {
      if (!opts?.silent) {
        if (err instanceof AuthError && err.status === 401) {
          setNotFound(true)
          return
        }
        setNotFound(true)
      }
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [isAuthenticated, selectedItemId])

  useEffect(() => {
    fetchFile()
  }, [fetchFile])

  useRealtimeOwnerFiles({
    userId: user?.id,
    fileId: selectedItemId || undefined,
    // Refresh silencieux : pas de spinner ni flicker, seule la donnée se met à jour
    onOwnerFileChange: () => { fetchFile({ skipCache: true, silent: true }) },
  })

  const handleAction = useCallback(async (action: 'APPROVE' | 'REJECT' | 'REQUEST_INFO', comment?: string) => {
    if (!file) return
    setActionLoading(true)
    try {
      const body: any = { fileIds: [file.id], action, comment: comment || '' }

      if (file.documents.length > 0) {
        if (action === 'APPROVE') {
          body.documentUpdates = file.documents.map((doc) => ({
            documentId: doc.id,
            status: 'VALIDATED',
          }))
        } else if (action === 'REJECT') {
          body.documentUpdates = file.documents.map((doc) => ({
            documentId: doc.id,
            status: 'REJECTED',
            comment: comment || null,
          }))
        }
      }

      await authFetch('/api/tc/owner-files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      toast.success(
        action === 'APPROVE'
          ? 'Dossier validé avec succès !'
          : action === 'REJECT'
            ? 'Dossier rejeté.'
            : "Demande d'information envoyée."
      )
      setRejectDialog(false)
      setRequestInfoDialog(false)
      setRejectComment('')
      setRequestInfoComment('')
      await fetchFile(true)
    } catch (err) {
      if (err instanceof AuthError) {
        toast.error(err.message)
      } else {
        toast.error("Erreur lors de l'action.")
      }
    } finally {
      setActionLoading(false)
    }
  }, [file, fetchFile])

  const handleValidate = () => handleAction('APPROVE')

  const handleRejectConfirm = () => {
    if (rejectComment.trim()) {
      handleAction('REJECT', rejectComment)
    }
  }

  const handleRequestInfoConfirm = () => {
    if (requestInfoComment.trim()) {
      handleAction('REQUEST_INFO', requestInfoComment)
    }
  }

  const handleOnHold = async () => {
    if (!file) return
    setActionLoading(true)
    try {
      await authFetch('/api/tc/owner-files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: file.id,
          onHold: true,
          onHoldReason: onHoldReason.trim(),
        }),
      })
      toast.success('Dossier mis en attente')
      setOnHoldDialog(false)
      setOnHoldReason('')
      await fetchFile(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setActionLoading(false)
    }
  }

  const handleResume = async () => {
    if (!file) return
    setActionLoading(true)
    try {
      await authFetch('/api/tc/owner-files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: file.id, onHold: false }),
      })
      toast.success('Dossier repris')
      await fetchFile(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 rounded bg-muted animate-pulse" />
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
        <div className="h-48 rounded-xl bg-muted animate-pulse" />
      </div>
    )
  }

  if (notFound || !file) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={goBack} className="gap-2">
          <ArrowLeft className="size-4" /> Retour
        </Button>
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <FileText className="size-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">Dossier introuvable</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ce dossier n&apos;existe pas ou vous n&apos;avez pas les droits pour le consulter.
            </p>
            <Button variant="outline" className="mt-4 gap-2" onClick={goBack}>
              <ArrowLeft className="size-4" /> Retour aux dossiers
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const canAction = (file.status === 'SUBMITTED' || file.status === 'TC_REVIEW') && !file.onHold

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-500/10 to-transparent rounded-xl p-4 sm:p-6 -mx-4 sm:-mx-6">
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" onClick={goBack} className="gap-2 -ml-2">
            <ArrowLeft className="size-4" /> Retour
          </Button>

          <div className="flex items-center gap-2">
            {file.onHold && (
              <Badge className="bg-amber-100 text-amber-700 gap-1">
                En attente
              </Badge>
            )}
            <Badge className={statusColors[file.status]}>{statusLabels[file.status] || file.status}</Badge>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-brand-100 shrink-0">
            <FileText className="size-5 text-brand-500" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground truncate">
              {file.owner ? `${file.owner.firstName} ${file.owner.lastName}` : 'Propriétaire'}
            </h2>
            <p className="text-sm text-muted-foreground">Détail du dossier propriétaire</p>
          </div>
        </div>

        {file.previouslyRejected && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700">
            <RotateCcw className="size-3.5 shrink-0" />
            <span>
              Ce dossier a déjà été rejeté et a été resoumis.
              {file.lastRejectedAt && (
                <> Dernier rejet le <strong>{new Date(file.lastRejectedAt).toLocaleDateString('fr-FR')}</strong>.</>
              )}
              {' '}Soyez vigilant lors de la validation.
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Owner info card */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-full bg-brand-500/10 flex items-center justify-center">
                    <User className="size-6 text-brand-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold text-foreground">
                      {file.owner ? `${file.owner.firstName} ${file.owner.lastName}` : 'Propriétaire'}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">Propriétaire</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {file.owner && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="size-4 shrink-0" />
                    <span className="truncate">{file.owner.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="size-4 shrink-0" />
                    <span>{file.owner.phone}</span>
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="border-t border-border pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 shrink-0" />
                    <span>Soumis le {new Date(file.createdAt).toLocaleDateString('fr-FR')}</span>
                  </div>
                  {file.reviewedAt && (
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4 shrink-0" />
                      <span>Revu le {new Date(file.reviewedAt).toLocaleDateString('fr-FR')}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Documents card */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="size-4 text-brand-500" />
                Documents ({file.documents.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {file.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Aucun document fourni</p>
              ) : (
                <div className="space-y-2">
                  {file.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                    >
                      <button
                        type="button"
                        className="flex items-center gap-2 min-w-0 flex-1 text-left"
                        onClick={() => setPreviewDoc({ open: true, url: doc.url, name: doc.name, type: doc.type })}
                      >
                        <FileText className="size-5 text-brand-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">{typeLabels[doc.type] || doc.type}</p>
                        </div>
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={cn('text-xs', docStatusColors[doc.status])}>
                          {docStatusLabels[doc.status]}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setPreviewDoc({ open: true, url: doc.url, name: doc.name, type: doc.type })}
                        >
                          <ChevronRight className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-amber-400" /> En attente
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-green-400" /> Validé
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-red-400" /> Rejeté
                </span>
              </div>
            </CardContent>
          </Card>

          {/* TC Comments */}
          {(file.tcComment || file.rejectionReason || file.onHoldReason) && (
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <MessageSquare className="size-4 text-brand-500" />
                  Commentaires
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {file.rejectionReason && (
                  <div className="p-3 rounded-lg bg-red-50 text-sm text-red-700">
                    <span className="font-medium">Motif de rejet :</span> {file.rejectionReason}
                  </div>
                )}
                {file.tcComment && (
                  <div className="p-3 rounded-lg bg-brand-500/5 text-sm text-foreground">
                    <span className="font-medium">Commentaire TC :</span> {file.tcComment}
                  </div>
                )}
                {file.onHoldReason && (
                  <div className="p-3 rounded-lg bg-amber-50 text-sm text-amber-700">
                    <span className="font-medium">Raison de la mise en attente :</span> {file.onHoldReason}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions card */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {canAction ? (
                <>
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white gap-2"
                    disabled={actionLoading}
                    onClick={handleValidate}
                  >
                    {actionLoading ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    Valider le dossier
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full text-orange-600 border-orange-200 hover:bg-orange-50 gap-2"
                    disabled={actionLoading}
                    onClick={() => { setRequestInfoComment(''); setRequestInfoDialog(true) }}
                  >
                    <MessageSquare className="size-4" />
                    Demander des informations
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full text-red-600 border-red-200 hover:bg-red-50 gap-2"
                    disabled={actionLoading}
                    onClick={() => { setRejectComment(''); setRejectDialog(true) }}
                  >
                    <X className="size-4" />
                    Rejeter le dossier
                  </Button>
                </>
              ) : file.onHold ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-amber-50 text-center">
                    <p className="text-xs text-amber-700 font-medium">Dossier en attente</p>
                    <p className="text-xs text-amber-600 mt-1">Reprendre pour pouvoir valider ou rejeter</p>
                  </div>
                  <Button
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                    disabled={actionLoading}
                    onClick={handleResume}
                  >
                    {actionLoading ? <Loader2 className="size-4 animate-spin" /> : <Shield className="size-4" />}
                    Reprendre le dossier
                  </Button>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">
                    Ce dossier a déjà été traité ({statusLabels[file.status] || file.status})
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Owner contact card */}
          {file.owner && (
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Contact propriétaire</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="size-4 shrink-0" />
                  <a href={`tel:${file.owner.phone}`} className="hover:underline">{file.owner.phone}</a>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="size-4 shrink-0" />
                  <a href={`mailto:${file.owner.email}`} className="hover:underline truncate">{file.owner.email}</a>
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>

      {/* ─── Reject Dialog ──────────────────────────────────────────────── */}
      <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmer le rejet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Vous allez rejeter le dossier de{' '}
              <span className="font-semibold text-foreground">
                {file.owner ? `${file.owner.firstName} ${file.owner.lastName}` : 'ce propriétaire'}
              </span>
              . Veuillez indiquer le motif du rejet.
            </p>
            <Textarea
              placeholder="Motif du rejet..."
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(false)}>Annuler</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={!rejectComment.trim() || actionLoading}
              onClick={handleRejectConfirm}
            >
              {actionLoading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Request Info Dialog ────────────────────────────────────────── */}
      <Dialog open={requestInfoDialog} onOpenChange={setRequestInfoDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Demander des informations</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Vous allez demander des informations complémentaires pour le dossier de{' '}
              <span className="font-semibold text-foreground">
                {file.owner ? `${file.owner.firstName} ${file.owner.lastName}` : 'ce propriétaire'}
              </span>
              . Précisez ce qui est attendu.
            </p>
            <Textarea
              placeholder="Informations ou documents attendus..."
              value={requestInfoComment}
              onChange={(e) => setRequestInfoComment(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestInfoDialog(false)}>Annuler</Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={!requestInfoComment.trim() || actionLoading}
              onClick={handleRequestInfoConfirm}
            >
              {actionLoading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Envoyer la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── On Hold Dialog ────────────────────────────────────────────── */}
      <Dialog open={onHoldDialog} onOpenChange={setOnHoldDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mettre le dossier en attente</DialogTitle>
            <DialogDescription>
              Le dossier sera suspendu jusqu&apos;à reprise. Indiquez la raison si nécessaire.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Dossier de{' '}
              <span className="font-semibold text-foreground">
                {file.owner ? `${file.owner.firstName} ${file.owner.lastName}` : 'ce propriétaire'}
              </span>
            </p>
            <div className="space-y-2">
              <Label htmlFor="detailOnHoldReason">Raison (optionnel)</Label>
              <Textarea
                id="detailOnHoldReason"
                placeholder="Raison de la mise en attente..."
                value={onHoldReason}
                onChange={(e) => setOnHoldReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
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
