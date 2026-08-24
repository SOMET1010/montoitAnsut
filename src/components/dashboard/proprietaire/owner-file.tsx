'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  FileText, Upload, CheckCircle2,
  Save, Send, AlertCircle, Trash2, Eye, Mail, Phone, User
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { motion } from 'framer-motion'
import { useRealtimeOwnerFiles } from '@/hooks/use-realtime-owner-files'

// ─── Types ──────────────────────────────────────────────────────────────────
interface OwnerFileDoc {
  id: string
  type: string
  url: string
  name: string
  status: string
  tcComment: string | null
  createdAt: string
}

interface OwnerFileItem {
  id: string
  status: string
  validUntil: string | null
  rejectionReason: string | null
  tcComment: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
  documents: OwnerFileDoc[]
  reviewedBy: { id: string; firstName: string; lastName: string } | null
}

interface OwnerFileResponse {
  data: OwnerFileItem[]
  stats: Record<string, number>
}

// ─── Document requirements for proprietors ──────────────────────────────────
interface DocRequirement {
  type: string
  label: string
  description?: string
  required: boolean
  accept?: string
}

const ownerDocumentRequirements: DocRequirement[] = [
  { type: 'ID_CARD', label: "Carte d'identité ou Passeport", required: true, accept: '.pdf,.jpg,.jpeg,.png' },
  { type: 'PROPERTY_TITLE', label: 'Titre de propriété', description: 'Pour chaque bien que vous louez', required: false, accept: '.pdf,.jpg,.jpeg,.png' },
  { type: 'UTILITY_BILL', label: 'Dernière facture CIE ou SODECI', required: false, accept: '.pdf,.jpg,.jpeg,.png' },
  { type: 'BANK_ACCOUNT_DETAILS', label: "Relevé d'identité bancaire (RIB)", required: false, accept: '.pdf,.jpg,.jpeg,.png' },
]

