'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  PlusCircle, ImagePlus, EyeOff, Video, X, Loader2,
  Upload, ArrowLeft, ArrowRight, CheckCircle2, MapPin, Home,
  FileText, Settings2, Save, Navigation, LocateFixed,
  ChevronLeft, ChevronRight, Building2, Camera, DollarSign, Minus, Plus, Sparkles
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { CITIES, getCommunesForCity } from '@/lib/cities'

// ── Property Location Picker (Leaflet map) ────────────────────────────────────

function PropertyLocationPicker({
  lat,
  lng,
  onLocationChange,
  defaultCenter,
}: {
  lat: number | null
  lng: number | null
  onLocationChange: (lat: number, lng: number) => void
  defaultCenter: { lat: number; lng: number }
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)

  const centerLat = lat ?? defaultCenter.lat
  const centerLng = lng ?? defaultCenter.lng

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    let cancelled = false

    import('leaflet').then((L) => {
      if (!mapRef.current || cancelled || mapInstanceRef.current) return

      const map = L.map(mapRef.current, {
        center: [centerLat, centerLng],
        zoom: 14,
        zoomControl: true,
        scrollWheelZoom: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map)

      const icon = L.divIcon({
        className: 'location-picker-marker',
        html: `<div style="
          background: #FF6C2F;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(45deg);"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      })

      if (lat !== null && lng !== null) {
        const marker = L.marker([lat, lng], { icon, draggable: true }).addTo(map)
        marker.on('dragend', () => {
          const pos = marker.getLatLng()
          onLocationChange(pos.lat, pos.lng)
        })
        markerRef.current = marker
      }

      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat: clickedLat, lng: clickedLng } = e.latlng
        if (markerRef.current) {
          markerRef.current.setLatLng([clickedLat, clickedLng])
        } else {
          const marker = L.marker([clickedLat, clickedLng], { icon, draggable: true }).addTo(map)
          marker.on('dragend', () => {
            const pos = marker.getLatLng()
            onLocationChange(pos.lat, pos.lng)
          })
          markerRef.current = marker
        }
        onLocationChange(clickedLat, clickedLng)
      })

      mapInstanceRef.current = map

      requestAnimationFrame(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize()
        }
      })
    })

    return () => {
      cancelled = true
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!mapInstanceRef.current || lat === null || lng === null) return
    const map = mapInstanceRef.current
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng])
    } else {
      import('leaflet').then((L) => {
        if (!mapInstanceRef.current) return
        const icon = L.divIcon({
          className: 'location-picker-marker',
          html: `<div style="
            background: #FF6C2F;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(45deg);"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
        })
        const marker = L.marker([lat, lng], { icon, draggable: true }).addTo(mapInstanceRef.current)
        marker.on('dragend', () => {
          const pos = marker.getLatLng()
          onLocationChange(pos.lat, pos.lng)
        })
        markerRef.current = marker
      })
    }
    map.setView([lat, lng], map.getZoom() || 14)
  }, [lat, lng, onLocationChange])

  return (
    <div className="w-full h-48 sm:h-56 rounded-lg overflow-hidden border border-border">
      <div ref={mapRef} className="w-full h-full" />
    </div>
  )
}

interface AddPropertyProps {
  editId?: string
  onSuccess?: () => void
  onCancel?: () => void
}

interface PropertyData {
  id: string
  title: string
  description: string
  type: string
  price: number
  area: number
  bedrooms: number | null
  bathrooms: number | null
  address: string
  city: string
  commune: string | null
  latitude: number | null
  longitude: number | null
  isFurnished: boolean
  hasParking: boolean
  hasGarden: boolean
  hasPool: boolean
  hideOwnerName: boolean
  virtualTourUrl: string | null
  images: Array<{ url: string; order: number }>
  status: string
  depositMonths: number | null
  advanceMonths: number | null
  agencyFeesMonths: number | null
}

const STEPS = [
  { id: 1, label: 'Description', icon: Home },
  { id: 2, label: 'Loyer & Charges', icon: DollarSign },
  { id: 3, label: 'Localisation', icon: MapPin },
  { id: 4, label: 'Photos', icon: Camera },
  { id: 5, label: 'Documents', icon: FileText },
] as const

