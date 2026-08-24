'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft, MapPin, User, Phone, Mail, Calendar,
  Check, X, FileText, Building2, Ruler, Bed, Bath,
  Car, Zap, Droplets, Wifi, Shield, ChevronLeft, ChevronRight,
  Eye, PenLine, Flag, AlertTriangle, Trash2, AlertCircle,
  Loader2, ImageOff, Clock
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useBackHandler } from '@/hooks/use-back-handler'
import { ReportDetailDialog, statusConfig, typeLabels as inventoryTypeLabels } from './report-detail-dialog'
import type { InventoryReport } from './report-detail-dialog'

// ─── Template messages ───────────────────────────────────────────────────────

const SIGNAL_TEMPLATES: Record<string, string[]> = {
  FALSE_INFORMATION: [
    "Les informations affichées dans cette annonce (surface, loyer, équipements) ne correspondent pas à la réalité du bien.",
    "Les photos de l'annonce ne correspondent pas au bien proposé.",
  ],
  INAPPROPRIATE_CONTENT: [
    "Cette annonce contient des images ou descriptions inappropriées qui enfreignent les conditions d'utilisation.",
    "Le contenu de cette annonce est de nature publicitaire ou non conforme à la plateforme.",
  ],
  FRAUD: [
    "Cette annonce semble frauduleuse. Le bien présenté pourrait ne pas exister.",
    "Les informations d'identité du propriétaire semblent suspectes.",
  ],
  OTHER: [
    "Cette annonce ne respecte pas les règles générales de la plateforme.",
    "Le bien proposé ne correspond pas à la catégorie sélectionnée.",
  ],
}

const WARN_TEMPLATES: Record<string, string[]> = {
  WARNING: [
    "Bonjour, nous avons constaté que votre annonce ne respecte pas nos conditions générales d'utilisation. Merci de la corriger dans les plus brefs délais.",
    "Bonjour, veuillez mettre à jour les informations de votre annonce qui semblent inexactes ou incomplètes.",
  ],
  FINAL_WARNING: [
    "Bonjour, malgré nos précédents avertissements, votre annonce n'est toujours pas conforme. Ceci est votre dernier avertissement avant suspension de votre compte.",
    "Bonjour, nous vous mettons en demeure de corriger votre annonce sous 48h sous peine de suspension définitive de votre compte.",
  ],
  BAN: [
    "Bonjour, suite à de multiples manquements constatés, nous vous informons de la suspension de votre compte sur la plateforme.",
    "Bonjour, votre compte est suspendu pour non-respect répété des conditions générales d'utilisation de la plateforme.",
  ],
}

const UNPUBLISH_TEMPLATES: Record<string, string[]> = {
  FALSE_INFORMATION: [
    "Les informations de l'annonce (surface, loyer, équipements) ne correspondent pas à la réalité du bien après vérification.",
    "Les photos de l'annonce ne correspondent pas au bien proposé.",
  ],
  MISSING_DOCUMENTS: [
    "Le propriétaire n'a pas fourni les documents requis pour la vérification du bien.",
    "Les documents de propriété fournis sont incomplets ou invalides.",
  ],
  FRAUD: [
    "Cette annonce est suspectée d'être frauduleuse après vérification.",
    "L'identité du propriétaire n'a pas pu être vérifiée.",
  ],
  NON_COMPLIANT: [
    "Le bien ne respecte pas les normes minimales requises sur la plateforme.",
    "Le bien présente des défauts structurels ou de salubrité incompatibles avec la location.",
  ],
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface PropertyDetail {
  id: string
  title: string
  type: string
  description: string
  price: number
  area: number
  commune: string
  address: string
  images: Array<{ id: string; url: string; order: number }>
  bedrooms?: number
  bathrooms?: number
  hasParking?: boolean
  hasGarden?: boolean
  hasPool?: boolean
  hasGuardian?: boolean
  hasClimate?: boolean
  isFurnished?: boolean
  amenities: string
  status: string
  isVerified: boolean
  owner: {
    id: string
    firstName: string
    lastName: string
    phone: string
    email: string
  }
  createdAt: string
}

// ─── Constants ──────────────────────────────────────────────────────────────

const typeLabels: Record<string, string> = {
  APARTMENT: 'Appartement',
  APPARTEMENT: 'Appartement',
  HOUSE: 'Maison',
  MAISON: 'Maison',
  STUDIO: 'Studio',
  CHAMBRE: 'Chambre',
  VILLA: 'Villa',
  DUPLEX: 'Duplex',
  PENTHOUSE: 'Penthouse',
  CONCESSION: 'Concession',
  IMMEUBLE: 'Immeuble',
  COMMERCIAL: 'Local commercial',
  LAND: 'Terrain',
}

const statusLabels: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Brouillon', className: 'bg-gray-100 text-gray-700' },
  PENDING_VERIFICATION: { label: 'En attente de vérification', className: 'bg-amber-100 text-amber-700' },
  ACTIVE: { label: 'Actif', className: 'bg-green-100 text-green-700' },
  SUSPENDED: { label: 'Suspendu', className: 'bg-red-100 text-red-700' },
  CLOSED: { label: 'Fermé', className: 'bg-gray-100 text-gray-500' },
  RENTED: { label: 'Loué', className: 'bg-emerald-100 text-emerald-700' },
}

