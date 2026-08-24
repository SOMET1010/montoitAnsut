'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Heart, MapPin, Building2, Eye, ArrowRight } from 'lucide-react'
import { useRealtimeProperties } from '@/hooks/use-realtime-properties'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { motion } from 'framer-motion'

interface FavoriteProperty {
  id: string
  createdAt: string
  property: {
    id: string
    title: string
    type: string
    price: number
    currency: string
    area: number
    bedrooms: number | null
    city: string
    commune: string | null
    address: string
    rentalStatus: string
    isFurnished: boolean
    isVerified: boolean
    viewsCount: number
    images: Array<{ url: string }>
    owner: { id: string; firstName: string; lastName: string }
  }
}

interface FavoritesResponse {
  favorites?: FavoriteProperty[]
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

export function Favorites() {
  const { user, isAuthenticated, setView, setSelectedPropertyId } = useAuthStore()
  const [favorites, setFavorites] = useState<FavoriteProperty[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const limit = 12
  const [error, setError] = useState<string | null>(null)

  const fetchFavorites = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    try {
      const d = await authFetch<FavoritesResponse>('/api/favorites')
      setFavorites(d.favorites ?? [])
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) {
        setFavorites([])
        return
      }
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setFavorites([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    fetchFavorites()
  }, [fetchFavorites])

  const paginatedFavorites = useMemo(() => {
    const start = (page - 1) * limit
    return favorites.slice(start, start + limit)
  }, [favorites, page, limit])

  // Realtime — refresh when properties change
  useRealtimeProperties({
    userId: user?.id,
    onPropertyChange: useCallback(() => { void fetchFavorites() }, [fetchFavorites]),
  })

  const handleRemoveFavorite = async (propertyId: string) => {
    try {
      await authFetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId }),
      })
      // Remove from local state immediately
      setFavorites((prev) => prev.filter((f) => f.property.id !== propertyId))
    } catch {
      // Silently fail — user can retry
    }
  }

  const handleViewProperty = (propertyId: string) => {
    setSelectedPropertyId(propertyId)
    setView('property-detail')
  }

  const handleBrowseProperties = () => {
    setView('nos-biens')
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Mes favoris</h1>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-sm text-amber-700">Impossible de charger vos favoris. Veuillez réessayer.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants} className="bg-gradient-to-r from-brand-500/10 to-transparent rounded-xl p-4 sm:p-6 -mx-4 sm:-mx-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-brand-100 shrink-0">
            <Heart className="size-6 text-brand-500" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Mes favoris</h1>
            <p className="text-muted-foreground mt-0.5">
              {favorites.length > 0
                ? `${favorites.length} bien${favorites.length > 1 ? 's' : ''} sauvegardé${favorites.length > 1 ? 's' : ''}`
                : 'Les biens que vous avez sauvegardés'}
            </p>
          </div>
        </div>
        {favorites.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="secondary" className="bg-brand-50 text-brand-700">
              <Heart className="size-3 mr-1" /> {favorites.length} favoris
            </Badge>
          </div>
        )}
      </motion.div>

      {favorites.length === 0 ? (
        /* Empty State */
        <motion.div variants={itemVariants}>
          <Card className="border-dashed border-border bg-muted/50">
            <CardContent className="py-12 flex flex-col items-center text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-red-50 mb-4">
                <Heart className="size-7 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                Vous n&apos;avez pas encore de favoris
              </h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                {user?.firstName}, commencez à sauvegarder les biens qui vous plaisent en cliquant sur le cœur.
              </p>
              <Button
                onClick={handleBrowseProperties}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Explorer les biens
                <ArrowRight className="size-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        /* Favorites Grid */
        <motion.div variants={containerVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedFavorites.map((fav) => {
            const p = fav.property
            const image = p.images?.[0]?.url
            const bedroomsLabel = p.bedrooms
              ? p.bedrooms === 1
                ? '1 pièce'
                : `${p.bedrooms} pièces`
              : 'Studio'

            return (
              <motion.div key={fav.id} variants={itemVariants}>
                <Card className="border-border overflow-hidden hover:shadow-md transition-shadow group">
                  {/* Image */}
                  <div
                    className="relative h-40 overflow-hidden cursor-pointer"
                    onClick={() => handleViewProperty(p.id)}
                  >
                    {image ? (
                      <img
                        src={image}
                        alt={p.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <Building2 className="size-8 text-neutral-300" />
                      </div>
                    )}
                    {/* Status badge */}
                    <Badge
                      className={`absolute top-3 left-3 border-0 text-xs font-semibold px-2 py-0.5 ${
                        p.rentalStatus === 'disponible'
                          ? 'bg-emerald-500 text-white'
                          : p.rentalStatus === 'loue'
                            ? 'bg-red-500 text-white'
                            : 'bg-amber-500 text-white'
                      }`}
                    >
                      {p.rentalStatus === 'disponible'
                        ? 'Disponible'
                        : p.rentalStatus === 'loue'
                          ? 'Loué'
                          : 'Réservé'}
                    </Badge>
                    {/* Remove button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveFavorite(p.id)
                      }}
                      className="absolute top-3 right-3 size-8 rounded-full bg-card/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-card transition-colors"
                      aria-label="Retirer des favoris"
                    >
                      <Heart className="size-4 fill-red-500 text-red-500" />
                    </button>
                  </div>

                  {/* Content */}
                  <CardContent className="p-4">
                    <button
                      onClick={() => handleViewProperty(p.id)}
                      className="text-left w-full"
                    >
                      <h3 className="font-semibold text-foreground text-sm line-clamp-1 mb-1 hover:text-brand-600 transition-colors">
                        {p.title}
                      </h3>
                    </button>
                    <div className="flex items-center gap-1 text-muted-foreground text-xs mb-2">
                      <MapPin className="size-3 shrink-0" />
                      <span className="line-clamp-1">{p.city}{p.commune ? `, ${p.commune}` : ''}</span>
                    </div>
                    <p className="text-muted-foreground text-xs mb-2">
                      {bedroomsLabel} &bull; {p.area} m²
                      {p.isFurnished && ' &bull; Meublé'}
                    </p>
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-foreground text-sm">
                        {p.price.toLocaleString('fr-FR')} <span className="text-xs font-normal text-muted-foreground">{p.currency}/mois</span>
                      </p>
                      {p.isVerified && (
                        <Badge className="bg-brand-50 text-brand-600 border-brand-200 text-[10px] px-1.5 py-0 border">
                          Vérifié
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {/* Pagination */}
      {favorites.length > limit && (
        <PaginationControls
          page={page}
          totalPages={Math.ceil(favorites.length / limit)}
          onPageChange={setPage}
        />
      )}
    </motion.div>
  )
}
