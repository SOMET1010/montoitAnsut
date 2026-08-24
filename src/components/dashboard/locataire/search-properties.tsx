'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  Search,
  MapPin,
  Building2,
  ChevronRight,
  Heart,
  Car,
  Trees,
  Waves,
  Shield,
  Thermometer,
  CalendarDays,
  Clock,
  MessageSquare,
  BookmarkPlus,
  Bookmark,
  X,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PropertyStatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { useAuthStore } from '@/lib/auth-store'
import { useFavorites } from '@/lib/use-favorites'
import { authFetch } from '@/lib/auth-fetch'
import { apiFetch } from '@/lib/capacitor'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { PaginationControls } from '@/components/ui/pagination-controls'

// ─── Types ──────────────────────────────────────────────────────────────────
interface PropertyItem {
  id: string
  title: string
  type: string
  price: number
  currency: string
  area: number
  bedrooms: number | null
  bathrooms: number | null
  address: string
  city: string
  commune: string | null
  rentalStatus: string
  isFurnished: boolean
  isVerified: boolean
  viewsCount: number
  image: string | null
  hasParking: boolean
  hasGarden: boolean
  hasPool: boolean
  hasGuardian: boolean
  hasClimate: boolean
  owner: {
    id: string
    firstName: string
    lastName: string
  }
}

interface SavedSearch {
  id: string
  name: string
  city: string | null
  propertyType: string | null
  minPrice: number | null
  maxPrice: number | null
  searchQuery: string | null
}

