'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Check,
  X,
  MessageSquare,
  FileText,
  Eye,
  ChevronDown,
  ChevronRight,
  User,
  Mail,
  Phone,
  Loader2,
  RotateCcw,
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
import { Skeleton } from '@/components/ui/skeleton'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { usePagination } from '@/hooks/use-pagination'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { useAuthStore } from '@/lib/auth-store'
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

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  SUBMITTED: { label: 'Soumis', className: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  TC_REVIEW: { label: 'Complément demandé', className: 'bg-orange-500/10 text-orange-700 border-orange-500/20' },
  VALIDATED: { label: 'Validé', className: 'bg-green-500/10 text-green-700 border-green-500/20' },
  REJECTED: { label: 'Rejeté', className: 'bg-red-500/10 text-red-700 border-red-500/20' },
}

const DOC_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'En attente', className: 'bg-yellow-500/10 text-yellow-700' },
  VALIDATED: { label: 'Validé', className: 'bg-green-500/10 text-green-700' },
  REJECTED: { label: 'Rejeté', className: 'bg-red-500/10 text-red-700' },
}

const TYPE_LABELS: Record<string, string> = {
  ID_CARD: 'Pièce d\'identité',
  PASSPORT: 'Passeport',
  PROPERTY_TITLE: 'Titre de propriété',
  UTILITY_BILL: 'Facture d\'utilité',
  BANK_ACCOUNT_DETAILS: 'Relevé bancaire',
  OTHER: 'Autre',
}

