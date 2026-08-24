'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  FileSignature, Plus, Building2, User, AlertTriangle, Loader2,
  MoreVertical, Eye, PenLine, Ban, CheckCircle2, Clock, XCircle,
  Archive, Search, ChevronDown, CalendarDays, Shield, Mail,
  Smartphone,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { useRealtimeMandats } from '@/hooks/use-realtime-mandats'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { SignaturePad } from '@/components/ui/signature-pad'

// ─── Types ──────────────────────────────────────────────────────────────────────

type MandatStatus = 'DRAFT' | 'PENDING_SIGNATURE' | 'ACTIVE' | 'TERMINATED' | 'EXPIRED'
type MandatType = 'GESTION_COMPLETE' | 'GESTION_LOCATION' | 'MANDAT_SIMPLE'
type CommissionType = 'PERCENTAGE' | 'FIXED'

interface MandatAgency {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  avatarUrl?: string | null
}

interface MandatProperty {
  id: string
  title: string
  city: string
  address: string
  type: string
  images: Array<{ url: string }>
}

interface MandatItem {
  id: string
  type: MandatType
  status: MandatStatus
  commissionRate: number
  commissionType: CommissionType
  fixedCommission: number | null
  startDate: string
  endDate: string
  conditions: string | null
  ownerSignedAt: string | null
  agencySignedAt: string | null
  terminatedAt: string | null
  terminationReason: string | null
  createdAt: string
  property: MandatProperty
  agency: MandatAgency
}

interface OwnerProperty {
  id: string
  title: string
  city: string
  images: Array<{ url: string }>
}

