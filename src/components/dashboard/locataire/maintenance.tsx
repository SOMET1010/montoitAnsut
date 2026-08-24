'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Wrench, Plus, AlertTriangle, Clock, CheckCircle2, X, ImageIcon, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { useRealtimeMaintenance } from '@/hooks/use-realtime-maintenance'
import { toast } from 'sonner'
import { motion } from 'framer-motion'

// ─── Types ──────────────────────────────────────────────────────────────────
interface MaintenanceItem {
  id: string
  title: string
  description: string
  status: string
  priority: string
  images: string // JSON string
  resolution: string | null
  createdAt: string
  updatedAt: string
  lease: {
    id: string
    startDate: string
    endDate: string
    monthlyRent: number
    property: {
      id: string
      title: string
      address: string
      city: string
      images: Array<{ url: string }>
    }
    owner: { id: string; firstName: string; lastName: string }
  }
}

interface MaintenanceResponse {
  data: MaintenanceItem[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
  stats: Record<string, number>
}

interface DashboardResponse {
  activeLeases: Array<{
    id: string
    startDate: string
    endDate: string
    monthlyRent: number
    property: {
      id: string
      title: string
      address: string
      city: string
    }
  }>
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  PENDING: { label: 'En attente', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  IN_PROGRESS: { label: 'En cours', color: 'bg-brand-50 text-brand-600 border-brand-200', icon: Wrench },
  RESOLVED: { label: 'Résolu', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  CLOSED: { label: 'Fermé', color: 'bg-muted text-muted-foreground border-border', icon: X },
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Faible', color: 'bg-muted text-muted-foreground border-border' },
  MEDIUM: { label: 'Moyenne', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  HIGH: { label: 'Haute', color: 'bg-brand-50 text-brand-600 border-brand-200' },
  URGENT: { label: 'Urgente', color: 'bg-red-50 text-red-700 border-red-200' },
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function parseImages(imagesJson: string): string[] {
  try {
    const parsed = JSON.parse(imagesJson)
    if (Array.isArray(parsed)) return parsed.filter((url) => typeof url === 'string')
  } catch {
    // Invalid JSON
  }
  return []
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier'))
    reader.readAsDataURL(file)
  })
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

export function Maintenance() {
  const { user, isAuthenticated } = useAuthStore()
  const [requests, setRequests] = useState<MaintenanceItem[]>([])
  const [stats, setStats] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [leases, setLeases] = useState<DashboardResponse['activeLeases']>([])
  const [formLeaseId, setFormLeaseId] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formPriority, setFormPriority] = useState('MEDIUM')
  const [submitting, setSubmitting] = useState(false)

  // Image upload state
  const [formImages, setFormImages] = useState<Array<{ dataUrl: string; file: File }>>([])
  const [imageError, setImageError] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  // Cancel confirmation state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<MaintenanceItem | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const fetchMaintenance = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return }
    try {
      const result = await authFetch<MaintenanceResponse>('/api/maintenance')
      setRequests(result.data ?? [])
      setStats(result.stats ?? {})
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) { setRequests([]); return }
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => { fetchMaintenance() }, [fetchMaintenance])

  // Realtime subscription for maintenance
  useRealtimeMaintenance({
    userId: user?.id,
    onMaintenanceChange: (event, req) => {
      if (event === 'INSERT') {
        fetchMaintenance()
      } else {
        setRequests((prev) =>
          prev.map((r) =>
            r.id === req.id
              ? { ...r, status: req.status, priority: req.priority, resolution: req.resolution, updatedAt: req.updated_at }
              : r
          )
        )
      }
    },
  })

  const fetchLeases = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const result = await authFetch<DashboardResponse>('/api/dashboard/locataire')
      setLeases(result.activeLeases ?? [])
    } catch {
      // Silently fail — leases are optional for the form
    }
  }, [isAuthenticated])

  const handleOpenDialog = () => {
    setFormLeaseId('')
    setFormTitle('')
    setFormDescription('')
    setFormPriority('MEDIUM')
    setFormImages([])
    setImageError(null)
    setDialogOpen(true)
    fetchLeases()
  }

  // ── Image handling ─────────────────────────────────────────────────────────
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    e.target.value = ''

    const remaining = 5 - formImages.length
    if (remaining <= 0) {
      setImageError('Maximum 5 photos autorisées')
      return
    }

    const newImages: Array<{ dataUrl: string; file: File }> = []
    let errorMsg = ''

    Array.from(files).slice(0, remaining).forEach((file) => {
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
        errorMsg = 'Format invalide. Utilisez JPG, PNG ou WEBP.'
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        errorMsg = 'Chaque image doit faire moins de 5 Mo.'
        return
      }
      const url = URL.createObjectURL(file)
      newImages.push({ dataUrl: url, file })
    })

    if (errorMsg) {
      setImageError(errorMsg)
      newImages.forEach((img) => URL.revokeObjectURL(img.dataUrl))
      return
    }

    setImageError(null)
    setFormImages((prev) => [...prev, ...newImages])
  }, [formImages.length])

  const removeImage = useCallback((index: number) => {
    setFormImages((prev) => {
      const updated = [...prev]
      URL.revokeObjectURL(updated[index].dataUrl)
      updated.splice(index, 1)
      return updated
    })
    setImageError(null)
  }, [])

  const handleSubmit = async () => {
    if (!formLeaseId || !formTitle.trim() || !formDescription.trim()) {
      toast.error('Veuillez remplir tous les champs obligatoires')
      return
    }
    setSubmitting(true)
    try {
      // Convert images to base64 data URLs
      const imageUrls: string[] = []
      for (const img of formImages) {
        const base64 = await fileToBase64(img.file)
        imageUrls.push(base64)
      }

      await authFetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaseId: formLeaseId,
          title: formTitle.trim(),
          description: formDescription.trim(),
          priority: formPriority,
          images: imageUrls,
        }),
      })
      toast.success('Demande de maintenance créée avec succès')
      setDialogOpen(false)
      // Clean up image object URLs
      formImages.forEach((img) => URL.revokeObjectURL(img.dataUrl))
      fetchMaintenance()
    } catch (err) {
      if (err instanceof AuthError) {
        toast.error(err.message)
      } else {
        toast.error('Erreur lors de la création')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Cancel handling ────────────────────────────────────────────────────────
  const handleCancelClick = (req: MaintenanceItem) => {
    setCancelTarget(req)
    setCancelDialogOpen(true)
  }

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return
    setCancelling(true)
    try {
      await authFetch(`/api/maintenance/${cancelTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CLOSED' }),
      })
      toast.success('Demande annulée avec succès')
      setCancelDialogOpen(false)
      setCancelTarget(null)
      fetchMaintenance()
    } catch (err) {
      if (err instanceof AuthError) {
        toast.error(err.message)
      } else {
        toast.error('Erreur lors de l\'annulation')
      }
    } finally {
      setCancelling(false)
    }
  }

  const pendingCount = stats.PENDING ?? 0
  const inProgressCount = stats.IN_PROGRESS ?? 0
  const resolvedCount = (stats.RESOLVED ?? 0) + (stats.CLOSED ?? 0)

  // ─── Loading skeleton ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-32 bg-muted animate-pulse rounded" />
            <div className="h-4 w-56 bg-muted animate-pulse rounded mt-2" />
          </div>
          <div className="h-10 w-40 bg-muted animate-pulse rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  // ─── Error state ───────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Maintenance</h1>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-sm text-amber-700">Impossible de charger vos demandes. Veuillez réessayer.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants} className="bg-gradient-to-r from-brand-500/10 to-transparent rounded-xl p-4 sm:p-6 -mx-4 sm:-mx-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-brand-100 shrink-0">
              <Wrench className="size-6 text-brand-500" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Maintenance</h1>
              <p className="text-muted-foreground mt-0.5">Demandes d&apos;intervention et suivi</p>
            </div>
          </div>
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shrink-0" onClick={handleOpenDialog}>
            <Plus className="size-4" />
            Nouvelle demande
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge variant="secondary" className="bg-brand-50 text-brand-700">
            <Wrench className="size-3 mr-1" /> {requests.length} total
          </Badge>
          <Badge variant="secondary" className="bg-amber-50 text-amber-700">
            {pendingCount} en attente
          </Badge>
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
            {inProgressCount} en cours
          </Badge>
          <Badge variant="secondary" className="bg-neutral-100 text-neutral-600">
            {resolvedCount} résolues
          </Badge>
        </div>
      </motion.div>

      {/* Status Summary */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-border">
            <CardContent className="p-4 text-center">
              <p className="text-xl sm:text-2xl font-bold text-amber-600">{pendingCount}</p>
              <p className="text-xs text-muted-foreground mt-1">En attente</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4 text-center">
              <p className="text-xl sm:text-2xl font-bold text-brand-600">{inProgressCount}</p>
              <p className="text-xs text-muted-foreground mt-1">En cours</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4 text-center">
              <p className="text-xl sm:text-2xl font-bold text-emerald-600">{resolvedCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Résolues</p>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Requests List or Empty State */}
      {requests.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card className="border-dashed border-border bg-muted/50">
            <CardContent className="py-12 flex flex-col items-center text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-brand-50 mb-4">
                <Wrench className="size-7 text-brand-500" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                Aucune demande de maintenance
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {user?.firstName}, signalez un problème ou demandez une intervention dans votre logement.
              </p>
              <Button
                onClick={handleOpenDialog}
                className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="size-4 mr-2" />
                Nouvelle demande
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div variants={containerVariants} className="space-y-3">
          {requests.map((req) => {
            const sConfig = statusConfig[req.status] || statusConfig.PENDING
            const pConfig = priorityConfig[req.priority] || priorityConfig.MEDIUM
            const SIcon = sConfig.icon
            const property = req.lease?.property
            const reqImages = parseImages(req.images)

            return (
              <motion.div key={req.id} variants={itemVariants}>
                <Card className="border-border hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Image thumbnail or icon */}
                      {reqImages.length > 0 ? (
                        <div className="relative size-10 shrink-0 rounded-lg overflow-hidden">
                          <img
                            src={reqImages.at(0) || ""}
                            alt={req.title}
                            className="size-full object-cover"
                          />
                          {reqImages.length > 1 && (
                            <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-brand-500 text-[9px] font-bold text-white">
                              {reqImages.length}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                          req.priority === 'URGENT' ? 'bg-red-50' : 'bg-brand-50'
                        }`}>
                          {req.priority === 'URGENT' ? (
                            <AlertTriangle className="size-5 text-red-500" />
                          ) : (
                            <Wrench className="size-5 text-brand-500" />
                          )}
                        </div>
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {req.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            {reqImages.length > 0 && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border border-brand-200 bg-brand-50 text-brand-600">
                                <ImageIcon className="size-3 mr-0.5" />
                                {reqImages.length}
                              </Badge>
                            )}
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${pConfig.color}`}>
                              {pConfig.label}
                            </Badge>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${sConfig.color}`}>
                              <SIcon className="size-3 mr-0.5" />
                              {sConfig.label}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {req.description}
                        </p>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                            {property && (
                              <span>{property.title} — {property.city}</span>
                            )}
                            <span>{formatDate(req.createdAt)}</span>
                          </div>
                          {req.status === 'PENDING' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-[10px] px-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 self-start"
                              onClick={() => handleCancelClick(req)}
                            >
                              <X className="size-3 mr-1" />
                              Annuler
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {/* New Request Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="size-5 text-brand-500" />
              Nouvelle demande de maintenance
            </DialogTitle>
            <DialogDescription>
              Décrivez le problème ou l&apos;intervention souhaitée
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Lease selection */}
            <div className="space-y-2">
              <Label>Bail concerné *</Label>
              <Select value={formLeaseId} onValueChange={setFormLeaseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un bail..." />
                </SelectTrigger>
                <SelectContent>
                  {leases.length === 0 ? (
                    <SelectItem value="none" disabled>Aucun bail actif</SelectItem>
                  ) : (
                    leases.map((lease) => (
                      <SelectItem key={lease.id} value={lease.id}>
                        {lease.property.title} — {lease.property.city}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {leases.length === 0 && (
                <p className="text-xs text-amber-600">Vous devez avoir un bail actif pour créer une demande.</p>
              )}
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label>Titre *</Label>
              <Input
                placeholder="Ex: Fuite d'eau dans la cuisine"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                placeholder="Décrivez le problème en détail..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={4}
              />
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label>Priorité</Label>
              <Select value={formPriority} onValueChange={setFormPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Faible</SelectItem>
                  <SelectItem value="MEDIUM">Moyenne</SelectItem>
                  <SelectItem value="HIGH">Haute</SelectItem>
                  <SelectItem value="URGENT">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Photos (max 5)</Label>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={handleImageSelect}
              />
              <div className="flex flex-wrap gap-2">
                {formImages.map((img, index) => (
                  <div key={index} className="relative group size-16 rounded-lg overflow-hidden border border-border">
                    <img
                      src={img.dataUrl}
                      alt={`Photo ${index + 1}`}
                      className="size-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="size-4 text-white" />
                    </button>
                  </div>
                ))}
                {formImages.length < 5 && (
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="flex size-16 items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-brand-300 hover:bg-brand-50/50 transition-colors"
                  >
                    <Plus className="size-5 text-muted-foreground" />
                  </button>
                )}
              </div>
              {imageError && (
                <p className="text-xs text-red-600">{imageError}</p>
              )}
              <p className="text-[10px] text-muted-foreground">
                JPG, PNG ou WEBP — 5 Mo max par photo
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !formLeaseId || !formTitle.trim() || !formDescription.trim() || leases.length === 0}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {submitting ? 'Envoi...' : 'Envoyer la demande'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-500" />
              Annuler la demande
            </DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir annuler cette demande de maintenance&nbsp;? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          {cancelTarget && (
            <div className="py-2">
              <p className="text-sm font-medium text-foreground">{cancelTarget.title}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{cancelTarget.description}</p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)} disabled={cancelling}>
              Non, garder
            </Button>
            <Button
              onClick={handleCancelConfirm}
              disabled={cancelling}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {cancelling ? 'Annulation...' : 'Oui, annuler'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
