'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, BedDouble, Maximize, BadgeCheck, ArrowRight, X, Star, Navigation, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { PropertyStatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { useGeolocation } from '@/hooks/capacitor/use-geolocation'

// ── Types ───────────────────────────────────────────────────────────────────

type PropertyStatus = 'disponible' | 'loue' | 'reserve'

interface MapProperty {
  id: string
  title: string
  price: number
  address: string
  commune: string | null
  bedrooms: number | null
  area: number
  image: string | null
  type: string
  isFurnished: boolean
  rentalStatus: PropertyStatus
  isVerified: boolean
  viewsCount: number
  latitude: number | null
  longitude: number | null
}

interface PropertyMapLeafletProps {
  properties: MapProperty[]
  onPropertyClick?: (property: MapProperty) => void
  userLocation?: { lat: number; lng: number } | null
  searchRadius?: number | null
}

// ── Property type icons ────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, string> = {
  APPARTEMENT: '\u{1F3E0}',
  STUDIO: '\u{1F3E0}',
  VILLA: '\u{1F3E1}',
  DUPLEX: '\u{1F3E2}',
  PENTHOUSE: '\u{1F3E2}',
  CHAMBRE: '\u{1F6CF}',
  CONCESSION: '\u{1F3E2}',
  IMMEUBLE: '\u{1F3E2}',
  TERRAIN: '\u{1F3D4}',
  LOCAL_COMMERCIAL: '\u{1F3EA}',
}

// ── Helper ──────────────────────────────────────────────────────────────────

function getMapPropertyLocation(property: MapProperty): string {
  if (property.commune) {
    return `${property.address}, ${property.commune}`
  }
  return property.address
}

function getTypeIcon(property: MapProperty): string {
  return TYPE_ICONS[property.type] || '\u{1F3E0}'
}

function formatCompactPrice(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return ''

  if (price >= 1_000_000) {
    const millions = price / 1_000_000
    return `${Number.isInteger(millions) ? millions.toFixed(0) : millions.toFixed(1).replace('.0', '')}M`
  }

  if (price >= 1_000) {
    const thousands = price / 1_000
    return `${Number.isInteger(thousands) ? thousands.toFixed(0) : thousands.toFixed(1).replace('.0', '')}k`
  }

  return price.toLocaleString('fr-FR')
}

function formatMarkerPrice(price: number, zoom: number): string {
  if (zoom >= 16) {
    return `${price.toLocaleString('fr-FR')} F`
  }

  return `${formatCompactPrice(price)} F`
}

// ── Popup Card ──────────────────────────────────────────────────────────────

