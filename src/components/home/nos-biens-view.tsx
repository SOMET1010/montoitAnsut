'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import {
  Search,
  MapPin,
  BedDouble,
  Maximize,
  Heart,
  SlidersHorizontal,
  RotateCcw,
  LayoutGrid,
  List,
  Map as MapIcon,
  Eye,
  BadgeCheck,
  X,
  ArrowRight,
  Loader2,
  Navigation,
  LocateFixed,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAuthStore } from '@/lib/auth-store'
import { useFavorites } from '@/lib/use-favorites'
import { apiFetch } from '@/lib/capacitor'
import { PaginationControls } from '@/components/ui/pagination-controls';
import { PropertyMapLeaflet } from '@/components/home/property-map'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AnimatedSheet } from '@/components/ui/sheet'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { CITIES, getCommunesForCity } from '@/lib/cities'
import { toast } from 'sonner'

// ── Types ───────────────────────────────────────────────────────────────────

type PropertyStatus = 'disponible' | 'loue' | 'reserve'

interface Property {
  id: string
  title: string
  description: string
  type: string
  rentalStatus: PropertyStatus
  price: number
  currency: string
  area: number
  bedrooms: number | null
  bathrooms: number | null
  address: string
  city: string
  commune: string | null
  latitude: number | null
  longitude: number | null
  isFurnished: boolean
  isVerified: boolean
  viewsCount: number
  image: string | null
  ownerId: string
  owner: {
    id: string
    firstName: string
    lastName: string
  }
}

// ── Constants ───────────────────────────────────────────────────────────────

const roomOptions = [1, 2, 3, 4, 5]
const sortOptions = [
  { label: 'Plus récent', value: 'recent' },
  { label: 'Prix croissant', value: 'price-asc' },
  { label: 'Prix décroissant', value: 'price-desc' },
  { label: 'Plus populaire', value: 'popular' },
  { label: 'Plus proche', value: 'nearest' },
]

const radiusOptions = [
  { label: '1 km', value: '1' },
  { label: '3 km', value: '3' },
  { label: '5 km', value: '5' },
  { label: '10 km', value: '10' },
  { label: '20 km', value: '20' },
  { label: '50 km', value: '50' },
]

// ── Property types ──────────────────────────────────────────────────────────

const PROPERTY_TYPES = [
  'APPARTEMENT', 'MAISON', 'STUDIO', 'CHAMBRE', 'DUPLEX',
  'PENTHOUSE', 'VILLA', 'CONCESSION', 'IMMEUBLE',
]

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  APPARTEMENT: 'Appartement',
  MAISON: 'Maison',
  STUDIO: 'Studio',
  CHAMBRE: 'Chambre',
  DUPLEX: 'Duplex',
  PENTHOUSE: 'Penthouse',
  VILLA: 'Villa',
  CONCESSION: 'Concession',
  IMMEUBLE: 'Immeuble',
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(price: number): string {
  return price.toLocaleString('fr-FR')
}

function formatPropertyType(type: string): string {
  return PROPERTY_TYPE_LABELS[type] || (type.charAt(0).toUpperCase() + type.slice(1).toLowerCase())
}

function getPropertyLocation(property: Property): string {
  if (property.commune) {
    return `${property.address}, ${property.commune}`
  }
  return property.address
}

