'use client'

import { useCallback, useEffect, useState } from 'react'
import { Home, Check, X, MapPin, User, Calendar, Search, Building2, Loader2, ImageOff } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { useRealtimeProperties } from '@/hooks/use-realtime-properties'
import { ViewModeToggle, type ViewMode } from './view-mode-toggle'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { usePagination } from '@/hooks/use-pagination'
import { PaginationControls } from '@/components/ui/pagination-controls'

interface PendingProperty {
  id: string
  title: string
  type: string
  price: number
  commune: string
  images: Array<{ id: string; url: string; order: number }>
  owner: {
    firstName: string
    lastName: string
    phone: string
  }
  createdAt: string
  area?: number
}

interface VerificationResponse {
  properties: PendingProperty[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

const typeLabels: Record<string, string> = {
  APARTMENT: 'Appartement',
  HOUSE: 'Maison',
  STUDIO: 'Studio',
  VILLA: 'Villa',
  COMMERCIAL: 'Local commercial',
  LAND: 'Terrain',
}

function PropertyThumbnail({
  images,
  title,
  type,
  size = 'default',
}: {
  images: PendingProperty['images']
  title: string
  type: string
  size?: 'default' | 'compact'
}) {
  const [imgError, setImgError] = useState(false)
  const hasImage = images && images.length > 0 && !imgError

  return (
    <div
      className={cn(
        'relative bg-muted shrink-0 overflow-hidden',
        size === 'default'
          ? 'w-full sm:w-40 h-32 sm:h-auto sm:min-h-[160px]'
          : 'w-16 h-16 rounded-lg'
      )}
    >
      {hasImage ? (
        <img
          src={images[0].url}
          alt={title}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          {imgError ? (
            <ImageOff className="size-6 text-muted-foreground/40" />
          ) : (
            <Building2 className={cn('text-muted-foreground/40', size === 'compact' ? 'size-5' : 'size-8')} />
          )}
        </div>
      )}
      <Badge className="absolute top-2 left-2 bg-brand-500 text-white text-[10px]">
        {typeLabels[type] || type}
      </Badge>
    </div>
  )
}

export function PropertyVerifications() {
  const { user, isAuthenticated, selectedItemId, setSelectedItemId, setDashboardSection } = useAuthStore()
  const [properties, setProperties] = useState<PendingProperty[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectComment, setRejectComment] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCommune, setFilterCommune] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'APARTMENT' | 'HOUSE' | 'OTHER'>('ALL')

  // Auto-navigate to property detail when selectedItemId matches
  useEffect(() => {
    if (!selectedItemId || properties.length === 0) return
    const match = properties.find(p => p.id === selectedItemId)
    if (!match) return
    setDashboardSection('property-verify-detail')
  }, [selectedItemId, properties, setDashboardSection])

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    try {
      const params = new URLSearchParams()
      if (searchQuery) params.set('search', searchQuery)
      if (filterCommune) params.set('commune', filterCommune)
      const qs = params.toString()
      const url = `/api/tc/verifications${qs ? `?${qs}` : ''}`

      const d = await authFetch<VerificationResponse>(url)
      setProperties(d.properties || [])
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) {
        setProperties([])
        return
      }
      setProperties([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, searchQuery, filterCommune])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useRealtimeProperties({
    userId: user?.id,
    watchAll: true,
    onPropertyChange: () => { fetchData() },
  })

  const handleVerify = (id: string) => {
    setSelectedItemId(id)
    setDashboardSection('property-verify-detail')
  }

  const handleApprove = async (id: string) => {
    setActionLoading(id)
    try {
      await authFetch('/api/tc/verifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: id, action: 'APPROVE' }),
      })
      toast.success('Bien approuvé avec succès !')
      setProperties((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'approbation")
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async () => {
    if (!rejectingId) return
    setActionLoading(rejectingId)
    try {
      await authFetch('/api/tc/verifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: rejectingId, action: 'REJECT', comment: rejectComment }),
      })
      toast.success('Bien rejeté')
      setProperties((prev) => prev.filter((p) => p.id !== rejectingId))
      setRejectingId(null)
      setRejectComment('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du rejet')
    } finally {
      setActionLoading(null)
    }
  }

  const closeRejectDialog = () => {
    setRejectingId(null)
    setRejectComment('')
  }

  const filteredProperties = properties.filter((p) => {
    if (typeFilter === 'ALL') return true
    if (typeFilter === 'OTHER') return !['APARTMENT', 'HOUSE'].includes(p.type)
    return p.type === typeFilter
  })

  // Pagination — réinitialise à la page 1 quand un filtre/recherche change
  const {
    paginatedItems: pagedProperties,
    page,
    totalPages,
    total,
    pageSize,
    setPage,
  } = usePagination({
    items: filteredProperties,
    pageSize: 10,
    resetSignal: `${searchQuery}|${filterCommune}|${typeFilter}`,
  })

  /* ─── Loading skeleton ─── */
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  /* ─── Empty state ─── */
  const emptyState = (
    <Card className="border-border">
      <CardContent className="py-12 text-center">
        <Home className="size-12 text-muted-foreground/50 mx-auto mb-4" />
        <p className="text-muted-foreground font-medium">Aucun bien en attente de vérification</p>
        <p className="text-sm text-muted-foreground mt-1">
          Les biens soumis par les propriétaires apparaîtront ici
        </p>
      </CardContent>
    </Card>
  )

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <Card className="border-border bg-gradient-to-r from-brand-500/10 to-transparent">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-brand-100">
                <Home className="size-6 text-brand-600" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">Vérification des biens</h1>
                <p className="text-muted-foreground text-sm">Biens en attente de vérification par le Tiers de Confiance</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 border text-[10px]">
                    <Home className="size-3 mr-0.5" /> {properties.length} bien{properties.length !== 1 ? 's' : ''} à vérifier
                  </Badge>
                  <Badge className="bg-brand-50 text-brand-700 border-brand-200 border text-[10px]">
                    <MapPin className="size-3 mr-0.5" /> {new Set(properties.map(p => p.commune)).size} commune{new Set(properties.map(p => p.commune)).size !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card
          className={cn('border-border cursor-pointer transition-all hover:shadow-sm', typeFilter === 'ALL' && 'ring-1 ring-brand-400 bg-brand-50/20')}
          onClick={() => setTypeFilter('ALL')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50">
                <Home className="size-5 text-brand-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">{properties.length}</p>
                <p className="text-xs text-muted-foreground">Total biens</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn('border-border cursor-pointer transition-all hover:shadow-sm', typeFilter === 'APARTMENT' && 'ring-1 ring-amber-400 bg-amber-50/20')}
          onClick={() => setTypeFilter(typeFilter === 'APARTMENT' ? 'ALL' : 'APARTMENT')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50">
                <Building2 className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-amber-600">{properties.filter(p => p.type === 'APARTMENT').length}</p>
                <p className="text-xs text-muted-foreground">Appartements</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn('border-border cursor-pointer transition-all hover:shadow-sm', typeFilter === 'HOUSE' && 'ring-1 ring-teal-400 bg-teal-50/20')}
          onClick={() => setTypeFilter(typeFilter === 'HOUSE' ? 'ALL' : 'HOUSE')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-teal-50">
                <Home className="size-5 text-teal-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-teal-600">{properties.filter(p => p.type === 'HOUSE').length}</p>
                <p className="text-xs text-muted-foreground">Maisons</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn('border-border cursor-pointer transition-all hover:shadow-sm', typeFilter === 'OTHER' && 'ring-1 ring-rose-400 bg-rose-50/20')}
          onClick={() => setTypeFilter(typeFilter === 'OTHER' ? 'ALL' : 'OTHER')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-rose-50">
                <MapPin className="size-5 text-rose-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-rose-600">{properties.filter(p => !['APARTMENT', 'HOUSE'].includes(p.type)).length}</p>
                <p className="text-xs text-muted-foreground">Autres</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search, filter & view toggle */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un bien..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="relative w-full sm:w-auto">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Commune"
            value={filterCommune}
            onChange={(e) => setFilterCommune(e.target.value)}
            className="pl-9 w-full sm:w-48"
          />
        </div>
        <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
      </div>

      {/* Content */}
      {filteredProperties.length === 0 ? (
        emptyState
      ) : viewMode === 'card' ? (
        /* ─── CARD VIEW ─── */
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <AnimatePresence mode="popLayout" initial={false} key={`page-${page}`}>
            {pagedProperties.map((property) => (
              <motion.div
                key={property.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="border-border overflow-hidden hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row">
                    {/* Thumbnail */}
                    <PropertyThumbnail images={property.images} title={property.title} type={property.type} />

                    {/* Content */}
                    <CardContent className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground line-clamp-1">{property.title}</h3>
                        <div className="flex items-center gap-1 mt-1">
                          <MapPin className="size-3.5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">{property.commune}</span>
                        </div>
                        <p className="text-lg font-bold text-brand-500 mt-1">
                          {(property.price ?? 0).toLocaleString('fr-FR')} FCFA
                          <span className="text-sm font-normal text-muted-foreground">/mois</span>
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="size-3" />
                            {property.owner.firstName} {property.owner.lastName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3" />
                            {new Date(property.createdAt).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1 flex-1"
                          onClick={() => handleVerify(property.id)}
                          disabled={actionLoading === property.id}
                        >
                          Vérifier
                        </Button>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white gap-1"
                          onClick={() => handleApprove(property.id)}
                          disabled={actionLoading === property.id}
                        >
                          {actionLoading === property.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Check className="size-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50 gap-1"
                          onClick={() => setRejectingId(property.id)}
                          disabled={actionLoading === property.id}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
          <PaginationControls
            page={page}
            totalPages={totalPages}
            total={total}
            limit={pageSize}
            onPageChange={setPage}
            className="md:col-span-2"
          />
        </div>
      ) : (
        /* ─── LIST VIEW ─── */
        <Card className="border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left font-medium text-muted-foreground px-4 py-3">Bien</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">Commune</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3">Prix</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">Propriétaire</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">Date</th>
                  <th className="text-right font-medium text-muted-foreground px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout" initial={false} key={`page-${page}`}>
                  {pagedProperties.map((property) => (
                    <motion.tr
                      key={property.id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.15 }}
                      className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => handleVerify(property.id)}
                    >
                      {/* Property info + thumbnail */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <PropertyThumbnail
                            images={property.images}
                            title={property.title}
                            type={property.type}
                            size="compact"
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate max-w-[200px]">
                              {property.title}
                            </p>
                            <Badge className="bg-brand-500 text-white text-[10px] mt-0.5">
                              {typeLabels[property.type] || property.type}
                            </Badge>
                          </div>
                        </div>
                      </td>
                      {/* Commune */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="size-3.5" />
                          {property.commune}
                        </div>
                      </td>
                      {/* Price */}
                      <td className="px-4 py-3">
                        <span className="font-semibold text-brand-500">
                          {(property.price ?? 0).toLocaleString('fr-FR')}
                        </span>
                        <span className="text-muted-foreground text-xs"> FCFA/m</span>
                      </td>
                      {/* Owner */}
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <User className="size-3" />
                          {property.owner.firstName} {property.owner.lastName}
                        </div>
                      </td>
                      {/* Date */}
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                        <div className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {new Date(property.createdAt).toLocaleDateString('fr-FR')}
                        </div>
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 px-3 text-xs"
                            onClick={(e) => { e.stopPropagation(); handleVerify(property.id) }}
                            disabled={actionLoading === property.id}
                          >
                            Vérifier
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="bg-green-600 hover:bg-green-700 text-white h-8 w-8 p-0"
                            onClick={(e) => { e.stopPropagation(); handleApprove(property.id) }}
                            disabled={actionLoading === property.id}
                          >
                            {actionLoading === property.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Check className="size-3.5" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700 h-8 w-8 p-0"
                            onClick={(e) => { e.stopPropagation(); setRejectingId(property.id) }}
                            disabled={actionLoading === property.id}
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-3">
            <PaginationControls
              page={page}
              totalPages={totalPages}
              total={total}
              limit={pageSize}
              onPageChange={setPage}
            />
          </div>
        </Card>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectingId !== null} onOpenChange={(open) => { if (!open) closeRejectDialog() }}>
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
            <Button variant="outline" onClick={closeRejectDialog}>
              Annuler
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleReject}
              disabled={!rejectComment.trim() || actionLoading !== null}
            >
              {actionLoading !== null ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : null}
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