function LeafletPopupCard({ property, onVoirClick }: { property: MapProperty; onVoirClick: () => void }) {
  const location = getMapPropertyLocation(property)

  return (
    <div className="w-64 font-sans">
      <div className="relative h-32 overflow-hidden rounded-t-lg">
        {property.image ? (
          <Image
            src={property.image}
            alt={property.title}
            fill
            className="object-cover"
            sizes="256px"
            unoptimized
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center">
            <span className="text-3xl">{getTypeIcon(property)}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
          <PropertyStatusBadge status={property.rentalStatus} className="text-[9px] font-semibold px-1.5 py-0" />
          {property.isFurnished && (
            <Badge className="border-0 text-[9px] font-medium px-1.5 py-0 bg-sky-500/90 text-white">
              Meublé
            </Badge>
          )}
        </div>
        {/* Type icon overlay */}
        <div className="absolute top-1.5 right-1.5 bg-black/30 backdrop-blur-sm rounded-full px-1.5 py-0.5 text-xs leading-none">
          <span>{getTypeIcon(property)}</span>
        </div>
      </div>
      <div className="p-2.5">
        <h3 className="font-semibold text-foreground text-[11px] mb-0.5 line-clamp-1">{property.title}</h3>
        <div className="flex items-center gap-1 text-muted-foreground text-[10px] mb-1.5">
          <MapPin className="size-2.5 shrink-0 text-brand-500" />
          <span className="line-clamp-1">{location}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-2">
          {property.bedrooms !== null && (
            <div className="flex items-center gap-0.5 bg-muted rounded-full px-1.5 py-0.5">
              <BedDouble className="size-2.5 text-muted-foreground" />
              <span>{property.bedrooms} pièce{property.bedrooms > 1 ? 's' : ''}</span>
            </div>
          )}
          <div className="flex items-center gap-0.5 bg-muted rounded-full px-1.5 py-0.5">
            <Maximize className="size-2.5 text-muted-foreground" />
            <span>{property.area} m²</span>
          </div>
          {property.isVerified && (
            <BadgeCheck className="size-3 text-brand-500" />
          )}
        </div>
        <div className="flex items-center justify-between pt-1.5 border-t border-border">
          <p className="text-xs font-bold text-brand-500">
            {property.price.toLocaleString('fr-FR')} <span className="text-[9px] font-normal text-muted-foreground">F CFA/mois</span>
          </p>
          <Button
            variant="outline"
            size="sm"
            className="text-brand-500 border-brand-200 hover:bg-brand-50 hover:text-brand-600 text-[9px] h-6 px-2 rounded-lg transition-all"
            onClick={(e) => {
              e.stopPropagation()
              onVoirClick()
            }}
          >
            Voir <ArrowRight className="size-2.5 ml-0.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Main Leaflet Map Component ──────────────────────────────────────────────

export default function PropertyMapLeaflet({ properties, onPropertyClick, userLocation, searchRadius }: PropertyMapLeafletProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const [selectedProperty, setSelectedProperty] = useState<MapProperty | null>(null)
  const [clusterProperties, setClusterProperties] = useState<MapProperty[]>([])
  const [mapZoomLevel, setMapZoomLevel] = useState(12)
  const [internalUserLocation, setInternalUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const hasAutoCenteredRef = useRef(false)
  const isTransitioningRef = useRef(false)
  const userFlyInProgressRef = useRef(false)
  const userMarkerLayerRef = useRef<L.LayerGroup | null>(null)
  const userMarkerRenderFnRef = useRef<((loc: { lat: number; lng: number } | null, radius: number | null) => void) | null>(null)
  // Refs for animated circle transitions
  const userMarkerRef = useRef<L.Marker | null>(null)
  const circleRef = useRef<L.Circle | null>(null)
  const pulseCircleRef = useRef<L.Circle | null>(null)
  const labelRef = useRef<L.Marker | null>(null)
  const circleAnimRef = useRef<number | null>(null)
  const currentRadiusRef = useRef<number | null>(null)

  // Geolocation hook for auto-detection (only when userLocation prop is not provided)
  const geo = useGeolocation({ enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 })

  // Effective location: prop overrides auto-detected location
  const effectiveUserLocation = userLocation ?? internalUserLocation

  // Auto-detect position on mount when parent doesn't provide userLocation
  useEffect(() => {
    if (!userLocation && !internalUserLocation) {
      geo.getCurrentPosition()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When geolocation hook obtains a position (and no prop overrides), update internal state
  useEffect(() => {
    if (userLocation) return // parent controls location
    if (!geo.position) return

    const newLoc = {
      lat: geo.position.coords.latitude,
      lng: geo.position.coords.longitude,
    }
    setInternalUserLocation(newLoc)
  }, [geo.position, userLocation])

  // Group properties by commune
  const communeGroups = useCallback(() => {
    const groups: Record<string, MapProperty[]> = {}
    properties.forEach((p) => {
      const communeKey = p.commune ?? 'Autre'
      if (!groups[communeKey]) groups[communeKey] = []
      groups[communeKey].push(p)
    })
    return groups
  }, [properties])

  // Compute price range for a group
  function getPriceRange(props: MapProperty[]): string {
    const prices = props.map(p => p.price).filter(p => p > 0)
    if (prices.length === 0) return ''
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    if (min === max) return formatCompactPrice(min)
    return `${formatCompactPrice(min)} - ${formatCompactPrice(max)}`
  }

  function getGroupTypes(props: MapProperty[]): string[] {
    const types = new Set(props.map(p => p.type))
    return Array.from(types)
  }

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    // Dynamic import of Leaflet
    import('leaflet').then((L) => {
      if (!mapRef.current || mapInstanceRef.current) return

      // Create map centered on Abidjan
      const map = L.map(mapRef.current, {
        center: [5.3600, -4.0083],
        zoom: 12,
        zoomControl: false,
        scrollWheelZoom: true,
        fadeAnimation: true,
        zoomAnimation: true,
        markerZoomAnimation: true,
      })

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      // Add zoom control to bottom-right
      L.control.zoom({ position: 'bottomright' }).addTo(map)

      // ── Marker creation functions ───────────────────────────────────────

      // Cluster marker: shows count of properties in a commune
      const createClusterIcon = (count: number, commune: string, priceRange: string, types: string[]) => {
        const size = count > 10 ? 56 : count > 5 ? 50 : count > 3 ? 44 : 38
        const bgColor = count > 5 ? '#FF6C2F' : '#FF8C5A'

        const typeIcons = types.slice(0, 3).map(t => TYPE_ICONS[t] || '').join(' ')
        const iconHtml = typeIcons || '\u{1F3E0}'

        return L.divIcon({
          className: 'custom-cluster-marker animated-marker',
          html: `
            <div class="cluster-marker-container" style="
              position: relative;
              width: ${size}px;
              height: ${size + 18}px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              animation: markerEntrance 0.4s ease-out both;
            ">
              <div class="cluster-marker-circle" style="
                width: ${size}px;
                height: ${size}px;
                border-radius: 50%;
                background: linear-gradient(135deg, ${bgColor}, #FF6C2F);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                border: 3px solid white;
                box-shadow: 0 3px 15px rgba(255,108,47,0.4), 0 0 0 1px rgba(255,108,47,0.15);
                transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease;
                position: relative;
                overflow: hidden;
              ">
                <div class="cluster-inner-glow" style="
                  position: absolute;
                  top: -30%;
                  left: -30%;
                  width: 80%;
                  height: 80%;
                  background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%);
                  border-radius: 50%;
                "></div>
                <span style="color: white; font-size: ${count > 9 ? 14 : 16}px; font-weight: 800; line-height: 1; position: relative;">${count}</span>
                <span style="color: rgba(255,255,255,0.85); font-size: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-top: -1px; position: relative;">biens</span>
              </div>
              <div class="cluster-label" style="
                margin-top: 4px;
                padding: 0 8px;
                height: 18px;
                display: flex;
                align-items: center;
                gap: 4px;
                background: rgba(0,0,0,0.7);
                backdrop-filter: blur(4px);
                color: white;
                font-size: 8px;
                font-weight: 600;
                border-radius: 9px;
                white-space: nowrap;
                border: 1.5px solid rgba(255,255,255,0.3);
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
              ">
                <span>${iconHtml}</span>
                <span>${commune}</span>
                ${priceRange ? `<span style="opacity:0.7;font-weight:400;">· ${priceRange}</span>` : ''}
              </div>
            </div>
          `,
          iconSize: [size + 12, size + 28],
          iconAnchor: [(size + 12) / 2, size + 20],
        })
      }

      // Individual property marker: shows price with type icon
      const createPropertyIcon = (price: number, status: PropertyStatus, propertyType: string, zoom: number) => {
        // Same semantic palette as PropertyStatusBadge (emerald/red/amber) —
        // the marker and the popup badge must agree on what each status means.
        const color: Record<PropertyStatus, string> = {
          disponible: '#10B981',
          loue: '#EF4444',
          reserve: '#F59E0B',
        }
        const bgColor = color[status]
        const label = formatMarkerPrice(price, zoom)
        const typeIcon = TYPE_ICONS[propertyType] || ''
        const isDetailedPrice = zoom >= 16
        const fontSize = isDetailedPrice ? 10 : 11
        const horizontalPadding = isDetailedPrice ? 10 : 12

        return L.divIcon({
          className: 'custom-price-marker animated-marker',
          html: `
            <div class="price-marker-container" style="
              position: relative;
              display: flex;
              flex-direction: column;
              align-items: center;
              animation: markerEntrance 0.35s ease-out both;
            ">
              <div class="price-marker-bubble" style="
                background: linear-gradient(135deg, ${bgColor}, ${bgColor}dd);
                color: white;
                font-size: ${fontSize}px;
                font-weight: 700;
                padding: 5px ${horizontalPadding}px;
                border-radius: 20px;
                white-space: nowrap;
                border: 2.5px solid white;
                box-shadow: 0 3px 12px rgba(0,0,0,0.25), 0 1px 2px rgba(0,0,0,0.15);
                cursor: pointer;
                transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease, background 0.2s ease;
                font-family: Inter, system-ui, sans-serif;
                display: flex;
                align-items: center;
                gap: 4px;
                position: relative;
              ">
                ${typeIcon ? `<span style="font-size: 12px;">${typeIcon}</span>` : ''}
                <span>${label}</span>
                <div class="price-arrow" style="
                  position: absolute;
                  bottom: -6px;
                  left: 50%;
                  transform: translateX(-50%) rotate(45deg);
                  width: 10px;
                  height: 10px;
                  background: ${bgColor}dd;
                  border-right: 2.5px solid white;
                  border-bottom: 2.5px solid white;
                  border-radius: 0 0 2px 0;
                "></div>
              </div>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [32, 40],
        })
      }

      // ── User location marker ────────────────────────────────────────────

      const userMarkerLayer = L.layerGroup().addTo(map)
      userMarkerLayerRef.current = userMarkerLayer

      function renderUserLocation(loc: { lat: number; lng: number } | null, radius: number | null) {
        const layer = userMarkerLayerRef.current
        if (!layer || !loc) return

        // Cancel any in-progress radius animation
        if (circleAnimRef.current) {
          cancelAnimationFrame(circleAnimRef.current)
          circleAnimRef.current = null
        }

        // --- First time setup: create user marker and circle elements ---
        if (!userMarkerRef.current) {
          layer.clearLayers()

          // User dot icon
          const userIcon = L.divIcon({
            className: 'user-location-marker',
            html: `
              <div style="position: relative; width: 32px; height: 32px;">
                <div class="user-pulse-ring" style="
                  position: absolute;
                  top: 50%; left: 50%;
                  transform: translate(-50%, -50%);
                  width: 32px; height: 32px;
                  border-radius: 50%;
                  background: rgba(255, 108, 47, 0.15);
                  animation: userPulseRing 2s ease-in-out infinite;
                "></div>
                <div class="user-dot" style="
                  position: absolute;
                  top: 50%; left: 50%;
                  transform: translate(-50%, -50%);
                  width: 18px; height: 18px;
                  border-radius: 50%;
                  background: linear-gradient(135deg, #FF8C5A, #FF6C2F);
                  border: 3px solid white;
                  box-shadow: 0 2px 10px rgba(255, 108, 47, 0.5);
                  animation: userPulse 2s ease-in-out infinite;
                "></div>
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          })

          const um = L.marker([loc.lat, loc.lng], { icon: userIcon, zIndexOffset: 1000 })
          um.addTo(layer)
          userMarkerRef.current = um

          // Create circle elements if radius is provided
          if (radius && radius > 0) {
            const rMeters = radius * 1000
            const labelLat = loc.lat + rMeters / 111320

            const c = L.circle([loc.lat, loc.lng], {
              radius: rMeters,
              color: '#FF6C2F',
              fillColor: '#FF6C2F',
              fillOpacity: 0.05,
              weight: 2.5,
              opacity: 0.55,
            })
            c.addTo(layer)
            circleRef.current = c

            const pc = L.circle([loc.lat, loc.lng], {
              radius: rMeters,
              color: '#FF6C2F',
              fill: false,
              weight: 4,
              opacity: 0,
              className: 'radius-pulse-circle',
            })
            pc.addTo(layer)
            pulseCircleRef.current = pc

            const radiusLabel = L.divIcon({
              className: 'radius-label-marker',
              html: `
                <div style="
                  background: rgba(255,108,47,0.92);
                  backdrop-filter: blur(4px);
                  color: white;
                  font-size: 10px;
                  font-weight: 700;
                  padding: 3px 10px;
                  border-radius: 20px;
                  border: 2px solid white;
                  box-shadow: 0 2px 8px rgba(255,108,47,0.3);
                  white-space: nowrap;
                  letter-spacing: 0.3px;
                ">
                  <span style="display:flex;align-items:center;gap:3px;">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <circle cx="12" cy="12" r="4"/>
                    </svg>
                    ${radius} km
                  </span>
                </div>
              `,
              iconSize: [0, 0],
              iconAnchor: [24, 12],
            })
            const lm = L.marker([labelLat, loc.lng], { icon: radiusLabel, zIndexOffset: 1001 })
            lm.addTo(layer)
            labelRef.current = lm

            currentRadiusRef.current = radius
          }
        } else {
          // --- Subsequent calls: animate transitions smoothly ---

          // Update user marker position if location changed
          userMarkerRef.current.setLatLng([loc.lat, loc.lng])

          // Handle radius change
          const existingCircle = circleRef.current
          const existingPulse = pulseCircleRef.current
          const existingLabel = labelRef.current

          if (radius && radius > 0) {
            if (existingCircle && existingPulse && existingLabel) {
              // Recreate label marker immediately so the text is correct
              layer.removeLayer(existingLabel)
              const rMeters = radius * 1000
              const labelLat = loc.lat + rMeters / 111320
              const radiusLabel = L.divIcon({
                className: 'radius-label-marker',
                html: `
                  <div style="
                    background: rgba(255,108,47,0.92);
                    backdrop-filter: blur(4px);
                    color: white;
                    font-size: 10px;
                    font-weight: 700;
                    padding: 3px 10px;
                    border-radius: 20px;
                    border: 2px solid white;
                    box-shadow: 0 2px 8px rgba(255,108,47,0.3);
                    white-space: nowrap;
                    letter-spacing: 0.3px;
                  ">
                    <span style="display:flex;align-items:center;gap:3px;">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <circle cx="12" cy="12" r="4"/>
                      </svg>
                      ${radius} km
                    </span>
                  </div>
                `,
                iconSize: [0, 0],
                iconAnchor: [24, 12],
              })
              const newLabel = L.marker([labelLat, loc.lng], { icon: radiusLabel, zIndexOffset: 1001 })
              newLabel.addTo(layer)
              labelRef.current = newLabel

              // Animate circles from current radius to new radius
              const startR = (currentRadiusRef.current ?? radius) * 1000
              const endR = radius * 1000
              const startTime = performance.now()
              const duration = 400

              const animate = (now: number) => {
                const t = Math.min((now - startTime) / duration, 1)
                // Ease-out cubic
                const eased = 1 - Math.pow(1 - t, 3)
                const current = startR + (endR - startR) * eased

                existingCircle.setRadius(current)
                existingPulse.setRadius(current)

                if (t < 1) {
                  circleAnimRef.current = requestAnimationFrame(animate)
                }
              }

              circleAnimRef.current = requestAnimationFrame(animate)
              currentRadiusRef.current = radius
            } else {
              // No existing circles — create them
              const rMeters = radius * 1000
              const labelLat = loc.lat + rMeters / 111320

              const c = L.circle([loc.lat, loc.lng], {
                radius: rMeters,
                color: '#FF6C2F',
                fillColor: '#FF6C2F',
                fillOpacity: 0.05,
                weight: 2.5,
                opacity: 0.55,
              })
              c.addTo(layer)
              circleRef.current = c

              const pc = L.circle([loc.lat, loc.lng], {
                radius: rMeters,
                color: '#FF6C2F',
                fill: false,
                weight: 4,
                opacity: 0,
                className: 'radius-pulse-circle',
              })
              pc.addTo(layer)
              pulseCircleRef.current = pc

              const radiusLabel = L.divIcon({
                className: 'radius-label-marker',
                html: `
                  <div style="
                    background: rgba(255,108,47,0.92);
                    backdrop-filter: blur(4px);
                    color: white;
                    font-size: 10px;
                    font-weight: 700;
                    padding: 3px 10px;
                    border-radius: 20px;
                    border: 2px solid white;
                    box-shadow: 0 2px 8px rgba(255,108,47,0.3);
                    white-space: nowrap;
                    letter-spacing: 0.3px;
                  ">
                    <span style="display:flex;align-items:center;gap:3px;">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <circle cx="12" cy="12" r="4"/>
                      </svg>
                      ${radius} km
                    </span>
                  </div>
                `,
                iconSize: [0, 0],
                iconAnchor: [24, 12],
              })
              const lm = L.marker([labelLat, loc.lng], { icon: radiusLabel, zIndexOffset: 1001 })
              lm.addTo(layer)
              labelRef.current = lm

              currentRadiusRef.current = radius
            }
          } else {
            // Radius removed — remove circle elements from the map
            if (existingCircle) { layer.removeLayer(existingCircle); circleRef.current = null }
            if (existingPulse) { layer.removeLayer(existingPulse); pulseCircleRef.current = null }
            if (existingLabel) { layer.removeLayer(existingLabel); labelRef.current = null }
            currentRadiusRef.current = null
          }
        }
      }

      userMarkerRenderFnRef.current = (loc: { lat: number; lng: number } | null, radius: number | null) => renderUserLocation(loc, radius)

      // ── Render markers based on zoom level ──────────────────────────────

      const markersLayer = L.layerGroup().addTo(map)

      function renderMarkers() {
        markersLayer.clearLayers()
        const zoom = map.getZoom()
        setMapZoomLevel(zoom)

        if (zoom < 14) {
          // Show cluster markers by commune
          const groups = communeGroups()
          let delay = 0
          Object.entries(groups).forEach(([commune, props]) => {
            const validProps = props.filter((p) => p.latitude !== null && p.longitude !== null)
            if (validProps.length === 0) return

            const avgLat = validProps.reduce((s, p) => s + (p.latitude ?? 0), 0) / validProps.length
            const avgLng = validProps.reduce((s, p) => s + (p.longitude ?? 0), 0) / validProps.length
            const priceRange = getPriceRange(props)
            const types = getGroupTypes(props)

            const clusterIcon = createClusterIcon(props.length, commune, priceRange, types)
            const marker = L.marker([avgLat, avgLng], { icon: clusterIcon })

            marker.on('click', () => {
              if (isTransitioningRef.current) return
              isTransitioningRef.current = true

              // Show cluster properties in the React overlay
              setClusterProperties(props)

              // Fly to bounds to show individual markers
              const bounds = L.latLngBounds(validProps.map((p) => L.latLng(p.latitude ?? 0, p.longitude ?? 0)))
              map.flyToBounds(bounds.pad(0.3), {
                animate: true,
                duration: 0.6,
                easeLinearity: 0.3,
              })

              // After fly animation, force zoom to at least 14 to show individual markers
              const ensureZoom = () => {
                if (map.getZoom() < 14) {
                  map.setZoom(Math.max(map.getZoom(), 14), { animate: true })
                }
              }
              setTimeout(ensureZoom, 700)

              setTimeout(() => { isTransitioningRef.current = false }, 900)
            })

            // Add entrance delay for staggered animation (set after marker is rendered)
            const currentDelay = delay
            marker.on('add', () => {
              const el = marker.getElement()
              if (el) {
                (el as HTMLElement).style.animationDelay = `${currentDelay * 0.08}s`
              }
            })
            delay++

            marker.addTo(markersLayer)
          })
        } else {
          // Show individual property markers
          properties.forEach((property, idx) => {
            if (property.latitude === null || property.longitude === null) return
            const icon = createPropertyIcon(property.price, property.rentalStatus, property.type, zoom)
            const marker = L.marker([property.latitude, property.longitude], { icon })

            marker.on('click', () => {
              setSelectedProperty(property)
              setClusterProperties([])
            })

            // Staggered animation delay (set after marker is rendered)
            const currentIdx = idx
            marker.on('add', () => {
              const el = marker.getElement()
              if (el) {
                (el as HTMLElement).style.animationDelay = `${currentIdx * 0.05}s`
              }
            })

            marker.addTo(markersLayer)
          })
        }
      }

      // Initial render
      renderMarkers()
      renderUserLocation(effectiveUserLocation, searchRadius ?? null)

      // Re-render on zoom change with smooth transition
      map.on('zoomstart', () => {
        isTransitioningRef.current = true
      })

      map.on('zoomend', () => {
        setTimeout(() => {
          renderMarkers()
          isTransitioningRef.current = false
        }, 100)
      })

      // Fit bounds to all properties
      if (properties.length > 0) {
        const allCoords = properties
          .filter((p) => p.latitude !== null && p.longitude !== null)
          .map((p) => L.latLng(p.latitude!, p.longitude!))
        if (allCoords.length > 0) {
          const bounds = L.latLngBounds(allCoords)
          map.fitBounds(bounds.pad(0.15))
        }
      }

      mapInstanceRef.current = map

      // Invalidate size after a short delay
      setTimeout(() => {
        map.invalidateSize()
      }, 200)
    })

    return () => {
      // Cancel any in-progress circle animation
      if (circleAnimRef.current) {
        cancelAnimationFrame(circleAnimRef.current)
        circleAnimRef.current = null
      }
      // Reset user marker refs so they get recreated on remount
      userMarkerRef.current = null
      circleRef.current = null
      pulseCircleRef.current = null
      labelRef.current = null
      currentRadiusRef.current = null
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [properties, communeGroups, searchRadius])

  // Update markers when properties change
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    setTimeout(() => {
      map.fire('zoomend')
    }, 50)
  }, [properties])

  // Update user marker and fly to location when user location changes
  useEffect(() => {
    const loc = userLocation ?? internalUserLocation
    if (!loc) return

    // Re-render the user marker with the latest location and radius
    userMarkerRenderFnRef.current?.(loc, searchRadius ?? null)

    // Fly to location on first auto-detection only (not when parent provides it)
    if (!hasAutoCenteredRef.current && !userLocation) {
      const map = mapInstanceRef.current
      if (map) {
        hasAutoCenteredRef.current = true
        map.flyTo([loc.lat, loc.lng], 14, {
          animate: true,
          duration: 0.8,
        })
      }
    }
  }, [userLocation, internalUserLocation, searchRadius])

  return (
    <div className="relative w-full h-full">
      {/* Leaflet map container */}
      <div
        ref={mapRef}
        className="w-full h-full min-h-[320px] rounded-xl overflow-hidden sm:min-h-[380px] lg:min-h-[500px]"
      />

      {/* Centrer sur ma position button (only when we have a location) */}
      {effectiveUserLocation && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            const map = mapInstanceRef.current
            if (!map) return
            userFlyInProgressRef.current = true
            map.flyTo([effectiveUserLocation.lat, effectiveUserLocation.lng], 14, {
              animate: true,
              duration: 0.8,
            })
            setTimeout(() => { userFlyInProgressRef.current = false }, 1200)
          }}
          className="absolute top-4 right-4 z-[1000] flex items-center gap-1.5 bg-card/95 backdrop-blur-md rounded-full px-3.5 py-2 shadow-lg border border-border hover:bg-accent transition-colors"
          aria-label="Centrer sur ma position"
        >
          <Navigation className="size-4 text-brand-500" />
          <span className="text-xs font-semibold text-foreground hidden sm:inline">Centrer</span>
        </motion.button>
      )}

      {/* Loading indicator when getting position */}
      {geo.isLoading && !effectiveUserLocation && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]"
        >
          <div className="flex items-center gap-2 bg-card/95 backdrop-blur-md rounded-full px-4 py-2 shadow-lg border border-border">
            <Loader2 className="size-3.5 text-brand-500 animate-spin" />
            <span className="text-xs text-muted-foreground font-medium">Recherche de votre position...</span>
          </div>
        </motion.div>
      )}

      {/* Leaflet CSS overrides */}
      <style jsx global>{`
        .leaflet-popup-content-wrapper {
          border-radius: 12px !important;
          padding: 0 !important;
          overflow: hidden !important;
          box-shadow: 0 8px 30px rgba(0,0,0,0.15) !important;
          animation: popupEntrance 0.3s ease-out;
        }
        .leaflet-popup-content {
          margin: 0 !important;
          width: auto !important;
        }
        .leaflet-popup-tip {
          box-shadow: none !important;
        }
        .leaflet-popup-close-button {
          display: none !important;
        }
        .custom-price-marker,
        .custom-cluster-marker,
        .user-location-marker {
          background: none !important;
          border: none !important;
        }
        .cluster-marker-container:hover .cluster-marker-circle {
          transform: scale(1.12) !important;
          box-shadow: 0 5px 20px rgba(255,108,47,0.5), 0 0 0 2px rgba(255,108,47,0.3) !important;
        }
        .price-marker-container:hover .price-marker-bubble {
          transform: scale(1.1) !important;
          box-shadow: 0 5px 18px rgba(0,0,0,0.3) !important;
        }

        @keyframes markerEntrance {
          0% {
            opacity: 0;
            transform: scale(0) translateY(10px);
          }
          60% {
            opacity: 1;
            transform: scale(1.15) translateY(-2px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0px);
          }
        }

        @keyframes popupEntrance {
          0% {
            opacity: 0;
            transform: translateY(10px) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes userPulse {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
            box-shadow: 0 2px 8px rgba(59, 130, 246, 0.5);
          }
          50% {
            transform: translate(-50%, -50%) scale(1.25);
            box-shadow: 0 2px 16px rgba(59, 130, 246, 0.4);
          }
        }

        .user-pulse-ring {
          animation: userPulseRing 2s ease-in-out infinite;
        }

        @keyframes userPulseRing {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.6;
          }
          50% {
            transform: translate(-50%, -50%) scale(2);
            opacity: 0;
          }
        }

        /* Radius circle edge pulse */
        .radius-pulse-circle {
          animation: radiusPulse 2.5s ease-in-out infinite !important;
        }

        @keyframes radiusPulse {
          0%, 100% {
            stroke-opacity: 0.6;
            stroke-width: 2.5;
          }
          50% {
            stroke-opacity: 0.15;
            stroke-width: 6;
          }
        }

        /* Radius label entrance */
        .radius-label-marker {
          animation: labelEntrance 0.4s ease-out both !important;
        }
        @keyframes labelEntrance {
          0% {
            opacity: 0;
            transform: translateY(-8px) scale(0.8);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* Smooth zoom transition */
        .leaflet-zoom-anim .leaflet-zoom-animated {
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        /* Improved zoom controls */
        .leaflet-control-zoom {
          border: none !important;
          box-shadow: 0 2px 12px rgba(0,0,0,0.15) !important;
          border-radius: 10px !important;
          overflow: hidden !important;
        }
        .leaflet-control-zoom a {
          width: 36px !important;
          height: 36px !important;
          line-height: 36px !important;
          font-size: 16px !important;
          border: none !important;
          background: white !important;
          color: #374151 !important;
          font-weight: 700 !important;
          transition: background 0.15s !important;
        }
        .leaflet-control-zoom a:hover {
          background: #F9FAFB !important;
          color: #FF6C2F !important;
        }
        .leaflet-control-zoom a.leaflet-control-zoom-in {
          border-bottom: 1px solid #F3F4F6 !important;
        }
      `}</style>

      {/* Selected property card overlay */}
      <AnimatePresence>
        {selectedProperty && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] sm:left-4 sm:translate-x-0 sm:bottom-6"
          >
            <div className="bg-card rounded-xl shadow-2xl border border-border overflow-hidden w-72 sm:w-64">
              {/* Close button */}
              <button
                onClick={() => setSelectedProperty(null)}
                className="absolute top-2 right-2 z-10 size-6 rounded-full bg-card/90 backdrop-blur-sm flex items-center justify-center hover:bg-card shadow-sm hover:shadow-md transition-all"
                aria-label="Fermer"
              >
                <X className="size-3 text-muted-foreground" />
              </button>
              <LeafletPopupCard
                property={selectedProperty}
                onVoirClick={() => {
                  if (onPropertyClick) onPropertyClick(selectedProperty)
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cluster properties list overlay */}
      <AnimatePresence>
        {clusterProperties.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] sm:left-4 sm:translate-x-0 sm:bottom-6"
          >
            <div className="bg-card rounded-xl shadow-2xl border border-border overflow-hidden w-80 sm:w-72 max-h-[60vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-brand-500" />
                  <h3 className="text-sm font-bold text-foreground">
                    {clusterProperties[0]?.commune || 'Groupe'}
                  </h3>
                  <span className="text-xs font-semibold text-brand-500 bg-brand-50 rounded-full px-2 py-0.5">
                    {clusterProperties.length} bien{clusterProperties.length > 1 ? 's' : ''}
                  </span>
                </div>
                <button
                  onClick={() => setClusterProperties([])}
                  className="size-7 rounded-full bg-card/80 flex items-center justify-center hover:bg-accent transition-colors"
                  aria-label="Fermer"
                >
                  <X className="size-3.5 text-muted-foreground" />
                </button>
              </div>

              {/* List of properties */}
              <div className="overflow-y-auto max-h-[50vh] divide-y divide-border">
                {clusterProperties.map((property) => (
                  <div
                    key={property.id}
                    role="button"
                    tabIndex={0}
                    className="flex items-center gap-3 p-3 hover:bg-muted/60 cursor-pointer transition-colors group"
                    onClick={() => {
                      if (onPropertyClick) onPropertyClick(property)
                      setClusterProperties([])
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        if (onPropertyClick) onPropertyClick(property)
                        setClusterProperties([])
                      }
                    }}
                  >
                    {/* Thumbnail */}
                    <div className="relative size-14 shrink-0 rounded-lg overflow-hidden bg-muted">
                      {property.image ? (
                        <Image
                          src={property.image}
                          alt={property.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="56px"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl">
                          {getTypeIcon(property)}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground line-clamp-1 mb-0.5">
                        {property.title}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-1 mb-1">
                        {property.address}
                      </p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-brand-500">
                          {property.price.toLocaleString('fr-FR')} F CFA
                        </span>
                        {property.bedrooms !== null && (
                          <>
                            <span className="text-muted-foreground/30">·</span>
                            <span className="text-muted-foreground">
                              {property.bedrooms} pièce{property.bedrooms > 1 ? 's' : ''}
                            </span>
                          </>
                        )}
                        <span className="text-muted-foreground/30">·</span>
                        <span className="text-muted-foreground">{property.area} m²</span>
                      </div>
                    </div>

                    {/* Arrow */}
                    <ArrowRight className="size-4 text-muted-foreground/40 group-hover:text-brand-500 transition-colors shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zoom hint */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]"
      >
        <div className="bg-card/90 backdrop-blur-md rounded-full px-4 py-2 shadow-lg border border-border">
          <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
            <MapPin className="size-3 text-brand-500" />
            {mapZoomLevel < 14
              ? properties.length > 0
                ? 'Cliquez sur un groupe pour voir les biens du quartier'
                : 'Aucun bien à afficher sur la carte'
              : 'Cliquez sur un marqueur pour voir les détails'}
          </p>
        </div>
      </motion.div>

      {/* Legend */}
      <motion.div
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
        className="absolute bottom-4 right-4 z-[1000] sm:right-14 bg-card/90 backdrop-blur-md rounded-xl shadow-lg border border-border px-3 py-2.5"
      >
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Légende</p>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-[#FF6C2F]" />
            <span className="text-[10px] text-muted-foreground">Disponible</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-red-500" />
            <span className="text-[10px] text-muted-foreground">Loué</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-amber-500" />
            <span className="text-[10px] text-muted-foreground">Réservé</span>
          </div>
        </div>
      </motion.div>

      {/* Property count */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="absolute top-4 left-4 z-[1000]"
      >
        <div className="bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-full px-4 py-1.5 shadow-lg text-xs font-semibold flex items-center gap-1.5">
          <Star className="size-3" />
          {properties.length} bien{properties.length !== 1 ? 's' : ''}
        </div>
      </motion.div>
    </div>
  )
}
