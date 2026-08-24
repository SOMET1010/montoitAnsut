'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ArrowLeft, FileText, Upload, CheckCircle2, ChevronRight, ChevronLeft,
  Save, Send, AlertCircle,
  Eye, Trash2
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { useRealtimeRentalFiles } from '@/hooks/use-realtime-rental-files'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { motion } from 'framer-motion'

// ─── Types ──────────────────────────────────────────────────────────────────
export interface RentalFileDoc {
  id: string
  type: string
  url: string
  name: string
  status: string
  tcComment: string | null
  createdAt: string
}

export interface RentalFileItem {
  id: string
  status: string
  tenantCategory: string | null
  monthlyIncome: number | null
  employer: string | null
  employmentType: string | null
  guarantorName: string | null
  guarantorPhone: string | null
  guarantorRelation: string | null
  validUntil: string | null
  rejectionReason: string | null
  tcComment: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
  documents: RentalFileDoc[]
  leases: Array<{
    id: string
    status: string
    property: { id: string; title: string; address: string; city: string }
  }>
  reviewedBy: { id: string; firstName: string; lastName: string } | null
}

interface RentalFileResponse {
  data: RentalFileItem[]
  stats: Record<string, number>
}


// ─── Document requirements ───────────────────────────────────────────────────
interface DocRequirement {
  type: string
  label: string
  description?: string
  required: boolean
  accept?: string
}

const documentRequirements: DocRequirement[] = [
  { type: 'ID_CARD', label: "Carte d'identité ou Passeport", required: true, accept: '.pdf,.jpg,.jpeg,.png' },
  { type: 'PROOF_OF_ADDRESS', label: 'Justificatif de domicile actuel', description: 'Facture CIE, SODECI ou quittance de loyer', required: false, accept: '.pdf,.jpg,.jpeg,.png' },
  { type: 'PAY_SLIP', label: 'Bulletins de salaire (3 derniers mois)', description: 'Facultatif — Fournir les 3 derniers bulletins si disponible', required: false, accept: '.pdf,.jpg,.jpeg,.png' },
  { type: 'BANK_STATEMENT', label: 'Relevés bancaires (3 derniers mois)', required: false, accept: '.pdf' },
  { type: 'EMPLOYMENT_CONTRACT', label: 'Contrat de travail', required: false, accept: '.pdf,.jpg,.jpeg,.png' },
  { type: 'GUARANTOR_ID', label: "Pièce d'identité du garant", required: false, accept: '.pdf,.jpg,.jpeg,.png' },
  { type: 'GUARANTOR_INCOME_PROOF', label: 'Justificatif de revenus du garant', required: false, accept: '.pdf,.jpg,.jpeg,.png' },
]

// ─── Step definition ───────────────────────────────────────────────────────
const steps = [
  { id: 1, title: 'Catégorie' },
  { id: 2, title: 'Garant' },
  { id: 3, title: 'Documents' },
]