export function AddProperty({ editId, onSuccess, onCancel }: AddPropertyProps) {
  const [step, setStep] = useState(1)

  const safeChargeAmount = (months: string, price: string) => {
    const m = parseInt(months)
    const p = parseFloat(price)
    if (isNaN(m) || isNaN(p) || p <= 0) return null
    return (m * p).toLocaleString('fr-FR')
  }
  const [form, setForm] = useState({
    title: '', description: '', type: 'APPARTEMENT', price: '', area: '',
    bedrooms: '', bathrooms: '', address: '', city: '', commune: '',
    latitude: '', longitude: '',
    isFurnished: false, hasParking: false, hasGarden: false, hasPool: false,
    hasBalcony: false, hasTerrace: false, hasKitchen: false, hasBox: false,
    hideOwnerName: false,
    depositMonths: '2', advanceMonths: '2', agencyFeesMonths: '1',
  })

  const [imagePreviews, setImagePreviews] = useState<Array<{ dataUrl: string; file: File }>>([])
  const [existingImages, setExistingImages] = useState<Array<{ url: string; order: number }>>([])
  const [imageError, setImageError] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(null)
  const [existingVideo, setExistingVideo] = useState<string | null>(null)
  const [videoUploading, setVideoUploading] = useState(false)
  const videoInputRef = useRef<HTMLInputElement>(null)

  const [newDocuments, setNewDocuments] = useState<Array<{
    file: File; name: string; type: string; description: string; expiryDate: string
  }>>([])
  const [existingDocuments, setExistingDocuments] = useState<Array<{
    id: string; name: string; type: string; description: string | null; expiryDate: string | null; url: string
  }>>([])
  const docInputRef = useRef<HTMLInputElement>(null)

  const docTypes = [
    { value: 'DIAGNOSTIC_DPE', label: 'Diagnostic DPE' },
    { value: 'DIAGNOSTIC_AMIANTE', label: 'Diagnostic Amiante' },
    { value: 'DIAGNOSTIC_PLOMB', label: 'Diagnostic Plomb' },
    { value: 'DIAGNOSTIC_ELECTRICITE', label: 'Diagnostic Électricité' },
    { value: 'ASSURANCE_HABITATION', label: 'Assurance Habitation' },
    { value: 'PERMIS_CONSTRUIRE', label: 'Permis de Construire' },
    { value: 'ATTESTATION_CONFORMITE', label: 'Attestation de Conformité' },
    { value: 'PLAN_BATIMENT', label: 'Plan du Bâtiment' },
    { value: 'AUTRE', label: 'Autre' },
  ]

  const [submitting, setSubmitting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null)
  const [propertyId, setPropertyId] = useState<string | null>(editId || null)
  const [loading, setLoading] = useState(!!editId)

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const update = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const [generatingDescription, setGeneratingDescription] = useState(false)

  const handleGenerateDescription = async () => {
    if (!form.type || generatingDescription) return
    setGeneratingDescription(true)
    try {
      const data = await authFetch<{ description: string }>('/api/properties/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title || undefined,
          type: form.type,
          area: form.area || undefined,
          bedrooms: form.bedrooms || undefined,
          bathrooms: form.bathrooms || undefined,
          city: form.city || undefined,
          commune: form.commune || undefined,
          isFurnished: form.isFurnished,
          hasParking: form.hasParking,
          hasGarden: form.hasGarden,
          hasPool: form.hasPool,
          hasBalcony: form.hasBalcony,
          hasTerrace: form.hasTerrace,
          hasKitchen: form.hasKitchen,
        }),
      })
      update('description', data.description)
    } catch (err) {
      toast.error(err instanceof AuthError ? err.message : 'Impossible de générer la description')
    } finally {
      setGeneratingDescription(false)
    }
  }

  // ── Load existing draft ────────────────────────────────────────────────────
  useEffect(() => {
    if (!editId) return
    const loadDraft = async () => {
      try {
        const result = await authFetch<{ property: PropertyData }>(`/api/properties/${editId}`)
        const p = result.property
        setForm({
          title: p.title || '', description: p.description || '', type: p.type || 'APPARTEMENT',
          price: p.price ? String(p.price) : '', area: p.area ? String(p.area) : '',
          bedrooms: p.bedrooms !== null ? String(p.bedrooms) : '',
          bathrooms: p.bathrooms !== null ? String(p.bathrooms) : '',
          address: p.address || '', city: p.city || '', commune: p.commune || '',
          latitude: p.latitude !== null ? String(p.latitude) : '',
          longitude: p.longitude !== null ? String(p.longitude) : '',
          isFurnished: p.isFurnished || false, hasParking: p.hasParking || false,
          hasGarden: p.hasGarden || false, hasPool: p.hasPool || false,
          hasBalcony: false, hasTerrace: false, hasKitchen: false, hasBox: false,
          hideOwnerName: p.hideOwnerName || false,
          depositMonths: p.depositMonths != null ? String(p.depositMonths) : '2',
          advanceMonths: p.advanceMonths != null ? String(p.advanceMonths) : '2',
          agencyFeesMonths: p.agencyFeesMonths != null ? String(p.agencyFeesMonths) : '1',
        })
        setExistingImages(p.images || [])
        if (p.virtualTourUrl) { setExistingVideo(p.virtualTourUrl); setVideoPreview(p.virtualTourUrl) }
        setPropertyId(p.id)
        try {
          const docRes = await authFetch<{ documents: Array<{
            id: string; name: string; type: string; description: string | null; expiryDate: string | null; url: string
          }> }>(`/api/properties/${editId}/documents`)
          setExistingDocuments(docRes.documents || [])
        } catch {}
      } catch { toast.error('Impossible de charger le brouillon') }
      finally { setLoading(false) }
    }
    loadDraft()
  }, [editId])

  // ── Auto-save ───────────────────────────────────────────────────────────────
  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => { handleSaveDraft(true) }, 5000)
  }, [form, propertyId, imagePreviews, videoFile, existingImages, existingVideo])

  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    if (loading) return
    triggerAutoSave()
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current) }
  }, [form, triggerAutoSave, loading])

  // ── Image handling ─────────────────────────────────────────────────────────
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const fileArray = Array.from(files)
    e.target.value = ''

    const remaining = 10 - imagePreviews.length - existingImages.length
    if (remaining <= 0) { setImageError('Maximum 10 photos autorisées'); return }

    const newImages: Array<{ dataUrl: string; file: File }> = []
    let error = ''

    for (const file of fileArray.slice(0, remaining)) {
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
        error = 'Format invalide. Utilisez JPG, PNG ou WEBP.'; continue
      }
      if (file.size > 5 * 1024 * 1024) { error = 'Chaque image doit faire moins de 5 Mo.'; continue }
      try { newImages.push({ dataUrl: URL.createObjectURL(file), file }) }
      catch { error = "Erreur lors du chargement de l'image" }
    }

    if (error) { setImageError(error); if (newImages.length === 0) return }
    setImageError(null)
    setImagePreviews((prev) => [...prev, ...newImages])
  }, [imagePreviews.length, existingImages.length])

  const removeImage = useCallback((index: number) => {
    setImagePreviews((prev) => { const img = prev[index]; if (img) URL.revokeObjectURL(img.dataUrl); return prev.filter((_, i) => i !== index) })
  }, [])

  const removeExistingImage = useCallback((index: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // ── Video handling ─────────────────────────────────────────────────────────
  const handleVideoSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (!file.type.startsWith('video/')) { setError('Format vidéo invalide.'); return }
    if (file.size > 50 * 1024 * 1024) { setError('La vidéo doit faire moins de 50 Mo.'); return }
    setError(null)
    setVideoFile(file)
    setExistingVideo(null)
    setVideoUploading(true)
    setVideoPreview(URL.createObjectURL(file))
    setVideoUploading(false)
  }, [])

  const removeVideo = useCallback(() => {
    if (videoPreview && !existingVideo) URL.revokeObjectURL(videoPreview)
    setVideoFile(null); setVideoPreview(null); setExistingVideo(null)
  }, [videoPreview, existingVideo])

  // ── Document handling ────────────────────────────────────────────────────
  const handleDocFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    e.target.value = ''
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) { toast.error(`"${file.name}" doit faire moins de 10 Mo.`); continue }
      setNewDocuments((prev) => [...prev, {
        file, name: file.name.replace(/\.[^/.]+$/, ''), type: 'AUTRE',
        description: '', expiryDate: '',
      }])
    }
  }

  const removeNewDocument = (index: number) => setNewDocuments((prev) => prev.filter((_, i) => i !== index))

  const deleteExistingDocument = async (docId: string, pid: string) => {
    try {
      await authFetch(`/api/properties/${pid}/documents/${docId}`, { method: 'DELETE' })
      setExistingDocuments((prev) => prev.filter((d) => d.id !== docId))
      toast.success('Document supprimé')
    } catch { toast.error('Erreur lors de la suppression') }
  }

  // ── Compress image ──────────────────────────────────────────────────────
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.onerror = () => reject(new Error('Erreur de lecture')); reader.readAsDataURL(file); return
      }
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(img.src)
        let { width, height } = img
        const MAX_DIM = 1600
        if (width > MAX_DIM || height > MAX_DIM) { const ratio = Math.min(MAX_DIM / width, MAX_DIM / height); width = Math.round(width * ratio); height = Math.round(height * ratio) }
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.readAsDataURL(file); return }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', file.type === 'image/png' ? 0.8 : 0.7))
      }
      img.onerror = () => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.readAsDataURL(file) }
      img.src = URL.createObjectURL(file)
    })
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.onerror = () => reject(new Error('Erreur de lecture')); reader.readAsDataURL(file)
    })
  }

  // ── Save Draft ─────────────────────────────────────────────────────────────
  const handleSaveDraft = async (silent = false) => {
    if (!silent) setSavingDraft(true)
    setError(null)
    try {
      const newImagesBase64: string[] = []
      for (const img of imagePreviews) newImagesBase64.push(await compressImage(img.file))
      const allImages = [...existingImages.map((img) => img.url), ...newImagesBase64]

      let virtualTourUrl: string | null | undefined = undefined
      if (videoFile) virtualTourUrl = await fileToBase64(videoFile)
      else if (existingVideo === null && videoPreview === null) virtualTourUrl = null

      const payload = Object.fromEntries(Object.entries({
        title: form.title.trim() || undefined, description: form.description.trim() || undefined,
        type: form.type || undefined, price: form.price ? parseFloat(form.price) : undefined,
        area: form.area ? parseFloat(form.area) : undefined,
        bedrooms: form.bedrooms ? parseInt(form.bedrooms) : null,
        bathrooms: form.bathrooms ? parseInt(form.bathrooms) : null,
        address: form.address.trim() || undefined, city: form.city.trim() || undefined,
        commune: form.commune.trim() || null,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        isFurnished: form.isFurnished, hasParking: form.hasParking,
        hasGarden: form.hasGarden, hasPool: form.hasPool,
        hasBalcony: form.hasBalcony, hasTerrace: form.hasTerrace,
        hasKitchen: form.hasKitchen, hasBox: form.hasBox,
        hideOwnerName: form.hideOwnerName,
        depositMonths: form.depositMonths ? parseInt(form.depositMonths) : undefined,
        advanceMonths: form.advanceMonths ? parseInt(form.advanceMonths) : undefined,
        agencyFeesMonths: form.agencyFeesMonths ? parseInt(form.agencyFeesMonths) : undefined,
        ...(virtualTourUrl !== undefined && { virtualTourUrl }),
        images: allImages.length > 0 ? allImages : undefined,
      }).filter(([_, v]) => v !== undefined))

      if (propertyId) {
        const result = await authFetch<{ property: { id: string; images: Array<{ url: string; order: number }>; virtualTourUrl: string | null } }>(`/api/properties/${propertyId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        if (result.property.images) setExistingImages(result.property.images)
        if (result.property.virtualTourUrl) { setExistingVideo(result.property.virtualTourUrl); setVideoPreview(result.property.virtualTourUrl); setVideoFile(null) }
        setImagePreviews([])
        for (const doc of newDocuments) {
          const base64 = await fileToBase64(doc.file)
          await authFetch(`/api/properties/${propertyId}/documents`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: doc.name, type: doc.type, content: base64, description: doc.description || undefined, expiryDate: doc.expiryDate || undefined }),
          })
        }
        setNewDocuments([])
      } else {
        const result = await authFetch<{ property: { id: string; images: Array<{ url: string; order: number }>; virtualTourUrl: string | null } }>('/api/properties', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, draft: true }),
        })
        setPropertyId(result.property.id)
        if (result.property.images) setExistingImages(result.property.images)
        if (result.property.virtualTourUrl) { setExistingVideo(result.property.virtualTourUrl); setVideoPreview(result.property.virtualTourUrl); setVideoFile(null) }
        setImagePreviews([])
      }

      setDraftSavedAt(new Date())
      if (!silent) toast.success('Brouillon sauvegardé')
    } catch (err) {
      const errMsg = err instanceof AuthError ? err.message : (err instanceof Error ? err.message : 'Erreur')
      if (!silent) toast.error(errMsg); else console.warn('[Auto-save failed]', errMsg)
    } finally { if (!silent) setSavingDraft(false) }
  }

  // ── Publish ────────────────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!form.title.trim()) { setError('Le titre est requis'); return }
    if (!form.description.trim()) { setError('La description est requise'); return }
    if (!form.price || parseFloat(form.price) <= 0) { setError('Le loyer mensuel est requis'); return }
    if (!form.area || parseFloat(form.area) <= 0) { setError('La surface est requise'); return }
    if (!form.address.trim()) { setError("L'adresse est requise"); return }
    if (!form.city.trim()) { setError('La ville est requise'); return }

    setSubmitting(true); setError(null)

    try {
      const newImagesBase64: string[] = []
      for (const img of imagePreviews) { newImagesBase64.push(await compressImage(img.file)) }
      const allImages = [...existingImages.map((img) => img.url), ...newImagesBase64]

      let virtualTourUrl: string | null | undefined = undefined
      if (videoFile) virtualTourUrl = await fileToBase64(videoFile)
      else if (existingVideo) virtualTourUrl = existingVideo
      else virtualTourUrl = null

      const payload = {
        title: form.title.trim(), description: form.description.trim(), type: form.type,
        price: parseFloat(form.price), area: parseFloat(form.area),
        bedrooms: form.bedrooms ? parseInt(form.bedrooms) : null,
        bathrooms: form.bathrooms ? parseInt(form.bathrooms) : null,
        address: form.address.trim(), city: form.city.trim(), commune: form.commune.trim() || null,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        isFurnished: form.isFurnished, hasParking: form.hasParking,
        hasGarden: form.hasGarden, hasPool: form.hasPool,
        hasBalcony: form.hasBalcony, hasTerrace: form.hasTerrace,
        hasKitchen: form.hasKitchen, hasBox: form.hasBox,
        hideOwnerName: form.hideOwnerName, virtualTourUrl, images: allImages,
        depositMonths: parseInt(form.depositMonths), advanceMonths: parseInt(form.advanceMonths), agencyFeesMonths: parseInt(form.agencyFeesMonths),
      }

      let pid = propertyId
      if (pid) {
        await authFetch(`/api/properties/${pid}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, status: 'ACTIVE' }), timeout: 120_000,
        })
      } else {
        const res = await authFetch<{ property: { id: string } }>('/api/properties', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload), timeout: 120_000,
        })
        pid = res.property.id; setPropertyId(pid)
      }

      if (pid && newDocuments.length > 0) {
        for (const doc of newDocuments) {
          try {
            const base64 = await fileToBase64(doc.file)
            await authFetch(`/api/properties/${pid}/documents`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: doc.name, type: doc.type, content: base64, description: doc.description || undefined, expiryDate: doc.expiryDate || undefined }),
            })
          } catch { toast.error(`Échec de l'upload du document: ${doc.name}`) }
        }
        setNewDocuments([])
      }

      toast.success('Bien soumis pour vérification ! Un Tiers de Confiance validera votre annonce.')
      onSuccess?.()
    } catch (err) {
      if (err instanceof AuthError) setError(err.message)
      else setError(err instanceof Error ? err.message : "Erreur lors de la publication")
    } finally { setSubmitting(false) }
  }

  // ── Validation for step navigation ─────────────────────────────────────────
  const canGoNext = (): boolean => {
    if (step === 1) {
      if (!form.title.trim()) return false
      if (!form.description.trim()) return false
      if (!form.area || parseFloat(form.area) <= 0) return false
      return true
    }
    if (step === 2) {
      if (!form.price || parseFloat(form.price) <= 0) return false
      return true
    }
    if (step === 3) {
      if (!form.address.trim()) return false
      if (!form.city.trim()) return false
      return true
    }
    return true
  }

  const handleNext = () => { if (canGoNext()) setStep((s) => Math.min(s + 1, 5)) }
  const handlePrev = () => setStep((s) => Math.max(s - 1, 1))

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted rounded-lg animate-pulse" />
        {[1, 2, 3].map((i) => <div key={i} className="h-48 bg-muted rounded-xl animate-pulse" />)}
      </div>
    )
  }

  const totalImages = imagePreviews.length + existingImages.length

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 sm:space-y-6">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => { if (form.title || form.description || form.address || form.city) handleSaveDraft(true); onCancel?.() }} aria-label="Retour" className="shrink-0 size-9">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            {propertyId && existingImages.length > 0 ? 'Modifier le bien' : 'Ajouter un bien'}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Étape {step} sur 5 — {STEPS[step - 1].label}</p>
        </div>
        <AnimatePresence>
          {draftSavedAt && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="flex items-center gap-1.5 text-xs text-emerald-600 shrink-0">
              <CheckCircle2 className="size-3.5" />
              <span className="hidden sm:inline">Brouillon sauvegardé</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Step indicator ──────────────────────────────────────────────── */}
      <div className="overflow-x-auto -mx-4 px-4 scrollbar-none">
        <div className="flex items-center justify-center gap-0 min-w-max sm:min-w-0">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <button
                onClick={() => { if (i < step - 1) setStep(s.id) }}
                className="flex flex-col items-center gap-1 px-1.5 sm:px-3 py-2 rounded-lg transition-colors"
              >
                <span className={cn(
                  'flex size-7 sm:size-9 items-center justify-center rounded-full border-2 transition-colors text-[11px] sm:text-sm font-bold',
                  step === s.id ? 'bg-brand-500 text-white border-brand-500' :
                  i < step - 1 ? 'bg-brand-100 text-brand-600 border-brand-200' :
                  'bg-muted text-muted-foreground border-border'
                )}>
                  {i < step - 1 ? <CheckCircle2 className="size-3 sm:size-5" /> : <span>{i + 1}</span>}
                </span>
                <span className={cn(
                  'text-[8px] sm:text-xs font-medium whitespace-nowrap sm:inline',
                  step === s.id ? 'text-foreground font-semibold' :
                  i < step - 1 ? 'text-brand-600' : 'text-muted-foreground',
                  step === s.id ? 'inline' : 'hidden sm:inline'
                )}>
                  {s.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={cn('w-4 sm:w-12 h-px', i < step - 1 ? 'bg-brand-300' : 'bg-border')} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-lg border bg-red-50 border-red-200 text-red-700 text-sm">
          {error}
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          STEP 1 — Informations générales
         ═══════════════════════════════════════════════════════════════════════ */}
      {step === 1 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-3 sm:pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Home className="size-4 text-brand-500" />
                Informations du bien
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-xs font-medium">Titre de l&apos;annonce <span className="text-red-500">*</span></Label>
                <Input id="title" placeholder="Appartement F3 Cocody..." value={form.title} onChange={(e) => update('title', e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="description" className="text-xs font-medium">Description <span className="text-red-500">*</span></Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs text-brand-600 hover:text-brand-700 hover:bg-brand-50 -mr-2"
                    onClick={handleGenerateDescription}
                    disabled={!form.type || generatingDescription}
                  >
                    {generatingDescription ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="size-3.5" />
                    )}
                    Générer avec l&apos;IA
                  </Button>
                </div>
                <Textarea id="description" placeholder="Décrivez votre bien..." rows={4} value={form.description} onChange={(e) => update('description', e.target.value)} className="text-sm resize-none" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Type de bien</Label>
                <Select value={form.type} onValueChange={(v) => update('type', v)}>
                  <SelectTrigger className="h-9 text-sm w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="APPARTEMENT">Appartement</SelectItem>
                    <SelectItem value="MAISON">Maison</SelectItem>
                    <SelectItem value="STUDIO">Studio</SelectItem>
                    <SelectItem value="CHAMBRE">Chambre</SelectItem>
                    <SelectItem value="DUPLEX">Duplex</SelectItem>
                    <SelectItem value="PENTHOUSE">Penthouse</SelectItem>
                    <SelectItem value="VILLA">Villa</SelectItem>
                    <SelectItem value="CONCESSION">Concession</SelectItem>
                    <SelectItem value="IMMEUBLE">Immeuble</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor="area" className="text-xs font-medium">Surface (m²) <span className="text-red-500">*</span></Label>
                  <Input id="area" type="number" placeholder="85" value={form.area} onChange={(e) => update('area', e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor="bedrooms" className="text-xs font-medium">Pièces</Label>
                  <Input id="bedrooms" type="number" placeholder="2" value={form.bedrooms} onChange={(e) => update('bedrooms', e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <Label htmlFor="bathrooms" className="text-xs font-medium">Salle de Bain</Label>
                  <Input id="bathrooms" type="number" placeholder="1" value={form.bathrooms} onChange={(e) => update('bathrooms', e.target.value)} className="h-9 text-sm" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          STEP 2 — Loyer & Charges
         ═══════════════════════════════════════════════════════════════════════ */}
      {step === 2 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-3 sm:pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="size-4 text-brand-500" />
                Loyer et charges mensuelles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Loyer mensuel <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <input value={form.price} onChange={(e) => update('price', e.target.value)} placeholder="500 000" inputMode="numeric" className="w-full h-11 px-3 pr-14 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">FCFA/mois</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <p className="text-xs font-medium text-muted-foreground">Charges locatives (en mois de loyer)</p>

                <div className="space-y-2 sm:space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg border border-border">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Dépôt de garantie</p>
                      <p className="text-[11px] text-muted-foreground">{form.depositMonths} mois — {safeChargeAmount(form.depositMonths, form.price) ?? '—'} FCFA</p>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button onClick={() => update('depositMonths', String(Math.max(0, parseInt(form.depositMonths) - 1)))} className="size-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors"><Minus className="size-4" /></button>
                      <span className="w-8 text-center text-sm font-semibold tabular-nums">{form.depositMonths}</span>
                      <button onClick={() => update('depositMonths', String(Math.min(12, parseInt(form.depositMonths) + 1)))} className="size-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors"><Plus className="size-4" /></button>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg border border-border">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Avance</p>
                      <p className="text-[11px] text-muted-foreground">{form.advanceMonths} mois — {safeChargeAmount(form.advanceMonths, form.price) ?? '—'} FCFA</p>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button onClick={() => update('advanceMonths', String(Math.max(0, parseInt(form.advanceMonths) - 1)))} className="size-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors"><Minus className="size-4" /></button>
                      <span className="w-8 text-center text-sm font-semibold tabular-nums">{form.advanceMonths}</span>
                      <button onClick={() => update('advanceMonths', String(Math.min(12, parseInt(form.advanceMonths) + 1)))} className="size-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors"><Plus className="size-4" /></button>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg border border-border">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Frais d&apos;agence</p>
                      <p className="text-[11px] text-muted-foreground">{form.agencyFeesMonths} mois — {safeChargeAmount(form.agencyFeesMonths, form.price) ?? '—'} FCFA</p>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button onClick={() => update('agencyFeesMonths', String(Math.max(0, parseInt(form.agencyFeesMonths) - 1)))} className="size-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors"><Minus className="size-4" /></button>
                      <span className="w-8 text-center text-sm font-semibold tabular-nums">{form.agencyFeesMonths}</span>
                      <button onClick={() => update('agencyFeesMonths', String(Math.min(12, parseInt(form.agencyFeesMonths) + 1)))} className="size-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors"><Plus className="size-4" /></button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          STEP 3 — Localisation & Caractéristiques
         ═══════════════════════════════════════════════════════════════════════ */}
      {step === 3 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-3 sm:pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="size-4 text-brand-500" />
                Localisation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="address" className="text-xs font-medium">Adresse <span className="text-red-500">*</span></Label>
                <Input id="address" placeholder="Riviera 3, Cocody" value={form.address} onChange={(e) => update('address', e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="city" className="text-xs font-medium">Ville <span className="text-red-500">*</span></Label>
                  <SearchableSelect
                    options={CITIES.map((c) => ({ value: c.name, label: c.name }))}
                    value={form.city} onChange={(v) => { update('city', v); if (v && getCommunesForCity(v).length > 0) { if (!getCommunesForCity(v).includes(form.commune)) update('commune', '') } else update('commune', '') }}
                    placeholder="Sélectionnez une ville" className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="commune" className="text-xs font-medium">Commune</Label>
                  {form.city && getCommunesForCity(form.city).length > 0 ? (
                    <SearchableSelect
                      options={getCommunesForCity(form.city).map((c) => ({ value: c, label: c }))}
                      value={form.commune} onChange={(v) => update('commune', v)}
                      placeholder="Sélectionnez une commune" className="h-9 text-sm"
                    />
                  ) : (
                    <Input id="commune" placeholder={form.city ? 'Aucune commune' : "Sélectionnez d'abord une ville"} value={form.commune} onChange={(e) => update('commune', e.target.value)} className="h-9 text-sm" disabled />
                  )}
                </div>
              </div>

              <div className="bg-muted/30 rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Navigation className="size-4 text-brand-500" />
                    <span className="text-xs font-semibold text-foreground">Coordonnées GPS</span>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    if (!navigator.geolocation) { toast.error('Géolocalisation non disponible'); return }
                    navigator.geolocation.getCurrentPosition(
                      (position) => { update('latitude', String(position.coords.latitude)); update('longitude', String(position.coords.longitude)); toast.success('Position détectée') },
                      () => toast.error('Impossible de détecter votre position'),
                      { enableHighAccuracy: true, timeout: 10000 }
                    )
                  }} className="h-8 gap-1.5 text-xs border-brand-200 text-brand-600 hover:bg-brand-50">
                    <LocateFixed className="size-3.5" />
                    <span className="hidden sm:inline">Ma position</span>
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-[11px] font-medium text-muted-foreground">Latitude</Label><Input type="number" step="any" placeholder="5.3364" value={form.latitude} onChange={(e) => update('latitude', e.target.value)} className="h-8 text-xs" /></div>
                  <div className="space-y-1"><Label className="text-[11px] font-medium text-muted-foreground">Longitude</Label><Input type="number" step="any" placeholder="-4.0267" value={form.longitude} onChange={(e) => update('longitude', e.target.value)} className="h-8 text-xs" /></div>
                </div>
                <PropertyLocationPicker
                  lat={form.latitude ? parseFloat(form.latitude) : null}
                  lng={form.longitude ? parseFloat(form.longitude) : null}
                  onLocationChange={(lat, lng) => { update('latitude', String(lat)); update('longitude', String(lng)) }}
                  defaultCenter={{ lat: 5.3364, lng: -4.0267 }}
                />
                <p className="text-[10px] text-muted-foreground text-center">Cliquez sur la carte pour positionner le bien</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3 sm:pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="size-4 text-brand-500" />
                Caractéristiques
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: 'isFurnished', label: 'Meublé', desc: 'Le bien est meublé' },
                  { key: 'hasParking', label: 'Parking', desc: 'Place de parking disponible' },
                  { key: 'hasGarden', label: 'Jardin', desc: 'Jardin ou espace vert' },
                  { key: 'hasPool', label: 'Piscine', desc: 'Piscine disponible' },
                  { key: 'hasBalcony', label: 'Balcon', desc: 'Balcon aménagé' },
                  { key: 'hasTerrace', label: 'Terrasse', desc: 'Terrasse extérieure' },
                  { key: 'hasKitchen', label: 'Cuisine équipée', desc: 'Cuisine avec équipements' },
                  { key: 'hasBox', label: 'Box / Débarras', desc: 'Espace de stockage' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                    <div className="mr-3 min-w-0">
                      <Label className="cursor-pointer text-sm">{item.label}</Label>
                      <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch checked={form[item.key as keyof typeof form] as boolean} onCheckedChange={(v) => update(item.key, v)} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          STEP 4 — Photos & Visite
         ═══════════════════════════════════════════════════════════════════════ */}
      {step === 4 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-3 sm:pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <ImagePlus className="size-4 text-brand-500" />
                Photos du bien <span className="text-xs font-normal text-muted-foreground">({totalImages}/10)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label
                htmlFor="property-image-upload"
                className={cn(
                  'border-2 border-dashed rounded-xl p-4 sm:p-6 text-center cursor-pointer transition-colors block',
                  'hover:border-brand-400 hover:bg-brand-50/20',
                  totalImages >= 10 ? 'opacity-50 pointer-events-none' : 'border-border'
                )}
              >
                <Upload className="size-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs sm:text-sm font-medium text-foreground">Cliquez ou glissez vos photos ici</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">JPG, PNG, WEBP — Max 5 Mo — 10 photos max</p>
              </label>
              <input id="property-image-upload" ref={imageInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" multiple className="hidden" onChange={handleImageSelect} />
              {imageError && <p className="text-xs text-red-500">{imageError}</p>}
              {existingImages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {existingImages.map((img, index) => (
                    <div key={`existing-${index}`} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
                      <img src={img.url} alt={`Photo ${index + 1}`} className="size-full object-cover" />
                      <button onClick={() => removeExistingImage(index)} className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"><X className="size-3" /></button>
                      {index === 0 && imagePreviews.length === 0 && <span className="absolute bottom-1 left-1 bg-brand-500 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded">Couverture</span>}
                    </div>
                  ))}
                </div>
              )}
              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {imagePreviews.map((img, index) => (
                    <div key={`new-${index}`} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
                      <img src={img.dataUrl} alt={`Photo ${index + 1}`} className="size-full object-cover" />
                      <button onClick={() => removeImage(index)} className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"><X className="size-3" /></button>
                      {index === 0 && existingImages.length === 0 && <span className="absolute bottom-1 left-1 bg-brand-500 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded">Couverture</span>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3 sm:pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Video className="size-4 text-brand-500" />
                Visite virtuelle 3D
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!videoFile && !existingVideo ? (
                <div onClick={() => videoInputRef.current?.click()} className="border-2 border-dashed border-border rounded-xl p-4 sm:p-6 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50/20 transition-colors"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      videoInputRef.current?.click()
                    }
                  }}
                >
                  <Video className="size-6 sm:size-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs sm:text-sm font-medium text-foreground">Télécharger une vidéo 3D</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">MP4, MOV, WEBM — Max 50 Mo</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl overflow-hidden bg-black aspect-video relative">
                    {videoUploading ? <div className="flex items-center justify-center h-full"><Loader2 className="size-8 animate-spin text-brand-500" /></div>
                      : <video src={videoPreview || undefined} controls className="size-full object-contain" title="Aperçu visite virtuelle">Votre navigateur ne supporte pas la lecture vidéo.</video>}
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted">
                    <div className="flex items-center gap-2 min-w-0">
                      <Video className="size-4 text-brand-500 shrink-0" />
                      <span className="text-xs text-foreground truncate">{videoFile ? videoFile.name : 'Vidéo existante'}</span>
                      {videoFile && <span className="text-[10px] text-muted-foreground shrink-0">({(videoFile.size / (1024 * 1024)).toFixed(1)} Mo)</span>}
                    </div>
                    <Button variant="ghost" size="sm" onClick={removeVideo} className="h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0"><X className="size-3.5" /></Button>
                  </div>
                </div>
              )}
              <input ref={videoInputRef} type="file" accept="video/mp4,video/quicktime,video/x-msvideo,video/webm,video/*" className="hidden" onChange={handleVideoSelect} />
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          STEP 5 — Documents & Publication
         ═══════════════════════════════════════════════════════════════════════ */}
      {step === 5 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-3 sm:pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="size-4 text-brand-500" />
                Documents du bien <span className="text-xs font-normal text-muted-foreground">({existingDocuments.length + newDocuments.length} document{existingDocuments.length + newDocuments.length !== 1 ? 's' : ''})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Existing documents */}
              {existingDocuments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Documents déjà ajoutés</p>
                  {existingDocuments.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <FileText className="size-5 text-brand-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                          <p className="text-[11px] text-muted-foreground">{docTypes.find((t) => t.value === doc.type)?.label || doc.type}{doc.expiryDate && ` — Exp. ${new Date(doc.expiryDate).toLocaleDateString('fr-FR')}`}</p>
                        </div>
                      </div>
                      <button onClick={() => propertyId && deleteExistingDocument(doc.id, propertyId)} className="size-8 flex items-center justify-center rounded-md text-red-500 hover:bg-red-50 transition-colors shrink-0 ml-2"><X className="size-4" /></button>
                    </div>
                  ))}
                </div>
              )}

              {/* New documents */}
              {newDocuments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Nouveaux documents (non sauvegardés)</p>
                  {newDocuments.map((doc, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-amber-50/50">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <FileText className="size-5 text-amber-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                          <p className="text-[11px] text-muted-foreground">{docTypes.find((t) => t.value === doc.type)?.label || doc.type}{doc.expiryDate && ` — Exp. ${new Date(doc.expiryDate).toLocaleDateString('fr-FR')}`}</p>
                        </div>
                      </div>
                      <button onClick={() => removeNewDocument(i)} className="size-8 flex items-center justify-center rounded-md text-red-500 hover:bg-red-50 transition-colors shrink-0 ml-2"><X className="size-4" /></button>
                    </div>
                  ))}
                </div>
              )}

              <Separator />

              {/* Upload document */}
              <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-border cursor-pointer hover:border-brand-400 hover:bg-brand-50/20 transition-colors">
                <Upload className="size-6 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Ajouter un document</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">PDF, JPG, PNG — Max 10 Mo</p>
                <input ref={docInputRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={handleDocFileSelect} />
              </label>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3 sm:pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <EyeOff className="size-4 text-brand-500" />
                Confidentialité
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div className="flex-1 min-w-0 mr-3">
                  <Label className="cursor-pointer text-sm">Masquer mon nom</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Votre nom n&apos;apparaîtra pas sur l&apos;annonce.</p>
                </div>
                <Switch checked={form.hideOwnerName} onCheckedChange={(v) => update('hideOwnerName', v)} />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Navigation & Actions ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        {step > 1 ? (
          <Button variant="outline" onClick={handlePrev} disabled={submitting} className="h-11 gap-2 border-border">
            <ChevronLeft className="size-4" /> Retour
          </Button>
        ) : (
          <Button variant="outline" onClick={() => { if (form.title || form.description || form.address || form.city) handleSaveDraft(true); onCancel?.() }} disabled={submitting} className="h-11 border-border">
            Annuler
          </Button>
        )}

        <div className="flex-1" />

        {step < 5 ? (
          <Button onClick={handleNext} disabled={!canGoNext() || submitting} className={cn('h-11 gap-2', canGoNext() ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : '')}>
            Suivant <ChevronRight className="size-4" />
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => handleSaveDraft(false)} disabled={savingDraft || submitting} className="h-11 gap-2 border-brand-200 text-brand-600 hover:bg-brand-50">
              {savingDraft ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              <span className="truncate">{savingDraft ? 'Sauvegarde...' : 'Brouillon'}</span>
            </Button>
            <Button onClick={handlePublish} disabled={submitting} className="flex-1 h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2">
              {submitting ? <Loader2 className="size-5 animate-spin shrink-0" /> : <PlusCircle className="size-5 shrink-0" />}
              Soumettre pour vérification
            </Button>
          </>
        )}
      </div>
    </motion.div>
  )
}