function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`
  }
  return `${km.toFixed(1)} km`
}

// ── Skeleton ────────────────────────────────────────────────────────────────

function PropertyCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm animate-pulse">
      <div className="h-52 bg-neutral-200" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-neutral-200 rounded w-3/4" />
        <div className="h-3 bg-neutral-200 rounded w-1/2" />
        <div className="flex gap-3">
          <div className="h-3 bg-neutral-200 rounded w-16" />
          <div className="h-3 bg-neutral-200 rounded w-16" />
        </div>
        <div className="h-px bg-border" />
        <div className="flex justify-between">
          <div className="h-4 bg-neutral-200 rounded w-24" />
          <div className="h-3 bg-neutral-200 rounded w-16" />
        </div>
      </div>
    </div>
  )
}

function PropertyListItemSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm flex animate-pulse">
      <div className="w-36 sm:w-48 h-36 bg-neutral-200 shrink-0" />
      <div className="flex-1 p-4 space-y-3">
        <div className="h-4 bg-neutral-200 rounded w-3/4" />
        <div className="h-3 bg-neutral-200 rounded w-1/2" />
        <div className="h-3 bg-neutral-200 rounded w-1/3" />
        <div className="h-4 bg-neutral-200 rounded w-24" />
      </div>
    </div>
  )
}

// ── Filter Sidebar ──────────────────────────────────────────────────────────

interface FilterSidebarProps {
  typeFilter: string
  setTypeFilter: (v: string) => void
  cityFilter: string
  setCityFilter: (v: string) => void
  communeFilter: string
  setCommuneFilter: (v: string) => void
  priceMin: string
  setPriceMin: (v: string) => void
  priceMax: string
  setPriceMax: (v: string) => void
  surfaceMin: string
  setSurfaceMin: (v: string) => void
  surfaceMax: string
  setSurfaceMax: (v: string) => void
  roomsMin: string
  setRoomsMin: (v: string) => void
  meubleOnly: boolean
  setMeubleOnly: (v: boolean) => void
  resultCount: number
  hasActiveFilters: boolean
  resetFilters: () => void
  userLocation: { lat: number; lng: number } | null
  radiusFilter: string
  setRadiusFilter: (v: string) => void
  showHeader?: boolean
}

function FilterSidebar({
  typeFilter,
  setTypeFilter,
  cityFilter,
  setCityFilter,
  communeFilter,
  setCommuneFilter,
  priceMin,
  setPriceMin,
  priceMax,
  setPriceMax,
  surfaceMin,
  setSurfaceMin,
  surfaceMax,
  setSurfaceMax,
  roomsMin,
  setRoomsMin,
  meubleOnly,
  setMeubleOnly,
  resultCount,
  hasActiveFilters,
  resetFilters,
  userLocation,
  radiusFilter,
  setRadiusFilter,
  showHeader = true,
}: FilterSidebarProps) {
  return (
    <div className="space-y-5">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-brand-500" />
            <span className="text-sm font-semibold text-foreground">Filtres</span>
            <Badge className="bg-brand-500 text-white border-0 text-[11px] px-2 py-0.5 hover:bg-brand-500 leading-tight">
              {resultCount}
            </Badge>
          </div>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-[11px] text-brand-500 hover:text-brand-600 transition-colors flex items-center gap-1"
            >
              <RotateCcw className="size-3" />
              Réinitialiser
            </button>
          )}
        </div>
      )}

      <div className="h-px bg-border" />

      {/* Type de bien */}
      <div className="space-y-2">
        <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Type de bien</Label>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 w-full rounded-md border-border bg-card text-xs">
            <SelectValue placeholder="Tous les types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Tous">Tous les types</SelectItem>
            {PROPERTY_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {formatPropertyType(type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Ville */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Ville</Label>
        <SearchableSelect
          options={CITIES.map((c) => ({ value: c.name, label: c.name }))}
          value={cityFilter}
          onChange={(v) => {
            setCityFilter(v)
            if (v && getCommunesForCity(v).length > 0) {
              if (!getCommunesForCity(v).includes(communeFilter)) {
                setCommuneFilter('')
              }
            } else {
              setCommuneFilter('')
            }
          }}
          placeholder="Toutes les villes"
          className="text-xs"
        />
      </div>
      {/* Commune */}
      {cityFilter && getCommunesForCity(cityFilter).length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Commune</Label>
          <SearchableSelect
            options={getCommunesForCity(cityFilter).map((c) => ({ value: c, label: c }))}
            value={communeFilter}
            onChange={setCommuneFilter}
            placeholder="Toutes les communes"
            className="text-xs"
          />
        </div>
      )}

      {/* Loyer */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Loyer (FCFA/Mois)</Label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              type="number"
              placeholder="Min"
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value)}
              className="h-9 bg-card border-border text-xs rounded-md pr-8"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">Min</span>
          </div>
          <span className="text-muted-foreground text-xs">—</span>
          <div className="relative flex-1">
            <Input
              type="number"
              placeholder="Max"
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
              className="h-9 bg-card border-border text-xs rounded-md pr-8"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">Max</span>
          </div>
        </div>
      </div>

      {/* Surface (m²) */}
      <div className="space-y-2">
        <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Surface (m²)</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              type="number"
              placeholder="Min"
              value={surfaceMin}
              onChange={(e) => setSurfaceMin(e.target.value)}
              className="h-9 text-xs pl-2.5 pr-7 rounded-md border-border bg-card [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">Min</span>
          </div>
          <div className="relative flex-1">
            <Input
              type="number"
              placeholder="Max"
              value={surfaceMax}
              onChange={(e) => setSurfaceMax(e.target.value)}
              className="h-9 text-xs pl-2.5 pr-7 rounded-md border-border bg-card [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">Max</span>
          </div>
        </div>
      </div>

      {/* Nombre de pièces min. */}
      <div className="space-y-2">
        <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Nombre de pièces min.</Label>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setRoomsMin('0')}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              roomsMin === '0'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-accent border border-border'
            }`}
          >
            Tous
          </button>
          {roomOptions.map((n) => (
            <button
              key={n}
              onClick={() => setRoomsMin(String(n))}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                roomsMin === String(n)
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-accent border border-border'
              }`}
            >
              {n}{n === 5 ? '+' : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Meublé uniquement */}
      <div className="flex items-center justify-between py-1">
        <Label className="text-xs font-medium text-muted-foreground cursor-pointer">Meublé uniquement</Label>
        <Switch
          checked={meubleOnly}
          onCheckedChange={setMeubleOnly}
          className="data-[state=checked]:bg-brand-500"
        />
      </div>

      {/* Rayon (only shown when user location is available) */}
      {userLocation && (
        <div className="space-y-2">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Navigation className="size-3 text-brand-500" />
            Rayon de recherche
          </Label>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setRadiusFilter('0')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                radiusFilter === '0'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-accent border border-border'
              }`
              }
            >
              Tous
            </button>
            {radiusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRadiusFilter(opt.value)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  radiusFilter === opt.value
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-accent border border-border'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="h-px bg-border" />

      {/* Reset button */}
      {hasActiveFilters ? (
        <Button
          variant="outline"
          onClick={resetFilters}
          className="w-full text-brand-500 border-brand-200 hover:bg-brand-50 hover:text-brand-600 text-xs h-9"
        >
          <RotateCcw className="size-3 mr-1.5" />
          Réinitialiser les filtres
        </Button>
      ) : (
        <p className="text-[11px] text-muted-foreground text-center">
          Ajustez les filtres pour affiner votre recherche
        </p>
      )}
    </div>
  )
}