export function OwnerDossierValidations() {
  const { isAuthenticated, user, selectedItemId, setSelectedItemId } = useAuthStore()
  const [files, setFiles] = useState<OwnerFile[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Auto-expand the file when navigating from a notification
  useEffect(() => {
    if (!selectedItemId || files.length === 0) return
    const match = files.find(f => f.id === selectedItemId || f.documents?.some(d => d.id === selectedItemId))
    if (!match) return
    setExpandedId(match.id)
    setSelectedItemId('')
  }, [selectedItemId, files, setSelectedItemId])

  const [actionDialog, setActionDialog] = useState<'APPROVE' | 'REJECT' | 'REQUEST_INFO' | null>(null)
  const [selectedFile, setSelectedFile] = useState<OwnerFile | null>(null)
  const [comment, setComment] = useState('')
  const [commentError, setCommentError] = useState('')

  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<{ url: string; name: string; type: string } | null>(null)

  const {
    paginatedItems: pagedFiles,
    page,
    totalPages,
    total,
    pageSize,
    setPage,
  } = usePagination({
    items: files,
    pageSize: 10,
  })

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return }
    try {
      const data = await authFetch<{ files: OwnerFile[] }>('/api/tc/owner-files')
      setFiles(data.files ?? [])
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) return
      setFiles([])
      toast.error('Erreur lors du chargement des dossiers')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useRealtimeOwnerFiles({
    userId: user?.id,
    watchAll: true,
    onOwnerFileChange: () => { fetchData() },
  })

  useEffect(() => { fetchData() }, [fetchData])

  const openActionDialog = (file: OwnerFile, action: 'APPROVE' | 'REJECT' | 'REQUEST_INFO') => {
    setSelectedFile(file)
    setActionDialog(action)
    setComment('')
    setCommentError('')
  }

  const confirmAction = async () => {
    if (!selectedFile || !actionDialog) return
    if (actionDialog === 'REJECT' && !comment.trim()) {
      setCommentError('Veuillez fournir une raison de rejet')
      return
    }
    if (actionDialog === 'REQUEST_INFO' && !comment.trim()) {
      setCommentError('Veuillez indiquer les documents complémentaires requis')
      return
    }

    setActionLoading(selectedFile.id)
    try {
      const body: any = { fileIds: [selectedFile.id], action: actionDialog, comment: comment.trim() || null }

      // Mettre à jour le statut de tous les documents selon l'action
      if (selectedFile.documents.length > 0) {
        if (actionDialog === 'APPROVE') {
          body.documentUpdates = selectedFile.documents.map((doc) => ({
            documentId: doc.id,
            status: 'VALIDATED',
          }))
        } else if (actionDialog === 'REJECT') {
          body.documentUpdates = selectedFile.documents.map((doc) => ({
            documentId: doc.id,
            status: 'REJECTED',
            comment: comment.trim() || null,
          }))
        }
      }

      await authFetch('/api/tc/owner-files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      toast.success(
        actionDialog === 'APPROVE' ? 'Dossier validé avec succès' :
        actionDialog === 'REJECT' ? 'Dossier rejeté' :
        'Demande de compléments envoyée'
      )
      setActionDialog(null)
      setSelectedFile(null)
      fetchData()
    } catch {
      toast.error('Erreur lors de l\'action sur le dossier')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        {[1, 2, 3].map((i) => (
          <Card key={i}><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
        ))}
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Dossiers propriétaires</h1>
          <p className="text-muted-foreground text-sm">{files.length} dossier{files.length !== 1 ? 's' : ''} en attente</p>
        </div>
      </div>

      {files.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <FileText className="size-12 mx-auto mb-4 opacity-40" />
            <p className="text-lg font-medium">Aucun dossier en attente</p>
            <p className="text-sm">Les dossiers propriétaires soumis apparaîtront ici.</p>
          </CardContent>
        </Card>
      ) : (
        pagedFiles.map((file) => (
          <Card key={file.id} className="border-border">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-brand-100">
                    <User className="size-5 text-brand-600" />
                  </div>
                  <div>
                    <p className="font-semibold">
                      {file.owner ? `${file.owner.firstName} ${file.owner.lastName}` : 'Propriétaire inconnu'}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {file.owner?.email && (
                        <span className="flex items-center gap-1"><Mail className="size-3" />{file.owner.email}</span>
                      )}
                      {file.owner?.phone && (
                        <span className="flex items-center gap-1"><Phone className="size-3" />{file.owner.phone}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={STATUS_CONFIG[file.status]?.className ?? ''}>
                    {STATUS_CONFIG[file.status]?.label ?? file.status}
                  </Badge>
                </div>
              </div>

              {file.previouslyRejected && (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700">
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

              {/* Documents */}
              <Collapsible
                open={expandedId === file.id}
                onOpenChange={(open) => setExpandedId(open ? file.id : null)}
              >
                <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
                  {expandedId === file.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  {file.documents.length} document{file.documents.length !== 1 ? 's' : ''}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-2 pl-4">
                    {file.documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="size-4 shrink-0 text-muted-foreground" />
                          <span className="text-sm truncate">{TYPE_LABELS[doc.type] || doc.type}</span>
                          <span className="text-xs text-muted-foreground truncate hidden sm:inline">{doc.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className={cn('text-[10px]', DOC_STATUS_CONFIG[doc.status]?.className)}>
                            {DOC_STATUS_CONFIG[doc.status]?.label || doc.status}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label="Prévisualiser le document"
                            onClick={() => { setPreviewDoc({ url: doc.url, name: doc.name, type: doc.type }); setPreviewOpen(true) }}
                          >
                            <Eye className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => openActionDialog(file, 'APPROVE')}
                  disabled={actionLoading === file.id}
                >
                  {actionLoading === file.id ? <Loader2 className="size-4 animate-spin mr-1" /> : <Check className="size-4 mr-1" />}
                  Valider
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => openActionDialog(file, 'REJECT')}
                  disabled={actionLoading === file.id}
                >
                  <X className="size-4 mr-1" /> Rejeter
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openActionDialog(file, 'REQUEST_INFO')}
                  disabled={actionLoading === file.id}
                >
                  <MessageSquare className="size-4 mr-1" /> Demander un complément
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <PaginationControls
        page={page}
        totalPages={totalPages}
        total={total}
        limit={pageSize}
        onPageChange={setPage}
      />

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={(open) => { if (!open) { setActionDialog(null); setSelectedFile(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog === 'APPROVE' ? 'Valider le dossier' :
               actionDialog === 'REJECT' ? 'Rejeter le dossier' :
               'Demander des documents complémentaires'}
            </DialogTitle>
            <DialogDescription>
              {selectedFile && (
                <span>
                  Dossier de <strong>{selectedFile.owner?.firstName} {selectedFile.owner?.lastName}</strong>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {(actionDialog === 'REJECT' || actionDialog === 'REQUEST_INFO') && (
            <div>
              <Textarea
                placeholder={actionDialog === 'REJECT' ? 'Raison du rejet...' : 'Documents complémentaires requis...'}
                value={comment}
                onChange={(e) => { setComment(e.target.value); setCommentError('') }}
                rows={3}
              />
              {commentError && <p className="text-xs text-red-500 mt-1">{commentError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionDialog(null); setSelectedFile(null) }}>Annuler</Button>
            <Button
              onClick={confirmAction}
              disabled={actionLoading === selectedFile?.id}
              className={actionDialog === 'APPROVE' ? 'bg-green-600 hover:bg-green-700' : actionDialog === 'REJECT' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {actionLoading === selectedFile?.id && <Loader2 className="size-4 animate-spin mr-1" />}
              {actionDialog === 'APPROVE' ? 'Valider' : actionDialog === 'REJECT' ? 'Rejeter' : 'Envoyer la demande'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      {previewDoc && (
        <DocumentPreviewDialog
          open={previewOpen}
          onOpenChange={(open) => { setPreviewOpen(open); if (!open) setPreviewDoc(null) }}
          documentUrl={previewDoc.url}
          documentName={previewDoc.name}
        />
      )}
    </motion.div>
  )
}
