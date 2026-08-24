'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Building2, Search, MapPin, X, Check,
  Loader2, FileText, ChevronsUpDown,
  User, Calendar, Eye, BadgeCheck, Clock,
  Flag, AlertTriangle, Trash2, AlertCircle,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { useRealtimeProperties } from '@/hooks/use-realtime-properties'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { PaginationControls } from '@/components/ui/pagination-controls'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PropertyItem {
  id: string
  title: string
  type: string
  status: string
  price: number
  area: number
  commune: string | null
  address: string | null
  bedrooms: number | null
  bathrooms: number | null
  isVerified: boolean
  isFurnished: boolean
  hasParking: boolean
  hasClimate: boolean
  ownerId: string
  createdAt: string
  owner: {
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string
  } | null
  images: Array<{ id: string; url: string; order: number }>
  inventoryReportCount: number
}

interface ApiResponse {
  properties: PropertyItem[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

// ─── Constants ──────────────────────────────────────────────────────────────

const typeLabels: Record<string, string> = {
  APPARTEMENT: 'Appartement',
  APARTMENT: 'Appartement',
  MAISON: 'Maison',
  HOUSE: 'Maison',
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
  PENDING_VERIFICATION: { label: 'En attente', className: 'bg-amber-100 text-amber-700' },
  ACTIVE: { label: 'Actif', className: 'bg-green-100 text-green-700' },
  SUSPENDED: { label: 'Suspendu', className: 'bg-red-100 text-red-700' },
  CLOSED: { label: 'Fermé', className: 'bg-gray-100 text-gray-500' },
  RENTED: { label: 'Loué', className: 'bg-emerald-100 text-emerald-700' },
}

const statusOptions = [
  { value: 'ALL', label: 'Tous les statuts' },
  { value: 'ACTIVE', label: 'Actif' },
  { value: 'PENDING_VERIFICATION', label: 'En attente' },
  { value: 'SUSPENDED', label: 'Suspendu' },
  { value: 'RENTED', label: 'Loué' },
  { value: 'CLOSED', label: 'Fermé' },
]

const typeOptions = [
  { value: 'ALL', label: 'Tous les types' },
  { value: 'APPARTEMENT', label: 'Appartement' },
  { value: 'MAISON', label: 'Maison' },
  { value: 'STUDIO', label: 'Studio' },
  { value: 'CHAMBRE', label: 'Chambre' },
  { value: 'VILLA', label: 'Villa' },
  { value: 'DUPLEX', label: 'Duplex' },
  { value: 'CONCESSION', label: 'Concession' },
  { value: 'IMMEUBLE', label: 'Immeuble' },
  { value: 'COMMERCIAL', label: 'Local commercial' },
]

// ─── Property Thumbnail ─────────────────────────────────────────────────────

function PropertyThumbnail({ images, title, className }: { images: PropertyItem['images']; title: string; className?: string }) {
  const [imgError, setImgError] = useState(false)
  const hasImage = images && images.length > 0 && !imgError

  return (
    <div className={cn('relative bg-muted overflow-hidden shrink-0', className || 'w-full h-36 sm:h-44')}>
      {hasImage ? (
        <img
          src={images[0].url}
          alt={title}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Building2 className="size-5 sm:size-7 text-muted-foreground/30" />
        </div>
      )}
    </div>
  )
}

// ─── Format helpers ─────────────────────────────────────────────────────────

function priceFCFA(val: number) {
  return (val ?? 0).toLocaleString('fr-FR')
}

function shortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// ─── Signal templates par motif ──────────────────────────────────────────────

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

// ─── Main Component ─────────────────────────────────────────────────────────

export function AllProperties() {
  const { isAuthenticated, setSelectedItemId, setDashboardSection, user } = useAuthStore()
  const [properties, setProperties] = useState<PropertyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // ─── Signal property dialog ────────────────────────────────────────
  const [signalDialogOpen, setSignalDialogOpen] = useState(false)
  const [signalReason, setSignalReason] = useState('FALSE_INFORMATION')
  const [signalDescription, setSignalDescription] = useState('')
  const [signalTemplateIndex, setSignalTemplateIndex] = useState(0)
  const [signalPropertyId, setSignalPropertyId] = useState<string | null>(null)

  // ─── Unpublish dialog ──────────────────────────────────────────────
  const [unpublishDialogOpen, setUnpublishDialogOpen] = useState(false)
  const [unpublishReason, setUnpublishReason] = useState('')
  const [unpublishReasonCategory, setUnpublishReasonCategory] = useState('FALSE_INFORMATION')
  const [unpublishTemplateIndex, setUnpublishTemplateIndex] = useState(0)
  const [unpublishPropertyId, setUnpublishPropertyId] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false)
  const [filterCommune, setFilterCommune] = useState('')

  // Pagination — server-side via offset/limit (page-based UI)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const LIMIT = 10
  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    try {
      const params = new URLSearchParams()
      if (searchQuery) params.set('search', searchQuery)
      if (filterStatus && filterStatus !== 'ALL' && filterStatus !== 'VERIFIED') params.set('status', filterStatus)
      if (filterStatus === 'VERIFIED') params.set('verified', 'true')
      if (filterType && filterType !== 'ALL') params.set('type', filterType)
      if (filterCommune) params.set('commune', filterCommune)
      params.set('limit', String(LIMIT))
      params.set('offset', String((page - 1) * LIMIT))
      const qs = params.toString()

      const d = await authFetch<ApiResponse>(`/api/tc/properties${qs ? `?${qs}` : ''}`)
      setProperties(d.properties || [])
      setTotal(d.pagination?.total || 0)
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) {
        setProperties([])
        return
      }
      setProperties([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, searchQuery, filterStatus, filterType, filterCommune, page])

  // ─── Realtime subscription (TC watches all properties) ────────────
  useRealtimeProperties({
    userId: user?.id,
    watchAll: true,
    onPropertyChange: () => { fetchData() },
  })

  // Refetch quand la page change OU les filtres changent
  useEffect(() => {
    setLoading(true)
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, filterStatus, filterType, filterCommune, page])

  // Reset à la page 1 quand un filtre change (sinon on peut tomber sur une page vide)
  useEffect(() => {
    setPage(1)
  }, [searchQuery, filterStatus, filterType, filterCommune])

  // Clamp si la page courante dépasse le nouveau totalPages (suite à un filtre)
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const handleViewDetail = (id: string) => {
    setSelectedItemId(id)
    setDashboardSection('property-verify-detail')
  }

  const handleInventoryReport = (id: string) => {
    setSelectedItemId(id)
    setDashboardSection('inventory-report-form')
  }

  // ─── Signal property ───────────────────────────────────────────────
  const currentTemplates = SIGNAL_TEMPLATES[signalReason] || SIGNAL_TEMPLATES.FALSE_INFORMATION

  // Sync description when reason or template index changes
  useEffect(() => {
    const templates = SIGNAL_TEMPLATES[signalReason] || SIGNAL_TEMPLATES.FALSE_INFORMATION
    const validIdx = Math.min(signalTemplateIndex, templates.length - 1)
    setSignalTemplateIndex(validIdx)
    setSignalDescription(templates[validIdx])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signalReason, signalTemplateIndex])

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
    if (!signalPropertyId || !signalDescription.trim()) return
    setActionLoading(signalPropertyId)
    try {
      await authFetch('/api/tc/signal-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: signalPropertyId,
          reason: signalReason,
          description: signalDescription.trim(),
        }),
      })
      toast.success('Bien signalé avec succès. Le propriétaire a été notifié.')
      setSignalDialogOpen(false)
      setSignalReason('FALSE_INFORMATION')
      setSignalDescription('')
      setSignalPropertyId(null)
      setSignalTemplateIndex(0)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors du signalement")
    } finally {
      setActionLoading(null)
    }
  }

  // ─── Unpublish property ────────────────────────────────────────────
  const handleUnpublish = async () => {
    if (!unpublishPropertyId) return
    setActionLoading(unpublishPropertyId)
    try {
      await authFetch(`/api/tc/properties/${unpublishPropertyId}/unpublish`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: unpublishReason.trim() || null }),
      })
      toast.success('Bien retiré de la plateforme.')
      setUnpublishDialogOpen(false)
      setUnpublishReason('')
      setUnpublishReasonCategory('FALSE_INFORMATION')
      setUnpublishTemplateIndex(0)
      setUnpublishPropertyId(null)
      // Remove from local state
      setProperties((prev) => prev.filter((p) => p.id !== unpublishPropertyId))
      setTotal((prev) => Math.max(0, prev - 1))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors du retrait du bien")
    } finally {
      setActionLoading(null)
    }
  }

  const handleQuickApprove = async (propertyId: string) => {
    setActionLoading(propertyId)
    try {
      await authFetch('/api/tc/verifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, action: 'APPROVE' }),
      })
      toast.success('Bien approuvé !')
      setProperties((prev) =>
        prev.map((p) =>
          p.id === propertyId ? { ...p, status: 'ACTIVE', isVerified: true } : p
        )
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'approbation")
    } finally {
      setActionLoading(null)
    }
  }

  const clearFilters = () => {
    setSearchQuery('')
    setFilterStatus('')
    setFilterType('')
    setFilterCommune('')
  }

  const hasActiveFilters = searchQuery || filterStatus || filterType || filterCommune

  // ─── Loading Skeleton ─────────────────────────────────────────────────────

  if (loading && properties.length === 0) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="h-10 w-full rounded-lg bg-muted animate-pulse" />
        <div className="space-y-2 sm:space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 sm:h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const pendingCount = properties.filter(p => p.status === 'PENDING_VERIFICATION').length
  const activeCount = properties.filter(p => p.status === 'ACTIVE').length
  const verifiedCount = properties.filter(p => p.isVerified).length

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <Card className="border-border bg-gradient-to-r from-brand-500/10 to-transparent">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-brand-100">
                <Building2 className="size-6 text-brand-600" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">Tous les biens</h1>
                <p className="text-muted-foreground text-sm">Gérez l&apos;ensemble des biens immobiliers sur la plateforme</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge className="bg-brand-50 text-brand-700 border-brand-200 border text-[10px]">
                    <Building2 className="size-3 mr-0.5" /> {total} bien{total !== 1 ? 's' : ''}
                  </Badge>
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 border text-[10px]">
                    <Clock className="size-3 mr-0.5" /> {pendingCount} en attente
                  </Badge>
                  <Badge className="bg-green-50 text-green-700 border-green-200 border text-[10px]">
                    <Check className="size-3 mr-0.5" /> {verifiedCount} vérifié{verifiedCount !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Row — cliquable pour filtrer */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card
          className={cn('border-border cursor-pointer transition-all hover:border-brand-200 hover:shadow-sm', !filterStatus && 'ring-1 ring-brand-200')}
          onClick={() => setFilterStatus('')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50">
                <Building2 className="size-5 text-brand-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">{total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn('border-border cursor-pointer transition-all hover:border-amber-300 hover:shadow-sm', filterStatus === 'PENDING_VERIFICATION' && 'ring-1 ring-amber-400 bg-amber-50/20')}
          onClick={() => setFilterStatus(filterStatus === 'PENDING_VERIFICATION' ? '' : 'PENDING_VERIFICATION')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50">
                <Clock className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-amber-600">{pendingCount}</p>
                <p className="text-xs text-muted-foreground">En attente</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn('border-border cursor-pointer transition-all hover:border-green-300 hover:shadow-sm', filterStatus === 'ACTIVE' && 'ring-1 ring-green-400 bg-green-50/20')}
          onClick={() => setFilterStatus(filterStatus === 'ACTIVE' ? '' : 'ACTIVE')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-green-50">
                <Check className="size-5 text-green-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-green-600">{activeCount}</p>
                <p className="text-xs text-muted-foreground">Actifs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn('border-border cursor-pointer transition-all hover:border-emerald-300 hover:shadow-sm', filterStatus === 'VERIFIED' && 'ring-1 ring-emerald-400 bg-emerald-50/20')}
          onClick={() => setFilterStatus(filterStatus === 'VERIFIED' ? '' : 'VERIFIED')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50">
                <BadgeCheck className="size-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-emerald-600">{verifiedCount}</p>
                <p className="text-xs text-muted-foreground">Vérifiés</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar: Search + Filters (responsive) */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative w-full sm:max-w-[180px] xl:max-w-xs shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un bien..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {statusOptions.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={filterStatus === opt.value ? 'default' : 'outline'}
              className={cn(
                'text-xs',
                filterStatus === opt.value
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  : 'hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200'
              )}
              onClick={() => setFilterStatus(opt.value === 'ALL' ? '' : opt.value)}
            >
              {opt.label}
            </Button>
          ))}
          <div className="w-px bg-border mx-1 shrink-0 hidden sm:block" />
          <Popover open={typeDropdownOpen} onOpenChange={setTypeDropdownOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={typeDropdownOpen}
                className="gap-1.5 text-xs justify-between min-w-[140px]"
              >
                {filterType && typeLabels[filterType]
                  ? typeLabels[filterType]
                  : 'Tous types'
                }
                <ChevronsUpDown className="size-3.5 opacity-50 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Rechercher un type..." />
                <CommandList>
                  <CommandEmpty>Aucun type trouvé</CommandEmpty>
                  <CommandGroup>
                    {typeOptions.map((opt) => (
                      <CommandItem
                        key={opt.value}
                        value={opt.label}
                        onSelect={() => {
                          setFilterType(opt.value === 'ALL' ? '' : opt.value)
                          setTypeDropdownOpen(false)
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 size-4',
                            filterType === opt.value || (filterType === '' && opt.value === 'ALL') ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        {opt.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Empty state */}
      {!loading && properties.length === 0 && (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <Building2 className="size-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">Aucun bien trouvé</p>
            <p className="text-sm text-muted-foreground mt-1">
              {hasActiveFilters
                ? 'Essayez de modifier vos filtres ou d\'élargir votre recherche.'
                : 'Aucun bien n\'est encore enregistré sur la plateforme.'}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4 gap-2">
                <X className="size-4" /> Effacer les filtres
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Properties table — non-vérifiés en surbrillance */}
      {properties.length > 0 && (
        <Card className="border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left font-medium text-muted-foreground p-3">Bien</th>
                  <th className="text-left font-medium text-muted-foreground p-3 hidden sm:table-cell">Type</th>
                  <th className="text-left font-medium text-muted-foreground p-3">Prix</th>
                  <th className="text-center font-medium text-muted-foreground p-3">Statut</th>
                  <th className="text-left font-medium text-muted-foreground p-3 hidden md:table-cell">Propriétaire</th>
                  <th className="text-left font-medium text-muted-foreground p-3 hidden lg:table-cell">Date</th>
                  <th className="text-right font-medium text-muted-foreground p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((property) => {
                  const isPending = property.status === 'PENDING_VERIFICATION'
                  const statusInfo = statusLabels[property.status] || { label: property.status, className: 'bg-gray-100 text-gray-700' }

                  return (
                    <tr
                      key={property.id}
                      className={cn(
                        'border-b border-border hover:bg-muted/50 transition-colors cursor-pointer',
                        isPending && 'bg-amber-50/40 border-l-2 border-l-amber-400'
                      )}
                      onClick={() => handleViewDetail(property.id)}
                    >
                        <td className="p-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="size-8 rounded-md overflow-hidden shrink-0 bg-muted">
                              {property.images && property.images.length > 0 ? (
                                <img src={property.images[0].url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Building2 className="size-4 text-muted-foreground/40" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate max-w-[160px] sm:max-w-[200px]">{property.title || 'Sans titre'}</p>
                              <p className="text-xs text-muted-foreground truncate">{property.commune || property.address || ''}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 hidden sm:table-cell">
                          <Badge className="bg-brand-500/10 text-brand-600 text-[10px]">
                            {typeLabels[property.type] || property.type}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-brand-500 whitespace-nowrap">{priceFCFA(property.price)}</span>
                          <span className="text-muted-foreground text-xs"> FCFA</span>
                        </td>
                        <td className="p-3 text-center">
                          {isPending ? (
                            <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-[10px] gap-1">
                              <Clock className="size-3" /> En attente
                            </Badge>
                          ) : property.isVerified ? (
                            <Badge className="bg-green-100 text-green-700 border border-green-200 text-[10px] gap-1">
                              <Check className="size-3" /> Vérifié
                            </Badge>
                          ) : (
                            <Badge className={cn('text-[10px]', statusInfo.className)}>
                              {statusInfo.label}
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 hidden md:table-cell">
                          {property.owner && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <User className="size-3 shrink-0" />
                              <span className="truncate max-w-[120px]">{property.owner.firstName} {property.owner.lastName}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground hidden lg:table-cell whitespace-nowrap">
                          {shortDate(property.createdAt)}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground hover:text-foreground h-8 w-8 p-0"
                              onClick={(e) => { e.stopPropagation(); handleViewDetail(property.id) }}
                              title="Détails"
                            >
                              <Eye className="size-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground hover:text-foreground h-8 w-8 p-0"
                              onClick={(e) => { e.stopPropagation(); handleInventoryReport(property.id) }}
                              title="État des lieux"
                            >
                              <FileText className="size-4" />
                            </Button>
                            {isPending && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50 h-8 w-8 p-0"
                                onClick={(e) => { e.stopPropagation(); handleQuickApprove(property.id) }}
                                disabled={actionLoading === property.id}
                                title="Approuver"
                              >
                                {actionLoading === property.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSignalPropertyId(property.id)
                                setSignalReason('FALSE_INFORMATION')
                                setSignalDescription('')
                                setSignalTemplateIndex(0)
                                setSignalDialogOpen(true)
                              }}
                              disabled={actionLoading === property.id}
                              title="Signaler"
                            >
                              <Flag className="size-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                setUnpublishPropertyId(property.id)
                                setUnpublishReason('')
                                setUnpublishReasonCategory('FALSE_INFORMATION')
                                setUnpublishTemplateIndex(0)
                                setUnpublishDialogOpen(true)
                              }}
                              disabled={actionLoading === property.id}
                              title="Retirer"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Signal Property Dialog */}
      <Dialog open={signalDialogOpen} onOpenChange={(open) => { if (!open) { setSignalDialogOpen(false); setSignalPropertyId(null); setSignalDescription(''); setSignalTemplateIndex(0) } }}>
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
                {currentTemplates.map((template, idx) => (
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
            <Button variant="outline" onClick={() => { setSignalDialogOpen(false); setSignalDescription(''); setSignalPropertyId(null); setSignalTemplateIndex(0) }}>
              Annuler
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleSignalProperty}
              disabled={!signalDescription.trim() || actionLoading !== null}
            >
              {actionLoading === signalPropertyId ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Signaler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unpublish Dialog */}
      <Dialog open={unpublishDialogOpen} onOpenChange={(open) => { if (!open) { setUnpublishDialogOpen(false); setUnpublishPropertyId(null); setUnpublishReason(''); setUnpublishReasonCategory('FALSE_INFORMATION'); setUnpublishTemplateIndex(0) } }}>
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
            <Button variant="outline" onClick={() => { setUnpublishDialogOpen(false); setUnpublishPropertyId(null); setUnpublishReason(''); setUnpublishReasonCategory('FALSE_INFORMATION'); setUnpublishTemplateIndex(0) }}>
              Annuler
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white gap-2"
              onClick={handleUnpublish}
              disabled={actionLoading !== null}
            >
              {actionLoading === unpublishPropertyId ? <Loader2 className="size-4 animate-spin mr-2" /> : <Trash2 className="size-4" />}
              Confirmer le retrait
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pagination */}
      <PaginationControls
        page={page}
        totalPages={totalPages}
        total={total}
        limit={LIMIT}
        onPageChange={(p) => setPage(p)}
      />
    </motion.div>
  )
}
