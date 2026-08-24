'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft, User, Mail, Phone, Calendar,
  FileText, Building2, Check, X, MessageSquare,
  Loader2, Shield,
} from 'lucide-react'
import { useBackHandler } from '@/hooks/use-back-handler'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { DocumentPreviewDialog } from './document-preview-dialog'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface AgencyDoc {
  id: string
  type: string
  url: string
  name: string
  status: string
  tcComment: string | null
  createdAt: string
  owner: {
    id: string
    firstName: string
    lastName: string
    phone: string
    email: string
    avatarUrl: string | null
  } | null
  reviewedBy: {
    id: string
    firstName: string
    lastName: string
  } | null
}

const statusLabels: Record<string, string> = {
  PENDING: 'En attente',
  VALIDATED: 'Validé',
  REJECTED: 'Rejeté',
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  VALIDATED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}

export function AgencyDetail() {
  const { isAuthenticated, selectedItemId, setDashboardSection, setSelectedItemId } = useAuthStore()

  const [doc, setDoc] = useState<AgencyDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const [rejectDialog, setRejectDialog] = useState(false)
  const [rejectComment, setRejectComment] = useState('')

  const [requestInfoDialog, setRequestInfoDialog] = useState(false)
  const [requestInfoComment, setRequestInfoComment] = useState('')

  const goBack = () => {
    setSelectedItemId('')
    setDashboardSection('dossier-validations')
  }

  useBackHandler('agency-detail', goBack)

  const fetchDoc = useCallback(async (skipCache?: boolean) => {
    if (!isAuthenticated || !selectedItemId) {
      setLoading(false)
      setNotFound(true)
      return
    }

    setLoading(true)
    setNotFound(false)
    setDoc(null)

    try {
      const d = await authFetch<{ docs: AgencyDoc[] }>(
        `/api/tc/ownership-docs?id=${selectedItemId}`,
        skipCache ? { skipCache: true } : undefined
      )
      const found = d.docs?.[0]
      if (found) {
        setDoc(found)
      } else {
        setNotFound(true)
      }
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) {
        setNotFound(true)
        return
      }
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, selectedItemId])

  useEffect(() => {
    fetchDoc()
  }, [fetchDoc])

  const handleAction = useCallback(async (action: 'APPROVE' | 'REJECT' | 'REQUEST_INFO', comment?: string) => {
    if (!doc) return
    setActionLoading(true)
    try {
      await authFetch('/api/tc/ownership-docs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docIds: [doc.id], action, comment: comment || '' }),
      })
      toast.success(
        action === 'APPROVE'
          ? 'Document validé avec succès !'
          : action === 'REJECT'
            ? 'Document rejeté.'
            : "Demande d'information envoyée."
      )
      setRejectDialog(false)
      setRequestInfoDialog(false)
      setRejectComment('')
      setRequestInfoComment('')
      await fetchDoc(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'action.")
    } finally {
      setActionLoading(false)
    }
  }, [doc, fetchDoc])

  const handleValidate = () => handleAction('APPROVE')
  const handleRejectConfirm = () => { if (rejectComment.trim()) handleAction('REJECT', rejectComment) }
  const handleRequestInfoConfirm = () => { if (requestInfoComment.trim()) handleAction('REQUEST_INFO', requestInfoComment) }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 rounded bg-muted animate-pulse" />
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      </div>
    )
  }

  if (notFound || !doc) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={goBack} className="gap-2">
          <ArrowLeft className="size-4" /> Retour
        </Button>
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <FileText className="size-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">Document introuvable</p>
            <Button variant="outline" className="mt-4 gap-2" onClick={goBack}>
              <ArrowLeft className="size-4" /> Retour
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const canAction = doc.status === 'PENDING'

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-500/10 to-transparent rounded-xl p-4 sm:p-6 -mx-4 sm:-mx-6">
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" onClick={goBack} className="gap-2 -ml-2">
            <ArrowLeft className="size-4" /> Retour
          </Button>
          <Badge className={statusColors[doc.status]}>{statusLabels[doc.status]}</Badge>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-brand-100 shrink-0">
            <Building2 className="size-5 text-brand-500" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground truncate">
              {doc.owner ? `${doc.owner.firstName} ${doc.owner.lastName}` : 'Agence'}
            </h2>
            <p className="text-sm text-muted-foreground">
              Document {doc.type === 'AGREMENT' ? "d'agrément" : 'RCCM'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Agency info card */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-full bg-brand-500/10 flex items-center justify-center">
                    <Building2 className="size-6 text-brand-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold text-foreground">
                      {doc.owner ? `${doc.owner.firstName} ${doc.owner.lastName}` : 'Agence'}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">Agence immobilière</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {doc.owner && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="size-4 shrink-0" />
                    <span className="truncate">{doc.owner.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="size-4 shrink-0" />
                    <span>{doc.owner.phone}</span>
                  </div>
                </div>
              )}

              <div className="border-t border-border pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 shrink-0" />
                    <span>Soumis le {new Date(doc.createdAt).toLocaleDateString('fr-FR')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 shrink-0" />
                    <span>{doc.type === 'AGREMENT' ? "Agrément" : 'RCCM'}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Document card */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="size-4 text-brand-500" />
                Document
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => window.open(doc.url, '_blank')}
              >
                <FileText className="size-8 text-brand-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.type === 'AGREMENT' ? "Document d'agrément" : 'Registre de commerce (RCCM)'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* TC Comment */}
          {doc.tcComment && (
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <MessageSquare className="size-4 text-brand-500" />
                  Commentaire TC
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground">{doc.tcComment}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
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
                    Valider le document
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
                    Rejeter le document
                  </Button>
                </>
              ) : (
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">
                    Ce document a déjà été traité ({statusLabels[doc.status]})
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {doc.owner && (
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="size-4 shrink-0" />
                  <a href={`tel:${doc.owner.phone}`} className="hover:underline">{doc.owner.phone}</a>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="size-4 shrink-0" />
                  <a href={`mailto:${doc.owner.email}`} className="hover:underline truncate">{doc.owner.email}</a>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Informations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">{doc.type === 'AGREMENT' ? 'Agrément' : 'RCCM'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Statut</span>
                  <span className={cn('font-medium', doc.status === 'VALIDATED' ? 'text-green-600' : doc.status === 'REJECTED' ? 'text-red-600' : 'text-amber-600')}>
                    {statusLabels[doc.status]}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmer le rejet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Vous allez rejeter le{doc.type === 'AGREMENT' ? " d'agrément" : ' RCCM'} de{' '}
              <span className="font-semibold text-foreground">
                {doc.owner ? `${doc.owner.firstName} ${doc.owner.lastName}` : 'cette agence'}
              </span>
              . Veuillez indiquer le motif.
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

      {/* Request Info Dialog */}
      <Dialog open={requestInfoDialog} onOpenChange={setRequestInfoDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Demander des informations</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Vous allez demander des informations complémentaires pour le document de{' '}
              <span className="font-semibold text-foreground">
                {doc.owner ? `${doc.owner.firstName} ${doc.owner.lastName}` : 'cette agence'}
              </span>
              .
            </p>
            <Textarea
              placeholder="Informations attendues..."
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
    </motion.div>
  )
}
