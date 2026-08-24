'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '@/lib/auth-store'
import { useFavorites } from '@/lib/use-favorites'
import { authFetch } from '@/lib/auth-fetch'
import { apiFetch } from '@/lib/capacitor'
import {
  MapPin,
  BedDouble,
  Maximize,
  Heart,
  BadgeCheck,
  Eye,
  Phone,
  Mail,
  Share2,
  ChevronLeft,
  ChevronRight,
  ShowerHead,
  Car,
  Wind,
  Shield,
  Building2,
  ArrowLeft,
  Star,
  MessageSquare,
  Calendar,
  Video,
  Clock,
  CheckCircle2,
  Send,
  AlertCircle,
  Flame,
  FileText,
  Wallet,
  Clock3,
  CreditCard,
  Scale,
  LogIn,
  X,
  Navigation,
  Loader2,
  EyeOff,
  Check,
  Flag,
  Zap,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { ReportDetailDialog, statusConfig as inventoryStatusConfig, typeLabels as inventoryTypeLabels } from '@/components/dashboard/tc/report-detail-dialog'
import type { InventoryReport } from '@/components/dashboard/tc/report-detail-dialog'
import { toast } from '@/hooks/use-toast'

// ── Types ───────────────────────────────────────────────────────────────────

type PropertyStatus = 'disponible' | 'loue' | 'reserve'

export interface PropertyDetail {
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
  hasParking: boolean
  hasGarden: boolean
  hasPool: boolean
  hasGuardian: boolean
  hasClimate: boolean
  amenities: string // JSON string
  rentalTerms: string // JSON string
  hideOwnerName: boolean // Owner can hide their name
  virtualTourUrl: string | null // 3D virtual tour video URL
  viewsCount: number
  createdAt: string
  updatedAt: string
  ownerId: string
  images: Array<{ id: string; url: string; order: number }>
  owner: {
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string | null
    avatarUrl: string | null
    createdAt: string
  }
}

type TabKey = 'details' | 'modalites' | 'contact' | 'reviews'

// ── Parsed extras derived from API data ────────────────────────────────────

interface ParsedExtras {
  description: string
  bathrooms: number | null
  parking: boolean
  climate: boolean
  guardian: boolean
  images: string[]
  modalites: {
    caution: number
    dureeBail: string
    chargesIncluses: string[]
    chargesNonIncluses: string[]
    modePaiement: string[]
    conditions: string[]
    etatLieux: string
    preavis: string
    depositMonths: number | null
    advanceMonths: number | null
    agencyFeesMonths: number | null
    advanceAmount: number | null
    agencyFeesAmount: number | null
  }
  owner: {
    name: string
    phone: string
    email: string
    avatar: string
    avatarUrl: string | null
    joinedDate: string
  }
  virtualTourUrl: string | null
  hideOwnerName: boolean
}

// ── Review type ────────────────────────────────────────────────────────────

interface Review {
  id: string
  name: string
  avatar: string
  rating: number
  date: string
  comment: string
  verified: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────

// ── Signal templates ────────────────────────────────────────────────────────

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

function formatJoinedDate(dateStr: string): string {
  const months = ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
  const d = new Date(dateStr)
  return `${months[d.getMonth()]} ${d.getFullYear()}`
}

function parseExtras(property: PropertyDetail): ParsedExtras {
  let modalites: ParsedExtras['modalites'] = {
    caution: 0,
    dureeBail: '',
    chargesIncluses: [],
    chargesNonIncluses: [],
    modePaiement: [],
    conditions: [],
    etatLieux: '',
    preavis: '',
    depositMonths: null,
    advanceMonths: null,
    agencyFeesMonths: null,
    advanceAmount: null,
    agencyFeesAmount: null,
  }
  try {
    const parsed = JSON.parse(property.rentalTerms || '{}')
    modalites = {
      caution: parsed.caution ?? 0,
      dureeBail: parsed.dureeBail ?? '',
      chargesIncluses: parsed.chargesIncluses ?? [],
      chargesNonIncluses: parsed.chargesNonIncluses ?? [],
      modePaiement: parsed.modePaiement ?? [],
      conditions: parsed.conditions ?? [],
      etatLieux: parsed.etatLieux ?? '',
      preavis: parsed.preavis ?? '',
      depositMonths: parsed.depositMonths ?? null,
      advanceMonths: parsed.advanceMonths ?? null,
      agencyFeesMonths: parsed.agencyFeesMonths ?? null,
      advanceAmount: parsed.advanceAmount ?? null,
      agencyFeesAmount: parsed.agencyFeesAmount ?? null,
    }
  } catch {
    // keep defaults
  }

  // Rétro-compatibilité : utiliser les valeurs par défaut du formulaire (Step 2 — Loyer & Charges)
  // si les données ne sont pas encore stockées en base
  if (property.price > 0) {
    if (modalites.depositMonths === null && modalites.caution <= 0) {
      modalites.depositMonths = 2
      modalites.caution = 2 * property.price
    } else if (modalites.depositMonths === null && modalites.caution > 0) {
      modalites.depositMonths = Math.round(modalites.caution / property.price)
    }
    if (modalites.advanceMonths === null) {
      modalites.advanceMonths = 2
      modalites.advanceAmount = 2 * property.price
    }
    if (modalites.agencyFeesMonths === null) {
      modalites.agencyFeesMonths = 1
      modalites.agencyFeesAmount = 1 * property.price
    }
  }

  const ownerName = property.hideOwnerName
    ? 'Propriétaire anonyme'
    : `${property.owner.firstName} ${property.owner.lastName}`
  const ownerAvatar = property.hideOwnerName
    ? 'P'
    : `${property.owner.firstName.charAt(0)}${property.owner.lastName.charAt(0)}`

  return {
    description: property.description,
    bathrooms: property.bathrooms,
    parking: property.hasParking,
    climate: property.hasClimate,
    guardian: property.hasGuardian,
    images: property.images.map((img) => img.url),
    modalites,
    owner: {
      name: ownerName,
      phone: property.hideOwnerName ? '' : (property.owner.phone || ''),
      email: property.hideOwnerName ? '' : property.owner.email,
      avatar: ownerAvatar,
      avatarUrl: property.hideOwnerName ? null : (property.owner.avatarUrl || null),
      joinedDate: formatJoinedDate(property.owner.createdAt),
    },
    virtualTourUrl: property.virtualTourUrl,
    hideOwnerName: property.hideOwnerName,
  }
}

// ── Auth Gate Dialog ────────────────────────────────────────────────────────

function AuthGateDialog({
  open,
  onOpenChange,
  action,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  action: string
}) {
  const { setView } = useAuthStore()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="size-14 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-3">
            <LogIn className="size-7 text-brand-500" />
          </div>
          <DialogTitle className="text-center text-lg">Connexion requise</DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">
            Vous devez être connecté pour {action}. Créez un compte gratuitement ou connectez-vous.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-4">
          <Button
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 text-sm font-semibold"
            onClick={() => { onOpenChange(false); setView('login') }}
          >
            Se connecter
          </Button>
          <Button
            variant="outline"
            className="w-full text-brand-500 border-brand-200 hover:bg-brand-50 hover:text-brand-600 h-10 text-sm"
            onClick={() => { onOpenChange(false); setView('register') }}
          >
            Créer un compte
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Mini Map Component ──────────────────────────────────────────────────────

function MiniMap({ lat, lng, location }: { lat: number; lng: number; location: string }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    import('leaflet').then((L) => {
      if (!mapRef.current || mapInstanceRef.current) return

      const map = L.map(mapRef.current, {
        center: [lat, lng],
        zoom: 15,
        zoomControl: false,
        scrollWheelZoom: false,
        dragging: true,
        doubleClickZoom: false,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map)

      // Custom marker
      const icon = L.divIcon({
        className: 'custom-detail-marker',
        html: `
          <div style="
            background: #FF6C2F;
            color: white;
            font-size: 11px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 20px;
            white-space: nowrap;
            border: 2px solid white;
            box-shadow: 0 2px 10px rgba(0,0,0,0.25);
            font-family: Inter, sans-serif;
          ">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:-2px;margin-right:3px;"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            ${location}
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [40, 30],
      })

      L.marker([lat, lng], { icon }).addTo(map)

      mapInstanceRef.current = map

      // Use ResizeObserver instead of fragile setTimeout
      if (mapRef.current) {
        const observer = new ResizeObserver(() => {
          map.invalidateSize()
        })
        observer.observe(mapRef.current)
        resizeObserverRef.current = observer
      }

      // Initial invalidate after mount
      map.invalidateSize()
    })

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
        resizeObserverRef.current = null
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [lat, lng, location])

  return (
    <div className="relative w-full h-48 sm:h-64 rounded-xl overflow-hidden border border-border">
      <div ref={mapRef} className="w-full h-full" style={{ minHeight: '192px' }} />
      <style jsx global>{`
        .custom-detail-marker { background: none !important; border: none !important; }
        .leaflet-control-attribution { display: none !important; }
      `}</style>
      {/* Get directions button */}
      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-2 right-2 z-10 bg-card/95 backdrop-blur-sm rounded-lg px-2.5 py-1.5 shadow-md border border-border flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:bg-card hover:text-brand-500 transition-colors"
      >
        <Navigation className="size-3.5" />
        Itinéraire
      </a>
    </div>
  )
}

// ── Loading Skeleton ────────────────────────────────────────────────────────

function PropertyDetailSkeleton() {
  return (
    <section className="bg-muted min-h-screen">
      {/* Top bar */}
      <div className="bg-card border-b border-border sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Skeleton className="h-4 w-16" />
          <div className="flex gap-2">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="size-9 rounded-full" />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="lg:grid lg:grid-cols-3 lg:gap-8">
          <div className="lg:col-span-2">
            <Skeleton className="h-64 sm:h-96 lg:h-[480px] rounded-2xl mb-6" />
            <Skeleton className="h-6 w-32 mb-2" />
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2 mb-4" />
            <div className="border-b border-border mb-6">
              <div className="flex gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-20" />
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
          </div>
          <div className="hidden lg:block">
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export function PropertyDetailView({ propertyId }: { propertyId: string }) {
  const { setView, isAuthenticated, user, previousView } = useAuthStore()
  const { isFavorite: checkIsFavorite, toggleFavorite: apiToggleFavorite, checkSingle } = useFavorites([propertyId])
  const [currentImage, setCurrentImage] = useState(0)
  const [showVideo, setShowVideo] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('details')
  const tabScrollRef = useRef<HTMLDivElement>(null)

  // Scroll active tab into view on mobile when it changes
  useEffect(() => {
    if (!tabScrollRef.current) return
    const el = tabScrollRef.current.querySelector(`[data-tab="${activeTab}"]`)
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [activeTab])

  const [authGateOpen, setAuthGateOpen] = useState(false)
  const [authGateAction, setAuthGateAction] = useState('')
  const [applyDialogOpen, setApplyDialogOpen] = useState(false)
  const [applySubmitted, setApplySubmitted] = useState(false)
  const [visitModalOpen, setVisitModalOpen] = useState(false)

  // API data state
  const [property, setProperty] = useState<PropertyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Reviews data state
  const [reviews, setReviews] = useState<Review[]>([])
  const [avgRating, setAvgRating] = useState<number>(0)
  const [totalReviews, setTotalReviews] = useState<number>(0)

  // Inventory reports state
  const [inventoryReports, setInventoryReports] = useState<InventoryReport[]>([])
  const [inventoryLoading, setInventoryLoading] = useState(false)
  const [detailReport, setDetailReport] = useState<InventoryReport | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Signal property state
  const [signalDialogOpen, setSignalDialogOpen] = useState(false)
  const [signalReason, setSignalReason] = useState('FALSE_INFORMATION')
  const [signalDescription, setSignalDescription] = useState('')
  const [signalTemplateIndex, setSignalTemplateIndex] = useState(0)
  const [signalSubmitting, setSignalSubmitting] = useState(false)
  const [signalSubmitted, setSignalSubmitted] = useState(false)

  const currentSignalTemplates = SIGNAL_TEMPLATES[signalReason] || SIGNAL_TEMPLATES.FALSE_INFORMATION

  useEffect(() => {
    const templates = SIGNAL_TEMPLATES[signalReason] || SIGNAL_TEMPLATES.FALSE_INFORMATION
    const validIdx = Math.min(signalTemplateIndex, templates.length - 1)
    setSignalTemplateIndex(validIdx)
    setSignalDescription(templates[validIdx])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signalReason, signalTemplateIndex])

  const handleSignalSubmit = async () => {
    if (!signalDescription.trim() || signalSubmitting) return
    setSignalSubmitting(true)
    try {
      await apiFetch('/api/properties/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          reason: signalReason,
          description: signalDescription.trim(),
        }),
        credentials: 'include',
      })
      setSignalSubmitted(true)
    } catch {
      toast({ title: 'Erreur', description: 'Impossible d\'envoyer le signalement. Veuillez réessayer.', variant: 'destructive' })
    } finally {
      setSignalSubmitting(false)
    }
  }

  const openSignalDialog = () => {
    requireAuth('signaler une annonce', () => {
      setSignalReason('FALSE_INFORMATION')
      setSignalDescription('')
      setSignalTemplateIndex(0)
      setSignalSubmitted(false)
      setSignalDialogOpen(true)
    })
  }

  // Partage state
  const [shareSuccess, setShareSuccess] = useState(false)
  const handleShare = useCallback(() => {
    const url = window.location.href
    const title = property?.title ?? 'Bien immobilier'
    if (navigator.share) {
      navigator.share({ title, url }).catch(() => {})
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setShareSuccess(true)
        toast({ title: 'Lien copié !', description: 'Le lien du bien a été copié dans votre presse-papier.' })
        setTimeout(() => setShareSuccess(false), 2000)
      }).catch(() => {
        toast({ title: 'Erreur', description: 'Impossible de copier le lien.', variant: 'destructive' })
      })
    }
  }, [property])

  // Fetch property from API
  useEffect(() => {
    if (!propertyId) return
    let cancelled = false
    apiFetch(`/api/properties/${propertyId}`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Bien introuvable')
        const contentType = res.headers.get('content-type')
        if (!contentType?.includes('application/json')) {
          console.error(`[PropertyDetailView] Réponse non-JSON pour /api/properties/${propertyId}: content-type=${contentType}`)
          throw new Error('Format de réponse invalide')
        }
        return res.json()
      })
      .then((data) => {
        if (!cancelled) {
          // Normalize owner data — API may return partial owner info for anonymous owners
          const p = data.property
          if (p.owner) {
            p.owner.avatarUrl = p.owner.avatarUrl ?? null
            p.owner.createdAt = p.owner.createdAt ?? new Date().toISOString()
          }
          setProperty(p)
          setCurrentImage(0)
          setShowVideo(false)
          setActiveTab('details')
          setError(null)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Erreur lors du chargement')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [propertyId])

  // Check favorite status on mount
  useEffect(() => {
    if (propertyId && isAuthenticated) {
      checkSingle(propertyId)
    }
  }, [propertyId, isAuthenticated, checkSingle])

  // Fetch inventory reports for this property (public endpoint, returns only COMPLETED/SIGNED reports)
  useEffect(() => {
    if (!property || !propertyId) return
    let cancelled = false
    setInventoryLoading(true)
    apiFetch(`/api/properties/${propertyId}/inventory-reports`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setInventoryReports(data.reports || [])
        }
      })
      .catch(() => {
        if (!cancelled) setInventoryReports([])
      })
      .finally(() => {
        if (!cancelled) setInventoryLoading(false)
      })
    return () => { cancelled = true }
  }, [property, propertyId])

  // Fetch reviews from API
  useEffect(() => {
    if (!propertyId) return
    apiFetch(`/api/properties/reviews?propertyId=${propertyId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Erreur')
        return res.json()
      })
      .then((data) => {
        setReviews(data.reviews ?? [])
        setAvgRating(data.avgRating ?? 0)
        setTotalReviews(data.totalReviews ?? 0)
      })
      .catch(() => {
        // Silently fail — reviews are not critical
        setReviews([])
        setAvgRating(0)
        setTotalReviews(0)
      })
  }, [propertyId])

  // Loading state
  if (loading) return <PropertyDetailSkeleton />

  // Error state
  if (error || !property) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <AlertCircle className="size-10 text-muted-foreground" />
        <p className="text-muted-foreground">{error || 'Bien introuvable'}</p>
        <Button variant="outline" onClick={() => setView(previousView === 'property-detail' ? 'home' : previousView)}>
          Retour
        </Button>
      </div>
    )
  }

  const isRented = property.rentalStatus === 'loue'

  // Derive extras from API data
  const extras = parseExtras(property)

  const statusConfig: Record<PropertyStatus, { label: string; className: string }> = {
    disponible: { label: 'Disponible', className: 'bg-emerald-500 text-white' },
    loue: { label: 'Loué', className: 'bg-red-500 text-white' },
    reserve: { label: 'Réservé', className: 'bg-amber-500 text-white' },
  }

  const features = [
    { icon: BedDouble, label: 'Pièces', value: property.bedrooms ?? '—' },
    { icon: ShowerHead, label: 'Salle de Bain', value: property.bathrooms ?? '—' },
    { icon: Maximize, label: 'Surface', value: `${property.area} m²` },
    { icon: Car, label: 'Parking', value: property.hasParking ? 'Oui' : 'Non' },
    { icon: Wind, label: 'Climatisation', value: property.hasClimate ? 'Oui' : 'Non' },
    { icon: Shield, label: 'Gardien', value: property.hasGuardian ? 'Oui' : 'Non' },
  ]

  // avgRating is now fetched from API (state variable)

  const images = extras.images
  const commune = property.commune || property.city

  // Check if modalites has any data
  const hasModalites = (() => {
    const m = extras.modalites
    return !!(m.dureeBail || m.caution > 0 || m.chargesIncluses.length > 0 || m.chargesNonIncluses.length > 0 || m.modePaiement.length > 0 || m.conditions.length > 0 || m.etatLieux || m.preavis || m.depositMonths || m.advanceMonths || m.agencyFeesMonths)
  })()

  // Auth-gated action helper
  const requireAuth = (action: string, callback: () => void) => {
    if (!isAuthenticated) {
      setAuthGateAction(action)
      setAuthGateOpen(true)
      return
    }
    callback()
  }

  // Favorite toggle with auth gate
  const toggleFavorite = () => {
    requireAuth('ajouter aux favoris', async () => {
      await apiToggleFavorite(propertyId)
    })
  }

  // Apply for property
  const handleApply = () => {
    requireAuth('soumettre votre candidature', () => setApplyDialogOpen(true))
  }

  const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'details', label: 'Détails', icon: Building2 },
    ...(hasModalites ? [{ key: 'modalites', label: 'Modalités', icon: FileText } as const] : []),
    { key: 'contact', label: 'Contacter', icon: Phone },
    { key: 'reviews', label: `Avis (${totalReviews})`, icon: Star },
  ]

  return (
    <section className="bg-muted min-h-screen overflow-x-hidden">
      {/* Auth Gate Dialog */}
      <AuthGateDialog open={authGateOpen} onOpenChange={setAuthGateOpen} action={authGateAction} />

      {/* Signal Property Dialog */}
      <Dialog open={signalDialogOpen} onOpenChange={(open) => { if (!open) { setSignalDialogOpen(false); setSignalSubmitted(false); setSignalReason('FALSE_INFORMATION'); setSignalDescription(''); setSignalTemplateIndex(0) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <Flag className="size-5 text-amber-500" />
                Signaler cette annonce
              </div>
            </DialogTitle>
            <DialogDescription>
              Signalez les informations incorrectes ou suspectes de cette annonce. Notre équipe examinera votre signalement.
            </DialogDescription>
          </DialogHeader>

          {signalSubmitted ? (
            <div className="text-center py-6">
              <div className="size-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="size-7 text-emerald-500" />
              </div>
              <h3 className="text-base font-bold text-foreground mb-2">Signalement envoyé !</h3>
              <p className="text-sm text-muted-foreground">
                Votre signalement a été transmis à notre équipe. Elle l&apos;examinera dans les plus brefs délais.
              </p>
              <Button
                variant="outline"
                className="mt-4 text-brand-500 border-brand-200"
                onClick={() => { setSignalDialogOpen(false); setSignalSubmitted(false); setSignalReason('FALSE_INFORMATION'); setSignalDescription(''); setSignalTemplateIndex(0) }}
              >
                Fermer
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-2">
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
          )}

          {!signalSubmitted && (
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setSignalDialogOpen(false); setSignalReason('FALSE_INFORMATION'); setSignalDescription(''); setSignalTemplateIndex(0) }}>
                Annuler
              </Button>
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleSignalSubmit}
                disabled={!signalDescription.trim() || signalSubmitting}
              >
                {signalSubmitting ? <Loader2 className="size-4 animate-spin mr-2" /> : <Flag className="size-4 mr-1.5" />}
                Signaler
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Apply Dialog */}
      <ApplyDialog
        open={applyDialogOpen}
        onOpenChange={setApplyDialogOpen}
        property={property}
        extras={extras}
        submitted={applySubmitted}
        setSubmitted={setApplySubmitted}
      />

      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <div className="bg-card border-b border-border sticky top-0 z-30 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <button
            onClick={() => setView(previousView === 'property-detail' ? 'home' : previousView)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-brand-500 transition-colors"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Retour</span>
            <span className="sm:hidden">Retour</span>
          </button>
          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                onClick={toggleFavorite}
                className="size-9 rounded-full bg-muted border border-border flex items-center justify-center hover:bg-red-50 hover:border-red-200 transition-all"
                aria-label={checkIsFavorite(propertyId) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              >
                <Heart className={`size-4 ${checkIsFavorite(propertyId) ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
              </button>
            )}
            <button
              onClick={handleShare}
              className="size-9 rounded-full bg-muted border border-border flex items-center justify-center hover:bg-brand-50 hover:border-brand-200 transition-all"
              aria-label="Partager"
            >
              {shareSuccess ? (
                <Check className="size-4 text-emerald-500" />
              ) : (
                <Share2 className="size-4 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="lg:grid lg:grid-cols-3 lg:gap-8">
          {/* ── Left Column (2/3) ──────────────────────────────────────── */}
          <div className="lg:col-span-2">
            {/* Media Gallery (Images + Video toggle) */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="relative h-64 sm:h-96 lg:h-[480px] rounded-2xl overflow-hidden bg-neutral-200 mb-6"
            >
              {/* Photos mode */}
              {!showVideo && (
                <>
                  {images.length > 0 ? (
                    <Image
                      src={images[currentImage] ?? images[0]!}
                      alt={property.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 66vw"
                      priority
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <Building2 className="size-16 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />

                  {/* Image nav */}
                  {images.length > 1 && (
                    <>
                      <button
                        onClick={() => setCurrentImage((p) => (p - 1 + images.length) % images.length)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center hover:bg-card shadow-md transition-colors"
                        aria-label="Image précédente"
                      >
                        <ChevronLeft className="size-4 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => setCurrentImage((p) => (p + 1) % images.length)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center hover:bg-card shadow-md transition-colors"
                        aria-label="Image suivante"
                      >
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </button>
                    </>
                  )}

                  {/* Image indicators */}
                  {images.length > 1 && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {images.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentImage(i)}
                          className={`size-2 rounded-full transition-all ${i === currentImage ? 'bg-white w-6' : 'bg-white/50 hover:bg-white/75'}`}
                          aria-label={`Image ${i + 1}`}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Video mode */}
              {showVideo && extras.virtualTourUrl && (
                <video
                  src={extras.virtualTourUrl}
                  controls
                  className="w-full h-full object-contain bg-black"
                  playsInline
                  preload="metadata"
                />
              )}

              {/* Media type toggle */}
              {extras.virtualTourUrl && (
                <div className="absolute top-4 right-4 flex items-center gap-1 rounded-lg bg-card/90 backdrop-blur-sm p-0.5 shadow-md z-10">
                  <button
                    onClick={() => setShowVideo(false)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${!showVideo ? 'bg-brand-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Photos
                  </button>
                  <button
                    onClick={() => setShowVideo(true)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${showVideo ? 'bg-brand-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <Video className="size-3.5" />
                    Vidéo
                  </button>
                </div>
              )}

              {/* Badges (only in photos mode) */}
              {!showVideo && (
                <div className="absolute top-4 left-4 flex items-center gap-1.5">
                  <Badge className={`border-0 text-xs font-semibold px-2.5 py-0.5 ${statusConfig[property.rentalStatus].className}`}>
                    {statusConfig[property.rentalStatus].label}
                  </Badge>
                  {property.isFurnished && (
                    <Badge className="border-0 text-xs font-medium px-2.5 py-0.5 bg-sky-500 text-white">
                      Meublé
                    </Badge>
                  )}
                  {property.isVerified && (
                    <Badge className="border-0 text-xs font-medium px-2.5 py-0.5 bg-card/90 backdrop-blur-sm text-foreground">
                      <BadgeCheck className="size-3 text-brand-500 mr-0.5" />
                      Vérifié
                    </Badge>
                  )}
                </div>
              )}
            </motion.div>

            {/* Title & Price (mobile) */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="mb-6"
            >
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0 border-border text-muted-foreground">
                  <Building2 className="size-3 mr-0.5" />
                  {property.type}
                </Badge>
                <div className="flex items-center gap-1 text-muted-foreground text-xs">
                  <Eye className="size-3" />
                  <span>{property.viewsCount} vues</span>
                </div>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-1">{property.title}</h1>
              <div className="flex items-center gap-1 text-muted-foreground text-sm">
                <MapPin className="size-3.5 shrink-0 text-brand-500" />
                <span>{property.address}</span>
              </div>
              <div className="flex items-center justify-between mt-3 lg:hidden">
                <p className="text-2xl font-bold text-brand-500">
                  {property.price.toLocaleString('fr-FR')} <span className="text-sm font-normal text-muted-foreground">F CFA/mois</span>
                </p>
              </div>
            </motion.div>

            {/* Tabs */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="mb-6 -mx-4 sm:mx-0"
            >
              {/* Mobile: pill/chip style scrollable tabs */}
              <div className="relative sm:hidden">
                <div
                  ref={tabScrollRef}
                  className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-2"
                  style={{
                    WebkitOverflowScrolling: 'touch',
                    scrollSnapType: 'x mandatory',
                  }}
                >
                  {tabs.map((tab) => {
                    const isActive = activeTab === tab.key
                    return (
                      <button
                        key={tab.key}
                        onClick={() => {
                          setActiveTab(tab.key)
                          // Scroll the clicked tab into view
                          const el = tabScrollRef.current?.querySelector(`[data-tab="${tab.key}"]`)
                          el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
                        }}
                        data-tab={tab.key}
                        className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                          isActive
                            ? 'bg-brand-500 text-white shadow-sm'
                            : 'bg-card text-muted-foreground border border-border hover:bg-muted hover:text-foreground'
                        }`}
                        style={{ scrollSnapAlign: 'center' }}
                      >
                        <tab.icon className="size-3.5 shrink-0" />
                        {tab.label}
                      </button>
                    )
                  })}
                </div>
                {/* Gradient fade edges to indicate scrollability */}
                <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-muted to-transparent" />
                <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-muted to-transparent" />
              </div>

              {/* Desktop: underline style tabs */}
              <div className="hidden sm:block border-b border-border">
                <div
                  className="flex gap-0 -mb-px overflow-x-auto scrollbar-hide"
                >
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex items-center gap-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === tab.key
                          ? 'border-brand-500 text-brand-500'
                          : 'border-transparent text-muted-foreground hover:text-muted-foreground hover:border-border'
                      }`}
                    >
                      <tab.icon className="size-4 shrink-0" />
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                {activeTab === 'details' && <DetailsTab property={property} features={features} extras={extras} />}
                {activeTab === 'modalites' && <ModalitesTab extras={extras} price={property.price} />}
                {activeTab === 'contact' && <ContactTab property={property} extras={extras} openSignalDialog={openSignalDialog} />}
                {activeTab === 'reviews' && <ReviewsTab avgRating={avgRating} reviews={reviews} totalReviews={totalReviews} propertyId={property.id} ownerId={property.ownerId} />}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* États des Lieux — Mobile version */}
          {!inventoryLoading && inventoryReports.length > 0 && (
            <div className="lg:hidden mt-6 pb-[72px]">
              <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <FileText className="size-4 text-brand-500" />
                    États des Lieux
                  </h3>
                  <span className="text-[11px] text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full font-medium">
                    {inventoryReports.length} rapport{inventoryReports.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {inventoryReports.map((report) => {
                    const config = inventoryStatusConfig[report.status] || inventoryStatusConfig.DRAFT
                    const StatusIcon = config.icon
                    return (
                      <div
                        key={report.id}
                        className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border hover:bg-muted/30 transition-colors active:bg-muted/50"
                      >
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <div className="flex items-start gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-foreground truncate max-w-full">
                              {inventoryTypeLabels[report.type] || report.type}
                            </span>
                            <span className={cn('whitespace-nowrap text-[10px] px-1.5 py-0.5 rounded-md font-medium inline-flex items-center gap-0.5', config.className)}>
                              <StatusIcon className="size-2.5" />
                              {config.label}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                            {new Date(report.createdAt).toLocaleDateString('fr-FR', {
                              day: 'numeric', month: 'short', year: 'numeric'
                            })}
                            {report.totalKeys != null && (
                              <span className="ml-2 text-muted-foreground/70">· {report.totalKeys} clé{report.totalKeys > 1 ? 's' : ''}</span>
                            )}
                          </p>
                        </div>
                        <button
                          className="shrink-0 h-8 w-16 flex items-center justify-center gap-1 rounded-lg border border-brand-200 text-brand-600 text-xs font-medium hover:bg-brand-50 hover:border-brand-300 transition-colors active:bg-brand-100"
                          onClick={() => {
                            setDetailReport(report)
                            setDetailOpen(true)
                          }}
                        >
                          <Eye className="size-3.5" />
                          Voir
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Right Sidebar (1/3) ─────────────────────────────────────── */}
          <motion.aside
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="hidden lg:block"
          >
            <div className="sticky top-20 space-y-5">
              {/* Price card */}
              <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
                <p className="text-2xl font-bold text-brand-500 mb-1">
                  {property.price.toLocaleString('fr-FR')} <span className="text-sm font-normal text-muted-foreground">F CFA/mois</span>
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                  <MapPin className="size-3" />
                  <span>{commune}, {property.city}</span>
                </div>

                <Separator className="mb-4" />
                {/* Owner mini card */}
                <div className="flex items-center gap-3 mb-4">
                  <Avatar className="size-11 shrink-0">
                    {extras.owner.avatarUrl && (
                      <AvatarImage src={extras.owner.avatarUrl} alt={extras.owner.name} className="object-cover" />
                    )}
                    <AvatarFallback className="bg-brand-500 text-white text-sm font-bold">
                      {extras.owner.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{extras.owner.name}</p>
                    <p className="text-[11px] text-muted-foreground">Propriétaire · Depuis {extras.owner.joinedDate}</p>
                    {extras.hideOwnerName && (
                      <p className="text-[10px] text-amber-600 flex items-center gap-1 mt-0.5">
                        <EyeOff className="size-2.5" />
                        Anonyme
                      </p>
                    )}
                  </div>
                </div>
                {!isRented && (
                  <>
                    <Button
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 text-sm font-semibold mb-2"
                      onClick={() => requireAuth('planifier une visite', () => setVisitModalOpen(true))}
                    >
                      <Calendar className="size-4 mr-1.5" />
                      Planifier une visite
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full text-brand-500 border-brand-200 hover:bg-brand-50 hover:text-brand-600 h-10 text-sm mb-2"
                      onClick={() => setActiveTab('contact')}
                    >
                      <Phone className="size-4 mr-1.5" />
                      Contacter le propriétaire
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 h-10 text-sm font-semibold"
                      onClick={handleApply}
                    >
                      <FileText className="size-4 mr-1.5" />
                      Soumettre ma candidature
                    </Button>
                  </>
                )}
              </div>

              {/* États des Lieux (visible si des rapports existent) */}
              {!inventoryLoading && inventoryReports.length > 0 && (
                <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                  <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                    <FileText className="size-3.5 text-brand-500" />
                    États des Lieux
                  </h3>
                  <div className="space-y-2">
                    {inventoryReports.map((report) => {
                      const config = inventoryStatusConfig[report.status] || inventoryStatusConfig.DRAFT
                      const StatusIcon = config.icon
                      return (
                        <div
                          key={report.id}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-medium text-muted-foreground">
                                {inventoryTypeLabels[report.type] || report.type}
                              </span>
                              <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', config.className)}>
                                <StatusIcon className="size-2.5 inline mr-0.5" />
                                {config.label}
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {new Date(report.createdAt).toLocaleDateString('fr-FR', {
                                day: 'numeric', month: 'short', year: 'numeric'
                              })}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 shrink-0 gap-0.5 text-[11px] px-1.5"
                            onClick={() => {
                              setDetailReport(report)
                              setDetailOpen(true)
                            }}
                          >
                            <Eye className="size-3" />
                            Voir
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Safety tips */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="size-4 text-amber-600" />
                  <p className="text-xs font-semibold text-amber-800">Conseils de sécurité</p>
                </div>
                <ul className="text-[11px] text-amber-700 space-y-1 mb-3">
                  <li>· Ne payez jamais avant la visite</li>
                  <li>· Vérifiez les documents du propriétaire</li>
                  <li>· Signalez toute démarche suspecte</li>
                </ul>
                <button
                  onClick={openSignalDialog}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-amber-300 bg-white/50 text-amber-700 text-xs font-medium hover:bg-amber-100/50 hover:border-amber-400 transition-all active:scale-[0.98]"
                >
                  <Flag className="size-3.5" />
                  Signaler cette annonce
                </button>
              </div>
            </div>
          </motion.aside>
        </div>

        {/* Mobile CTA bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] z-30 lg:hidden">
          <div className="flex items-center gap-2 sm:gap-3 max-w-7xl mx-auto">
            <div className="flex-1 min-w-0">
              <p className="text-base sm:text-lg font-bold text-brand-500">
                {property.price.toLocaleString('fr-FR')} <span className="text-[10px] sm:text-xs font-normal text-muted-foreground">F CFA/mois</span>
              </p>
            </div>
            {!isRented && (
              <>
                <Button
                  className="bg-primary hover:bg-primary/90 text-primary-foreground h-11 min-w-[5.5rem] text-sm font-semibold shadow-sm"
                  onClick={() => requireAuth('planifier une visite', () => setVisitModalOpen(true))}
                >
                  <Calendar className="size-4 mr-1.5" />
                  Visiter
                </Button>
                <Button
                  variant="outline"
                  className="text-brand-500 border-brand-200 hover:bg-brand-50 h-11 px-3 text-sm"
                  onClick={() => setActiveTab('contact')}
                >
                  <Phone className="size-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Appeler</span>
                </Button>
                <Button
                  variant="outline"
                  className="border-emerald-200 text-emerald-600 hover:bg-emerald-50 h-11 px-3 text-sm"
                  onClick={handleApply}
                >
                  <FileText className="size-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Candidature</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Visit Modal */}
      <VisitModal
        property={property}
        open={visitModalOpen}
        onOpenChange={setVisitModalOpen}
      />

      {/* États des Lieux Modal */}
      <ReportDetailDialog
        report={detailReport}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </section>
  )
}

// ── Details Tab ─────────────────────────────────────────────────────────────

function DetailsTab({
  property,
  features,
  extras,
}: {
  property: PropertyDetail
  features: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number }[]
  extras: ParsedExtras
}) {
  const commune = property.commune || property.city
  const lat = property.latitude ?? 5.3364
  const lng = property.longitude ?? -4.0267

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      {/* Features grid */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Caractéristiques</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {features.map((feat) => (
            <div key={feat.label} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-card border border-border shadow-sm">
              <feat.icon className="size-5 text-brand-500" />
              <span className="text-[10px] text-muted-foreground font-medium">{feat.label}</span>
              <span className="text-sm font-semibold text-foreground">{feat.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Description</h3>
        <p className="text-sm text-muted-foreground leading-relaxed break-words">{extras.description}</p>
      </div>

      {/* Localisation with map */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <MapPin className="size-4 text-brand-500" />
          Localisation
        </h3>
        <div className="bg-card rounded-xl border border-border p-4 space-y-4">
          <div className="flex items-start gap-3">
            <MapPin className="size-5 text-brand-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground break-words">{property.address}</p>
              <p className="text-xs text-muted-foreground">{commune}, {property.city}, Côte d&apos;Ivoire</p>
            </div>
          </div>
          {/* Mini Map */}
          <MiniMap lat={lat} lng={lng} location={commune} />
        </div>
      </div>
    </div>
  )
}

// ── Modalités Tab ───────────────────────────────────────────────────────────

function ModalitesTab({
  extras,
  price,
}: {
  extras: ParsedExtras
  price: number
}) {
  const m = extras.modalites

  const hasChargesLocatives = m.depositMonths || m.advanceMonths || m.agencyFeesMonths
  const totalDeposit = m.caution > 0 ? m.caution : (m.depositMonths ? m.depositMonths * price : 0)
  const totalAdvance = m.advanceAmount ?? (m.advanceMonths ? m.advanceMonths * price : 0)
  const totalAgencyFees = m.agencyFeesAmount ?? (m.agencyFeesMonths ? m.agencyFeesMonths * price : 0)
  if (!m.dureeBail && m.caution === 0 && m.chargesIncluses.length === 0 && m.chargesNonIncluses.length === 0 && !hasChargesLocatives) {
    return (
      <div className="pb-24 lg:pb-6">
        <div className="bg-card rounded-xl border border-border p-8 text-center shadow-sm">
          <FileText className="size-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Les modalités de location n&apos;ont pas encore été renseignées par le propriétaire.</p>
        </div>
      </div>
    )
  }

  const cf = (amount: number) => `${amount.toLocaleString('fr-FR')} F CFA`
  const paymentModes = m.modePaiement

  return (
    <div className="space-y-5 pb-24 lg:pb-6">

      {/* ── Carte récapitulative : Loyer + Charges locatives + Total entrée ── */}
      <div className="bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl p-5 sm:p-6 text-white shadow-md">
        <div className="flex items-baseline gap-1.5 mb-5">
          <span className="text-3xl sm:text-4xl font-black">{price.toLocaleString('fr-FR')}</span>
          <span className="text-sm font-medium opacity-80">F CFA / mois</span>
        </div>

        {hasChargesLocatives && (
          <>
            <div className="border-t border-white/20 pt-4 space-y-2.5">
              {m.depositMonths && (
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-80">Caution / Dépôt de garantie <span className="text-[11px] opacity-60">({m.depositMonths} mois)</span></span>
                  <span className="font-bold">{cf(totalDeposit)}</span>
                </div>
              )}
              {m.advanceMonths && (
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-80">Avance sur loyer <span className="text-[11px] opacity-60">({m.advanceMonths} mois)</span></span>
                  <span className="font-bold">{cf(totalAdvance)}</span>
                </div>
              )}
              {m.agencyFeesMonths && (
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-80">Frais d&apos;agence <span className="text-[11px] opacity-60">({m.agencyFeesMonths} mois)</span></span>
                  <span className="font-bold">{cf(totalAgencyFees)}</span>
                </div>
              )}
            </div>


          </>
        )}
      </div>

      {/* ── Grille secondaire : Paiement + Durée du bail ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {paymentModes.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-4 sm:p-5 shadow-sm">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Moyens de paiement</h4>
            <div className="flex flex-wrap gap-1.5">
              {paymentModes.map((mode) => (
                <span key={mode} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-xs font-medium text-muted-foreground">
                  <CreditCard className="size-3" />
                  {mode}
                </span>
              ))}
            </div>
          </div>
        )}

        {m.dureeBail && (
          <div className="bg-card rounded-xl border border-border p-4 sm:p-5 shadow-sm">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Durée du bail</h4>
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                <Calendar className="size-4 text-brand-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{m.dureeBail}</p>
                {m.preavis && <p className="text-[11px] text-muted-foreground">Préavis : {m.preavis}</p>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Charges (utilités) ── */}
      {(m.chargesIncluses.length > 0 || m.chargesNonIncluses.length > 0) && (
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Charges incluses dans le loyer</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {m.chargesIncluses.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-emerald-600 mb-2.5 flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5" />
                  Incluses
                </p>
                <ul className="space-y-2">
                  {m.chargesIncluses.map((charge) => (
                    <li key={charge} className="flex items-center gap-2.5 text-sm text-foreground">
                      <span className="size-1.5 rounded-full bg-emerald-400 shrink-0" />
                      {charge}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {m.chargesNonIncluses.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-500 mb-2.5 flex items-center gap-1.5">
                  <X className="size-3.5" />
                  Non incluses
                </p>
                <ul className="space-y-2">
                  {m.chargesNonIncluses.map((charge) => (
                    <li key={charge} className="flex items-center gap-2.5 text-sm text-foreground">
                      <span className="size-1.5 rounded-full bg-red-400 shrink-0" />
                      {charge}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Conditions ── */}
      {m.conditions.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Conditions d&apos;entrée</h4>
          <ul className="space-y-3">
            {m.conditions.map((condition, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-foreground">
                <span className="size-6 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center text-[11px] font-bold shrink-0">
                  {i + 1}
                </span>
                {condition}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── État des lieux ── */}
      {m.etatLieux && (
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">État des lieux</h4>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Shield className="size-4 text-brand-500 shrink-0 mt-0.5" />
            <p className="text-sm text-foreground leading-relaxed">{m.etatLieux}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Contact Tab ─────────────────────────────────────────────────────────────

function ContactTab({
  property,
  extras,
  openSignalDialog,
}: {
  property: PropertyDetail
  extras: ParsedExtras
  openSignalDialog: () => void
}) {
  const { isAuthenticated, setView } = useAuthStore()
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  const handleSendMessage = async () => {
    if (!isAuthenticated) {
      setView('login')
      return
    }
    if (!message.trim() || sending) return

    setSending(true)
    try {
      const { authFetch } = await import('@/lib/auth-fetch')
      await authFetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId: property.ownerId,
          content: message.trim(),
          propertyId: property.id,
        }),
      })
      setSent(true)
    } catch (err) {
      console.error('Send message error:', err)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      {/* Owner card */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
        <div className="flex items-center gap-4 mb-4">
          <Avatar className="size-14 shrink-0">
            {extras.owner.avatarUrl && (
              <AvatarImage src={extras.owner.avatarUrl} alt={extras.owner.name} className="object-cover" />
            )}
            <AvatarFallback className="bg-brand-500 text-white text-lg font-bold">
              {extras.owner.avatar}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-foreground">{extras.owner.name}</p>
            <p className="text-xs text-muted-foreground">Propriétaire · Membre depuis {extras.owner.joinedDate}</p>
            {extras.hideOwnerName && (
              <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                <EyeOff className="size-3" />
                Ce propriétaire préfère rester anonyme
              </p>
            )}
          </div>
        </div>
        {extras.hideOwnerName ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <p className="text-xs text-amber-700">
              Ce propriétaire a choisi de masquer ses coordonnées. Envoyez-lui un message via le formulaire ci-dessous.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground h-11 text-sm font-semibold"
              onClick={() => { if (!isAuthenticated) { setView('login'); return; } }}
            >
              <Phone className="size-4 mr-1.5" />
              Appeler
            </Button>
            <Button
              variant="outline"
              className="text-brand-500 border-brand-200 hover:bg-brand-50 hover:text-brand-600 h-11 text-sm"
              onClick={() => { if (!isAuthenticated) { setView('login'); return; } }}
            >
              <Mail className="size-4 mr-1.5" />
              Envoyer un email
            </Button>
          </div>
        )}
        {!extras.hideOwnerName && !isAuthenticated && (
          <p className="text-[11px] text-muted-foreground text-center mb-2">
            Connectez-vous pour accéder aux coordonnées du propriétaire
          </p>
        )}
        {!extras.hideOwnerName && isAuthenticated && extras.owner.phone && (
          <div className="text-xs text-muted-foreground text-center">
            {extras.owner.phone} · {extras.owner.email}
          </div>
        )}
      </div>

      {/* Message form */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <MessageSquare className="size-4 text-brand-500" />
          Envoyer un message
        </h3>
        {sent ? (
          <div className="text-center py-6">
            <CheckCircle2 className="size-10 text-emerald-500 mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground mb-1">Message envoyé !</p>
            <p className="text-xs text-muted-foreground">Le propriétaire vous répondra dans les plus brefs délais.</p>
          </div>
        ) : !isAuthenticated ? (
          <div className="text-center py-6 space-y-3">
            <div className="size-12 bg-brand-50 rounded-full flex items-center justify-center mx-auto">
              <LogIn className="size-6 text-brand-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">Connectez-vous pour contacter le propriétaire</p>
              <p className="text-xs text-muted-foreground">Vous devez être connecté pour envoyer un message au propriétaire de ce bien.</p>
            </div>
            <Button
              onClick={() => setView('login')}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-10 text-sm font-semibold"
            >
              <LogIn className="size-4 mr-1.5" />
              Se connecter
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Objet</Label>
              <Input
                readOnly
                value={`Intérêt pour : ${property.title}`}
                className="h-9 bg-muted border-border text-xs"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Votre message</Label>
              <Textarea
                placeholder="Bonjour, je suis intéressé(e) par votre bien. Pourrions-nous convenir d'une visite ?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[120px] bg-card border-border text-sm resize-none"
              />
            </div>
            <Button
              onClick={handleSendMessage}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-10 text-sm font-semibold"
              disabled={!message.trim() || sending}
            >
              {sending ? (
                <span className="flex items-center gap-2">
                  <span className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Envoi...
                </span>
              ) : (
                <>
                  <Send className="size-4 mr-1.5" />
                  Envoyer le message
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Signal property button (visible only for authenticated users) */}
      {isAuthenticated && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="size-4 text-amber-600" />
            <p className="text-xs font-semibold text-amber-800">Conseils de sécurité</p>
          </div>
          <ul className="text-[11px] text-amber-700 space-y-1 mb-3">
            <li>· Ne payez jamais avant la visite</li>
            <li>· Vérifiez les documents du propriétaire</li>
            <li>· Signalez toute démarche suspecte</li>
          </ul>
          <button
            onClick={openSignalDialog}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-amber-300 bg-white/50 text-amber-700 text-xs font-medium hover:bg-amber-100/50 hover:border-amber-400 transition-all active:scale-[0.98]"
          >
            <Flag className="size-3.5" />
            Signaler cette annonce
          </button>
        </div>
      )}
    </div>
  )
}

// ── Visit Modal ──────────────────────────────────────────────────────────────

function VisitModal({
  property,
  open,
  onOpenChange,
}: {
  property: PropertyDetail
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { isAuthenticated, user } = useAuthStore()
  const [visitType, setVisitType] = useState<'PHYSICAL' | 'VIRTUAL'>('PHYSICAL')
  const [visitDate, setVisitDate] = useState('')
  const [visitTime, setVisitTime] = useState('')
  const [visitNotes, setVisitNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Reset form when modal closes
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      // Reset on close
      setTimeout(() => {
        setSubmitted(false)
        setVisitDate('')
        setVisitTime('')
        setVisitNotes('')
        setError('')
      }, 200)
    }
    onOpenChange(v)
  }

  const handleSubmit = async () => {
    if (!isAuthenticated || !user) {
      onOpenChange(false)
      // The parent component should handle auth gating
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const res = await apiFetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: property.id,
          visitType,
          requestedDate: visitDate,
          timeSlot: visitTime,
          tenantMessage: visitNotes || null,
        }),
        credentials: 'include',
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erreur lors de la demande')
        return
      }

      setSubmitted(true)
    } catch {
      setError('Erreur réseau. Veuillez réessayer.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="size-5 text-brand-500" />
            Planifier une visite
          </DialogTitle>
          <DialogDescription>
            Choisissez le type de visite et la date qui vous conviennent.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="text-center py-6">
            <div className="size-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="size-7 text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">Demande envoyée !</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Votre demande de visite {visitType === 'PHYSICAL' ? 'physique' : 'virtuelle'} pour le {visitDate} à {visitTime} a été transmise au propriétaire.
            </p>
            <div className="bg-muted rounded-lg p-3 text-left space-y-1.5 mb-4">
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">{property.title}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">{visitDate} à {visitTime}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {visitType === 'PHYSICAL' ? <MapPin className="size-4 text-muted-foreground" /> : <Video className="size-4 text-muted-foreground" />}
                <span className="text-muted-foreground">Visite {visitType === 'PHYSICAL' ? 'physique' : 'virtuelle'}</span>
              </div>
            </div>
            <Button variant="outline" onClick={() => handleOpenChange(false)} className="text-brand-500 border-brand-200">
              Fermer
            </Button>
          </div>
        ) : (
          <div className="space-y-4 mt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {/* Visit type */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2">Type de visite</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setVisitType('PHYSICAL')}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left ${
                    visitType === 'PHYSICAL' ? 'border-brand-500 bg-brand-50/50' : 'border-border hover:border-brand-300'
                  }`}
                >
                  <MapPin className={`size-4 shrink-0 ${visitType === 'PHYSICAL' ? 'text-brand-500' : 'text-muted-foreground'}`} />
                  <div>
                    <span className={`text-xs font-medium block ${visitType === 'PHYSICAL' ? 'text-brand-600' : 'text-muted-foreground'}`}>Physique</span>
                    <span className="text-[10px] text-muted-foreground">Sur place</span>
                  </div>
                </button>
                <button
                  onClick={() => setVisitType('VIRTUAL')}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left ${
                    visitType === 'VIRTUAL' ? 'border-brand-500 bg-brand-50/50' : 'border-border hover:border-brand-300'
                  }`}
                >
                  <Video className={`size-4 shrink-0 ${visitType === 'VIRTUAL' ? 'text-brand-500' : 'text-muted-foreground'}`} />
                  <div>
                    <span className={`text-xs font-medium block ${visitType === 'VIRTUAL' ? 'text-brand-600' : 'text-muted-foreground'}`}>Virtuelle</span>
                    <span className="text-[10px] text-muted-foreground">Visioconférence</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1">Date souhaitée</Label>
                <Input
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  className="h-10 bg-card border-border text-sm"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1">Heure</Label>
                <Input
                  type="time"
                  value={visitTime}
                  onChange={(e) => setVisitTime(e.target.value)}
                  className="h-10 bg-card border-border text-sm"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Message (optionnel)</Label>
              <Textarea
                placeholder="Précisez vos disponibilités ou posez vos questions..."
                value={visitNotes}
                onChange={(e) => setVisitNotes(e.target.value)}
                className="min-h-[80px] bg-card border-border text-sm resize-none"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-700">
                {error}
              </div>
            )}

            {/* Submit */}
            <Button
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 text-sm font-semibold"
              disabled={!visitDate || !visitTime || submitting}
              onClick={handleSubmit}
            >
              {submitting ? (
                <Loader2 className="size-4 mr-1.5 animate-spin" />
              ) : (
                <Calendar className="size-4 mr-1.5" />
              )}
              {submitting ? 'Envoi en cours...' : `Confirmer la visite ${visitType === 'PHYSICAL' ? 'physique' : 'virtuelle'}`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Reviews Tab ─────────────────────────────────────────────────────────────

function ReviewsTab({ avgRating, reviews, totalReviews, propertyId, ownerId }: {
  avgRating: number
  reviews: Review[]
  totalReviews: number
  propertyId: string
  ownerId: string
}) {
  const { isAuthenticated, user } = useAuthStore()
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
  const ratingDistribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
    percentage: reviews.length > 0
      ? (reviews.filter((r) => r.rating === star).length / reviews.length) * 100
      : 0,
  }))

  const canReview = isAuthenticated && user && (
    user.role === 'LOCATAIRE' || user.activeRole === 'LOCATAIRE' ||
    user.role === 'PROPRIETAIRE' || user.activeRole === 'PROPRIETAIRE'
  )

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      <ReviewDialog
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        propertyId={propertyId}
        ownerId={ownerId}
      />

      {reviews.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center shadow-sm">
          <MessageSquare className="size-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Aucun avis pour le moment. Soyez le premier à laisser un avis !</p>
          {canReview && (
            <Button
              onClick={() => setReviewDialogOpen(true)}
              className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground h-10 text-sm font-semibold"
            >
              <Star className="size-4 mr-1.5" />
              Donner un avis
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Rating summary */}
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              <div className="text-center">
                <p className="text-4xl font-bold text-foreground">{avgRating.toFixed(1)}</p>
                <div className="flex items-center gap-0.5 mt-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`size-4 ${i < Math.round(avgRating) ? 'fill-amber-400 text-amber-400' : 'text-neutral-200'}`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{totalReviews} avis</p>
              </div>
              <div className="w-full sm:w-auto flex-1 max-w-xs space-y-1.5">
                {ratingDistribution.map((d) => (
                  <div key={d.star} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-3">{d.star}</span>
                    <Star className="size-3 text-amber-400 fill-amber-400" />
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all"
                        style={{ width: `${d.percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-6">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
            {canReview && (
              <div className="mt-4 pt-4 border-t border-border text-center">
                <Button
                  onClick={() => setReviewDialogOpen(true)}
                  variant="outline"
                  className="text-brand-500 border-brand-200 hover:bg-brand-50 hover:text-brand-600 h-10 text-sm font-semibold"
                >
                  <Star className="size-4 mr-1.5" />
                  Donner un avis
                </Button>
              </div>
            )}
          </div>

          {/* Individual reviews */}
          {reviews.map((review) => (
            <div key={review.id} className="bg-card rounded-xl border border-border p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-full bg-brand-500 text-white flex items-center justify-center text-sm font-bold shrink-0">
                  {review.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{review.name}</p>
                      {review.verified && (
                        <BadgeCheck className="size-4 text-brand-500" />
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">{review.date}</span>
                  </div>
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`size-3 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-200'}`}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{review.comment}</p>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ── Review Dialog ────────────────────────────────────────────────────────────

function ReviewDialog({
  open,
  onOpenChange,
  propertyId,
  ownerId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  propertyId: string
  ownerId: string
}) {
  const [score, setScore] = useState(0)
  const [hoverScore, setHoverScore] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [checkingLease, setCheckingLease] = useState(true)
  const [leaseId, setLeaseId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setScore(0)
        setHoverScore(0)
        setComment('')
        setSubmitting(false)
        setSubmitted(false)
        setError('')
        setLeaseId(null)
        setCheckingLease(true)
      }, 200)
      return
    }

    let cancelled = false
    setCheckingLease(true)

    authFetch<{ data?: { id: string }[] }>(`/api/leases?propertyId=${encodeURIComponent(propertyId)}`)
      .then((data) => {
        if (cancelled) return
        const lease = (data.data ?? [])[0]
        if (lease) {
          setLeaseId(lease.id)
        }
        setCheckingLease(false)
      })
      .catch(() => {
        if (!cancelled) setCheckingLease(false)
      })

    return () => { cancelled = true }
  }, [open, propertyId])

  const handleSubmit = async () => {
    if (!leaseId || score < 1) return
    setSubmitting(true)
    setError('')

    try {
      await authFetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaseId,
          toUserId: ownerId,
          score,
          comment: comment.trim() || undefined,
          propertyId,
        }),
      })

      setSubmitted(true)
    } catch {
      setError('Erreur réseau. Veuillez réessayer.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenChange = (v: boolean) => {
    if (submitting) return
    onOpenChange(v)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="size-5 text-brand-500" />
            {submitted ? 'Avis envoyé !' : 'Donner un avis'}
          </DialogTitle>
          <DialogDescription>
            {submitted
              ? 'Merci pour votre retour. Votre avis a été enregistré.'
              : 'Partagez votre expérience avec ce propriétaire.'}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="text-center py-4">
            <div className="size-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="size-7 text-emerald-500" />
            </div>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="text-brand-500 border-brand-200"
            >
              Fermer
            </Button>
          </div>
        ) : checkingLease ? (
          <div className="text-center py-8">
            <div className="size-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Vérification de votre éligibilité...</p>
          </div>
        ) : !leaseId ? (
          <div className="text-center py-6">
            <AlertCircle className="size-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              Vous devez avoir été locataire de ce bien pour laisser un avis.
            </p>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="text-brand-500 border-brand-200"
            >
              Fermer
            </Button>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            {/* Star rating */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Note</Label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverScore(star)}
                    onMouseLeave={() => setHoverScore(0)}
                    onClick={() => setScore(star)}
                    className="p-0.5 transition-transform hover:scale-110"
                  >
                    <Star
                      className={`size-7 transition-colors ${
                        star <= (hoverScore || score)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-neutral-200'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Comment */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Commentaire (optionnel)</Label>
              <Textarea
                placeholder="Décrivez votre expérience avec ce propriétaire..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[100px] bg-card border-border text-sm resize-none"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-700">
                {error}
              </div>
            )}

            {/* Submit */}
            <Button
              onClick={handleSubmit}
              disabled={score < 1 || submitting}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 text-sm font-semibold"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Envoi...
                </span>
              ) : (
                <>
                  <Star className="size-4 mr-1.5" />
                  Envoyer mon avis
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Apply Dialog ────────────────────────────────────────────────────────────

function ApplyDialog({
  open,
  onOpenChange,
  property,
  extras,
  submitted,
  setSubmitted,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  property: PropertyDetail
  extras: ParsedExtras
  submitted: boolean
  setSubmitted: (v: boolean) => void
}) {
  const { setView, setDashboardSection } = useAuthStore()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [dossierIncomplete, setDossierIncomplete] = useState(false)
  const submittingRef = useRef(false)

  const handleSubmit = async () => {
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await authFetch<{ error?: string; data?: { rentalFileId?: string } }>('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: property.id,
        }),
      })
      if (res.error) {
        throw new Error(res.error)
      }
      // Vérifier le statut du dossier locataire
      try {
        const rentalRes = await authFetch<{ data?: Array<{ status: string }> }>('/api/rental-file')
        const rentalFile = Array.isArray(rentalRes?.data) ? rentalRes.data[0] : null
        const status = rentalFile?.status
        if (!status || status === 'DRAFT' || status !== 'VALIDATED') {
          setDossierIncomplete(true)
        }
      } catch {
        setDossierIncomplete(true)
      }
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erreur lors de la soumission')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const handleCompleteDossier = () => {
    onOpenChange(false)
    setSubmitted(false)
    setView('dashboard')
    setDashboardSection('rental-file')
  }

  const handleClose = () => {
    onOpenChange(false)
    if (submitted) {
      setSubmitted(false)
      setDossierIncomplete(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5 text-brand-500" />
            Candidature
          </DialogTitle>
        </DialogHeader>

        {submitted ? (
          <div className="text-center py-6">
            <div className="size-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="size-8 text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">Candidature soumise !</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Votre candidature pour &quot;{property.title}&quot; a été transmise au propriétaire.
              Vous serez notifié de la suite donnée à votre demande.
            </p>

            {dossierIncomplete && (
              <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-left">
                <p className="text-xs font-semibold text-amber-800 mb-1">
                  ⚠️ Dossier locataire incomplet
                </p>
                <p className="text-xs text-amber-700">
                  Votre candidature ne sera pas prise en compte tant que vous n&apos;avez pas soumis votre dossier locataire avec les documents requis.
                </p>
                <Button
                  className="mt-3 w-full h-9 text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={handleCompleteDossier}
                >
                  <FileText className="size-3.5" />
                  Compléter mon dossier
                </Button>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              {!dossierIncomplete && (
                <Button
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={handleClose}
                >
                  Fermer
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="size-16 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-4">
              <Building2 className="size-8 text-brand-500" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">{property.title}</h3>
            <p className="text-sm text-muted-foreground mb-1">{property.address}</p>
            <p className="text-lg font-bold text-brand-500 mb-6">
              {property.price.toLocaleString('fr-FR')} F CFA/mois
            </p>

            {submitError && (
              <p className="text-xs text-red-500 text-center mb-4">{submitError}</p>
            )}
            <Button
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 text-sm font-semibold"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? (
                <Loader2 className="size-4 mr-1.5 animate-spin" />
              ) : (
                <Send className="size-4 mr-1.5" />
              )}
              {submitting ? 'Envoi en cours...' : 'Soumettre ma candidature'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