const statusConfig: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Brouillon', color: 'bg-muted text-muted-foreground' },
  SUBMITTED: { label: 'Soumis', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  TC_REVIEW: { label: 'En examen TC', color: 'bg-brand-50 text-brand-600 border-brand-200' },
  VALIDATED: { label: 'Validé', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED: { label: 'Rejeté', color: 'bg-red-50 text-red-700 border-red-200' },
  EXPIRED: { label: 'Expiré', color: 'bg-muted text-muted-foreground border-border' },
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export function RentalFileForm({ onBack, onSubmitSuccess }: { onBack?: () => void; onSubmitSuccess?: () => void }) {
  const { user, isAuthenticated } = useAuthStore()
  const [step, setStep] = useState(1)
  const [existingFile, setExistingFile] = useState<RentalFileItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null)
  const [deleteDocConfirmId, setDeleteDocConfirmId] = useState<string | null>(null)
  const [withdrawConfirmOpen, setWithdrawConfirmOpen] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const rentalFileIdRef = useRef<string | null>(null)
  const isCreatingDraftRef = useRef(false)
  const submittingRef = useRef(false)
  const fetchCountRef = useRef(0)

  const [formData, setFormData] = useState({
    tenantCategory: '',
    guarantorName: '',
    guarantorPhone: '',
    guarantorRelation: '',
  })

  const fetchRentalFile = useCallback(async () => {
    const thisFetch = ++fetchCountRef.current
    if (!isAuthenticated) { setLoading(false); return }
    try {
      const result = await authFetch<RentalFileResponse>('/api/rental-file')
      if (thisFetch !== fetchCountRef.current) return // stale response
      const files = result.data ?? []
      const file = files.find((f) => f.status === 'DRAFT')
        || files.find((f) => f.status === 'REJECTED')
        || files.find((f) => f.status === 'TC_REVIEW')
        || files[0]
      if (file) {
        setExistingFile(file)
        rentalFileIdRef.current = file.id
        setFormData({
          tenantCategory: file.tenantCategory || '',
          guarantorName: file.guarantorName || '',
          guarantorPhone: file.guarantorPhone || '',
          guarantorRelation: file.guarantorRelation || '',
        })
      } else {
        rentalFileIdRef.current = null
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

  useRealtimeRentalFiles({
    userId: user?.id,
    onRentalFileChange: () => fetchRentalFile(),
  })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRentalFile()
  }, [fetchRentalFile])

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSaveDraft = async () => {
    setSaving(true)
    try {
      await authFetch('/api/rental-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantCategory: formData.tenantCategory || undefined,
          guarantorName: formData.guarantorName || undefined,
          guarantorPhone: formData.guarantorPhone || undefined,
          guarantorRelation: formData.guarantorRelation || undefined,
        }),
      })
      toast.success('Brouillon sauvegardé')
      fetchRentalFile()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur de sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const requiredDocTypes = documentRequirements.filter(d => d.required).map(d => d.type)
  const uploadedDocTypes = new Set((existingFile?.documents ?? []).map(d => d.type))
  const hasAllRequiredDocs = requiredDocTypes.every(t => uploadedDocTypes.has(t))

  const handleSubmit = async () => {
    if (!hasAllRequiredDocs) {
      toast.error('Veuillez télécharger tous les documents obligatoires avant de soumettre.')
      return
    }
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    try {
      await authFetch('/api/rental-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantCategory: formData.tenantCategory || undefined,
          guarantorName: formData.guarantorName || undefined,
          guarantorPhone: formData.guarantorPhone || undefined,
          guarantorRelation: formData.guarantorRelation || undefined,
          submit: true,
        }),
      })
      toast.success('Dossier soumis avec succès ! Il sera examiné par un Tiers de Confiance.')
      await fetchRentalFile()
      onSubmitSuccess?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la soumission')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  // ─── Helper: ensure a draft rental file exists, returns its ID ────────
  const ensureDraftExists = async (): Promise<string | null> => {
    // Fast path: only use the ref if the existing file is actually a DRAFT
    if (rentalFileIdRef.current && existingFile?.status === 'DRAFT') {
      return rentalFileIdRef.current
    }

    // Use existing file only if it's a DRAFT
    if (existingFile?.status === 'DRAFT') {
      rentalFileIdRef.current = existingFile.id
      return existingFile.id
    }

    // Reset ref — the existing file is not a DRAFT (e.g. REJECTED, TC_REVIEW),
    // so we need to create a new draft before uploading documents
    rentalFileIdRef.current = null

    // Lock to prevent concurrent draft creation
    if (isCreatingDraftRef.current) {
      // Wait for the other call to finish, with timeout
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
      }).catch(() => {}) // fall through to DB fetch on timeout

      // Fetch from DB (the other call may have created the draft)
      const result = await authFetch<RentalFileResponse>('/api/rental-file')
      const files = result.data ?? []
      const draft = files.find((f) => f.status === 'DRAFT') || files[0]
      if (draft?.id && draft.status === 'DRAFT') {
        rentalFileIdRef.current = draft.id
        setExistingFile(draft)
        return draft.id
      }
      return null
    }

    // Create the draft
    isCreatingDraftRef.current = true
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any = await authFetch('/api/rental-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const draftId: string | undefined = raw?.data?.id
      // Verify that the created/returned file is indeed a DRAFT
      if (draftId && raw?.data?.status === 'DRAFT') {
        setExistingFile(raw.data as RentalFileItem)
        rentalFileIdRef.current = draftId
        return draftId
      }
      // Fallback: refetch
      const fetchResult = await authFetch<RentalFileResponse>('/api/rental-file')
      const files = fetchResult.data ?? []
      const draft = files.find((f) => f.status === 'DRAFT') || files[0]
      if (draft?.id && draft.status === 'DRAFT') {
        rentalFileIdRef.current = draft.id
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
      // Convert to base64
      const reader = new FileReader()
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const base64Content = await base64Promise

      await authFetch('/api/rental-file/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rentalFileId: draftId,
          type: docType,
          name: file.name,
          content: base64Content,
        }),
      })

      toast.success('Document téléchargé avec succès')
      fetchRentalFile()
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
      await authFetch(`/api/rental-file/documents?docId=${deleteDocConfirmId}`, {
        method: 'DELETE',
      })
      toast.success('Document supprimé')
      setDeleteDocConfirmId(null)
      fetchRentalFile()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression')
    }
  }

  const handleWithdrawSubmission = async () => {
    setWithdrawing(true)
    try {
      await authFetch('/api/rental-file/withdraw', { method: 'POST' })
      toast.success('Soumission retirée. Vous pouvez à nouveau modifier votre dossier.')
      setWithdrawConfirmOpen(false)
      fetchRentalFile()
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
          <div className="h-8 w-40 bg-muted animate-pulse rounded" />
          <div className="h-4 w-56 bg-muted animate-pulse rounded mt-2" />
        </div>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-20 sm:w-24 bg-muted animate-pulse rounded-full" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      </div>
    )
  }

  // ─── Error state ───────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Dossier locatif</h1>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-sm text-amber-700">Impossible de charger votre dossier. Veuillez réessayer.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Read-only des champs (formulaire) quand le dossier est verrouillé côté TC
  const isReadOnly = !!(existingFile && (existingFile.status === 'VALIDATED' || existingFile.status === 'SUBMITTED'))
  const existingStatus = existingFile ? statusConfig[existingFile.status] : null
  const requiredDocs = documentRequirements

  // Capacités sur les documents selon le statut du dossier.
  // - Voir : toujours possible (consultation read-only de son propre doc)
  // - Remplacer : DRAFT/TC_REVIEW/REJECTED autorisés ; bloqué en SUBMITTED/VALIDATED
  // - Supprimer : DRAFT/REJECTED uniquement
  const fileStatus = existingFile?.status
  const canReplaceDoc = fileStatus === 'DRAFT' || fileStatus === 'TC_REVIEW' || fileStatus === 'REJECTED' || !existingFile
  const canDeleteDoc = fileStatus === 'DRAFT' || fileStatus === 'REJECTED'

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        {onBack && (
          <Button variant="ghost" onClick={onBack} className="gap-2 text-muted-foreground -ml-2 mb-3">
            <ArrowLeft className="size-4" /> Retour
          </Button>
        )}
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Dossier locatif</h1>
        <p className="text-muted-foreground mt-1">Complétez votre dossier pour postuler aux logements</p>
      </div>

      {/* Existing file status banner */}
      {existingFile && existingStatus && (
        <Card className={`border ${existingFile.status === 'VALIDATED' ? 'border-emerald-200 bg-emerald-50' : existingFile.status === 'REJECTED' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {existingFile.status === 'VALIDATED' ? (
                <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
              ) : existingFile.status === 'REJECTED' ? (
                <AlertCircle className="size-5 text-red-600 shrink-0" />
              ) : (
                <FileText className="size-5 text-amber-600 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium flex flex-wrap items-center gap-1.5">
                  <span className="text-nowrap">Statut du dossier :</span>
                  <Badge variant="outline" className={`text-[10px] px-2 py-0.5 border ${existingStatus.color}`}>{existingStatus.label}</Badge>
                </p>
                {existingFile.validUntil && (
                  <p className="text-xs text-muted-foreground mt-1">Valide jusqu&apos;au {new Date(existingFile.validUntil).toLocaleDateString('fr-FR')}</p>
                )}
              </div>
            </div>

            {/* Rejection reason block */}
            {existingFile.rejectionReason && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="size-4 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-red-800">Motif du rejet</p>
                    <p className="text-xs text-red-700 mt-0.5">{existingFile.rejectionReason}</p>
                  </div>
                </div>
              </div>
            )}

            {/* TC comment block (when not rejected) */}
            {existingFile.tcComment && !existingFile.rejectionReason && (
              <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-start gap-2">
                  <FileText className="size-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">Commentaire du Tiers de Confiance</p>
                    <p className="text-xs text-amber-700 mt-0.5">{existingFile.tcComment}</p>
                  </div>
                </div>
              </div>
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
                  Votre dossier est verrouillé pendant la validation. Pour le modifier, retirez d&apos;abord votre soumission.
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
          </CardContent>
        </Card>
      )}

      {/* Progress Steps — toujours navigables même en read-only (l'utilisateur
          doit pouvoir consulter ses propres infos / documents après soumission) */}
      <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1 scrollbar-none">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              onClick={() => setStep(s.id)}
              className={`flex items-center justify-center size-8 sm:size-8 rounded-full text-xs sm:text-sm font-medium transition-all active:scale-95 cursor-pointer hover:ring-2 hover:ring-brand-200 ${
                step >= s.id ? 'bg-brand-500 text-white shadow-sm shadow-brand-200' : 'bg-muted text-muted-foreground'
              }`}
            >
              {step > s.id ? <CheckCircle2 className="size-4 sm:size-5" /> : s.id}
            </button>
            <span className={`text-xs sm:text-sm whitespace-nowrap hidden sm:inline ${
              step >= s.id ? 'text-foreground font-medium' : 'text-muted-foreground'
            }`}>
              {s.title}
            </span>
            {i < steps.length - 1 && (
              <div className={`hidden sm:block w-6 sm:w-8 h-0.5 ${step > s.id ? 'bg-brand-500' : 'bg-neutral-200'}`} />
            )}
          </div>
        ))}
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg">{steps[step - 1].title}</CardTitle>
          <CardDescription>Étape {step} sur {steps.length}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Personal info read-only section */}
          <div className="rounded-lg bg-muted/30 border border-border p-4">
            <p className="text-sm font-medium mb-3 text-muted-foreground">Informations personnelles</p>
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
                <p className="text-xs text-muted-foreground">Téléphone</p>
                <p className="text-sm font-medium">{user?.phone || 'Non renseigné'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium">{user?.email || '—'}</p>
              </div>
            </div>
          </div>

          {/* Step 1: Category */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Sélectionnez votre catégorie pour adapter les documents à fournir.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(['SALARIE', 'ENTREPRENEUR', 'ETUDIANT'] as const).map((cat) => {
                  const labels: Record<string, string> = {
                    SALARIE: 'Salarié',
                    ENTREPRENEUR: 'Entrepreneur / Indépendant',
                    ETUDIANT: 'Étudiant',
                  }
                  const icons: Record<string, string> = {
                    SALARIE: '💼',
                    ENTREPRENEUR: '🚀',
                    ETUDIANT: '🎓',
                  }
                  const descs: Record<string, string> = {
                    SALARIE: 'CDI, CDD, fonctionnaire',
                    ENTREPRENEUR: 'Freelance, gérant, profession libérale',
                    ETUDIANT: 'Boursier, non boursier',
                  }
                  const selected = formData.tenantCategory === cat
                  return (
                    <button
                      key={cat}
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => updateField('tenantCategory', selected ? '' : cat)}
                      className={`relative text-left p-4 rounded-xl border-2 transition-all active:scale-[0.98] ${
                        selected
                          ? 'border-brand-500 bg-brand-50 shadow-sm shadow-brand-200'
                          : 'border-border bg-card hover:border-brand-200 hover:bg-brand-50/50'
                      } ${isReadOnly ? 'cursor-default opacity-60' : 'cursor-pointer'}`}
                    >
                      <span className="text-2xl block mb-2">{icons[cat]}</span>
                      <p className="text-sm font-semibold text-foreground">{labels[cat]}</p>
                      <p className="text-xs text-muted-foreground mt-1">{descs[cat]}</p>
                      {selected && (
                        <span className="absolute top-2 right-2 size-5 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs font-bold">
                          ✓
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 2: Guarantor */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nom complet du garant (Si disponible)</Label>
                <Input
                  className="w-full"
                  placeholder="Nom complet du garant"
                  value={formData.guarantorName}
                  onChange={(e) => updateField('guarantorName', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
              <div className="space-y-2">
                <Label>Téléphone du garant</Label>
                <Input
                  className="w-full"
                  placeholder="01 23 45 67 89"
                  value={formData.guarantorPhone}
                  onChange={(e) => updateField('guarantorPhone', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
              <div className="space-y-2">
                <Label>Relation avec le garant</Label>
                <Select value={formData.guarantorRelation} onValueChange={(v) => updateField('guarantorRelation', v)} disabled={isReadOnly}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choisir..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="parent">Parent</SelectItem>
                    <SelectItem value="frere_soeur">Frère/Sœur</SelectItem>
                    <SelectItem value="ami">Ami</SelectItem>
                    <SelectItem value="tuteur">Tuteur légal</SelectItem>
                    <SelectItem value="autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 3: Documents */}
          {step === 3 && (
            <div className="space-y-4">
              <span className="text-xs text-muted-foreground">
                Documents à fournir pour compléter votre dossier
              </span>

              {/* Required documents summary */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-red-400 inline-block" /> Obligatoire
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-neutral-300 inline-block" /> Facultatif
                </span>
              </div>

              {/* Document list */}
              {requiredDocs.map((doc) => {
                const existingDoc = existingFile?.documents?.find((d) => d.type === doc.type)
                const isUploading = uploadingDocType === doc.type

                return (
                  <div key={doc.type} className={`rounded-xl border-2 p-3 sm:p-4 transition-colors ${
                    existingDoc ? 'border-emerald-200 bg-emerald-50/50' : doc.required ? 'border-red-100' : 'border-border'
                  }`}>
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 w-full sm:w-auto">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {existingDoc ? (
                            <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                          ) : (
                            <FileText className={`size-4 shrink-0 ${doc.required ? 'text-red-400' : 'text-muted-foreground'}`} />
                          )}
                          <span className="text-sm font-medium text-foreground break-words">{doc.label}</span>
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
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-2 ml-6">
                            <span className="text-xs text-muted-foreground truncate max-w-[140px] sm:max-w-[300px]">{existingDoc.name}</span>
                            <span className="text-xs text-muted-foreground hidden sm:inline">•</span>
                            <span className="text-xs text-muted-foreground">
                              Ajouté le {new Date(existingDoc.createdAt).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                        )}
                        {existingDoc?.tcComment && (
                          <p className="text-xs text-amber-600 mt-1 ml-6">Commentaire TC : {existingDoc.tcComment}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto justify-end sm:justify-start">
                        {/* Voir — toujours disponible quand un doc existe */}
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
                        {/* Supprimer — DRAFT / REJECTED uniquement */}
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

              {/* Upload progress indicator */}
              {requiredDocs.length > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-muted-foreground">Progression des documents</span>
                    <span className="font-medium">
                      {existingFile?.documents?.filter(d => requiredDocs.some(rd => rd.type === d.type)).length || 0} / {requiredDocs.length}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${((existingFile?.documents?.filter(d => requiredDocs.some(rd => rd.type === d.type)).length || 0) / requiredDocs.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={() => setStep(Math.max(1, step - 1))}
              disabled={step === 1}
              className="gap-1 w-full sm:w-auto order-2 sm:order-1"
            >
              <ChevronLeft className="size-4" />
              Précédent
            </Button>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto order-1 sm:order-2">
              {existingFile?.status === 'DRAFT' && (
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={saving}
                  className="gap-1.5 w-full sm:w-auto"
                >
                  <Save className="size-4" />
                  {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                </Button>
              )}
              {step < steps.length ? (
                <Button
                  onClick={() => setStep(step + 1)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1 w-full sm:w-auto"
                  disabled={isReadOnly}
                >
                  Suivant
                  <ChevronRight className="size-4" />
                </Button>
              ) : (
                existingFile?.status !== 'SUBMITTED' && existingFile?.status !== 'VALIDATED' && (
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || !hasAllRequiredDocs}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1 w-full sm:w-auto disabled:opacity-50"
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
                )
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
