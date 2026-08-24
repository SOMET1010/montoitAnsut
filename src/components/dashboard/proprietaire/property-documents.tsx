'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Building2,
  FileText,
  Upload,
  Search,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  FileBadge,
  FilePlus,
  FlaskConical,
  Zap,
  Flame,
  Droplets,
  AlertTriangle,
  X,
  ChevronDown,
  LayoutGrid,
  List,
  PlusCircle,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { useRealtimePropertyDocuments } from '@/hooks/use-realtime-property-documents'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

// ─── Types ──────────────────────────────────────────────────────────────────────

type PropertyDocType =
  | 'DIAGNOSTIC_DPE'
  | 'DIAGNOSTIC_AMIANTE'
  | 'DIAGNOSTIC_PLOMB'
  | 'DIAGNOSTIC_GAZ'
  | 'DIAGNOSTIC_ELECTRICITE'
  | 'DIAGNOSTIC_ERP'
  | 'ASSURANCE_HABITATION'
  | 'ASSURANCE_RC'
  | 'PERMIS_CONSTRUIRE'
  | 'ATTESTATION_CONFORMITE'
  | 'PLAN_BATIMENT'
  | 'AUTRE'

interface PropertyDoc {
  id: string
  name: string
  type: PropertyDocType
  url: string
  description: string | null
  expiryDate: string | null
  createdAt: string
  updatedAt: string
  propertyId: string
}

interface PropertyInfo {
  id: string
  title: string
  type: string
  city: string
  status: string
  images: Array<{ url: string }>
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<PropertyDocType, string> = {
  DIAGNOSTIC_DPE: 'DPE',
  DIAGNOSTIC_AMIANTE: 'Amiante',
  DIAGNOSTIC_PLOMB: 'Plomb',
  DIAGNOSTIC_GAZ: 'Gaz',
  DIAGNOSTIC_ELECTRICITE: 'Électricité',
  DIAGNOSTIC_ERP: 'ERP',
  ASSURANCE_HABITATION: 'Assurance habitation',
  ASSURANCE_RC: 'Assurance RC',
  PERMIS_CONSTRUIRE: 'Permis de construire',
  ATTESTATION_CONFORMITE: 'Attestation de conformité',
  PLAN_BATIMENT: 'Plan bâtiment',
  AUTRE: 'Autre',
}

const DOC_TYPE_CATEGORIES: Record<string, PropertyDocType[]> = {
  'Diagnostics': [
    'DIAGNOSTIC_DPE',
    'DIAGNOSTIC_AMIANTE',
    'DIAGNOSTIC_PLOMB',
    'DIAGNOSTIC_GAZ',
    'DIAGNOSTIC_ELECTRICITE',
    'DIAGNOSTIC_ERP',
  ],
  'Assurances': ['ASSURANCE_HABITATION', 'ASSURANCE_RC'],
  'Permis & Conformité': [
    'PERMIS_CONSTRUIRE',
    'ATTESTATION_CONFORMITE',
    'PLAN_BATIMENT',
  ],
  'Autre': ['AUTRE'],
}

const DOC_TYPE_ICON: Record<PropertyDocType, React.ElementType> = {
  DIAGNOSTIC_DPE: FlaskConical,
  DIAGNOSTIC_AMIANTE: ShieldAlert,
  DIAGNOSTIC_PLOMB: Droplets,
  DIAGNOSTIC_GAZ: Flame,
  DIAGNOSTIC_ELECTRICITE: Zap,
  DIAGNOSTIC_ERP: AlertTriangle,
  ASSURANCE_HABITATION: ShieldCheck,
  ASSURANCE_RC: ShieldCheck,
  PERMIS_CONSTRUIRE: FileBadge,
  ATTESTATION_CONFORMITE: FileBadge,
  PLAN_BATIMENT: FileText,
  AUTRE: FilePlus,
}

const DOC_TYPE_COLOR: Record<PropertyDocType, string> = {
  DIAGNOSTIC_DPE: 'bg-emerald-50 text-emerald-600',
  DIAGNOSTIC_AMIANTE: 'bg-red-50 text-red-600',
  DIAGNOSTIC_PLOMB: 'bg-sky-50 text-sky-600',
  DIAGNOSTIC_GAZ: 'bg-orange-50 text-orange-600',
  DIAGNOSTIC_ELECTRICITE: 'bg-amber-50 text-amber-600',
  DIAGNOSTIC_ERP: 'bg-rose-50 text-rose-600',
  ASSURANCE_HABITATION: 'bg-teal-50 text-teal-600',
  ASSURANCE_RC: 'bg-cyan-50 text-cyan-600',
  PERMIS_CONSTRUIRE: 'bg-violet-50 text-violet-600',
  ATTESTATION_CONFORMITE: 'bg-indigo-50 text-indigo-600',
  PLAN_BATIMENT: 'bg-fuchsia-50 text-fuchsia-600',
  AUTRE: 'bg-neutral-50 text-neutral-600',
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
}

// ─── Helper: expiry status ──────────────────────────────────────────────────────

function getExpiryStatus(expiryDate: string | null): {
  status: 'valid' | 'expiring' | 'expired'
  label: string
} {
  if (!expiryDate) return { status: 'valid', label: '' }
  const now = new Date()
  const expiry = new Date(expiryDate)
  const diffMs = expiry.getTime() - now.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffDays < 0) return { status: 'expired', label: 'Expiré' }
  if (diffDays <= 90) return { status: 'expiring', label: 'Expire bientôt' }
  return { status: 'valid', label: '' }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function PropertyDocuments() {
  const { user, isAuthenticated } = useAuthStore()

  // Data state
  const [properties, setProperties] = useState<PropertyInfo[]>([])
  const [documents, setDocuments] = useState<PropertyDoc[]>([])
  const [allDocuments, setAllDocuments] = useState<Map<string, PropertyDoc[]>>(new Map())
  const [loading, setLoading] = useState(true)

  // UI state
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadTargetPropertyId, setUploadTargetPropertyId] = useState<string>('')
  const [uploadForm, setUploadForm] = useState({
    name: '',
    type: '' as PropertyDocType | '',
    description: '',
    expiryDate: '',
    file: null as File | null,
  })
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<PropertyDoc | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ─── Fetch properties ──────────────────────────────────────────────────────