// ─── Image Thumbnail Row ────────────────────────────────────────────────────

function ImageGallery({
  images,
  currentIndex,
  onSelect,
  title,
}: {
  images: PropertyDetail['images']
  currentIndex: number
  onSelect: (idx: number) => void
  title: string
}) {
  const [mainError, setMainError] = useState(false)
  const [thumbErrors, setThumbErrors] = useState<Set<number>>(new Set())

  const hasImages = images && images.length > 0

  const onThumbError = (idx: number) => {
    setThumbErrors((prev) => new Set(prev).add(idx))
  }

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="relative h-48 sm:h-64 md:h-72 rounded-xl overflow-hidden bg-muted">
        {hasImages && !mainError ? (
          <img
            src={images[currentIndex]?.url || images[0]?.url}
            alt={`${title} - ${currentIndex + 1}`}
            className="w-full h-full object-cover"
            onError={() => setMainError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building2 className="size-16 text-muted-foreground/30" />
          </div>
        )}
        {/* Image counter */}
        {hasImages && images.length > 1 && (
          <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full">
            {currentIndex + 1} / {images.length}
          </div>
        )}
        {/* Nav arrows */}
        {hasImages && images.length > 1 && (
          <>
            <button
              onClick={() => onSelect((currentIndex - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 size-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors text-white"
              aria-label="Image précédente"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={() => onSelect((currentIndex + 1) % images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 size-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors text-white"
              aria-label="Image suivante"
            >
              <ChevronRight className="size-4" />
            </button>
          </>
        )}
        {/* Badge overlay — type is shown in the card below */}
      </div>

      {/* Thumbnails row */}
      {hasImages && images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {images.map((img, idx) => (
            <button
              key={img.id || idx}
              onClick={() => onSelect(idx)}
              className={cn(
                'size-14 sm:size-16 shrink-0 rounded-lg overflow-hidden border-2 transition-all',
                idx === currentIndex
                  ? 'border-brand-500 ring-1 ring-brand-300'
                  : 'border-border hover:border-muted-foreground/30 opacity-70 hover:opacity-100'
              )}
            >
              {thumbErrors.has(idx) ? (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <ImageOff className="size-4 text-muted-foreground/40" />
                </div>
              ) : (
                <img
                  src={img.url}
                  alt={`${title} - ${idx + 1}`}
                  className="w-full h-full object-cover"
                  onError={() => onThumbError(idx)}
                  loading="lazy"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function PropertyVerifyDetail() {
  const { isAuthenticated, selectedItemId, setDashboardSection, setSelectedItemId, setSelectedPropertyId } = useAuthStore()
  const [property, setProperty] = useState<PropertyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [currentImage, setCurrentImage] = useState(0)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectComment, setRejectComment] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [inventoryReports, setInventoryReports] = useState<InventoryReport[]>([])
  const [inventoryLoading, setInventoryLoading] = useState(false)
  const [detailReport, setDetailReport] = useState<InventoryReport | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // ─── Signal property dialog ────────────────────────────────────────
  const [signalDialogOpen, setSignalDialogOpen] = useState(false)
  const [signalReason, setSignalReason] = useState('FALSE_INFORMATION')
  const [signalDescription, setSignalDescription] = useState('')
  const [signalTemplateIndex, setSignalTemplateIndex] = useState(0)

  // ─── Warn owner dialog ─────────────────────────────────────────────
  const [warnDialogOpen, setWarnDialogOpen] = useState(false)
  const [warnMessage, setWarnMessage] = useState('')
  const [warnSeverity, setWarnSeverity] = useState<'WARNING' | 'FINAL_WARNING' | 'BAN'>('WARNING')
  const [warnTemplateIndex, setWarnTemplateIndex] = useState(0)

  // ─── Unpublish dialog ──────────────────────────────────────────────
  const [unpublishDialogOpen, setUnpublishDialogOpen] = useState(false)
  const [unpublishReason, setUnpublishReason] = useState('')
  const [unpublishReasonCategory, setUnpublishReasonCategory] = useState('FALSE_INFORMATION')
  const [unpublishTemplateIndex, setUnpublishTemplateIndex] = useState(0)


  const goBack = () => {
    setSelectedItemId('')
    setDashboardSection('property-verifications')
  }

  // Register hardware back button handler (Android Capacitor)
  useBackHandler('property-verify-detail', goBack)

  const goToInventoryForm = () => {
    setSelectedPropertyId(selectedItemId)
    setSelectedItemId('')
    setDashboardSection('inventory-report-form')
  }

  const fetchInventoryReports = useCallback(async () => {
    if (!isAuthenticated || !selectedItemId) return
    setInventoryLoading(true)
    try {
      const d = await authFetch<{ reports: InventoryReport[] }>(
        `/api/tc/inventory-reports?propertyId=${selectedItemId}`
      )
      setInventoryReports(d.reports || [])
    } catch {
      setInventoryReports([])
    } finally {
      setInventoryLoading(false)
    }
  }, [isAuthenticated, selectedItemId])

  useEffect(() => {
    if (property && !loading) {
      fetchInventoryReports()
    }
  }, [property, loading, fetchInventoryReports])

  const fetchProperty = useCallback(async () => {
    if (!isAuthenticated || !selectedItemId) {
      setLoading(false)
      setNotFound(true)
      return
    }

    setLoading(true)
    setNotFound(false)
    setProperty(null)

    try {
      const d = await authFetch<{ property: PropertyDetail }>(`/api/tc/verifications?propertyId=${selectedItemId}`, { skipCache: true })
      if (d.property) {
        setProperty(d.property)
        setLoading(false)
        return
      }
    } catch (err) {
      if (err instanceof AuthError && (err.status === 401 || err.status === 403)) {
        // Auth error — still try fallback
      }
    }

    try {
      const d2 = await authFetch<{ property: PropertyDetail }>(`/api/properties/${selectedItemId}`, { skipCache: true })
      if (d2.property) {
        setProperty(d2.property)
        setLoading(false)
        return
      }
    } catch {
      // Fallback also failed
    }

    setNotFound(true)
    setProperty(null)
    setLoading(false)
  }, [isAuthenticated, selectedItemId])

  useEffect(() => {
    fetchProperty()
  }, [fetchProperty])

  const handleApprove = async () => {
    if (!selectedItemId) return
    setActionLoading(true)
    try {
      await authFetch('/api/tc/verifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: selectedItemId, action: 'APPROVE' }),
      })
      toast.success('Bien approuvé avec succès !')
      goBack()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'approbation")
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!selectedItemId) return
    setActionLoading(true)
    try {
      await authFetch('/api/tc/verifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: selectedItemId, action: 'REJECT', comment: rejectComment }),
      })
      toast.success('Bien rejeté')
      goBack()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du rejet')
    } finally {
      setActionLoading(false)
    }
  }

  // ─── Sync signal description from template ─────────────────────────
  const currentSignalTemplates = SIGNAL_TEMPLATES[signalReason] || SIGNAL_TEMPLATES.FALSE_INFORMATION

  useEffect(() => {
    const templates = SIGNAL_TEMPLATES[signalReason] || SIGNAL_TEMPLATES.FALSE_INFORMATION
    const validIdx = Math.min(signalTemplateIndex, templates.length - 1)
    setSignalTemplateIndex(validIdx)
    setSignalDescription(templates[validIdx])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signalReason, signalTemplateIndex])

  // ─── Sync warn message from template ───────────────────────────────
  const currentWarnTemplates = WARN_TEMPLATES[warnSeverity] || WARN_TEMPLATES.WARNING

  useEffect(() => {
    const templates = WARN_TEMPLATES[warnSeverity] || WARN_TEMPLATES.WARNING
    const validIdx = Math.min(warnTemplateIndex, templates.length - 1)
    setWarnTemplateIndex(validIdx)
    setWarnMessage(templates[validIdx])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warnSeverity, warnTemplateIndex])

  // ─── Sync unpublish reason from template ───────────────────────────
  const currentUnpublishTemplates = UNPUBLISH_TEMPLATES[unpublishReasonCategory] || UNPUBLISH_TEMPLATES.FALSE_INFORMATION

  useEffect(() => {
    const templates = UNPUBLISH_TEMPLATES[unpublishReasonCategory] || UNPUBLISH_TEMPLATES.FALSE_INFORMATION
    const validIdx = Math.min(unpublishTemplateIndex, templates.length - 1)
    setUnpublishTemplateIndex(validIdx)
    setUnpublishReason(templates[validIdx])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unpublishReasonCategory, unpublishTemplateIndex])

  const handleSignalProperty = async () => {
    if (!selectedItemId || !signalDescription.trim()) return
    setActionLoading(true)
    try {
      await authFetch('/api/tc/signal-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: selectedItemId,
          reason: signalReason,
          description: signalDescription.trim(),
        }),
      })
      toast.success('Bien signalé avec succès. Le propriétaire a été notifié.')
      setSignalDialogOpen(false)
      setSignalReason('FALSE_INFORMATION')
      setSignalDescription('')
      setSignalTemplateIndex(0)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors du signalement")
    } finally {
      setActionLoading(false)
    }
  }

  const handleWarnOwner = async () => {
    if (!selectedItemId || !warnMessage.trim()) return
    setActionLoading(true)
    try {
      await authFetch('/api/tc/warn-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: selectedItemId,
          warningMessage: warnMessage.trim(),
          severity: warnSeverity,
        }),
      })
      toast.success('Avertissement envoyé au propriétaire.')
      setWarnDialogOpen(false)
      setWarnMessage('')
      setWarnSeverity('WARNING')
      setWarnTemplateIndex(0)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'envoi de l'avertissement")
    } finally {
      setActionLoading(false)
    }
  }

  const handleUnpublish = async () => {
    if (!selectedItemId) return
    setActionLoading(true)
    try {
      await authFetch(`/api/tc/properties/${selectedItemId}/unpublish`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: unpublishReason.trim() || null }),
      })
      toast.success('Bien retiré de la plateforme.')
      setUnpublishDialogOpen(false)
      setUnpublishReason('')
      setUnpublishReasonCategory('FALSE_INFORMATION')
      setUnpublishTemplateIndex(0)
      goBack()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors du retrait du bien")
    } finally {
      setActionLoading(false)
    }
  }

  // ─── Loading ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 rounded bg-muted animate-pulse" />
        <div className="h-48 rounded-xl bg-muted animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-48 rounded-xl bg-muted animate-pulse" />
          <div className="h-48 rounded-xl bg-muted animate-pulse" />
        </div>
        <div className="h-14 rounded-xl bg-muted animate-pulse" />
      </div>
    )
  }

  if (notFound || !property) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={goBack} className="gap-2">
          <ArrowLeft className="size-4" /> Retour
        </Button>
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <Building2 className="size-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">Bien introuvable</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ce bien n&apos;existe pas ou vous n&apos;avez pas les droits pour le consulter.
            </p>
            <Button variant="outline" className="mt-4 gap-2" onClick={goBack}>
              <ArrowLeft className="size-4" /> Retour aux vérifications
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isPendingVerification = property.status === 'PENDING_VERIFICATION'
  const statusInfo = statusLabels[property.status] || { label: property.status, className: 'bg-gray-100 text-gray-700' }

  // Parse amenities
  let amenities: string[] = []
  try { amenities = JSON.parse((property as unknown as Record<string, unknown>).amenities as string || '[]') } catch { amenities = [] }

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pb-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-brand-500/10 to-transparent rounded-xl p-3 sm:p-4 -mx-4 sm:-mx-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={goBack} className="gap-1.5 shrink-0 -ml-2">
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Retour</span>
          </Button>
          <div className="flex items-center gap-1.5 min-w-0">
            <Building2 className="size-4 text-brand-500 shrink-0" />
            <h2 className="text-sm font-semibold text-foreground truncate">{property.title}</h2>
          </div>
        </div>
        <Badge className={cn('text-xs shrink-0', statusInfo.className)}>
          {statusInfo.label}
        </Badge>
      </div>

      {/* ── Main Grid (50/50 on md+) ────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        {/* ── LEFT COLUMN ──────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Image Gallery */}
          <ImageGallery
            images={property.images}
            currentIndex={currentImage}
            onSelect={setCurrentImage}
            title={property.title}
          />

          {/* Title & Price */}
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                    {typeLabels[property.type] || property.type}
                  </Badge>
                </div>
                <h3 className="text-lg font-bold text-foreground truncate">{property.title}</h3>
                <div className="flex items-center gap-1 mt-1">
                  <MapPin className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground truncate">{property.commune}</span>
                  {property.address && (
                    <>
                      <span className="text-muted-foreground/50">—</span>
                      <span className="text-sm text-muted-foreground truncate">{property.address}</span>
                    </>
                  )}
                </div>
              </div>
              <p className="text-xl font-bold text-brand-500 shrink-0 text-right leading-tight">
                {(property.price ?? 0).toLocaleString('fr-FR')}
                <span className="block text-xs font-normal text-muted-foreground">FCFA/mois</span>
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="bg-card rounded-xl border border-border p-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Description</h4>
            <p className="text-sm text-foreground leading-relaxed">
              {property.description || 'Aucune description fournie'}
            </p>
          </div>

          {/* Amenities (if any) */}
          {amenities.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Équipements</h4>
              <div className="flex flex-wrap gap-1.5">
                {amenities.map((feature, i) => (
                  <Badge key={i} variant="secondary" className="text-[11px] font-normal">
                    {feature}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN ─────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Owner card */}
          <div className="bg-card rounded-xl border border-border p-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Propriétaire</h4>
            <div className="flex items-center gap-3 mb-3">
              <div className="size-10 rounded-full bg-brand-50 flex items-center justify-center shrink-0">
                <User className="size-5 text-brand-500" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-foreground">{property.owner.firstName} {property.owner.lastName}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="size-3.5 text-muted-foreground/70 shrink-0" />
                <a href={`tel:${property.owner.phone}`} className="hover:text-brand-500 transition-colors">
                  {property.owner.phone}
                </a>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="size-3.5 text-muted-foreground/70 shrink-0" />
                <a href={`mailto:${property.owner.email}`} className="hover:text-brand-500 transition-colors truncate">
                  {property.owner.email}
                </a>
              </div>
            </div>
          </div>

          {/* Key stats */}
          <div className="bg-card rounded-xl border border-border p-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Informations clés</h4>
            <div className="grid grid-cols-2 gap-2">
              <StatItem icon={Building2} label="Type" value={typeLabels[property.type] || property.type} />
              {property.area > 0 && <StatItem icon={Ruler} label="Surface" value={`${property.area} m²`} />}
              {property.bedrooms != null && <StatItem icon={Bed} label="Chambres" value={`${property.bedrooms}`} />}
              {property.bathrooms != null && <StatItem icon={Bath} label="Salle de bain" value={`${property.bathrooms}`} />}
              {property.hasParking && <StatItem icon={Car} label="Parking" value="Oui" />}
              {property.hasClimate && <StatItem icon={Zap} label="Climatisation" value="Oui" />}
              {property.hasGarden && <StatItem icon={Droplets} label="Jardin" value="Oui" />}
              {property.isFurnished && <StatItem icon={Shield} label="Meublé" value="Oui" />}
              <StatItem icon={Calendar} label="Soumis le" value={new Date(property.createdAt).toLocaleDateString('fr-FR')} />
            </div>
          </div>

          {/* Inventory reports */}
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">États des Lieux</h4>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={goToInventoryForm}>
                <PenLine className="size-3" />
                <span>Créer</span>
              </Button>
            </div>
            {inventoryLoading ? (
              <div className="space-y-2">
                <div className="h-10 rounded-lg bg-muted animate-pulse" />
                <div className="h-10 rounded-lg bg-muted animate-pulse" />
              </div>
            ) : inventoryReports.length === 0 ? (
              <div className="text-center py-3">
                <FileText className="size-6 text-muted-foreground/40 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Aucun état des lieux</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {inventoryReports.slice(0, 3).map((report) => {
                  const config = statusConfig[report.status] || statusConfig.DRAFT
                  const StatusIcon = config.icon
                  return (
                    <div
                      key={report.id}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => { setDetailReport(report); setDetailOpen(true) }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-foreground">
                            {inventoryTypeLabels[report.type] || report.type}
                          </span>
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-0.5', config.className)}>
                            <StatusIcon className="size-2.5" />
                            {config.label}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(report.createdAt).toLocaleDateString('fr-FR', {
                            day: 'numeric', month: 'short', year: 'numeric'
                          })}
                        </p>
                      </div>
                      <Eye className="size-3.5 text-muted-foreground shrink-0" />
                    </div>
                  )
                })}
                {inventoryReports.length > 3 && (
                  <p className="text-[10px] text-center text-muted-foreground pt-1">
                    +{inventoryReports.length - 3} autre{inventoryReports.length - 3 > 1 ? 's' : ''} rapport{inventoryReports.length - 3 > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Actions ────────────────────────────────────────────── */}
          <div className="bg-card rounded-xl border border-border p-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Actions</h4>
            <div className="space-y-2">
              {isPendingVerification ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white gap-1.5 h-10 text-sm font-semibold w-full"
                    onClick={handleApprove}
                    disabled={actionLoading}
                  >
                    {actionLoading ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    Approuver
                  </Button>
                  <Button
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5 h-10 text-sm w-full"
                    onClick={() => setShowRejectDialog(true)}
                    disabled={actionLoading}
                  >
                    <X className="size-4" />
                    Rejeter
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/70">
                  <Clock className="size-4 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground font-medium">
                    Déjà traité ({statusInfo.label})
                  </span>
                </div>
              )}
              <div className="w-full border-t border-border my-2" />
              <Button
                variant="outline"
                className="text-amber-600 border-amber-200 hover:bg-amber-50 gap-2 h-10 text-sm w-full justify-start"
                onClick={() => {
                  setSignalReason('FALSE_INFORMATION')
                  setSignalDescription('')
                  setSignalTemplateIndex(0)
                  setSignalDialogOpen(true)
                }}
                disabled={actionLoading}
              >
                <Flag className="size-4" />
                Signaler le bien
              </Button>
              <Button
                variant="outline"
                className="text-orange-600 border-orange-200 hover:bg-orange-50 gap-2 h-10 text-sm w-full justify-start"
                onClick={() => {
                  setWarnMessage('')
                  setWarnSeverity('WARNING')
                  setWarnTemplateIndex(0)
                  setWarnDialogOpen(true)
                }}
                disabled={actionLoading}
              >
                <AlertTriangle className="size-4" />
                Avertir le propriétaire
              </Button>
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50 gap-2 h-10 text-sm w-full justify-start"
                onClick={() => {
                  setUnpublishReason('')
                  setUnpublishReasonCategory('FALSE_INFORMATION')
                  setUnpublishTemplateIndex(0)
                  setUnpublishDialogOpen(true)
                }}
                disabled={actionLoading}
              >
                <Trash2 className="size-4" />
                Retirer le bien
              </Button>
              <div className="w-full border-t border-border my-2" />
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 h-10 text-sm w-full justify-start"
                onClick={goToInventoryForm}
              >
                <FileText className="size-4" />
                Créer un état des lieux
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Reject Dialog ──────────────────────────────────────────── */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeter le bien</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Veuillez indiquer la raison du rejet. Ce motif sera communiqué au propriétaire.
            </p>
            <Textarea
              placeholder="Raison du rejet..."
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowRejectDialog(false); setRejectComment('') }}>
              Annuler
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleReject}
              disabled={!rejectComment.trim() || actionLoading}
            >
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Signal Property Dialog ─────────────────────────────────── */}
      <Dialog open={signalDialogOpen} onOpenChange={setSignalDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Signaler ce bien</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Signalez les informations incorrectes de cette annonce. Le propriétaire sera notifié.
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Motif du signalement</label>
              <select
                value={signalReason}
                onChange={(e) => setSignalReason(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="FALSE_INFORMATION">Fausse information</option>
                <option value="INAPPROPRIATE_CONTENT">Contenu inapproprié</option>
                <option value="FRAUD">Fraude</option>
                <option value="OTHER">Autre</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Message de signalement</label>
              <div className="space-y-2">
                {currentSignalTemplates.map((template, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSignalTemplateIndex(idx)
                      setSignalDescription(template)
                    }}
                    className={`w-full text-left p-3 rounded-lg border text-sm transition-all ${
                      signalTemplateIndex === idx
                        ? 'border-amber-300 bg-amber-50 text-amber-900 ring-2 ring-amber-200 ring-offset-1'
                        : 'border-border hover:bg-muted text-foreground'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`size-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${
                        signalTemplateIndex === idx
                          ? 'border-amber-500 bg-amber-500'
                          : 'border-muted-foreground/30'
                      }`}>
                        {signalTemplateIndex === idx && <div className="size-2 rounded-full bg-white" />}
                      </div>
                      <span>{template}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setSignalDialogOpen(false); setSignalDescription(''); setSignalTemplateIndex(0) }}>
              Annuler
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleSignalProperty}
              disabled={!signalDescription.trim() || actionLoading}
            >
              {actionLoading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Signaler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Warn Owner Dialog ──────────────────────────────────────── */}
      <Dialog open={warnDialogOpen} onOpenChange={(open) => { if (!open) { setWarnDialogOpen(false); setWarnMessage(''); setWarnSeverity('WARNING'); setWarnTemplateIndex(0) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Envoyer un avertissement au propriétaire</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Cet avertissement sera envoyé au propriétaire par message et notification.
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Sévérité</label>
              <div className="flex gap-2">
                {([
                  { value: 'WARNING' as const, label: 'Avertissement', color: 'border-amber-300 bg-amber-50 text-amber-700' },
                  { value: 'FINAL_WARNING' as const, label: 'Dernier avertissement', color: 'border-orange-300 bg-orange-50 text-orange-700' },
                  { value: 'BAN' as const, label: 'Bannissement', color: 'border-red-300 bg-red-50 text-red-700' },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setWarnSeverity(opt.value)}
                    className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                      warnSeverity === opt.value
                        ? `${opt.color} ring-2 ring-offset-1`
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    {warnSeverity === opt.value && <Check className="size-3 inline mr-1" />}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Message d'avertissement</label>
              <div className="space-y-2">
                {currentWarnTemplates.map((template, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setWarnTemplateIndex(idx)
                      setWarnMessage(template)
                    }}
                    className={`w-full text-left p-3 rounded-lg border text-sm transition-all ${
                      warnTemplateIndex === idx
                        ? warnSeverity === 'BAN'
                          ? 'border-red-300 bg-red-50 text-red-900 ring-2 ring-red-200 ring-offset-1'
                          : warnSeverity === 'FINAL_WARNING'
                            ? 'border-orange-300 bg-orange-50 text-orange-900 ring-2 ring-orange-200 ring-offset-1'
                            : 'border-amber-300 bg-amber-50 text-amber-900 ring-2 ring-amber-200 ring-offset-1'
                        : 'border-border hover:bg-muted text-foreground'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`size-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${
                        warnTemplateIndex === idx
                          ? warnSeverity === 'BAN'
                            ? 'border-red-500 bg-red-500'
                            : warnSeverity === 'FINAL_WARNING'
                              ? 'border-orange-500 bg-orange-500'
                              : 'border-amber-500 bg-amber-500'
                          : 'border-muted-foreground/30'
                      }`}>
                        {warnTemplateIndex === idx && <div className="size-2 rounded-full bg-white" />}
                      </div>
                      <span>{template}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            {warnSeverity === 'FINAL_WARNING' && (
              <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                <p className="text-xs text-orange-700">
                  ⚠️ Ce dernier avertissement sera envoyé au propriétaire avec une mention "DERNIER AVERTISSEMENT".
                </p>
              </div>
            )}
            {warnSeverity === 'BAN' && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-xs text-red-700">
                  🚫 Un avis de bannissement sera envoyé. Cette action est grave et sera journalisée.
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setWarnDialogOpen(false); setWarnMessage(''); setWarnSeverity('WARNING'); setWarnTemplateIndex(0) }}>
              Annuler
            </Button>
            <Button
              className={`gap-2 ${
                warnSeverity === 'BAN'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : warnSeverity === 'FINAL_WARNING'
                    ? 'bg-orange-600 hover:bg-orange-700 text-white'
                    : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
              onClick={handleWarnOwner}
              disabled={!warnMessage.trim() || actionLoading}
            >
              {actionLoading ? <Loader2 className="size-4 animate-spin mr-2" /> : <AlertTriangle className="size-4" />}
              {warnSeverity === 'BAN' ? 'Envoyer le bannissement' : warnSeverity === 'FINAL_WARNING' ? 'Envoyer le dernier avertissement' : "Envoyer l'avertissement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Unpublish Dialog ────────────────────────────────────────── */}
      <Dialog open={unpublishDialogOpen} onOpenChange={setUnpublishDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Retirer le bien de la plateforme</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-red-50 border border-red-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="size-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-700">Action irréversible</p>
                  <p className="text-xs text-red-600 mt-1">
                    Ce bien sera remis en brouillon et ne sera plus visible sur la plateforme.
                    Le propriétaire pourra le modifier et le soumettre à nouveau après correction.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Motif du retrait</label>
              <select
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={unpublishReasonCategory}
                onChange={(e) => { setUnpublishReasonCategory(e.target.value); setUnpublishTemplateIndex(0) }}
              >
                <option value="FALSE_INFORMATION">Informations inexactes</option>
                <option value="MISSING_DOCUMENTS">Documents manquants</option>
                <option value="FRAUD">Fraude suspectée</option>
                <option value="NON_COMPLIANT">Bien non conforme</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Message de retrait</label>
              <div className="flex flex-wrap gap-2">
                {currentUnpublishTemplates.map((tpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setUnpublishTemplateIndex(idx)
                      setUnpublishReason(tpl)
                    }}
                    className={cn(
                      "text-left text-xs px-3 py-2 rounded-lg border transition-colors",
                      idx === unpublishTemplateIndex
                        ? "border-red-300 bg-red-50 text-red-700"
                        : "border-border hover:border-red-200 hover:bg-red-50/50 text-muted-foreground"
                    )}
                  >
                    {tpl}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Ou personnalisez le message</label>
              <Textarea
                placeholder="Expliquez pourquoi ce bien est retiré..."
                value={unpublishReason}
                onChange={(e) => setUnpublishReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setUnpublishDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white gap-2"
              onClick={handleUnpublish}
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Trash2 className="size-4" />}
              Confirmer le retrait
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Inventory Report Detail Dialog ──────────────────────────── */}
      <ReportDetailDialog
        report={detailReport}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </motion.div>
  )
}

// ─── Stat Item (small helper) ────────────────────────────────────────────────

function StatItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
      <Icon className="size-3.5 text-brand-500 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
        <p className="text-xs font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  )
}