interface AgencyUser {
  id: string
  firstName: string
  lastName: string
  email: string
  avatarUrl?: string | null
  role: string
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const MANDAT_TYPE_LABELS: Record<MandatType, string> = {
  GESTION_COMPLETE: 'Gestion complète',
  GESTION_LOCATION: 'Gestion location',
  MANDAT_SIMPLE: 'Mandat simple',
}

const MANDAT_TYPE_COLORS: Record<MandatType, string> = {
  GESTION_COMPLETE: 'bg-teal-50 text-teal-700',
  GESTION_LOCATION: 'bg-brand-50 text-brand-700',
  MANDAT_SIMPLE: 'bg-neutral-100 text-neutral-700',
}

const STATUS_LABELS: Record<MandatStatus, string> = {
  DRAFT: 'Brouillon',
  PENDING_SIGNATURE: 'En attente de signature',
  ACTIVE: 'Actif',
  TERMINATED: 'Résilié',
  EXPIRED: 'Expiré',
}

const STATUS_COLORS: Record<MandatStatus, string> = {
  DRAFT: 'bg-amber-100 text-amber-700',
  PENDING_SIGNATURE: 'bg-brand-50 text-brand-600',
  ACTIVE: 'bg-green-100 text-green-700',
  TERMINATED: 'bg-red-50 text-red-600',
  EXPIRED: 'bg-neutral-100 text-neutral-600',
}

const STATUS_ICONS: Record<MandatStatus, React.ElementType> = {
  DRAFT: PenLine,
  PENDING_SIGNATURE: Clock,
  ACTIVE: CheckCircle2,
  TERMINATED: XCircle,
  EXPIRED: Archive,
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function ProprietaireMandats() {
  const { user, isAuthenticated } = useAuthStore()

  // Data
  const [mandats, setMandats] = useState<MandatItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Properties for create form
  const [properties, setProperties] = useState<OwnerProperty[]>([])

  // Agencies for create form
  const [agencies, setAgencies] = useState<AgencyUser[]>([])
  const [agencySearch, setAgencySearch] = useState('')
  const [agencySearchLoading, setAgencySearchLoading] = useState(false)
  const [agencyPopoverOpen, setAgencyPopoverOpen] = useState(false)

  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showSignDialog, setShowSignDialog] = useState(false)
  const [showTerminateDialog, setShowTerminateDialog] = useState(false)
  const [showDetailDialog, setShowDetailDialog] = useState(false)

  // Selected mandat
  const [selectedMandat, setSelectedMandat] = useState<MandatItem | null>(null)

  // Form state
  const [formPropertyId, setFormPropertyId] = useState('')
  const [formAgencyId, setFormAgencyId] = useState('')
  const [formType, setFormType] = useState<MandatType>('GESTION_LOCATION')
  const [formCommissionRate, setFormCommissionRate] = useState('')
  const [formCommissionType, setFormCommissionType] = useState<CommissionType>('PERCENTAGE')
  const [formFixedCommission, setFormFixedCommission] = useState('')
  const [formStartDate, setFormStartDate] = useState('')
  const [formEndDate, setFormEndDate] = useState('')
  const [formConditions, setFormConditions] = useState('')

  // Edit mode
  const [editMode, setEditMode] = useState(false)
  const [editMandatId, setEditMandatId] = useState<string | null>(null)

  // Termination reason
  const [terminationReason, setTerminationReason] = useState('')

  // Loading states
  const [creating, setCreating] = useState(false)
  const [signing, setSigning] = useState(false)
  const [terminating, setTerminating] = useState(false)

  // Signature state
  const [signStep, setSignStep] = useState<'signature' | 'otp' | 'confirm'>('signature')
  const [signatureDataUrl, setSignatureDataUrl] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [sendingOtp, setSendingOtp] = useState(false)
  const [otpSentTo, setOtpSentTo] = useState('')
  const [otpCanal, setOtpCanal] = useState<'MAIL' | 'SMS'>('MAIL')

  // ─── Fetch mandats ──────────────────────────────────────────────────────
  const fetchMandats = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    try {
      const d = await authFetch<{ mandats: MandatItem[] }>('/api/mandats')
      setMandats(d.mandats || [])
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) {
        setMandats([])
        return
      }
      setMandats([])
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  // ─── Fetch owner properties ─────────────────────────────────────────────
  const fetchProperties = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const d = await authFetch<{ properties: OwnerProperty[] }>('/api/properties?mine=true&all=true')
      setProperties(d.properties || [])
    } catch {
      setProperties([])
    }
  }, [isAuthenticated])

  // ─── Search agencies ────────────────────────────────────────────────────
  const searchAgencies = useCallback(async (rawQuery: string) => {
    const query = rawQuery.trim()
    setAgencySearchLoading(true)
    try {
      const url = query.length >= 2
        ? `/api/users?role=AGENCE&q=${encodeURIComponent(query)}`
        : '/api/users?role=AGENCE'
      const d = await authFetch<{ users: AgencyUser[] }>(url)
      setAgencies(d.users || [])
    } catch {
      setAgencies([])
    } finally {
      setAgencySearchLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMandats()
  }, [fetchMandats])

  useRealtimeMandats({
    userId: user?.id,
    onMandatChange: useCallback(() => {
      fetchMandats()
    }, [fetchMandats]),
  })

  useEffect(() => {
    if (showCreateDialog) {
      fetchProperties()
      searchAgencies('')
    }
  }, [showCreateDialog, fetchProperties, searchAgencies])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (agencySearch.length >= 2) {
        searchAgencies(agencySearch)
      }
      // Keep preloaded agencies visible when search < 2 chars
    }, 350)
    return () => clearTimeout(timer)
  }, [agencySearch, searchAgencies])

  // ─── Filters ───────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  // ─── Stats ──────────────────────────────────────────────────────────────
  const stats = {
    all: mandats.length,
    active: mandats.filter((m) => m.status === 'ACTIVE').length,
    pending: mandats.filter((m) => m.status === 'PENDING_SIGNATURE' || m.status === 'DRAFT').length,
    terminated: mandats.filter((m) => m.status === 'TERMINATED' || m.status === 'EXPIRED').length,
  }

  const filteredMandats = mandats.filter((m) => {
    if (statusFilter !== 'ALL' && (
      statusFilter === 'active' ? m.status !== 'ACTIVE' :
      statusFilter === 'pending' ? !['DRAFT', 'PENDING_SIGNATURE'].includes(m.status) :
      statusFilter === 'terminated' ? !['TERMINATED', 'EXPIRED'].includes(m.status) : true
    )) return false
    if (search) {
      const q = search.toLowerCase()
      const propTitle = m.property.title.toLowerCase()
      const agencyName = `${m.agency.firstName} ${m.agency.lastName}`.toLowerCase()
      if (!propTitle.includes(q) && !agencyName.includes(q)) return false
    }
    return true
  })

  const statTabs = [
    { key: 'ALL', label: 'Tous', count: stats.all },
    { key: 'active', label: 'Actifs', count: stats.active },
    { key: 'pending', label: 'En attente', count: stats.pending },
    { key: 'terminated', label: 'Terminés', count: stats.terminated },
  ]

  // ─── Reset form ─────────────────────────────────────────────────────────
  const resetForm = () => {
    setFormPropertyId('')
    setFormAgencyId('')
    setFormType('GESTION_LOCATION')
    setFormCommissionRate('')
    setFormCommissionType('PERCENTAGE')
    setFormFixedCommission('')
    setFormStartDate('')
    setFormEndDate('')
    setFormConditions('')
    setAgencySearch('')
    setAgencies([])
    setEditMode(false)
    setEditMandatId(null)
  }

  // ─── Open create dialog ─────────────────────────────────────────────────
  const openCreateDialog = () => {
    resetForm()
    setShowCreateDialog(true)
  }

  // ─── Open edit dialog ───────────────────────────────────────────────────
  const openEditDialog = (mandat: MandatItem) => {
    setFormPropertyId(mandat.property.id)
    setFormAgencyId(mandat.agency.id)
    setFormType(mandat.type)
    setFormCommissionRate(String(mandat.commissionRate))
    setFormCommissionType(mandat.commissionType || 'PERCENTAGE')
    setFormFixedCommission(mandat.fixedCommission ? String(mandat.fixedCommission) : '')
    setFormStartDate(mandat.startDate ? new Date(mandat.startDate).toISOString().split('T')[0] : '')
    setFormEndDate(mandat.endDate ? new Date(mandat.endDate).toISOString().split('T')[0] : '')
    setFormConditions(mandat.conditions || '')
    setAgencySearch(mandat.agency.email || '')
    setEditMode(true)
    setEditMandatId(mandat.id)
    setShowCreateDialog(true)
  }

  // ─── Create / Update mandat ─────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!formPropertyId || !formAgencyId || !formCommissionRate || !formStartDate || !formEndDate) {
      toast.error('Veuillez remplir tous les champs requis')
      return
    }

    const payload: Record<string, unknown> = {
      propertyId: formPropertyId,
      agencyId: formAgencyId,
      type: formType,
      commissionRate: parseFloat(formCommissionRate),
      commissionType: formCommissionType,
      startDate: formStartDate,
      endDate: formEndDate,
      conditions: formConditions || null,
    }

    if (formCommissionType === 'FIXED' && formFixedCommission) {
      payload.fixedCommission = parseFloat(formFixedCommission)
    }

    setCreating(true)
    try {
      if (editMode && editMandatId) {
        await authFetch(`/api/mandats/${editMandatId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: formType,
            commissionRate: parseFloat(formCommissionRate),
            commissionType: formCommissionType,
            fixedCommission: formCommissionType === 'FIXED' ? parseFloat(formFixedCommission) : null,
            startDate: formStartDate,
            endDate: formEndDate,
            conditions: formConditions || null,
          }),
        })
        toast.success('Mandat modifié avec succès')
      } else {
        await authFetch('/api/mandats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        toast.success('Mandat créé avec succès')
      }
      setShowCreateDialog(false)
      resetForm()
      fetchMandats()
    } catch (err) {
      if (err instanceof AuthError) {
        toast.error(err.message || 'Erreur lors de la création')
      } else {
        toast.error('Erreur lors de la création du mandat')
      }
    } finally {
      setCreating(false)
    }
  }

  // ─── Sign mandat ────────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    if (!selectedMandat) return
    setSendingOtp(true)
    try {
      const res = await authFetch<{ sentTo: string; canal: 'MAIL' | 'SMS' }>(`/api/mandats/${selectedMandat.id}/request-sign-otp`, {
        method: 'POST',
      })
      const canal = res.canal || 'MAIL'
      setOtpCanal(canal)
      setOtpSentTo(res.sentTo || '')
      setSignStep('otp')
      const label = canal === 'SMS' ? 'par SMS' : 'par email'
      toast.success(`Code de vérification envoyé ${label}`)
    } catch (err) {
      if (err instanceof AuthError) {
        toast.error(err.message || 'Erreur lors de l\'envoi du code')
      } else {
        toast.error('Erreur lors de l\'envoi du code de vérification')
      }
    } finally {
      setSendingOtp(false)
    }
  }

  const handleSign = async () => {
    if (!selectedMandat || !signatureDataUrl) return
    setSigning(true)
    try {
      await authFetch(`/api/mandats/${selectedMandat.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'owner', signatureImage: signatureDataUrl, otpCode }),
      })
      toast.success('Mandat signé avec succès')
      setShowSignDialog(false)
      setSelectedMandat(null)
      setSignatureDataUrl('')
      setOtpCode('')
      setSignStep('signature')
      fetchMandats()
    } catch (err) {
      if (err instanceof AuthError) {
        toast.error(err.message || 'Erreur lors de la signature')
      } else {
        toast.error('Erreur lors de la signature du mandat')
      }
    } finally {
      setSigning(false)
    }
  }

  // ─── Terminate mandat ───────────────────────────────────────────────────
  const handleTerminate = async () => {
    if (!selectedMandat) return
    if (!terminationReason.trim()) {
      toast.error('La raison de la résiliation est requise')
      return
    }
    setTerminating(true)
    try {
      await authFetch(`/api/mandats/${selectedMandat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'terminate', terminationReason: terminationReason.trim() }),
      })
      toast.success('Mandat résilié avec succès')
      setShowTerminateDialog(false)
      setSelectedMandat(null)
      setTerminationReason('')
      fetchMandats()
    } catch (err) {
      if (err instanceof AuthError) {
        toast.error(err.message || 'Erreur lors de la résiliation')
      } else {
        toast.error('Erreur lors de la résiliation du mandat')
      }
    } finally {
      setTerminating(false)
    }
  }

  // ─── Loading skeleton ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div><div className="h-8 w-48 bg-muted animate-pulse rounded" /><div className="h-4 w-64 bg-muted animate-pulse rounded mt-2" /></div>
        <div className="flex gap-2">{[1,2,3].map((i) => <div key={i} className="h-9 w-24 bg-muted animate-pulse rounded-lg" />)}</div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  // ─── Error state ────────────────────────────────────────────────────────
  if (error) return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={itemVariants}>
        <div><h1 className="text-xl sm:text-2xl font-bold text-foreground">Mes Mandats</h1><p className="text-muted-foreground mt-1">Impossible de charger les mandats</p></div>
      </motion.div>
      <Card className="border-amber-200 bg-amber-50"><CardContent className="p-4"><p className="text-sm text-amber-700">Impossible de charger. Veuillez réessayer.</p></CardContent></Card>
    </motion.div>
  )

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Mes Mandats</h1>
          <p className="text-muted-foreground mt-1">Gérez vos mandats de gestion avec les agences</p>
        </div>
        <Button
          onClick={openCreateDialog}
          className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">Nouveau mandat</span>
          <span className="sm:hidden">Nouveau</span>
        </Button>
      </motion.div>

      {/* ─── Stats Cards ─────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={cn(
              'p-3 rounded-xl border text-left transition-all',
              statusFilter === tab.key
                ? 'border-brand-500 bg-brand-50 shadow-sm'
                : 'border-border bg-card hover:bg-muted/50'
            )}
          >
            <p className={cn(
              'text-2xl font-bold',
              statusFilter === tab.key ? 'text-brand-600' : 'text-foreground'
            )}>{tab.count}</p>
            <p className={cn(
              'text-xs mt-0.5',
              statusFilter === tab.key ? 'text-brand-600 font-medium' : 'text-muted-foreground'
            )}>{tab.label}</p>
          </button>
        ))}
      </motion.div>

      {/* ─── Filters ──────────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par bien ou agence..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
      </motion.div>

      {/* ─── Status tabs ────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {statTabs.filter(t => t.key !== 'ALL').map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors',
              statusFilter === tab.key
                ? 'bg-brand-500 text-white'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            )}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </motion.div>

      {/* ─── Mandat Cards ────────────────────────────────────────────────── */}
      {filteredMandats.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card className="border-dashed border-border bg-muted/50">
            <CardContent className="py-12 flex flex-col items-center text-center">
              <FileSignature className="size-12 text-muted-foreground/40 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {search
                  ? 'Aucun mandat trouvé'
                  : 'Aucun mandat'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {search
                  ? 'Essayez de modifier vos filtres.'
                  : 'Créez un mandat pour confier la gestion de vos biens à une agence'}
              </p>
              {!search && (
                <Button
                  onClick={openCreateDialog}
                  className="mt-4 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Plus className="size-4" />
                  Créer un mandat
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filteredMandats.map((mandat) => (
              <MandatCard
                key={mandat.id}
                mandat={mandat}
                onSign={() => {
                  setSelectedMandat(mandat)
                  setShowSignDialog(true)
                }}
                onEdit={() => openEditDialog(mandat)}
                onTerminate={() => {
                  setSelectedMandat(mandat)
                  setTerminationReason('')
                  setShowTerminateDialog(true)
                }}
                onViewDetail={() => {
                  setSelectedMandat(mandat)
                  setShowDetailDialog(true)
                }}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ─── Create / Edit Mandat Dialog ─────────────────────────────────── */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        if (!open) resetForm()
        setShowCreateDialog(open)
      }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="size-5 text-brand-500" />
              {editMode ? 'Modifier le mandat' : 'Nouveau mandat'}
            </DialogTitle>
            <DialogDescription>
              {editMode
                ? 'Modifiez les informations du mandat'
                : 'Confiez la gestion de votre bien à une agence'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Property selection */}
            <div className="space-y-2">
              <Label htmlFor="property">Bien immobilier *</Label>
              <Select
                value={formPropertyId}
                onValueChange={setFormPropertyId}
                disabled={editMode}
              >
                <SelectTrigger className="w-full" id="property">
                  <SelectValue placeholder="Sélectionnez un bien" />
                </SelectTrigger>
                <SelectContent>
                  {properties.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      Aucun bien disponible
                    </SelectItem>
                  ) : (
                    properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title} — {p.city}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Agency selection */}
            <div className="space-y-2">
              <Label htmlFor="agency">Agence *</Label>
              <Popover open={agencyPopoverOpen && !editMode} onOpenChange={(open) => {
                if (!open) {
                  setAgencyPopoverOpen(false)
                  setAgencySearch('')
                }
              }}>
                <PopoverTrigger asChild>
                  <Button
                    id="agency"
                    variant="outline"
                    role="combobox"
                    className={cn(
                      'justify-between w-full',
                      !formAgencyId && 'text-muted-foreground',
                      editMode && 'cursor-not-allowed'
                    )}
                    disabled={editMode}
                    onClick={(e) => {
                      e.preventDefault()
                      setAgencyPopoverOpen(true)
                    }}
                  >
                    {formAgencyId ? (
                      (() => {
                        const selected = agencies.find(a => a.id === formAgencyId)
                        return selected
                          ? `${selected.firstName} ${selected.lastName} (${selected.email})`
                          : agencySearch || 'Agence sélectionnée'
                      })()
                    ) : (
                      <span>Rechercher une agence par nom ou email...</span>
                    )}
                    <ChevronDown className="opacity-50" />
                  </Button>
                </PopoverTrigger>
                {agencyPopoverOpen && !editMode && (
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command shouldFilter={false}>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                        <CommandInput
                          placeholder="Rechercher par nom ou email..."
                          className="pl-9"
                          value={agencySearch}
                          onValueChange={(value) => {
                            setAgencySearch(value)
                            setFormAgencyId('')
                          }}
                        />
                        {agencySearchLoading && (
                          <Loader2 className="absolute right-2.5 top-2.5 size-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      <CommandList>
                        {agencies.length === 0 && agencySearch.length < 2 && (
                          <CommandEmpty>Saisissez au moins 2 caractères pour chercher</CommandEmpty>
                        )}
                        {agencies.length === 0 && agencySearch.length >= 2 && (
                          <CommandEmpty>Aucune agence trouvée</CommandEmpty>
                        )}
                        {agencies.length > 0 && (
                          <CommandGroup>
                            {agencies.map((agency) => (
                              <CommandItem
                                key={agency.id}
                                value={agency.id}
                                onSelect={() => {
                                  setFormAgencyId(agency.id)
                                  setAgencySearch(`${agency.firstName} ${agency.lastName} (${agency.email})`)
                                  setAgencyPopoverOpen(false)
                                }}
                              >
                                <Building2 className="mr-2 size-4 shrink-0 text-teal-600" />
                                <div className="flex-1 min-w-0">
                                  <p className="truncate text-sm font-medium">
                                    {agency.firstName} {agency.lastName}
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {agency.email}
                                  </p>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                )}
              </Popover>
              {formAgencyId && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> Agence sélectionnée
                </p>
              )}
            </div>

            {/* Mandat type */}
            <div className="space-y-2">
              <Label htmlFor="mandat-type">Type de mandat *</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v as MandatType)}>
                <SelectTrigger className="w-full" id="mandat-type">
                  <SelectValue placeholder="Sélectionnez le type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GESTION_COMPLETE">Gestion complète</SelectItem>
                  <SelectItem value="GESTION_LOCATION">Gestion location</SelectItem>
                  <SelectItem value="MANDAT_SIMPLE">Mandat simple</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Commission type */}
            <div className="space-y-2">
              <Label htmlFor="commission-type">Type de commission *</Label>
              <Select value={formCommissionType} onValueChange={(v) => setFormCommissionType(v as CommissionType)}>
                <SelectTrigger className="w-full" id="commission-type">
                  <SelectValue placeholder="Sélectionnez le type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENTAGE">Pourcentage</SelectItem>
                  <SelectItem value="FIXED">Montant fixe</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Commission rate / fixed amount */}
            <div className="space-y-2">
              <div className="space-y-2">
                <Label htmlFor="commission-rate">
                  {formCommissionType === 'PERCENTAGE' ? 'Taux (%) *' : 'Taux de référence (%) *'}
                </Label>
                <Input
                  id="commission-rate"
                  type="number"
                  placeholder="ex: 8.5"
                  min="0"
                  max="100"
                  step="0.5"
                  value={formCommissionRate}
                  onChange={(e) => setFormCommissionRate(e.target.value)}
                />
              </div>
              {formCommissionType === 'FIXED' && (
                <div className="space-y-2">
                  <Label htmlFor="fixed-commission">Montant fixe (FCFA)</Label>
                  <Input
                    id="fixed-commission"
                    type="number"
                    placeholder="ex: 50000"
                    min="0"
                    value={formFixedCommission}
                    onChange={(e) => setFormFixedCommission(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="start-date">Date de début *</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">Date de fin *</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Conditions */}
            <div className="space-y-2">
              <Label htmlFor="conditions">Conditions particulières</Label>
              <Textarea
                id="conditions"
                placeholder="Conditions spécifiques du mandat (optionnel)..."
                value={formConditions}
                onChange={(e) => setFormConditions(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false)
                resetForm()
              }}
              disabled={creating}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={creating || !formPropertyId || !formAgencyId || !formCommissionRate || !formStartDate || !formEndDate}
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {creating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {editMode ? 'Modification...' : 'Création...'}
                </>
              ) : (
                editMode ? 'Enregistrer' : 'Créer le mandat'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Sign Mandat Dialog ──────────────────────────────────────────── */}
      <Dialog open={showSignDialog} onOpenChange={(open) => {
        if (!open) {
          setSelectedMandat(null)
          setSignatureDataUrl('')
          setOtpCode('')
          setSignStep('signature')
          setOtpSentTo('')
          setOtpCanal('MAIL')
        }
        setShowSignDialog(open)
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="size-5 text-brand-500" />
              Signer le mandat
            </DialogTitle>
            <DialogDescription className="pt-2">
              Vous êtes sur le point de signer électroniquement le mandat pour
              <span className="font-semibold text-foreground"> {selectedMandat?.property?.title}</span> avec l&apos;agence
              <span className="font-semibold text-foreground"> {selectedMandat?.agency?.firstName} {selectedMandat?.agency?.lastName}</span>.
            </DialogDescription>
          </DialogHeader>

          {selectedMandat?.agencySignedAt && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-100">
              <p className="text-xs text-green-700 flex items-center gap-1">
                <CheckCircle2 className="size-3.5" />
                L&apos;agence a déjà signé ce mandat. Votre signature l&apos;activera immédiatement.
              </p>
            </div>
          )}

          {signStep === 'signature' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-brand-50 border border-brand-100">
                <p className="text-xs text-brand-700">
                  En signant ce mandat, vous autorisez l&apos;agence à gérer votre bien selon les conditions définies. Votre signature électronique a la même valeur légale qu&apos;une signature manuscrite.
                </p>
              </div>
              <SignaturePad
                onConfirm={(dataUrl) => {
                  setSignatureDataUrl(dataUrl)
                  setSignStep('confirm')
                }}
                onCancel={() => {
                  setShowSignDialog(false)
                  setSelectedMandat(null)
                }}
                signatoryName={user ? `${user.firstName} ${user.lastName}` : undefined}
                signatoryRole="Propriétaire"
              />
            </div>
          )}

          {signStep === 'confirm' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-xs text-muted-foreground mb-2">Signature apposée :</p>
                <img src={signatureDataUrl} alt="Signature" className="max-h-16 rounded border bg-white" />
              </div>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                <p className="text-xs text-amber-700 flex items-center gap-1">
                  <Shield className="size-3.5" />
                  Vous allez recevoir un code de vérification {otpCanal === 'SMS' ? 'par SMS' : 'par email'} pour valider votre signature via CRYPTONEO.
                </p>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSignatureDataUrl('')
                    setSignStep('signature')
                  }}
                  disabled={sendingOtp}
                >
                  Modifier la signature
                </Button>
                <Button
                  onClick={handleSendOtp}
                  disabled={sendingOtp}
                  className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {sendingOtp ? (
                    <><Loader2 className="size-4 animate-spin" /> Envoi...</>
                  ) : (
                    <><Mail className="size-4" /> Envoyer le code de vérification</>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}

          {signStep === 'otp' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-xs text-muted-foreground mb-2">Signature apposée :</p>
                <img src={signatureDataUrl} alt="Signature" className="max-h-16 rounded border bg-white" />
              </div>
              <div className="p-3 rounded-lg bg-green-50 border border-green-100">
                <p className="text-xs text-green-700 flex items-center gap-1">
                  {otpCanal === 'SMS' ? <Smartphone className="size-3.5" /> : <Mail className="size-3.5" />}
                  Un code vous a été envoyé {otpCanal === 'SMS' ? 'par SMS' : `à ${otpSentTo || 'votre adresse email'}`}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="otp">Code de vérification reçu {otpCanal === 'SMS' ? 'par SMS' : 'par email'}</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder={otpCanal === 'SMS' ? 'Entrez le code reçu par SMS' : 'Entrez le code reçu par email'}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  maxLength={10}
                  className="text-center text-lg tracking-widest"
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={() => {
                    setOtpCode('')
                    setOtpSentTo('')
                    setSignStep('signature')
                    setSignatureDataUrl('')
                  }}
                  disabled={signing}
                >
                  Annuler
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={handleSendOtp}
                    disabled={sendingOtp}
                    size="sm"
                  >
                    {sendingOtp ? 'Envoi...' : 'Renvoyer'}
                  </Button>
                  <Button
                    onClick={handleSign}
                    disabled={signing || !otpCode}
                    className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {signing ? (
                      <><Loader2 className="size-4 animate-spin" /> Signature...</>
                    ) : (
                      <><Shield className="size-4" /> Valider et signer</>
                    )}
                  </Button>
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Terminate Mandat Dialog ─────────────────────────────────────── */}
      <Dialog open={showTerminateDialog} onOpenChange={setShowTerminateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-500" />
              Résilier le mandat
            </DialogTitle>
            <DialogDescription className="pt-2">
              Êtes-vous sûr de vouloir résilier le mandat pour
              <span className="font-semibold text-foreground"> {selectedMandat?.property?.title}</span> ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3 rounded-lg bg-red-50 border border-red-100 my-2">
            <p className="text-xs text-red-700">
              En résiliant ce mandat, vous mettez fin au contrat de gestion avec l&apos;agence. Les obligations en cours restent dues selon les conditions du mandat.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="termination-reason">Raison de la résiliation *</Label>
            <Textarea
              id="termination-reason"
              placeholder="Expliquez la raison de la résiliation..."
              value={terminationReason}
              onChange={(e) => setTerminationReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowTerminateDialog(false)
                setSelectedMandat(null)
                setTerminationReason('')
              }}
              disabled={terminating}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleTerminate}
              disabled={terminating || !terminationReason.trim()}
              className="gap-2"
            >
              {terminating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Résiliation...
                </>
              ) : (
                <>
                  <AlertTriangle className="size-4" />
                  Confirmer la résiliation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Mandat Detail Dialog ─────────────────────────────────────────── */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="size-5 text-brand-500" />
              Détails du mandat
            </DialogTitle>
            <DialogDescription>
              Mandat pour {selectedMandat?.property?.title}
            </DialogDescription>
          </DialogHeader>

          {selectedMandat && (
            <div className="space-y-4 py-2">
              {/* Property & Agency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <div className="size-10 rounded-lg overflow-hidden shrink-0">
                    {selectedMandat.property.images?.[0]?.url ? (
                      <img
                        src={selectedMandat.property.images[0].url}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="size-full flex items-center justify-center bg-brand-50">
                        <Building2 className="size-4 text-brand-500" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{selectedMandat.property.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{selectedMandat.property.city}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <div className="size-10 rounded-full bg-teal-50 flex items-center justify-center shrink-0">
                    <Building2 className="size-5 text-teal-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {selectedMandat.agency.firstName} {selectedMandat.agency.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{selectedMandat.agency.email}</p>
                  </div>
                </div>
              </div>

              {/* Type & Status */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={MANDAT_TYPE_COLORS[selectedMandat.type]}>
                  {MANDAT_TYPE_LABELS[selectedMandat.type]}
                </Badge>
                <Badge className={STATUS_COLORS[selectedMandat.status]}>
                  {STATUS_LABELS[selectedMandat.status]}
                </Badge>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-muted">
                <div>
                  <p className="text-xs text-muted-foreground">Commission</p>
                  <p className="text-sm font-semibold">
                    {selectedMandat.commissionType === 'FIXED' && selectedMandat.fixedCommission
                      ? `${selectedMandat.fixedCommission.toLocaleString('fr-FR')} FCFA`
                      : `${selectedMandat.commissionRate}%`}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Type de commission</p>
                  <p className="text-sm font-semibold">
                    {selectedMandat.commissionType === 'FIXED' ? 'Montant fixe' : 'Pourcentage'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Début</p>
                  <p className="text-sm font-semibold">
                    {new Date(selectedMandat.startDate).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fin</p>
                  <p className="text-sm font-semibold">
                    {new Date(selectedMandat.endDate).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>

              {/* Signatures status */}
              <div className="p-3 rounded-lg border border-border">
                <p className="text-xs font-medium text-muted-foreground mb-2">État des signatures</p>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-sm">Votre signature</span>
                    {selectedMandat.ownerSignedAt ? (
                      <Badge className="bg-green-100 text-green-700 gap-1">
                        <CheckCircle2 className="size-3" /> Signé le {new Date(selectedMandat.ownerSignedAt).toLocaleDateString('fr-FR')}
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 gap-1">
                        <Clock className="size-3" /> En attente
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-sm">Signature agence</span>
                    {selectedMandat.agencySignedAt ? (
                      <Badge className="bg-green-100 text-green-700 gap-1">
                        <CheckCircle2 className="size-3" /> Signé le {new Date(selectedMandat.agencySignedAt).toLocaleDateString('fr-FR')}
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 gap-1">
                        <Clock className="size-3" /> En attente
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Conditions */}
              {selectedMandat.conditions && (
                <div className="p-3 rounded-lg border border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Conditions particulières</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{selectedMandat.conditions}</p>
                </div>
              )}

              {/* Termination info */}
              {selectedMandat.status === 'TERMINATED' && selectedMandat.terminationReason && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-100">
                  <p className="text-xs font-medium text-red-700 mb-1">Raison de la résiliation</p>
                  <p className="text-sm text-red-600">{selectedMandat.terminationReason}</p>
                  {selectedMandat.terminatedAt && (
                    <p className="text-xs text-red-500 mt-1">
                      Résilié le {new Date(selectedMandat.terminatedAt).toLocaleDateString('fr-FR')}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

// ─── Mandat Card Sub-component ─────────────────────────────────────────────────

function MandatCard({
  mandat,
  onSign,
  onEdit,
  onTerminate,
  onViewDetail,
}: {
  mandat: MandatItem
  onSign: () => void
  onEdit: () => void
  onTerminate: () => void
  onViewDetail: () => void
}) {
  const StatusIcon = STATUS_ICONS[mandat.status]

  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, y: -10 }}
      layout
    >
      <Card
        className="border-border hover:shadow-md transition-shadow cursor-pointer"
        onClick={onViewDetail}
      >
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-4">
            {/* Property thumbnail */}
            <div className="hidden sm:flex size-14 rounded-lg bg-muted overflow-hidden shrink-0">
              {mandat.property.images?.[0]?.url ? (
                <img src={mandat.property.images[0].url} alt="" className="size-full object-cover" />
              ) : (
                <div className="size-full flex items-center justify-center">
                  <Building2 className="size-6 text-muted-foreground/40" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              {/* Top row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{mandat.property.title}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Building2 className="size-3" />
                    {mandat.agency.firstName} {mandat.agency.lastName}
                  </p>
                </div>
                <Badge className={cn('shrink-0 text-xs w-fit', STATUS_COLORS[mandat.status])}>
                  <StatusIcon className="size-3 mr-1" />
                  {STATUS_LABELS[mandat.status]}
                </Badge>
              </div>

              {/* Info rows */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <FileSignature className="size-3.5 shrink-0" />
                  <span>{MANDAT_TYPE_LABELS[mandat.type]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="size-3.5 shrink-0" />
                  <span>
                    {mandat.commissionType === 'FIXED' && mandat.fixedCommission
                      ? `${mandat.fixedCommission.toLocaleString('fr-FR')} FCFA`
                      : `${mandat.commissionRate}%`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="size-3.5 shrink-0" />
                  <span>{new Date(mandat.startDate).toLocaleDateString('fr-FR')} → {new Date(mandat.endDate).toLocaleDateString('fr-FR')}</span>
                </div>
              </div>

              {/* Quick actions */}
              <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {(mandat.status === 'DRAFT' || (mandat.status === 'PENDING_SIGNATURE' && !mandat.ownerSignedAt)) && (
                  <Button
                    size="sm"
                    onClick={onSign}
                    className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground gap-1"
                  >
                    <FileSignature className="size-3.5" />
                    <span className="hidden lg:inline">Signer</span>
                  </Button>
                )}
                {mandat.status === 'DRAFT' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onEdit}
                    className="h-8 gap-1"
                  >
                    <PenLine className="size-3.5" />
                    <span className="hidden lg:inline">Modifier</span>
                  </Button>
                )}
                {(mandat.status === 'ACTIVE' || mandat.status === 'PENDING_SIGNATURE') && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-red-200 text-red-600 hover:bg-red-50 gap-1"
                    onClick={onTerminate}
                  >
                    <Ban className="size-3.5" />
                    <span className="hidden lg:inline">Résilier</span>
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={onViewDetail}>
                  <Eye className="size-3.5" />
                  <span className="hidden lg:inline">Détails</span>
                </Button>
              </div>

              {/* Termination reason for TERMINATED */}
              {mandat.status === 'TERMINATED' && mandat.terminationReason && (
                <div className="mt-3 p-2.5 rounded-lg bg-red-50 border border-red-100">
                  <p className="text-xs text-red-600">
                    <span className="font-medium">Raison :</span> {mandat.terminationReason}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