const statusConfig: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Brouillon', color: 'bg-muted text-muted-foreground' },
  SUBMITTED: { label: 'Soumis', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  TC_REVIEW: { label: 'Complément requis', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  VALIDATED: { label: 'Validé', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED: { label: 'Rejeté', color: 'bg-red-50 text-red-700 border-red-200' },
  EXPIRED: { label: 'Expiré', color: 'bg-muted text-muted-foreground border-border' },
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export function OwnerFileForm() {
  const { user, isAuthenticated } = useAuthStore()
  const [existingFile, setExistingFile] = useState<OwnerFileItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null)
  const [deleteDocConfirmId, setDeleteDocConfirmId] = useState<string | null>(null)
  const [withdrawConfirmOpen, setWithdrawConfirmOpen] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const ownerFileIdRef = useRef<string | null>(null)
  const isCreatingDraftRef = useRef(false)
  const fetchCountRef = useRef(0)

  const fetchOwnerFile = useCallback(async () => {
    const thisFetch = ++fetchCountRef.current
    if (!isAuthenticated) { setLoading(false); return }
    try {
      const result = await authFetch<OwnerFileResponse>('/api/owner-file')
      if (thisFetch !== fetchCountRef.current) return // stale response
      const files = result.data ?? []
      const draft = files.find((f) => f.status === 'DRAFT')
        || files.find((f) => f.status === 'REJECTED')
        || files.find((f) => f.status === 'TC_REVIEW')
        || files[0]
      if (draft) {
        setExistingFile(draft)
        ownerFileIdRef.current = draft.id
      }
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) { return }
      if (thisFetch !== fetchCountRef.current) return
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      if (thisFetch === fetchCountRef.current) {
        setLoading(false)
      }
    }
  }, [isAuthenticated])

  useEffect(() => { fetchOwnerFile() }, [fetchOwnerFile])

  // Realtime — refresh when owner files or documents change
  useRealtimeOwnerFiles({
    userId: user?.id,
    onOwnerFileChange: useCallback(() => { void fetchOwnerFile() }, [fetchOwnerFile]),
  })

  const handleSaveDraft = async () => {
    setSaving(true)
    try {
      await authFetch('/api/owner-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      toast.success('Brouillon sauvegardé')
      fetchOwnerFile()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur de sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const requiredDocTypes = ownerDocumentRequirements.filter(d => d.required).map(d => d.type)
  const uploadedDocTypes = new Set((existingFile?.documents ?? []).map(d => d.type))
  const hasAllRequiredDocs = requiredDocTypes.every(t => uploadedDocTypes.has(t))

  const handleSubmit = async () => {
    if (!hasAllRequiredDocs) {
      toast.error('Veuillez télécharger tous les documents obligatoires avant de soumettre.')
      return
    }
    setSubmitting(true)
    try {
      await authFetch('/api/owner-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submit: true }),
      })
      toast.success('Dossier propriétaire soumis avec succès ! Il sera examiné par un Tiers de Confiance.')
      fetchOwnerFile()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la soumission')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Helper: ensure a draft owner file exists, returns its ID ────────
  const ensureDraftExists = async (): Promise<string | null> => {
    // Fast path: only use the ref if the existing file is actually a DRAFT
    if (ownerFileIdRef.current && existingFile?.status === 'DRAFT') {
      return ownerFileIdRef.current
    }

    // Use existing file only if it's a DRAFT
    if (existingFile?.status === 'DRAFT') {
      ownerFileIdRef.current = existingFile.id
      return existingFile.id
    }

    // Reset ref — the existing file is not a DRAFT (e.g. REJECTED, TC_REVIEW),
    // so we need to create a new draft before uploading documents
    ownerFileIdRef.current = null

    if (isCreatingDraftRef.current) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          clearInterval(check)
          reject(new Error('Timeout waiting for draft creation'))
        }, 10000)
        const check = setInterval(() => {
          if (!isCreatingDraftRef.current) {
            clearInterval(check)
            clearTimeout(timeout)
            resolve()
          }
        }, 100)
      }).catch(() => {})

      if (ownerFileIdRef.current && existingFile?.status === 'DRAFT') {
        return ownerFileIdRef.current
      }

      const result = await authFetch<OwnerFileResponse>('/api/owner-file')
      const files = result.data ?? []
      const draft = files.find((f) => f.status === 'DRAFT') || files[0]
      if (draft?.id && draft.status === 'DRAFT') {
        ownerFileIdRef.current = draft.id
        setExistingFile(draft)
        return draft.id
      }
      return null
    }

    isCreatingDraftRef.current = true
    try {
      const raw: any = await authFetch('/api/owner-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const draftId: string | undefined = raw?.data?.id
      // Verify that the created/returned file is indeed a DRAFT
      if (draftId && raw?.data?.status === 'DRAFT') {
        setExistingFile(raw.data as OwnerFileItem)
        ownerFileIdRef.current = draftId
        return draftId
      }

      const fetchResult = await authFetch<OwnerFileResponse>('/api/owner-file')
      const files = fetchResult.data ?? []
      const draft = files.find((f) => f.status === 'DRAFT') || files[0]
      if (draft?.id && draft.status === 'DRAFT') {
        ownerFileIdRef.current = draft.id
        setExistingFile(draft)
        return draft.id
      }
      return null
    } catch {
      toast.error('Erreur lors de la création du dossier')
      return null
    } finally {
      isCreatingDraftRef.current = false
    }
  }

  // ─── File upload handler ──────────────────────────────────────────────
  const handleFileUpload = async (docType: string, file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Le fichier ne doit pas dépasser 5 Mo')
      return
    }

    const draftId = await ensureDraftExists()
    if (!draftId) {
      toast.error('Impossible de créer le dossier. Réessayez.')
      return
    }

    setUploadingDocType(docType)

    try {
      const { uploadUrl, publicUrl } = await authFetch<{
        uploadUrl: string
        publicUrl: string
      }>('/api/owner-file/documents/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerFileId: draftId,
          type: docType,
          name: file.name,
        }),
      })

      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })

      await authFetch('/api/owner-file/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerFileId: draftId,
          type: docType,
          name: file.name,
          url: publicUrl,
        }),
      })

      toast.success('Document téléchargé avec succès')
      fetchOwnerFile()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du téléchargement')
    } finally {
      setUploadingDocType(null)
    }
  }

  const handleDeleteDocument = (docId: string) => {
    setDeleteDocConfirmId(docId)
  }

  const confirmDeleteDocument = async () => {
    if (!deleteDocConfirmId) return
    try {
      await authFetch(`/api/owner-file/documents?docId=${deleteDocConfirmId}`, {
        method: 'DELETE',
      })
      toast.success('Document supprimé')
      setDeleteDocConfirmId(null)
      fetchOwnerFile()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression')
    }
  }

  const handleWithdrawSubmission = async () => {
    setWithdrawing(true)
    try {
      await authFetch('/api/owner-file/withdraw', { method: 'POST' })
      toast.success('Soumission retirée. Vous pouvez à nouveau modifier vos documents.')
      setWithdrawConfirmOpen(false)
      fetchOwnerFile()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Impossible de retirer la soumission')
    } finally {
      setWithdrawing(false)
    }
  }

  // ─── Loading skeleton ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-64 bg-muted animate-pulse rounded mt-2" />
        </div>
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      </div>
    )
  }

  // ─── Error state ───────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Dossier propriétaire</h1>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-sm text-amber-700">Impossible de charger votre dossier. Veuillez réessayer.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isReadOnly = !!(existingFile && existingFile.status === 'VALIDATED')
  const existingStatus = existingFile ? statusConfig[existingFile.status] : null

  // Capacités du propriétaire sur ses documents selon le statut du dossier.
  // - Voir : toujours possible (consultation read-only)
  // - Remplacer : DRAFT/REJECTED libre, TC_REVIEW (l'owner répond à une demande du TC),
  //   bloqué en SUBMITTED (en attente du TC) et VALIDATED (figé)
  // - Supprimer : DRAFT/REJECTED uniquement (en TC_REVIEW on garde la trace ;
  //   l'owner remplace au lieu de supprimer)
  const fileStatus = existingFile?.status
  const canReplaceDoc = fileStatus === 'DRAFT' || fileStatus === 'TC_REVIEW' || fileStatus === 'REJECTED' || !existingFile
  const canDeleteDoc = fileStatus === 'DRAFT' || fileStatus === 'REJECTED'

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Dossier propriétaire</h1>
        <p className="text-muted-foreground mt-1">Vérifiez votre profil de propriétaire en fournissant les documents requis</p>
      </div>

      {/* Existing file status banner */}
      {existingFile && existingStatus && (
        <Card className={`border ${existingFile.status === 'VALIDATED' ? 'border-emerald-200 bg-emerald-50' : existingFile.status === 'REJECTED' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {existingFile.status === 'VALIDATED' ? (
                <CheckCircle2 className="size-6 text-emerald-600 shrink-0 mt-0.5" />
              ) : existingFile.status === 'REJECTED' ? (
                <AlertCircle className="size-6 text-red-600 shrink-0 mt-0.5" />
              ) : (
                <FileText className="size-6 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">Statut du dossier :</span>
                  <Badge variant="outline" className={`text-[11px] px-2 py-0.5 border ${existingStatus.color}`}>{existingStatus.label}</Badge>
                </div>

                {/* TC Comment - prominent for rejected */}
                {existingFile.status === 'REJECTED' && (
                  <div className="mt-3 p-3 rounded-lg bg-red-100/70 border border-red-200">
                    <p className="text-xs font-semibold text-red-700 mb-1">Motif du rejet</p>
                    <p className="text-sm text-red-800">{existingFile.rejectionReason || 'Aucune raison spécifiée'}</p>
                    {existingFile.tcComment && (
                      <>
                        <p className="text-xs font-semibold text-red-700 mt-2 mb-1">Commentaire du Tiers de Confiance</p>
                        <p className="text-sm text-red-800">{existingFile.tcComment}</p>
                      </>
                    )}
                  </div>
                )}

                {/* TC Comment - visible for all statuses except REJECTED (has its own section) */}
                {existingFile.status !== 'REJECTED' && existingFile.tcComment && (
                  <div className="mt-2 p-2.5 rounded-lg bg-amber-100/50 border border-amber-200">
                    <p className="text-xs font-semibold text-amber-700">Commentaire du Tiers de Confiance</p>
                    <p className="text-sm text-amber-800 mt-0.5">{existingFile.tcComment}</p>
                  </div>
                )}

                {existingFile.validUntil && (
                  <p className="text-xs text-muted-foreground mt-2">Valide jusqu&apos;au {new Date(existingFile.validUntil).toLocaleDateString('fr-FR')}</p>
                )}

                {/* Re-submit button for rejected/expired/tc_review */}
                {existingFile.status !== 'DRAFT' && existingFile.status !== 'SUBMITTED' && existingFile.status !== 'VALIDATED' && (
                  <Button
                    size="sm"
                    className="mt-3 bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                    onClick={handleSubmit}
                    disabled={submitting || !hasAllRequiredDocs}
                  >
                    {submitting ? (
                      <span className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="size-3.5" />
                    )}
                    {submitting ? 'Envoi...' : 'Soumettre à nouveau'}
                  </Button>
                )}

                {/* Withdraw button when dossier is awaiting TC review */}
                {existingFile.status === 'SUBMITTED' && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-amber-700">
                      Vos documents sont verrouillés pendant la validation. Pour les modifier, retirez d&apos;abord votre soumission.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-100"
                      onClick={() => setWithdrawConfirmOpen(true)}
                      disabled={withdrawing}
                    >
                      {withdrawing ? (
                        <span className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <AlertCircle className="size-3.5" />
                      )}
                      {withdrawing ? 'Retrait…' : 'Retirer ma soumission'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border">
        <CardContent className="p-6 space-y-6">
          {/* Personal info read-only section (comme rental-file) */}
          <div className="rounded-lg bg-muted/30 border border-border p-4">
            <p className="text-sm font-medium mb-3 text-muted-foreground flex items-center gap-2">
              <User className="size-4" />
              Informations personnelles
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Prénom</p>
                <p className="text-sm font-medium">{user?.firstName || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Nom</p>
                <p className="text-sm font-medium">{user?.lastName || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="size-3" /> Téléphone
                </p>
                <p className="text-sm font-medium">{user?.phone || 'Non renseigné'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Mail className="size-3" /> Email
                </p>
                <p className="text-sm font-medium">{user?.email || '—'}</p>
              </div>
            </div>
          </div>

          {/* Documents section (comme rental-file step 2) */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <FileText className="size-4 text-brand-500" />
              <h3 className="text-sm font-semibold text-foreground">Documents requis</h3>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-red-400 inline-block" /> Obligatoire
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-neutral-300 inline-block" /> Facultatif
              </span>
            </div>

            <div className="space-y-3">
              {ownerDocumentRequirements.map((doc) => {
                const existingDoc = existingFile?.documents?.find((d) => d.type === doc.type)
                const isUploading = uploadingDocType === doc.type

                return (
                  <div key={doc.type} className={`rounded-xl border-2 p-4 transition-colors ${
                    existingDoc ? 'border-emerald-200 bg-emerald-50/50' : doc.required ? 'border-red-100' : 'border-border'
                  }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {existingDoc ? (
                            <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                          ) : (
                            <FileText className={`size-4 shrink-0 ${doc.required ? 'text-red-400' : 'text-muted-foreground'}`} />
                          )}
                          <span className="text-sm font-medium text-foreground">{doc.label}</span>
                          {doc.required && !existingDoc && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-50 text-red-600 border-red-200">
                              Obligatoire
                            </Badge>
                          )}
                          {!doc.required && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground border-border">
                              Facultatif
                            </Badge>
                          )}
                          {existingDoc && (
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                              existingDoc.status === 'VALIDATED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : existingDoc.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {existingDoc.status === 'VALIDATED' ? 'Validé' : existingDoc.status === 'REJECTED' ? 'Rejeté' : 'En attente'}
                            </Badge>
                          )}
                        </div>
                        {doc.description && (
                          <p className="text-xs text-muted-foreground mt-1 ml-6">{doc.description}</p>
                        )}
                        {existingDoc && (
                          <div className="flex items-center gap-2 mt-2 ml-6">
                            <span className="text-xs text-muted-foreground truncate">{existingDoc.name}</span>
                            <span className="text-xs text-muted-foreground">
                              • Ajouté le {new Date(existingDoc.createdAt).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                        )}
                        {existingDoc?.tcComment && (
                          <p className="text-xs text-amber-600 mt-1 ml-6">Commentaire TC : {existingDoc.tcComment}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Voir — toujours disponible quand un doc existe (consultation read-only) */}
                        {existingDoc && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => window.open(existingDoc.url, '_blank', 'noopener,noreferrer')}
                            title="Ouvrir le document dans un nouvel onglet"
                          >
                            <Eye className="size-3.5" />
                            Voir
                          </Button>
                        )}
                        {/* Supprimer — uniquement DRAFT/REJECTED */}
                        {existingDoc && canDeleteDoc && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteDocument(existingDoc.id)}
                            title="Supprimer"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                        {/* Téléverser / Remplacer — bloqué en SUBMITTED et VALIDATED */}
                        {canReplaceDoc && (
                          <Button
                            variant={existingDoc ? "outline" : "default"}
                            size="sm"
                            className={`gap-1.5 ${!existingDoc ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : ''}`}
                            disabled={isUploading}
                            onClick={() => fileInputRefs.current[doc.type]?.click()}
                            title={existingDoc ? 'Remplacer le document' : 'Téléverser le document'}
                          >
                            {isUploading ? (
                              <span className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Upload className="size-3.5" />
                            )}
                            {isUploading ? 'Envoi...' : existingDoc ? 'Remplacer' : 'Téléverser'}
                          </Button>
                        )}
                        <input
                          ref={(el) => { fileInputRefs.current[doc.type] = el }}
                          type="file"
                          className="hidden"
                          accept={doc.accept}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleFileUpload(doc.type, file)
                            e.target.value = ''
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Upload progress indicator */}
            {ownerDocumentRequirements.length > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-muted-foreground">Progression des documents</span>
                  <span className="font-medium">
                    {existingFile?.documents?.filter(d => ownerDocumentRequirements.some(rd => rd.type === d.type)).length || 0} / {ownerDocumentRequirements.length}
                  </span>
                </div>
                <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${((existingFile?.documents?.filter(d => ownerDocumentRequirements.some(rd => rd.type === d.type)).length || 0) / ownerDocumentRequirements.length) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div />
            <div className="flex items-center gap-2">
              {existingFile?.status === 'DRAFT' && (
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={saving}
                  className="gap-1.5"
                >
                  <Save className="size-4" />
                  {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                </Button>
              )}
              {existingFile?.status !== 'SUBMITTED' && existingFile?.status !== 'VALIDATED' && (
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !hasAllRequiredDocs}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1 disabled:opacity-50"
                >
                  {submitting ? (
                    'Envoi...'
                  ) : (
                    <>
                      <Send className="size-4" />
                      {existingFile?.status === 'DRAFT' ? 'Soumettre le dossier' : 'Soumettre à nouveau'}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteDocConfirmId}
        onOpenChange={(open) => { if (!open) setDeleteDocConfirmId(null) }}
        title="Supprimer le document"
        description="Ce document sera définitivement supprimé. Cette action est irréversible."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={confirmDeleteDocument}
        variant="destructive"
      />

      <ConfirmDialog
        open={withdrawConfirmOpen}
        onOpenChange={(open) => { if (!open) setWithdrawConfirmOpen(false) }}
        title="Retirer votre soumission ?"
        description="Votre dossier repassera en brouillon. Les Tiers de Confiance ne pourront plus le valider tant que vous ne l'avez pas re-soumis."
        confirmLabel="Retirer la soumission"
        cancelLabel="Annuler"
        onConfirm={handleWithdrawSubmission}
      />
    </motion.div>
  )
}