// ── Property Card ───────────────────────────────────────────────────────────

function PropertyCard({ property, onClick, isFavorite, toggleFavorite, distance }: { property: Property; onClick: () => void; isFavorite: (id: string) => boolean; toggleFavorite: (id: string) => Promise<boolean>; distance?: number | null }) {
  const { isAuthenticated, setView } = useAuthStore()

  const statusConfig: Record<PropertyStatus, { label: string; className: string }> = {
    disponible: { label: 'Disponible', className: 'bg-emerald-500 text-white' },
    loue: { label: 'Loué', className: 'bg-red-500 text-white' },
    reserve: { label: 'Réservé', className: 'bg-amber-500 text-white' },
  }

  const location = getPropertyLocation(property)

  return (
    <motion.div
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group bg-card rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer"
      onClick={onClick}
    >
      {/* Image */}
      <div className="relative h-52 overflow-hidden">
        {property.image ? (
          <Image
            src={property.image}
            alt={property.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            unoptimized
          />
        ) : (
          <div className="w-full h-full bg-neutral-200 flex items-center justify-center">
            <MapPin className="size-8 text-muted-foreground" />
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />

        {/* Badges row */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
          <Badge className={`border-0 text-[11px] font-semibold px-2 py-0.5 ${statusConfig[property.rentalStatus].className}`}>
            {statusConfig[property.rentalStatus].label}
          </Badge>
          {property.isFurnished && (
            <Badge className="border-0 text-[11px] font-medium px-2 py-0.5 bg-sky-500 text-white">
              Meublé
            </Badge>
          )}
        </div>

        {/* Verified badge */}
        {property.isVerified && (
          <div className="absolute top-3 right-12 flex items-center gap-1 bg-card/95 backdrop-blur-sm rounded-full px-2 py-0.5">
            <BadgeCheck className="size-3 text-brand-500" />
            <span className="text-[11px] font-medium text-muted-foreground">Vérifié</span>
          </div>
        )}

        {/* Favorite button — visible uniquement pour les utilisateurs connectés */}
        {isAuthenticated && (
          <button
            onClick={async (e) => {
              e.preventDefault()
              e.stopPropagation()
              toggleFavorite(property.id)
            }}
            className="absolute top-3 right-3 size-8 rounded-full bg-card/90 backdrop-blur-sm flex items-center justify-center hover:bg-card shadow-sm transition-all"
            aria-label={isFavorite(property.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            <Heart
              className={`size-4 transition-colors ${
                isFavorite(property.id) ? 'fill-red-500 text-red-500' : 'text-muted-foreground'
              }`}
            />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-foreground text-sm mb-1 line-clamp-1">
          {property.title}
        </h3>
        <div className="flex items-center gap-1 text-muted-foreground text-xs mb-3">
          <MapPin className="size-3 shrink-0" />
          <span className="line-clamp-1">{location}</span>
          {distance != null && (
            <span className="ml-auto shrink-0 text-brand-500 font-semibold flex items-center gap-0.5">
              <Navigation className="size-3" />
              {formatDistance(distance)}
            </span>
          )}
        </div>

        {/* Features */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
          {property.bedrooms !== null && (
            <div className="flex items-center gap-1">
              <BedDouble className="size-3.5 text-muted-foreground" />
              <span>{property.bedrooms} pièce{property.bedrooms > 1 ? 's' : ''}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Maximize className="size-3.5 text-muted-foreground" />
            <span>{property.area} m²</span>
          </div>
        </div>

        {/* Price & Views */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <p className="text-base font-bold text-brand-500">
            {formatPrice(property.price)} <span className="text-xs font-normal text-muted-foreground">F CFA/mois</span>
          </p>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Eye className="size-3.5" />
            <span className="text-xs">{property.viewsCount} vues</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ── Property List Item ──────────────────────────────────────────────────────

function PropertyListItem({ property, onClick, isFavorite, toggleFavorite, distance }: { property: Property; onClick: () => void; isFavorite: (id: string) => boolean; toggleFavorite: (id: string) => Promise<boolean>; distance?: number | null }) {
  const { isAuthenticated, setView } = useAuthStore()

  const statusConfig: Record<PropertyStatus, { label: string; className: string }> = {
    disponible: { label: 'Disponible', className: 'bg-emerald-500 text-white' },
    loue: { label: 'Loué', className: 'bg-red-500 text-white' },
    reserve: { label: 'Réservé', className: 'bg-amber-500 text-white' },
  }

  const location = getPropertyLocation(property)

  return (
    <motion.div
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className="group bg-card rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-all flex cursor-pointer"
      onClick={onClick}
    >
      {/* Image */}
      <div className="relative w-36 sm:w-48 shrink-0 overflow-hidden">
        {property.image ? (
          <Image
            src={property.image}
            alt={property.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="224px"
            unoptimized
          />
        ) : (
          <div className="w-full h-full bg-neutral-200 flex items-center justify-center">
            <MapPin className="size-6 text-muted-foreground" />
          </div>
        )}
        <Badge className={`absolute top-2 left-2 border-0 text-xs font-semibold px-2 py-0.5 ${statusConfig[property.rentalStatus].className}`}>
          {statusConfig[property.rentalStatus].label}
        </Badge>
      </div>

      {/* Content */}
      <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between min-w-0">
        <div>
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-foreground text-sm line-clamp-1">{property.title}</h3>
            {isAuthenticated && (
              <button
                onClick={async (e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(property.id) }}
                className="shrink-0 size-7 sm:size-8 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors"
                aria-label={isFavorite(property.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              >
                <Heart className={`size-3.5 sm:size-4 ${isFavorite(property.id) ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 text-muted-foreground text-xs mb-2">
            <MapPin className="size-3 shrink-0" />
            <span className="line-clamp-1">{location}</span>
            {distance != null && (
              <span className="ml-auto shrink-0 text-brand-500 font-semibold flex items-center gap-0.5">
                <Navigation className="size-3" />
                {formatDistance(distance)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground mb-2 flex-wrap">
            {property.bedrooms !== null && (
              <div className="flex items-center gap-1">
                <BedDouble className="size-3.5 text-muted-foreground" />
                <span>{property.bedrooms}p</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Maximize className="size-3.5 text-muted-foreground" />
              <span>{property.area}m²</span>
            </div>
            {property.isFurnished && (
              <Badge variant="outline" className="text-xs text-sky-600 border-sky-200 bg-sky-50 px-1.5 py-0">
                Meublé
              </Badge>
            )}
            {property.isVerified && (
              <div className="hidden sm:flex items-center gap-0.5 text-brand-500">
                <BadgeCheck className="size-3.5" />
                <span className="text-xs font-medium">Vérifié</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm sm:text-base font-bold text-brand-500 whitespace-nowrap">
            {formatPrice(property.price)} <span className="text-xs font-normal text-muted-foreground">F CFA/mois</span>
          </p>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-1 text-muted-foreground">
              <Eye className="size-3.5" />
              <span className="text-xs">{property.viewsCount} vues</span>
            </div>
            <Button variant="outline" size="sm" className="text-brand-500 border-brand-200 hover:bg-brand-50 hover:text-brand-600 text-xs h-7 sm:h-8">
              Voir <ArrowRight className="size-3 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ── Map List Item (compact card for map sidebar) ────────────────────────────

function MapListItem({ property, onClick, isFavorite, toggleFavorite, distance }: { property: Property; onClick: () => void; isFavorite: (id: string) => boolean; toggleFavorite: (id: string) => Promise<boolean>; distance?: number | null }) {
  const { isAuthenticated, setView } = useAuthStore()

  const statusConfig: Record<PropertyStatus, { label: string; className: string }> = {
    disponible: { label: 'Disponible', className: 'bg-emerald-500 text-white' },
    loue: { label: 'Loué', className: 'bg-red-500 text-white' },
    reserve: { label: 'Réservé', className: 'bg-amber-500 text-white' },
  }

  const location = getPropertyLocation(property)

  return (
    <div
      className="group bg-card rounded-lg border border-border overflow-hidden shadow-sm hover:shadow-md hover:border-brand-200 transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex gap-3 p-2.5">
        {/* Image */}
        <div className="relative w-20 h-20 shrink-0 rounded-md overflow-hidden">
          {property.image ? (
            <Image
              src={property.image}
              alt={property.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="80px"
              unoptimized
            />
          ) : (
            <div className="w-full h-full bg-neutral-200 flex items-center justify-center rounded-md">
              <MapPin className="size-4 text-muted-foreground" />
            </div>
          )}
          <Badge className={`absolute top-1 left-1 border-0 text-[8px] font-semibold px-1 py-0 ${statusConfig[property.rentalStatus].className}`}>
            {statusConfig[property.rentalStatus].label}
          </Badge>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-foreground text-xs line-clamp-1 mb-0.5">{property.title}</h3>
            <div className="flex items-center gap-1 text-muted-foreground text-[10px] mb-1">
              <MapPin className="size-2.5 shrink-0" />
              <span className="line-clamp-1">{location}</span>
              {distance != null && (
                <span className="ml-auto shrink-0 text-brand-500 font-semibold flex items-center gap-0.5">
                  <Navigation className="size-2.5" />
                  {formatDistance(distance)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              {property.bedrooms !== null && (
                <div className="flex items-center gap-0.5">
                  <BedDouble className="size-2.5 text-muted-foreground" />
                  <span>{property.bedrooms}p</span>
                </div>
              )}
              <div className="flex items-center gap-0.5">
                <Maximize className="size-2.5 text-muted-foreground" />
                <span>{property.area}m²</span>
              </div>
              {property.isFurnished && (
                <span className="text-sky-500 font-medium">Meublé</span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-brand-500">
              {formatPrice(property.price)} <span className="text-[9px] font-normal text-muted-foreground">F CFA</span>
            </p>
            {isAuthenticated && (
              <button
                onClick={async (e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(property.id) }}
                className="size-5 rounded-full flex items-center justify-center hover:bg-accent transition-colors"
                aria-label={isFavorite(property.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              >
                <Heart className={`size-3 ${isFavorite(property.id) ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export function NosBiensView() {
  const { setView, setSelectedPropertyId, searchParams, setSearchParams } = useAuthStore()
  const resultsTopRef = useRef<HTMLDivElement | null>(null)

  // Data state
  const [properties, setProperties] = useState<Property[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Favorites — useMemo to stabilize the array reference
  const propertyIds = useMemo(() => properties.map(p => p.id), [properties])
  const { isFavorite, toggleFavorite } = useFavorites(propertyIds)

  // Filter state — initialize from search params passed from Hero
  const [searchQuery, setSearchQuery] = useState(searchParams.query || '')
  const [typeFilter, setTypeFilter] = useState<string>(searchParams.propertyType || 'Tous')
  const [cityFilter, setCityFilter] = useState<string>(searchParams.city || '')
  const [communeFilter, setCommuneFilter] = useState<string>(searchParams.commune || '')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [surfaceMin, setSurfaceMin] = useState('')
  const [surfaceMax, setSurfaceMax] = useState('')
  const [roomsMin, setRoomsMin] = useState('0')
  const [meubleOnly, setMeubleOnly] = useState(false)

  // Geolocation state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [radiusFilter, setRadiusFilter] = useState('0')

  // View state
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'map'>('grid')
  const [sortBy, setSortBy] = useState('recent')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [page, setPage] = useState(1)

  const ITEMS_PER_PAGE = viewMode === 'grid' ? 12 : 15

  // Request user geolocation
  const requestGeolocation = () => {
    if (!navigator.geolocation) {
      toast.error('Géolocalisation non disponible', {
        description: 'Votre navigateur ne supporte pas la géolocalisation.',
      })
      return
    }
    if (userLocation) {
      // Toggle off
      setUserLocation(null)
      setRadiusFilter('0')
      if (sortBy === 'nearest') setSortBy('recent')
      return
    }
    setIsGettingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setIsGettingLocation(false)
        toast.success('Position détectée', {
          description: 'Les biens sont désormais triés par distance.',
        })
      },
      (err) => {
        setIsGettingLocation(false)
        const messages: Record<number, string> = {
          1: 'Vous avez refusé l\'accès à votre position. Activez-la dans les paramètres du navigateur.',
          2: 'Impossible de déterminer votre position. Vérifiez votre connexion GPS.',
          3: 'La demande de géolocalisation a expiré. Réessayez.',
        }
        toast.error('Géolocalisation impossible', {
          description: messages[err.code] || 'Une erreur inconnue est survenue.',
        })
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }

  // Clear search params after reading them (so they don't persist on revisit)
  useEffect(() => {
    setSearchParams({ query: '', city: '', commune: '', propertyType: '' })
  }, [setSearchParams])

  // Fetch properties and filter options from API
  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true)
        const propertiesRes = await apiFetch('/api/properties?all=true')
        if (!propertiesRes.ok) throw new Error('Erreur lors du chargement')
        const propertiesData = await propertiesRes.json()
        setProperties(propertiesData.properties || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  const openDetail = (propertyId: string) => {
    setSelectedPropertyId(propertyId)
    setView('property-detail')
  }

  // Compute distances for each property relative to user location
  const propertyDistances = useMemo(() => {
    if (!userLocation) return new Map<string, number>()
    const dists = new Map<string, number>()
    properties.forEach((p) => {
      if (p.latitude !== null && p.longitude !== null) {
        dists.set(p.id, getDistanceKm(userLocation.lat, userLocation.lng, p.latitude, p.longitude))
      }
    })
    return dists
  }, [properties, userLocation])

  // Filter logic
  const filteredProperties = useMemo(() => {
    const minRooms = Number(roomsMin)

    let result = properties.filter((p) => {
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const location = getPropertyLocation(p)
        const match =
          p.title.toLowerCase().includes(q) ||
          location.toLowerCase().includes(q) ||
          (p.commune ?? '').toLowerCase().includes(q) ||
          p.type.toLowerCase().includes(q) ||
          p.address.toLowerCase().includes(q)
        if (!match) return false
      }
      // Type
      if (typeFilter !== 'Tous' && p.type !== typeFilter) return false
      // City
      if (cityFilter && p.city !== cityFilter) return false
      // Commune
      if (communeFilter && p.commune !== communeFilter) return false
      // Price range
      if (priceMin && p.price < Number(priceMin)) return false
      if (priceMax && p.price > Number(priceMax)) return false
      // Surface
      if (surfaceMin && p.area < Number(surfaceMin)) return false
      if (surfaceMax && p.area > Number(surfaceMax)) return false
      // Rooms
      if (roomsMin !== '0' && (p.bedrooms === null || p.bedrooms < minRooms)) return false
      // Meuble
      if (meubleOnly && !p.isFurnished) return false
      // Radius filter
      if (userLocation && radiusFilter !== '0') {
        const dist = propertyDistances.get(p.id)
        if (dist === undefined || dist > Number(radiusFilter)) return false
      }
      return true
    })

    // Sort
    switch (sortBy) {
      case 'price-asc':
        result = [...result].sort((a, b) => a.price - b.price)
        break
      case 'price-desc':
        result = [...result].sort((a, b) => b.price - a.price)
        break
      case 'popular':
        result = [...result].sort((a, b) => b.viewsCount - a.viewsCount)
        break
      case 'nearest':
        if (userLocation) {
          result = [...result].sort((a, b) => {
            const distA = propertyDistances.get(a.id) ?? Infinity
            const distB = propertyDistances.get(b.id) ?? Infinity
            return distA - distB
          })
        }
        break
      default:
        // recent — default order
        break
    }

    return result
  }, [properties, searchQuery, typeFilter, cityFilter, communeFilter, priceMin, priceMax, surfaceMin, surfaceMax, roomsMin, meubleOnly, sortBy, userLocation, radiusFilter, propertyDistances])

  // Map-compatible properties (only those with coordinates)
  const mappableProperties = useMemo(() => (
    filteredProperties.filter((p) => p.latitude !== null && p.longitude !== null)
  ), [filteredProperties])

  const hasActiveFilters =
    typeFilter !== 'Tous' ||
    cityFilter !== '' ||
    communeFilter !== '' ||
    priceMin !== '' ||
    priceMax !== '' ||
    surfaceMin !== '' ||
    surfaceMax !== '' ||
    roomsMin !== '0' ||
    meubleOnly ||
    radiusFilter !== '0'

  // Paginate after filtering
  const totalPages = Math.ceil(filteredProperties.length / ITEMS_PER_PAGE)
  const paginatedProperties = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE
    return filteredProperties.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredProperties, page, ITEMS_PER_PAGE])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [searchQuery, typeFilter, cityFilter, communeFilter, priceMin, priceMax, surfaceMin, surfaceMax, roomsMin, meubleOnly, sortBy, radiusFilter])

  const resetFilters = () => {
    setTypeFilter('Tous')
    setCityFilter('')
    setCommuneFilter('')
    setPriceMin('')
    setPriceMax('')
    setSurfaceMin('')
    setSurfaceMax('')
    setRoomsMin('0')
    setMeubleOnly(false)
    setSearchQuery('')
    setRadiusFilter('0')
  }

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage)

    const resultsTop = resultsTopRef.current
    if (!resultsTop) return

    const headerOffset = 96
    const targetTop = resultsTop.getBoundingClientRect().top + window.scrollY - headerOffset

    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: 'smooth',
    })
  }

  const filterSidebarProps = {
    typeFilter,
    setTypeFilter,
    cityFilter,
    setCityFilter,
    communeFilter,
    setCommuneFilter,
    priceMin,
    setPriceMin,
    priceMax,
    setPriceMax,
    surfaceMin,
    setSurfaceMin,
    surfaceMax,
    setSurfaceMax,
    roomsMin,
    setRoomsMin,
    meubleOnly,
    setMeubleOnly,
    resultCount: filteredProperties.length,
    hasActiveFilters,
    resetFilters,
    userLocation,
    radiusFilter,
    setRadiusFilter,
  }

  // Loading state
  if (isLoading) {
    return (
      <section className="bg-muted min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Search bar skeleton */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-11 bg-neutral-200 rounded-xl animate-pulse" />
              <div className="hidden sm:block h-11 w-[150px] bg-neutral-200 rounded-xl animate-pulse" />
              <div className="hidden sm:flex items-center bg-neutral-200 rounded-xl h-11 w-[120px] animate-pulse" />
            </div>
          </div>
          {/* Results count skeleton */}
          <div className="h-4 bg-neutral-200 rounded w-32 mb-5 animate-pulse" />
          {/* Content skeleton */}
          <div className="flex gap-6">
            <div className="hidden lg:block w-72 shrink-0">
              <div className="bg-card rounded-xl border border-border p-5 h-96 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <PropertyCardSkeleton key={i} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  // Error state
  if (error) {
    return (
      <section className="bg-muted min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="text-center py-20">
            <div className="size-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
              <Search className="size-8 text-red-300" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Erreur de chargement
            </h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
              {error}
            </p>
            <Button
              onClick={() => window.location.reload()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <RotateCcw className="size-4 mr-2" />
              Réessayer
            </Button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-muted min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div ref={resultsTopRef} />
        {/* ── Search Bar + Controls ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-3 mb-6"
        >
          {/* Search row */}
          <div className="flex items-center gap-3">
            {/* Search input */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Rechercher un bien, quartier, ville..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-11 pr-10 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 size-5 rounded-full bg-neutral-200 flex items-center justify-center hover:bg-neutral-300 transition-colors"
                >
                  <X className="size-3 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Autour de moi button */}
            <Button
              variant={userLocation ? 'default' : 'outline'}
              size="sm"
              className={`h-11 rounded-xl text-xs shadow-sm gap-1.5 shrink-0 ${
                userLocation
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground border-brand-500'
                  : 'text-muted-foreground border-border hover:bg-accent'
              }`}
              onClick={requestGeolocation}
              disabled={isGettingLocation}
            >
              {isGettingLocation ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LocateFixed className="size-4" />
              )}
              <span className="hidden sm:inline">{userLocation ? 'Autour de moi' : 'Autour de moi'}</span>
            </Button>

            {/* Sort - desktop/tablet */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="hidden sm:flex data-[size=default]:h-11 w-[150px] bg-card border-border text-xs rounded-xl shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* View toggle - desktop/tablet */}
            <div className="hidden sm:flex items-center bg-card border border-border rounded-xl overflow-hidden shadow-sm h-11">
              <button
                onClick={() => setViewMode('grid')}
                className={`h-full px-3 transition-colors ${viewMode === 'grid' ? 'bg-brand-500 text-white' : 'text-muted-foreground hover:bg-accent'}`}
                aria-label="Vue grille"
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`h-full px-3 transition-colors ${viewMode === 'list' ? 'bg-brand-500 text-white' : 'text-muted-foreground hover:bg-accent'}`}
                aria-label="Vue liste"
              >
                <List className="size-4" />
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`h-full px-3 transition-colors flex items-center gap-1.5 ${viewMode === 'map' ? 'bg-brand-500 text-white' : 'text-muted-foreground hover:bg-accent'}`}
                aria-label="Vue carte"
              >
                <MapIcon className="size-4" />
              </button>
            </div>

            {/* Mobile filter button */}
            <Button
              variant="outline"
              size="sm"
              className="lg:hidden text-muted-foreground border-border hover:bg-accent h-11 rounded-xl text-xs shadow-sm"
              onClick={() => setMobileFiltersOpen(true)}
            >
              <SlidersHorizontal className="size-3.5 mr-1.5" />
              Filtres
              {hasActiveFilters && (
                <span className="ml-1.5 size-4 rounded-full bg-brand-500 text-white text-[10px] flex items-center justify-center">!</span>
              )}
            </Button>

            <AnimatedSheet
              open={mobileFiltersOpen}
              onOpenChange={setMobileFiltersOpen}
              side="left"
              className="w-[85vw] max-w-80"
            >
              <div className="p-4 border-b border-border">
                <h2 className="font-semibold flex items-center gap-2">
                  <SlidersHorizontal className="size-4 text-brand-500" />
                  Filtres
                </h2>
              </div>
              <div className="px-4 py-4 overflow-y-auto max-h-[calc(100vh-120px)]">
                <FilterSidebar {...filterSidebarProps} showHeader={false} />
              </div>
              <div className="px-4 pb-4 mt-auto">
                <Button
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={() => setMobileFiltersOpen(false)}
                >
                  Voir {filteredProperties.length} résultat{filteredProperties.length !== 1 ? 's' : ''}
                </Button>
              </div>
            </AnimatedSheet>
          </div>

          {/* Mobile-only: Sort + View toggle row */}
          <div className="flex sm:hidden items-center gap-3">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-9 flex-1 bg-card border-border text-xs rounded-xl shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center bg-card border border-border rounded-xl overflow-hidden shadow-sm h-9">
              <button
                onClick={() => setViewMode('grid')}
                className={`h-full px-2.5 transition-colors ${viewMode === 'grid' ? 'bg-brand-500 text-white' : 'text-muted-foreground hover:bg-accent'}`}
                aria-label="Vue grille"
              >
                <LayoutGrid className="size-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`h-full px-2.5 transition-colors ${viewMode === 'list' ? 'bg-brand-500 text-white' : 'text-muted-foreground hover:bg-accent'}`}
                aria-label="Vue liste"
              >
                <List className="size-3.5" />
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`h-full px-2.5 transition-colors ${false ? 'bg-brand-500 text-white' : 'text-muted-foreground hover:bg-accent'}`}
                aria-label="Vue carte"
              >
                <MapIcon className="size-3.5" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── Results count ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="flex items-center gap-3 mb-5"
        >
          <h1 className="text-sm font-semibold text-foreground">
            {filteredProperties.length} bien{filteredProperties.length !== 1 ? 's' : ''} trouvé{filteredProperties.length !== 1 ? 's' : ''}
          </h1>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-xs text-brand-500 hover:text-brand-600 transition-colors flex items-center gap-1"
            >
              <RotateCcw className="size-3" />
              Voir tout
            </button>
          )}
        </motion.div>

        {/* ── Main Layout ────────────────────────────────────────────── */}
        {viewMode === 'map' ? (
          /* ── Map View (full width split: list + map) ──────────────── */
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-5">
            {/* Desktop: Left property list (scrollable) */}
            <div className="hidden lg:block w-80 shrink-0">
              <div className="space-y-3 max-h-[calc(100vh-10rem)] overflow-y-auto pr-1 sticky top-24">
                {filteredProperties.length > 0 ? (
                  filteredProperties.map((property) => (
                    <MapListItem
                      key={property.id}
                      property={property}
                      onClick={() => openDetail(property.id)}
                      isFavorite={isFavorite}
                      toggleFavorite={toggleFavorite}
                      distance={userLocation ? propertyDistances.get(property.id) ?? null : null}
                    />
                  ))
                ) : (
                  <div className="text-center py-12">
                    <p className="text-sm text-muted-foreground">Aucun bien trouvé</p>
                  </div>
                )}
              </div>
            </div>

            {/* Map area */}
            <div className="flex-1 min-w-0">
              <div className="h-[42vh] sm:h-[52vh] lg:h-[calc(100vh-10rem)] lg:sticky lg:top-24">
                {mappableProperties.length > 0 ? (
                  <PropertyMapLeaflet
                    properties={mappableProperties}
                    onPropertyClick={(p) => openDetail(p.id)}
                    userLocation={userLocation}
                    searchRadius={radiusFilter !== '0' ? Number(radiusFilter) : null}
                  />
                ) : (
                  <div className="w-full h-full bg-muted rounded-xl flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">Aucun bien à afficher sur la carte</p>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile-only: horizontal scroll of property cards below map */}
            <div className="lg:hidden">
              {filteredProperties.length > 0 ? (
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
                  {filteredProperties.map((property) => (
                    <div key={property.id} className="shrink-0 w-60 snap-start">
                      <MapListItem
                        property={property}
                        onClick={() => openDetail(property.id)}
                        isFavorite={isFavorite}
                        toggleFavorite={toggleFavorite}
                        distance={userLocation ? propertyDistances.get(property.id) ?? null : null}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">Aucun bien trouvé</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── Grid / List View ──────────────────────────────────────── */
          <div className="flex gap-6">
            {/* Desktop Sidebar */}
            <motion.aside
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="hidden lg:block w-72 shrink-0"
            >
              <div className="bg-card rounded-xl border border-border p-5 sticky top-24">
                <FilterSidebar {...filterSidebarProps} />
              </div>
            </motion.aside>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {paginatedProperties.length > 0 ? (
                viewMode === 'grid' ? (
                  /* Grid view */
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5"
                  >
                    {paginatedProperties.map((property, i) => (
                      <motion.div
                        key={property.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: i * 0.05 }}
                      >
                        <PropertyCard
                          property={property}
                          onClick={() => openDetail(property.id)}
                          isFavorite={isFavorite}
                          toggleFavorite={toggleFavorite}
                          distance={userLocation ? propertyDistances.get(property.id) ?? null : null}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  /* List view */
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    {paginatedProperties.map((property, i) => (
                      <motion.div
                        key={property.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.04 }}
                      >
                        <PropertyListItem
                          property={property}
                          onClick={() => openDetail(property.id)}
                          isFavorite={isFavorite}
                          toggleFavorite={toggleFavorite}
                          distance={userLocation ? propertyDistances.get(property.id) ?? null : null}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                )
              ) : (
                /* Empty state */
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-20"
                >
                  <div className="size-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-5">
                    <Search className="size-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Aucun bien ne correspond à vos critères
                  </h3>
                  <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
                    Essayez de modifier vos filtres ou votre recherche pour découvrir plus de biens disponibles.
                  </p>
                  <Button
                    variant="outline"
                    onClick={resetFilters}
                    className="text-brand-500 border-brand-200 hover:bg-brand-50 hover:text-brand-600"
                  >
                    <RotateCcw className="size-4 mr-2" />
                    Réinitialiser les filtres
                  </Button>
                </motion.div>
              )}
              {/* Pagination */}
              {filteredProperties.length > ITEMS_PER_PAGE && (
                <PaginationControls
                  page={page}
                  totalPages={totalPages}
                  total={filteredProperties.length}
                  limit={ITEMS_PER_PAGE}
                  onPageChange={handlePageChange}
                  className="pt-6"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