interface VisitDialogState {
  open: boolean
  propertyId: string | null
  propertyTitle: string | null
  requestedDate: string
  timeSlot: string
  tenantMessage: string
  submitting: boolean
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatCurrency(amount: number): string {
  return amount.toLocaleString('fr-FR')
}

const PROPERTY_TYPE_OPTIONS = [
  { value: 'ALL', label: 'Tous les types' },
  { value: 'STUDIO', label: 'Studio' },
  { value: 'APPARTEMENT', label: 'Appartement' },
  { value: 'MAISON', label: 'Maison' },
  { value: 'DUPLEX', label: 'Duplex' },
  { value: 'PENTHOUSE', label: 'Penthouse' },
  { value: 'VILLA', label: 'Villa' },
  { value: 'CHAMBRE', label: 'Chambre' },
  { value: 'CONCESSION', label: 'Concession' },
  { value: 'IMMEUBLE', label: 'Immeuble' },
] as const

const TIME_SLOTS = [
  { value: '08:00-10:00', label: '08h00 – 10h00' },
  { value: '10:00-12:00', label: '10h00 – 12h00' },
  { value: '12:00-14:00', label: '12h00 – 14h00' },
  { value: '14:00-16:00', label: '14h00 – 16h00' },
  { value: '16:00-18:00', label: '16h00 – 18h00' },
] as const

// ─── Amenity icon config ────────────────────────────────────────────────────
const AMENITY_ICONS: {
  key: keyof Pick<PropertyItem, 'hasParking' | 'hasGarden' | 'hasPool' | 'hasGuardian' | 'hasClimate'>
  icon: typeof Car
  label: string
}[] = [
  { key: 'hasParking', icon: Car, label: 'Parking' },
  { key: 'hasGarden', icon: Trees, label: 'Jardin' },
  { key: 'hasPool', icon: Waves, label: 'Piscine' },
  { key: 'hasGuardian', icon: Shield, label: 'Gardien' },
  { key: 'hasClimate', icon: Thermometer, label: 'Climatisation' },
]

// ─── Animation Variants ────────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

export function SearchProperties() {
  const { user, isAuthenticated, setView, setSelectedPropertyId } = useAuthStore()

  // Search state
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [propertyType, setPropertyType] = useState('ALL')
  const [results, setResults] = useState<PropertyItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pagination
  const [page, setPage] = useState(1)
  const limit = 12

  const paginatedResults = useMemo(() => {
    const start = (page - 1) * limit
    return results.slice(start, start + limit)
  }, [results, page, limit])

  useEffect(() => {
    setPage(1)
  }, [search, city, minPrice, maxPrice, propertyType])

  // Visit dialog state
  const [visitDialog, setVisitDialog] = useState<VisitDialogState>({
    open: false,
    propertyId: null,
    propertyTitle: null,
    requestedDate: '',
    timeSlot: '',
    tenantMessage: '',
    submitting: false,
  })

  // Favorites hook
  const propertyIds = useMemo(() => results.map((p) => p.id), [results])
  const { isFavorite, toggleFavorite } = useFavorites(propertyIds)

  const handleSearch = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSearched(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (city) params.set('commune', city)
      if (minPrice) params.set('minPrice', minPrice)
      if (maxPrice) params.set('maxPrice', maxPrice)
      if (propertyType !== 'ALL') params.set('type', propertyType)
      params.set('all', 'true')

      // /api/properties is a public endpoint — use apiFetch
      const res = await apiFetch(`/api/properties?${params.toString()}`)
      if (!res.ok) throw new Error('Erreur serveur')
      const data = await res.json()
      setResults(data.properties ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [search, city, minPrice, maxPrice, propertyType])

  // Saved searches
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [saveSearchOpen, setSaveSearchOpen] = useState(false)
  const [saveSearchName, setSaveSearchName] = useState('')
  const [savingSearch, setSavingSearch] = useState(false)

  const fetchSavedSearches = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const data = await authFetch<{ data: SavedSearch[] }>('/api/search-alerts')
      setSavedSearches(data.data ?? [])
    } catch {
      setSavedSearches([])
    }
  }, [isAuthenticated])

  useEffect(() => {
    fetchSavedSearches()
  }, [fetchSavedSearches])

  const handleSaveSearch = useCallback(async () => {
    if (!saveSearchName.trim() || savingSearch) return
    setSavingSearch(true)
    try {
      await authFetch('/api/search-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveSearchName.trim(),
          city: city || undefined,
          propertyType,
          minPrice: minPrice || undefined,
          maxPrice: maxPrice || undefined,
          searchQuery: search || undefined,
        }),
      })
      toast.success('Recherche enregistrée')
      setSaveSearchOpen(false)
      setSaveSearchName('')
      fetchSavedSearches()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Impossible d\'enregistrer la recherche')
    } finally {
      setSavingSearch(false)
    }
  }, [saveSearchName, savingSearch, city, propertyType, minPrice, maxPrice, search, fetchSavedSearches])

  const handleApplySavedSearch = useCallback((saved: SavedSearch) => {
    setSearch(saved.searchQuery || '')
    setCity(saved.city || '')
    setPropertyType(saved.propertyType || 'ALL')
    setMinPrice(saved.minPrice ? String(saved.minPrice) : '')
    setMaxPrice(saved.maxPrice ? String(saved.maxPrice) : '')
    setTimeout(handleSearch, 0)
  }, [handleSearch])

  const handleDeleteSavedSearch = useCallback(async (id: string) => {
    setSavedSearches((prev) => prev.filter((s) => s.id !== id))
    try {
      await authFetch(`/api/search-alerts/${id}`, { method: 'DELETE' })
    } catch {
      fetchSavedSearches()
    }
  }, [fetchSavedSearches])

  const handleViewProperty = (propertyId: string) => {
    setSelectedPropertyId(propertyId)
    setView('property-detail')
  }

  const handleBrowseAll = () => {
    setView('nos-biens')
  }

  const handleToggleFavorite = async (e: React.MouseEvent, propertyId: string) => {
    e.stopPropagation()
    if (!isAuthenticated) {
      setView('login')
      return
    }
    const result = await toggleFavorite(propertyId)
    if (result) {
      toast.success('Ajouté aux favoris')
    } else {
      toast.success('Retiré des favoris')
    }
  }

  // ─── Visit dialog handlers ──────────────────────────────────────────────
  const openVisitDialog = (e: React.MouseEvent, property: PropertyItem) => {
    e.stopPropagation()
    if (!isAuthenticated) {
      setView('login')
      return
    }
    setVisitDialog({
      open: true,
      propertyId: property.id,
      propertyTitle: property.title,
      requestedDate: '',
      timeSlot: '',
      tenantMessage: '',
      submitting: false,
    })
  }

  const closeVisitDialog = () => {
    setVisitDialog((prev) => ({ ...prev, open: false }))
  }

  const submitVisitRequest = async () => {
    if (!visitDialog.propertyId || !visitDialog.requestedDate || !visitDialog.timeSlot) {
      toast.error('Veuillez remplir tous les champs obligatoires')
      return
    }

    setVisitDialog((prev) => ({ ...prev, submitting: true }))
    try {
      await authFetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: visitDialog.propertyId,
          requestedDate: visitDialog.requestedDate,
          timeSlot: visitDialog.timeSlot,
          visitType: 'PHYSICAL',
          tenantMessage: visitDialog.tenantMessage || undefined,
        }),
      })
      toast.success('Demande de visite envoyée !')
      closeVisitDialog()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la demande'
      toast.error(message)
    } finally {
      setVisitDialog((prev) => ({ ...prev, submitting: false }))
    }
  }

  // ─── Build address display ──────────────────────────────────────────────
  const formatAddress = (property: PropertyItem): string => {
    const parts: string[] = []
    if (property.address) parts.push(property.address)
    if (property.commune) parts.push(property.commune)
    if (property.city) parts.push(property.city)
    return parts.join(', ')
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-500/10 to-transparent -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 rounded-none">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-brand-100">
            <Search className="size-6 text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Chercher un bien</h1>
            <p className="text-muted-foreground mt-1">Trouvez votre futur logement</p>
          </div>
        </div>
      </div>

      {/* Search Card */}
      <motion.div variants={itemVariants}>
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-brand-50">
                <Search className="size-4 text-brand-500" />
              </div>
              Recherche rapide
            </CardTitle>
            <CardDescription>Entrez une commune ou un quartier pour commencer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Commune, quartier, ville..."
                className="pl-10 h-11"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch()
                }}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select value={propertyType} onValueChange={setPropertyType}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Type de bien" />
                </SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Ville"
                className="h-10"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                placeholder="Budget min"
                className="h-10"
                type="number"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
              />
              <Input
                placeholder="Budget max"
                className="h-10"
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSearch}
                disabled={loading}
                className="flex-1 bg-brand-500 hover:bg-brand-600 text-white h-11"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Recherche...
                  </div>
                ) : (
                  <>
                    <Search className="size-4 mr-2" />
                    Rechercher
                  </>
                )}
              </Button>
              {isAuthenticated && (
                <Button
                  variant="outline"
                  className="h-11 shrink-0"
                  onClick={() => { setSaveSearchName(''); setSaveSearchOpen(true) }}
                  title="Enregistrer cette recherche"
                >
                  <BookmarkPlus className="size-4" />
                  <span className="hidden sm:inline ml-2">Enregistrer</span>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Saved searches */}
      {isAuthenticated && savedSearches.length > 0 && (
        <motion.div variants={itemVariants}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Bookmark className="size-3.5" />
              Recherches enregistrées :
            </span>
            {savedSearches.map((saved) => (
              <Badge
                key={saved.id}
                variant="outline"
                className="pl-3 pr-1.5 py-1 gap-1.5 cursor-pointer hover:bg-brand-50 hover:border-brand-200"
                onClick={() => handleApplySavedSearch(saved)}
              >
                {saved.name}
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteSavedSearch(saved.id) }}
                  className="rounded-full hover:bg-muted p-0.5"
                  aria-label={`Supprimer la recherche ${saved.name}`}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        </motion.div>
      )}

      {/* Save search dialog */}
      <Dialog open={saveSearchOpen} onOpenChange={setSaveSearchOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookmarkPlus className="size-4" />
              Enregistrer cette recherche
            </DialogTitle>
            <DialogDescription>
              Retrouvez rapidement ces critères depuis vos recherches enregistrées.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Ex : Appartements à Cocody"
            value={saveSearchName}
            onChange={(e) => setSaveSearchName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveSearch() }}
            autoFocus
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSaveSearchOpen(false)} disabled={savingSearch}>
              Annuler
            </Button>
            <Button onClick={handleSaveSearch} disabled={!saveSearchName.trim() || savingSearch}>
              {savingSearch ? <Loader2 className="size-4 mr-2 animate-spin" /> : <BookmarkPlus className="size-4 mr-2" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error */}
      {error && (
        <motion.div variants={itemVariants}>
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <p className="text-sm text-amber-700">{error}</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Search Results */}
      <AnimatePresence mode="wait">
        {searched && !loading && results.length === 0 ? (
          <motion.div key="no-results" variants={itemVariants} initial="hidden" animate="show" exit="hidden">
            <Card className="border-dashed border-border bg-muted/50">
              <CardContent className="py-12 flex flex-col items-center text-center">
                <div className="flex size-16 items-center justify-center rounded-full bg-brand-50 mb-4">
                  <Search className="size-7 text-brand-500" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Aucun résultat</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Essayez avec d&apos;autres critères de recherche ou parcourez tous nos biens.
                </p>
                <Button
                  onClick={handleBrowseAll}
                  variant="outline"
                  className="mt-4 gap-1.5 text-brand-600 border-brand-200 hover:bg-brand-50"
                >
                  Voir tous les biens
                  <ChevronRight className="size-4" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : results.length > 0 ? (
          <motion.div key="results" variants={containerVariants} initial="hidden" animate="show">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">
                {results.length} bien{results.length > 1 ? 's' : ''} trouvé{results.length > 1 ? 's' : ''}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedResults.map((property) => {
                const bedroomsLabel = property.bedrooms
                  ? property.bedrooms === 1
                    ? '1 pièce'
                    : `${property.bedrooms} pièces`
                  : 'Studio'

                // Compute active amenities
                const activeAmenities = AMENITY_ICONS.filter((a) => property[a.key])

                return (
                  <motion.div key={property.id} variants={itemVariants}>
                    <Card
                      className="border-border overflow-hidden hover:shadow-md transition-shadow group cursor-pointer"
                      onClick={() => handleViewProperty(property.id)}
                    >
                      {/* Image */}
                      <div className="relative h-40 overflow-hidden">
                        {property.image ? (
                          <img
                            src={property.image}
                            alt={property.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <Building2 className="size-8 text-neutral-300" />
                          </div>
                        )}
                        <PropertyStatusBadge status={property.rentalStatus} className="absolute top-3 left-3 text-xs font-semibold px-2 py-0.5" />
                        {property.isVerified && (
                          <Badge className="absolute top-3 right-12 bg-brand-50 text-brand-600 border-brand-200 text-[10px] px-1.5 py-0 border">
                            Vérifié
                          </Badge>
                        )}
                        {/* Favorite heart button — visible uniquement pour les utilisateurs connectés */}
                        {isAuthenticated && (
                          <button
                            type="button"
                            onClick={(e) => handleToggleFavorite(e, property.id)}
                            className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm hover:bg-white transition-colors shadow-sm"
                            aria-label={isFavorite(property.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                          >
                            <Heart
                              className={`size-4 transition-colors ${
                                isFavorite(property.id)
                                  ? 'fill-red-500 text-red-500'
                                  : 'text-neutral-500 hover:text-red-400'
                              }`}
                            />
                          </button>
                        )}
                      </div>

                      {/* Content */}
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-foreground text-sm line-clamp-1 mb-1 group-hover:text-brand-600 transition-colors">
                          {property.title}
                        </h3>
                        <div className="flex items-center gap-1 text-muted-foreground text-xs mb-2">
                          <MapPin className="size-3 shrink-0" />
                          <span className="line-clamp-1">{formatAddress(property)}</span>
                        </div>
                        <p className="text-muted-foreground text-xs mb-2">
                          {bedroomsLabel} &bull; {property.area} m²
                          {property.isFurnished && ' \u2022 Meublé'}
                        </p>

                        {/* Amenity icons */}
                        {activeAmenities.length > 0 && (
                          <div className="flex items-center gap-1.5 mb-2">
                            {activeAmenities.map(({ key, icon: Icon, label }) => (
                              <div
                                key={key}
                                className="flex items-center gap-0.5 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] text-brand-600"
                                title={label}
                              >
                                <Icon className="size-3" />
                                <span className="hidden sm:inline">{label}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-end justify-between gap-2">
                          <p className="font-bold text-foreground text-sm">
                            {formatCurrency(property.price)}{' '}
                            <span className="text-xs font-normal text-muted-foreground">
                              {property.currency}/mois
                            </span>
                          </p>
                          <Button
                            size="sm"
                            onClick={(e) => openVisitDialog(e, property)}
                            className="bg-brand-500 hover:bg-brand-600 text-white text-xs h-7 px-2.5 shrink-0"
                          >
                            <CalendarDays className="size-3 mr-1" />
                            Visiter
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
            <PaginationControls
              page={page}
              totalPages={Math.ceil(results.length / limit)}
              total={results.length}
              limit={limit}
              onPageChange={setPage}
            />
          </motion.div>
        ) : !searched ? (
          /* Initial empty state */
          <motion.div key="initial" variants={itemVariants}>
            <Card className="border-dashed border-border bg-muted/50">
              <CardContent className="py-12 flex flex-col items-center text-center">
                <div className="flex size-16 items-center justify-center rounded-full bg-brand-50 mb-4">
                  <Search className="size-7 text-brand-500" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  Explorez nos biens disponibles
                </h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                  {user?.firstName}, parcourez notre catalogue de logements et trouvez celui qui vous
                  correspond.
                </p>
                <Button
                  onClick={handleBrowseAll}
                  className="bg-brand-500 hover:bg-brand-600 text-white"
                >
                  <Search className="size-4 mr-2" />
                  Voir les biens
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Visit Request Dialog */}
      <Dialog open={visitDialog.open} onOpenChange={(open) => !open && closeVisitDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="size-5 text-brand-500" />
              Demander une visite
            </DialogTitle>
            <DialogDescription>
              {visitDialog.propertyTitle
                ? `Pour : ${visitDialog.propertyTitle}`
                : 'Planifiez votre visite'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Date */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <CalendarDays className="size-3.5 text-muted-foreground" />
                Date souhaitée <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={visitDialog.requestedDate}
                onChange={(e) =>
                  setVisitDialog((prev) => ({ ...prev, requestedDate: e.target.value }))
                }
                min={new Date().toISOString().split('T')[0]}
                className="h-10"
              />
            </div>

            {/* Time slot */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Clock className="size-3.5 text-muted-foreground" />
                Créneau horaire <span className="text-red-500">*</span>
              </label>
              <Select
                value={visitDialog.timeSlot}
                onValueChange={(value) =>
                  setVisitDialog((prev) => ({ ...prev, timeSlot: value }))
                }
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Sélectionnez un créneau" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map((slot) => (
                    <SelectItem key={slot.value} value={slot.value}>
                      {slot.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Message */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <MessageSquare className="size-3.5 text-muted-foreground" />
                Message (optionnel)
              </label>
              <Textarea
                placeholder="Précisez vos besoins ou posez vos questions..."
                value={visitDialog.tenantMessage}
                onChange={(e) =>
                  setVisitDialog((prev) => ({ ...prev, tenantMessage: e.target.value }))
                }
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={closeVisitDialog} className="h-9">
              Annuler
            </Button>
            <Button
              onClick={submitVisitRequest}
              disabled={visitDialog.submitting || !visitDialog.requestedDate || !visitDialog.timeSlot}
              className="bg-brand-500 hover:bg-brand-600 text-white h-9"
            >
              {visitDialog.submitting ? (
                <div className="flex items-center gap-2">
                  <div className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Envoi...
                </div>
              ) : (
                <>
                  <CalendarDays className="size-3.5 mr-1.5" />
                  Confirmer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