  const fetchProperties = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    try {
      const d = await authFetch<{ properties?: PropertyInfo[] }>(
        '/api/dashboard/proprietaire'
      )
      setProperties(d.properties || [])
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) {
        setProperties([])
        return
      }
      setProperties([])
    }
  }, [isAuthenticated])

  // ─── Fetch documents for a specific property ───────────────────────────────

  const fetchDocumentsForProperty = useCallback(
    async (propertyId: string): Promise<PropertyDoc[]> => {
      try {
        const res = await authFetch<{ data: PropertyDoc[] }>(
          `/api/properties/${propertyId}/documents`
        )
        return res.data || []
      } catch {
        return []
      }
    },
    []
  )

  // ─── Load all data ─────────────────────────────────────────────────────────

  const loadAllData = useCallback(async () => {
    setLoading(true)
    try {
      const d = await authFetch<{ properties?: PropertyInfo[] }>(
        '/api/dashboard/proprietaire'
      )
      const props = d.properties || []
      setProperties(props)

      // Fetch documents for all properties in parallel
      const docMap = new Map<string, PropertyDoc[]>()
      const results = await Promise.all(
        props.map(async (p) => {
          const docs = await fetchDocumentsForProperty(p.id)
          return { id: p.id, docs }
        })
      )
      let allDocs: PropertyDoc[] = []
      for (const r of results) {
        docMap.set(r.id, r.docs)
        allDocs = allDocs.concat(r.docs)
      }
      setAllDocuments(docMap)
      setDocuments(allDocs)
    } catch {
      setProperties([])
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }, [fetchDocumentsForProperty])

  useEffect(() => {
    if (isAuthenticated) {
      loadAllData()
    } else {
      setLoading(false)
    }
  }, [isAuthenticated, loadAllData])

  // ─── Realtime: reload when documents change ────────────────────────────────

  useRealtimePropertyDocuments({
    userId: user?.id,
    watchedPropertyIds: properties.map(p => p.id),
    onPropertyDocChange: useCallback(() => {
      loadAllData()
    }, [loadAllData]),
  })

  // ─── When property selector changes ────────────────────────────────────────

  useEffect(() => {
    if (selectedPropertyId === 'all') {
      const allDocs: PropertyDoc[] = []
      allDocuments.forEach((docs) => allDocs.push(...docs))
      setDocuments(allDocs)
    } else {
      setDocuments(allDocuments.get(selectedPropertyId) || [])
    }
  }, [selectedPropertyId, allDocuments])

  // ─── Filtered & searched documents ─────────────────────────────────────────

  const filteredDocuments = useMemo(() => {
    let result = documents
    if (typeFilter !== 'all') {
      result = result.filter((d) => d.type === typeFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          (d.description && d.description.toLowerCase().includes(q)) ||
          DOC_TYPE_LABELS[d.type].toLowerCase().includes(q)
      )
    }
    return result
  }, [documents, typeFilter, searchQuery])

  // ─── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = documents.length
    let expiring = 0
    let expired = 0
    for (const doc of documents) {
      const { status } = getExpiryStatus(doc.expiryDate)
      if (status === 'expired') expired++
      else if (status === 'expiring') expiring++
    }
    return { total, expiring, expired }
  }, [documents])

  // ─── Group documents by category ───────────────────────────────────────────

  const groupedDocuments = useMemo(() => {
    const groups: Record<string, PropertyDoc[]> = {}
    for (const doc of filteredDocuments) {
      let category = 'Autre'
      for (const [cat, types] of Object.entries(DOC_TYPE_CATEGORIES)) {
        if (types.includes(doc.type)) {
          category = cat
          break
        }
      }
      if (!groups[category]) groups[category] = []
      groups[category].push(doc)
    }
    return groups
  }, [filteredDocuments])

  // ─── Upload handlers ───────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Le fichier ne doit pas dépasser 10 Mo')
      return
    }
    setUploadForm((prev) => ({ ...prev, file }))
  }

  const handleUpload = async () => {
    if (!uploadTargetPropertyId) {
      toast.error('Veuillez sélectionner un bien')
      return
    }
    if (!uploadForm.name.trim()) {
      toast.error('Veuillez saisir le nom du document')
      return
    }
    if (!uploadForm.type) {
      toast.error('Veuillez sélectionner le type de document')
      return
    }
    if (!uploadForm.file) {
      toast.error('Veuillez sélectionner un fichier')
      return
    }

    setUploading(true)
    try {
      // Convert file to base64 data URL
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(uploadForm.file!)
      })

      await authFetch(`/api/properties/${uploadTargetPropertyId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: uploadForm.name.trim(),
          type: uploadForm.type,
          content: base64,
          description: uploadForm.description.trim() || undefined,
          expiryDate: uploadForm.expiryDate || undefined,
        }),
      })

      toast.success('Document ajouté avec succès')
      setUploadOpen(false)
      resetUploadForm()
      // Reload data
      loadAllData()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur lors de l'ajout du document"
      )
    } finally {
      setUploading(false)
    }
  }

  const resetUploadForm = () => {
    setUploadForm({
      name: '',
      type: '',
      description: '',
      expiryDate: '',
      file: null,
    })
    setUploadTargetPropertyId('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const openUploadDialog = (propertyId?: string) => {
    resetUploadForm()
    if (propertyId) setUploadTargetPropertyId(propertyId)
    else if (selectedPropertyId !== 'all')
      setUploadTargetPropertyId(selectedPropertyId)
    setUploadOpen(true)
  }

  // ─── Delete handler ────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await authFetch(
        `/api/properties/${deleteTarget.propertyId}/documents/${deleteTarget.id}`,
        { method: 'DELETE' }
      )
      toast.success('Document supprimé')
      setDeleteTarget(null)
      loadAllData()
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Erreur lors de la suppression'
      )
    } finally {
      setDeleting(false)
    }
  }

  // ─── Loading skeleton ──────────────────────────────────────────────────────

  if (loading)
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 rounded-xl bg-muted animate-pulse"
          />
        ))}
      </div>
    )

  // ─── Empty state with no properties ────────────────────────────────────────

  if (properties.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            Documents
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez les documents de vos biens immobiliers
          </p>
        </div>
        <Card className="border-border">
          <CardContent className="py-16 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="flex size-16 items-center justify-center rounded-full bg-brand-50">
                <Building2 className="size-8 text-brand-500" />
              </div>
              <div>
                <p className="text-foreground font-semibold">
                  Aucun bien enregistré
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Ajoutez d&apos;abord un bien immobilier pour gérer ses
                  documents
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  const propertySelectOptions = [
    { value: 'all', label: 'Tous les biens' },
    ...properties.map((p) => ({
      value: p.id,
      label: p.title || p.city || 'Bien sans titre',
    })),
  ]

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Documents</h1>
          <p className="text-muted-foreground mt-1">
            Gérez les documents de vos biens immobiliers
          </p>
        </div>
        <Button
          onClick={() => openUploadDialog()}
          className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <PlusCircle className="size-4" />
          <span className="hidden sm:inline">Ajouter un document</span>
          <span className="sm:hidden">Ajouter</span>
        </Button>
      </motion.div>

      {/* ── Stats ───────────────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <FileText className="size-5" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">
                  {stats.total}
                </p>
                <p className="text-xs text-muted-foreground">
                  Documents
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">
                  {stats.expiring}
                </p>
                <p className="text-xs text-muted-foreground">
                  Expirent bientôt
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-red-50 text-red-600">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">
                  {stats.expired}
                </p>
                <p className="text-xs text-muted-foreground">Expirés</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row gap-3"
      >
        {/* Property selector */}
        <Select
          value={selectedPropertyId}
          onValueChange={setSelectedPropertyId}
        >
          <SelectTrigger className="w-full sm:w-64">
            <Building2 className="size-4 text-muted-foreground" />
            <SelectValue placeholder="Sélectionner un bien" />
          </SelectTrigger>
          <SelectContent>
            {propertySelectOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Type filter */}
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <FileText className="size-4 text-muted-foreground" />
            <SelectValue placeholder="Type de document" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {Object.entries(DOC_TYPE_CATEGORIES).map(
              ([category, types]) => (
                <div key={category}>
                  <SelectItem
                    value={types[0]}
                    disabled
                    className="font-semibold text-muted-foreground pointer-events-none"
                  >
                    {category}
                  </SelectItem>
                  {types.map((t) => (
                    <SelectItem key={t} value={t}>
                      &nbsp;&nbsp;{DOC_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </div>
              )
            )}
          </SelectContent>
        </Select>

        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un document..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-full"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* View mode toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`flex items-center justify-center px-3 py-2 text-sm transition-colors ${
              viewMode === 'grid'
                ? 'bg-brand-50 text-brand-600'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutGrid className="size-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center justify-center px-3 py-2 text-sm transition-colors ${
              viewMode === 'list'
                ? 'bg-brand-50 text-brand-600'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <List className="size-4" />
          </button>
        </div>
      </motion.div>

      {/* ── Documents list ──────────────────────────────────────────────────── */}
      {filteredDocuments.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card className="border-border">
            <CardContent className="py-16 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="flex size-16 items-center justify-center rounded-full bg-muted">
                  <FileText className="size-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-foreground font-semibold">
                    {documents.length === 0
                      ? 'Aucun document'
                      : 'Aucun résultat'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {documents.length === 0
                      ? 'Ajoutez votre premier document pour commencer'
                      : 'Essayez de modifier vos filtres'}
                  </p>
                </div>
                {documents.length === 0 && (
                  <Button
                    onClick={() => openUploadDialog()}
                    className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Upload className="size-4" />
                    Ajouter un document
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={viewMode}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {Object.entries(groupedDocuments).map(
              ([category, docs]) => (
                <div key={category} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {category}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-xs"
                    >
                      {docs.length}
                    </Badge>
                  </div>

                  {viewMode === 'grid' ? (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {docs.map((doc) => (
                        <DocumentCard
                          key={doc.id}
                          doc={doc}
                          propertyName={
                            properties.find(
                              (p) => p.id === doc.propertyId
                            )?.title ||
                            properties.find(
                              (p) => p.id === doc.propertyId
                            )?.city ||
                            ''
                          }
                          showPropertyName={
                            selectedPropertyId === 'all'
                          }
                          onDelete={setDeleteTarget}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {docs.map((doc) => (
                        <DocumentRow
                          key={doc.id}
                          doc={doc}
                          propertyName={
                            properties.find(
                              (p) => p.id === doc.propertyId
                            )?.title ||
                            properties.find(
                              (p) => p.id === doc.propertyId
                            )?.city ||
                            ''
                          }
                          showPropertyName={
                            selectedPropertyId === 'all'
                          }
                          onDelete={setDeleteTarget}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* ── Upload Dialog ───────────────────────────────────────────────────── */}
      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          if (!open) resetUploadForm()
          setUploadOpen(open)
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ajouter un document</DialogTitle>
            <DialogDescription>
              Ajoutez un document relatif à l&apos;un de vos biens
              immobiliers
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Property selector */}
            <div className="space-y-2">
              <Label htmlFor="doc-property">Bien immobilier *</Label>
              <Select
                value={uploadTargetPropertyId}
                onValueChange={setUploadTargetPropertyId}
              >
                <SelectTrigger id="doc-property" className="w-full">
                  <SelectValue placeholder="Sélectionner un bien" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title || p.city || 'Bien sans titre'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Document name */}
            <div className="space-y-2">
              <Label htmlFor="doc-name">Nom du document *</Label>
              <Input
                id="doc-name"
                placeholder="Ex: DPE 2024, Attestation d'assurance..."
                value={uploadForm.name}
                onChange={(e) =>
                  setUploadForm((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
              />
            </div>

            {/* Document type */}
            <div className="space-y-2">
              <Label htmlFor="doc-type">Type de document *</Label>
              <Select
                value={uploadForm.type}
                onValueChange={(v) =>
                  setUploadForm((prev) => ({
                    ...prev,
                    type: v as PropertyDocType,
                  }))
                }
              >
                <SelectTrigger id="doc-type" className="w-full">
                  <SelectValue placeholder="Sélectionner le type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_TYPE_CATEGORIES).map(
                    ([category, types]) => (
                      <div key={category}>
                        <SelectItem
                          value={types[0]}
                          disabled
                          className="font-semibold text-muted-foreground pointer-events-none"
                        >
                          {category}
                        </SelectItem>
                        {types.map((t) => (
                          <SelectItem key={t} value={t}>
                            &nbsp;&nbsp;{DOC_TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </div>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="doc-desc">Description (optionnel)</Label>
              <Textarea
                id="doc-desc"
                placeholder="Ajoutez une description..."
                value={uploadForm.description}
                onChange={(e) =>
                  setUploadForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                rows={3}
              />
            </div>

            {/* Expiry date */}
            <div className="space-y-2">
              <Label htmlFor="doc-expiry">
                Date d&apos;expiration (optionnel)
              </Label>
              <Input
                id="doc-expiry"
                type="date"
                value={uploadForm.expiryDate}
                onChange={(e) =>
                  setUploadForm((prev) => ({
                    ...prev,
                    expiryDate: e.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Obligatoire pour les diagnostics immobiliers
              </p>
            </div>

            {/* File upload */}
            <div className="space-y-2">
              <Label htmlFor="doc-file">Fichier *</Label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  id="doc-file"
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {uploadForm.file ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="size-5 text-brand-500" />
                    <span className="text-sm text-foreground font-medium">
                      {uploadForm.file.name}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setUploadForm((prev) => ({
                          ...prev,
                          file: null,
                        }))
                        if (fileInputRef.current)
                          fileInputRef.current.value = ''
                      }}
                      className="text-muted-foreground hover:text-red-500"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Cliquez ou glissez un fichier ici
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Images ou PDF, max 10 Mo
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetUploadForm()
                setUploadOpen(false)
              }}
              disabled={uploading}
            >
              Annuler
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {uploading ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Upload className="size-4" />
                  Ajouter
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="Supprimer le document"
        description={`Êtes-vous sûr de vouloir supprimer le document "${deleteTarget?.name ?? ''}" ? Cette action est irréversible.`}
        confirmLabel={deleting ? 'Suppression...' : 'Supprimer'}
        cancelLabel="Annuler"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </motion.div>
  )
}

// ─── Sub-Components ─────────────────────────────────────────────────────────────

function DocumentCard({
  doc,
  propertyName,
  showPropertyName,
  onDelete,
}: {
  doc: PropertyDoc
  propertyName: string
  showPropertyName: boolean
  onDelete: (doc: PropertyDoc) => void
}) {
  const Icon = DOC_TYPE_ICON[doc.type]
  const colorClass = DOC_TYPE_COLOR[doc.type]
  const expiry = getExpiryStatus(doc.expiryDate)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <Card className="border-border overflow-hidden hover:shadow-md transition-shadow group">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${colorClass}`}
            >
              <Icon className="size-5" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground truncate">
                    {doc.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0"
                    >
                      {DOC_TYPE_LABELS[doc.type]}
                    </Badge>
                    {expiry.status === 'expired' && (
                      <Badge className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0">
                        Expiré
                      </Badge>
                    )}
                    {expiry.status === 'expiring' && (
                      <Badge className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0">
                        Expire bientôt
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Delete button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 h-8 w-8 p-0"
                  onClick={() => onDelete(doc)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              {doc.description && (
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                  {doc.description}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                <span>Ajouté le {formatDate(doc.createdAt)}</span>
                {doc.expiryDate && (
                  <span>
                    Expire le{' '}
                    <span
                      className={
                        expiry.status === 'expired'
                          ? 'text-red-600 font-medium'
                          : expiry.status === 'expiring'
                          ? 'text-amber-600 font-medium'
                          : ''
                      }
                    >
                      {formatDate(doc.expiryDate)}
                    </span>
                  </span>
                )}
              </div>

              {showPropertyName && propertyName && (
                <div className="flex items-center gap-1 mt-1.5">
                  <Building2 className="size-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground truncate">
                    {propertyName}
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function DocumentRow({
  doc,
  propertyName,
  showPropertyName,
  onDelete,
}: {
  doc: PropertyDoc
  propertyName: string
  showPropertyName: boolean
  onDelete: (doc: PropertyDoc) => void
}) {
  const Icon = DOC_TYPE_ICON[doc.type]
  const colorClass = DOC_TYPE_COLOR[doc.type]
  const expiry = getExpiryStatus(doc.expiryDate)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
    >
      <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors group">
        {/* Icon */}
        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${colorClass}`}
        >
          <Icon className="size-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-foreground truncate">
              {doc.name}
            </h3>
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 shrink-0"
            >
              {DOC_TYPE_LABELS[doc.type]}
            </Badge>
            {expiry.status === 'expired' && (
              <Badge className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0 shrink-0">
                Expiré
              </Badge>
            )}
            {expiry.status === 'expiring' && (
              <Badge className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0 shrink-0">
                Expire bientôt
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
            <span>{formatDate(doc.createdAt)}</span>
            {doc.expiryDate && (
              <span>
                Expire le{' '}
                <span
                  className={
                    expiry.status === 'expired'
                      ? 'text-red-600 font-medium'
                      : expiry.status === 'expiring'
                      ? 'text-amber-600 font-medium'
                      : ''
                  }
                >
                  {formatDate(doc.expiryDate)}
                </span>
              </span>
            )}
            {showPropertyName && propertyName && (
              <span className="flex items-center gap-1">
                <Building2 className="size-3" />
                {propertyName}
              </span>
            )}
          </div>
        </div>

        {/* Delete button */}
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 h-8 w-8 p-0"
          onClick={() => onDelete(doc)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </motion.div>
  )
}
