'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { MapPin, Heart, Eye, ShieldCheck, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { PropertyStatusBadge } from '@/components/ui/status-badge'
import { useAuthStore } from '@/lib/auth-store'
import { useFavorites } from '@/lib/use-favorites'
import { apiFetch } from '@/lib/capacitor'

interface Property {
  id: string
  title: string
  description: string
  type: string
  rentalStatus: string
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

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
} as const

function formatPrice(price: number): string {
  return price.toLocaleString('fr-FR')
}

function PropertyCard({ property, isFavorite, onToggleFavorite }: { property: Property; isFavorite: boolean; onToggleFavorite: (id: string) => Promise<boolean> }) {
  const { setView, setSelectedPropertyId, isAuthenticated } = useAuthStore()

  const handleClick = () => {
    setSelectedPropertyId(property.id)
    setView('property-detail')
  }

  const bedroomsLabel = property.bedrooms
    ? property.bedrooms === 1
      ? '1 pièce'
      : `${property.bedrooms} pièces`
    : 'Studio'

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group bg-card rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={handleClick}
    >
      {/* Image */}
      <div className="relative h-48 sm:h-52 overflow-hidden">
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
            <span className="text-muted-foreground text-sm">Aucune image</span>
          </div>
        )}
        {/* Status + Meublé badges on image top-left */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <PropertyStatusBadge status={property.rentalStatus} className="text-xs font-semibold px-2.5 py-1" />
          {property.isFurnished && (
            <Badge className="bg-brand-500 text-white border-0 text-xs font-semibold px-2.5 py-1">
              Meublé
            </Badge>
          )}
        </div>
        {/* Favorite button — visible uniquement pour les utilisateurs connectés */}
        {isAuthenticated && (
          <button
            onClick={async (e) => {
              e.preventDefault()
              e.stopPropagation()
              onToggleFavorite(property.id)
            }}
            className="absolute top-3 right-3 size-8 rounded-full bg-card/90 backdrop-blur-sm flex items-center justify-center transition-opacity hover:bg-card shadow-sm"
            aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            <Heart
              className={`size-4 transition-colors ${
                isFavorite ? 'fill-red-500 text-red-500' : 'text-muted-foreground'
              }`}
            />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <h3 className="font-semibold text-foreground text-sm sm:text-base mb-1 line-clamp-1">
          {property.title}
        </h3>
        {/* Location */}
        <div className="flex items-center gap-1 text-muted-foreground text-xs sm:text-sm mb-2">
          <MapPin className="size-3.5 shrink-0" />
          <span className="line-clamp-1">{property.address}{property.commune ? `, ${property.commune}` : ''}</span>
        </div>

        {/* Features */}
        <p className="text-muted-foreground text-xs sm:text-sm mb-3">
          {bedroomsLabel} &bull; {property.area} m²
        </p>

        {/* Price */}
        <p className="font-bold text-foreground text-base sm:text-lg mb-2">
          {formatPrice(property.price)} <span className="text-xs sm:text-sm font-normal text-muted-foreground">{property.currency}/mois</span>
        </p>

        {/* Bottom row: views + verified */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-muted-foreground text-xs">
            <Eye className="size-3.5" />
            <span>{property.viewsCount} vues</span>
          </div>
          {property.isVerified && (
            <Badge className="bg-brand-50 text-brand-600 border-brand-200 text-xs font-medium px-2 py-0.5 border">
              <ShieldCheck className="size-3 mr-1" />
              Vérifié
            </Badge>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export function NosBiens() {
  const { setView } = useAuthStore()
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)

  // Single shared favorites hook for all property cards
  const propertyIds = useMemo(() => properties.map(p => p.id), [properties])
  const { isFavorite: checkIsFavorite, toggleFavorite } = useFavorites(propertyIds)

  useEffect(() => {
    apiFetch('/api/properties?limit=6')
      .then((res) => res.json())
      .then((data) => {
        setProperties(data.properties ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <section className="py-16 sm:py-20 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header - left-aligned title with "Voir tout" link on right */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex items-start sm:items-center justify-between mb-8 sm:mb-10 gap-4"
        >
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
              Annonces récents
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              Découvrez les dernières annonces disponibles
            </p>
          </div>
          <button
            onClick={() => setView('nos-biens')}
            className="flex items-center gap-1 text-brand-500 hover:text-brand-600 font-medium text-sm whitespace-nowrap transition-colors shrink-0"
          >
            Voir tout
            <ArrowRight className="size-4" />
          </button>
        </motion.div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card rounded-xl border border-border overflow-hidden animate-pulse">
                <div className="h-48 sm:h-52 bg-neutral-200" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-neutral-200 rounded w-3/4" />
                  <div className="h-3 bg-neutral-200 rounded w-1/2" />
                  <div className="h-3 bg-neutral-200 rounded w-1/3" />
                  <div className="h-5 bg-neutral-200 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : properties.length > 0 ? (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {properties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                isFavorite={checkIsFavorite(property.id)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </motion.div>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Aucun bien disponible pour le moment.</p>
          </div>
        )}
      </div>
    </section>
  )
}

// Keep backward-compatible export name
export { NosBiens as Properties }
