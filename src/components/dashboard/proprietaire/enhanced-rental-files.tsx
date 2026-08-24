'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ClipboardCheck,
  FileText,
  CheckCircle2,
  XCircle,
  MessageSquare,
  ChevronDown,
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Shield,
  CreditCard,
  AlertTriangle,
  Eye,
  ArrowLeft,
  Trash2,
  Search,
  Home,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { useRealtimeRentalFiles } from '@/hooks/use-realtime-rental-files'
import { QuickContactDialog } from '@/components/messaging/quick-contact-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

// ─── Types ──────────────────────────────────────────────────────────────────
interface TenantInfo {
  id: string
  firstName: string
  lastName: string
  phone: string | null
  email: string
  avatarUrl: string | null
  gender: string | null
  city: string | null
  address: string | null
  birthDate: string | null
  createdAt: string
}

interface DocumentInfo {
  id: string
  type: string
  name: string
  status: string
  tcComment: string | null
  createdAt: string
}

interface PropertyInfo {
  id: string
  title: string
  city: string
  address: string
  price: number
  rentalTerms: string
}

interface LeaseInfo {
  id: string
  status?: string
  ownerSignedAt?: string | null
  tenantSignedAt?: string | null
  property: PropertyInfo & { images: Array<{ url: string }> }
}

interface OtherFileInfo {
  id: string
  status: string
  createdAt: string
  tenantCategory: string | null
  leases: Array<{ property: { title: string; city: string } }>
}

interface RentalFileItem {
  id: string
  status: string
  tenantCategory: string | null
  monthlyIncome: number | null
  employer: string | null
  employmentType: string | null
  guarantorName: string | null
  guarantorPhone: string | null
  guarantorRelation: string | null
  rejectionReason: string | null
  createdAt: string
  updatedAt: string
  tenant: TenantInfo
  documents: DocumentInfo[]
  leases: LeaseInfo[]
  tenantPaymentScore: number | null
  tenantTrustScore: number
  tenantOtherFiles: OtherFileInfo[]
}

interface OwnerRentalFilesResponse {
  data: RentalFileItem[]
  stats: Record<string, number>
  properties: Array<{ id: string; title: string; city: string; address: string }>
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'DRAFT': return 'Brouillon'
    case 'SUBMITTED': return 'Soumis'
    case 'ACCEPTED': return 'Accepté'
    case 'VALIDATED': return 'Validé'
    case 'REJECTED': return 'Refusé'
    case 'EXPIRED': return 'Expiré'
    default: return status
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'ACCEPTED': return 'bg-emerald-100 text-emerald-700'
    case 'VALIDATED': return 'bg-blue-100 text-blue-700'
    case 'SUBMITTED': return 'bg-amber-100 text-amber-700'
    case 'REJECTED': return 'bg-red-100 text-red-700'
    case 'EXPIRED': return 'bg-neutral-100 text-neutral-600'
    case 'DRAFT': return 'bg-neutral-100 text-neutral-600'
    default: return 'bg-neutral-100 text-neutral-600'
  }
}

function getCategoryLabel(cat: string | null): string {
  switch (cat) {
    case 'SALARIE': return 'Salarié'
    case 'ENTREPRENEUR': return 'Entrepreneur'
    case 'ETUDIANT': return 'Étudiant'
    default: return 'Non renseigné'
  }
}

function getCategoryColor(cat: string | null): string {
  switch (cat) {
    case 'SALARIE': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'ENTREPRENEUR': return 'bg-brand-50 text-brand-700 border-brand-200'
    case 'ETUDIANT': return 'bg-sky-50 text-sky-700 border-sky-200'
    default: return 'bg-neutral-50 text-neutral-600 border-neutral-200'
  }
}

function getDocStatusLabel(status: string): string {
  switch (status) {
    case 'VALIDATED': return 'Validé'
    case 'REJECTED': return 'Refusé'
    case 'PENDING': return 'En attente'
    default: return status
  }
}

function getDocStatusColor(status: string): string {
  switch (status) {
    case 'VALIDATED': return 'text-emerald-600'
    case 'REJECTED': return 'text-red-600'
    case 'PENDING': return 'text-amber-600'
    default: return 'text-neutral-500'
  }
}

type TabType = 'pending' | 'validated' | 'rejected' | 'all'

// ─── Animation Variants ────────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

// ─── Main Component ─────────────────────────────────────────────────────────
export function EnhancedRentalFiles() {
  const { user, isAuthenticated, dashboardSection, setDashboardSection } = useAuthStore()
  const [data, setData] = useState<RentalFileItem[]>([])
  const [properties, setProperties] = useState<Array<{ id: string; title: string; city: string; address: string }>>([])
  const [stats, setStats] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('pending')
  const [propertyFilter, setPropertyFilter] = useState<string>('all')

  // Accept/Reject dialog state
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [selectedFileId, setSelectedFileId] = useState<string>('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Lease terms form
  const todayStr = new Date().toISOString().split('T')[0]
  const defaultEndDate = new Date()
  defaultEndDate.setFullYear(defaultEndDate.getFullYear() + 3) // bail 3 ans par défaut
  const defaultEndStr = defaultEndDate.toISOString().split('T')[0]

  const [leaseTerms, setLeaseTerms] = useState({
    monthlyRent: '',
    charges: '',
    deposit: '',
    startDate: todayStr,
    endDate: defaultEndStr,
    specialConditions: '',
  })
  const [termsErrors, setTermsErrors] = useState<Record<string, string>>({})

  // Pre-fill lease terms from property data when accept dialog opens
  useEffect(() => {
    if (!acceptDialogOpen) return
    const rf = data.find(r => r.id === selectedFileId)
    const prop = rf?.leases[0]?.property
    const propPrice = prop?.price || 0
    let deposit = ''
    if (prop?.rentalTerms) {
      try {
        const terms = JSON.parse(prop.rentalTerms)
        const depositMonths = terms.depositMonths ?? 2
        deposit = String(Math.round(propPrice * depositMonths))
      } catch { /* ignore parse errors */ }
    }
    const newToday = new Date().toISOString().split('T')[0]
    const newEnd = new Date()
    newEnd.setFullYear(newEnd.getFullYear() + 3)
    setLeaseTerms({
      monthlyRent: propPrice ? String(propPrice) : '',
      charges: '',
      deposit,
      startDate: newToday,
      endDate: newEnd.toISOString().split('T')[0],
      specialConditions: '',
    })
  }, [acceptDialogOpen, selectedFileId, data])

  // Tenant profile dialog state
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState<RentalFileItem | null>(null)
  const [search, setSearch] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const fetchData = useCallback(async (skipCache = false) => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    try {
      const d = await authFetch<OwnerRentalFilesResponse>('/api/owner/rental-files', skipCache ? { skipCache: true } : undefined)
      setData(d.data || [])
      setStats(d.stats || {})
      setProperties(d.properties || [])
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) {
        setData([])
        return
      }
      setData([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Derive watched tenant IDs from existing data for Realtime filtering
  const watchedTenantIds = [...new Set(data.map((rf) => rf.tenant?.id).filter(Boolean))] as string[]

  // Realtime subscription for rental files
  useRealtimeRentalFiles({
    userId: user?.id,
    watchedTenantIds,
    onRentalFileChange: () => {
      fetchData(true)
    },
  })

  // Auto-switch to first non-empty tab after data loads (defined before use below)
  useEffect(() => {
    if (!loading && data.length > 0) {
      const pCount = stats['SUBMITTED'] || 0
      const vCount = stats['VALIDATED'] || 0
      const rCount = stats['REJECTED'] || 0
      if (activeTab === 'pending' && pCount === 0) {
        if (vCount > 0) setActiveTab('validated')
        else if (rCount > 0) setActiveTab('rejected')
        else setActiveTab('all')
      }
    }
  }, [loading, data.length, stats, activeTab])

  // ─── Filter logic ────────────────────────────────────────────────────────
  const filteredData = data.filter((rf) => {
    // Status filter
    if (activeTab === 'pending' && rf.status !== 'SUBMITTED') return false
    if (activeTab === 'validated' && rf.status !== 'VALIDATED') return false
    if (activeTab === 'rejected' && rf.status !== 'REJECTED') return false

    // Property filter
    if (propertyFilter !== 'all') {
      const hasProperty = rf.leases.some((l) => l.property.id === propertyFilter)
      if (!hasProperty) return false
    }

    return true
  })

  // ─── Accept handler ──────────────────────────────────────────────────────
  const handleAccept = async () => {
    // Validate form
    const errors: Record<string, string> = {}
    if (!leaseTerms.monthlyRent || parseFloat(leaseTerms.monthlyRent) <= 0) {
      errors.monthlyRent = 'Le loyer mensuel est requis et doit être supérieur à 0'
    }
    if (!leaseTerms.startDate) {
      errors.startDate = 'La date de début est requise'
    }
    if (!leaseTerms.endDate) {
      errors.endDate = 'La date de fin est requise'
    }
    if (leaseTerms.startDate && leaseTerms.endDate && new Date(leaseTerms.endDate) <= new Date(leaseTerms.startDate)) {
      errors.endDate = 'La date de fin doit être postérieure à la date de début'
    }
    setTermsErrors(errors)
    if (Object.keys(errors).length > 0) return

    setActionLoading(true)
    try {
      const res = await authFetch<{ data: { leaseId: string } }>(`/api/rental-files/${selectedFileId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accept',
          monthlyRent: parseFloat(leaseTerms.monthlyRent),
          charges: leaseTerms.charges ? parseFloat(leaseTerms.charges) : 0,
          deposit: leaseTerms.deposit ? parseFloat(leaseTerms.deposit) : 0,
          startDate: leaseTerms.startDate,
          endDate: leaseTerms.endDate,
          specialConditions: leaseTerms.specialConditions || undefined,
        }),
      })
      toast.success('Candidature acceptée ! Le bail est en attente de signature.')
      setAcceptDialogOpen(false)
      setLeaseTerms({ monthlyRent: '', charges: '', deposit: '', startDate: '', endDate: '', specialConditions: '' })
      setTermsErrors({})
      setDashboardSection('my-leases')
    } catch (err) {
      if (err instanceof AuthError) {
        toast.error(err.message || 'Erreur lors de l\'acceptation')
      } else {
        toast.error('Erreur lors de l\'acceptation')
      }
    } finally {
      setActionLoading(false)
    }
  }

  // ─── Reject handler ──────────────────────────────────────────────────────
  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Veuillez fournir une raison de refus')
      return
    }
    setActionLoading(true)
    try {
      await authFetch(`/api/rental-files/${selectedFileId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', rejectionReason: rejectionReason.trim() }),
      })
      toast.success('Dossier refusé')
      setRejectDialogOpen(false)
      setRejectionReason('')
      fetchData()
    } catch (err) {
      if (err instanceof AuthError) {
        toast.error(err.message || 'Erreur lors du refus')
      } else {
        toast.error('Erreur lors du refus')
      }
    } finally {
      setActionLoading(false)
    }
  }

  // ─── Delete lease handler ─────────────────────────────────────────────────
  const handleDeleteLease = async (leaseId: string) => {
    setDeleteConfirmId(leaseId)
  }

  const confirmDeleteLease = async () => {
    if (!deleteConfirmId) return
    try {
      await authFetch(`/api/leases/${deleteConfirmId}`, { method: 'DELETE' })
      toast.success('Bail supprimé')
      setDeleteConfirmId(null)
      fetchData()
    } catch (err) {
      if (err instanceof AuthError) {
        toast.error(err.message || 'Erreur lors de la suppression')
      } else {
        toast.error('Erreur lors de la suppression')
      }
    }
  }

  // ─── Loading skeleton ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-64 bg-muted animate-pulse rounded mt-2" />
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 w-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  const pendingCount = (stats['SUBMITTED'] || 0)
  const validatedCount = stats['VALIDATED'] || 0
  const rejectedCount = stats['REJECTED'] || 0
  const totalCount = Object.values(stats).reduce((a, b) => a + b, 0)

  const isCandidatures = dashboardSection === 'candidatures'
  const pageTitle = isCandidatures ? 'Mes candidatures' : 'Dossiers locatifs'
  const pageDesc = isCandidatures
    ? 'Consultez et gérez les candidatures soumises pour vos biens'
    : 'Gérez les candidatures de location pour vos biens'

  const tabs: Array<{ key: TabType; label: string; count: number }> = [
    { key: 'pending', label: 'En attente', count: pendingCount },
    { key: 'validated', label: 'Validés', count: validatedCount },
    { key: 'rejected', label: 'Refusés', count: rejectedCount },
    { key: 'all', label: 'Tous', count: totalCount },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">{pageTitle}</h1>
        <p className="text-muted-foreground mt-1">{pageDesc}</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'p-3 rounded-xl border text-left transition-all',
              activeTab === tab.key
                ? 'border-brand-500 bg-brand-50 shadow-sm'
                : 'border-border bg-card hover:bg-muted/50'
            )}
          >
            <p className={cn(
              'text-2xl font-bold',
              activeTab === tab.key ? 'text-brand-600' : 'text-foreground'
            )}>{tab.count}</p>
            <p className={cn(
              'text-xs mt-0.5',
              activeTab === tab.key ? 'text-brand-600 font-medium' : 'text-muted-foreground'
            )}>{tab.label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par locataire ou bien..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        {properties.length > 1 && (
          <Select value={propertyFilter} onValueChange={setPropertyFilter}>
            <SelectTrigger className="w-full sm:w-[220px] h-10">
              <Building2 className="size-4 mr-2 shrink-0" />
              <SelectValue placeholder="Tous les biens" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les biens</SelectItem>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors',
              activeTab === tab.key
                ? 'bg-brand-500 text-white'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            )}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Files List */}
      <AnimatePresence mode="wait">
        {(search ? (() => {
          const q = search.toLowerCase()
          return filteredData.filter((rf) => {
            if (!search) return true
            const name = `${rf.tenant.firstName} ${rf.tenant.lastName}`.toLowerCase()
            const propTitle = rf.leases[0]?.property?.title?.toLowerCase() || ''
            return name.includes(q) || propTitle.includes(q)
          })
        })() : filteredData).length === 0 ? (
          <motion.div key="empty" variants={itemVariants} initial="hidden" animate="show" exit="hidden">
            <Card className="border-dashed border-border bg-muted/50">
              <CardContent className="py-12 flex flex-col items-center text-center">
                <div className="flex size-16 items-center justify-center rounded-full bg-amber-50 mb-4">
                  <ClipboardCheck className="size-7 text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  {search || propertyFilter !== 'all'
                    ? 'Aucun dossier trouvé'
                    : activeTab === 'pending'
                      ? 'Aucun dossier en attente'
                      : activeTab === 'validated'
                        ? 'Aucun dossier validé'
                        : activeTab === 'rejected'
                          ? 'Aucun dossier refusé'
                          : 'Aucun dossier locatif'}
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {search || propertyFilter !== 'all'
                    ? 'Essayez de modifier vos filtres.'
                    : activeTab === 'pending'
                      ? 'Les nouvelles candidatures apparaîtront ici.'
                      : 'Aucun dossier dans cette catégorie.'}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div key={activeTab} variants={containerVariants} initial="hidden" animate="show" className="space-y-3">
            {(search ? (() => {
              const q = search.toLowerCase()
              return filteredData.filter((rf) => {
                if (!search) return true
                const name = `${rf.tenant.firstName} ${rf.tenant.lastName}`.toLowerCase()
                const propTitle = rf.leases[0]?.property?.title?.toLowerCase() || ''
                return name.includes(q) || propTitle.includes(q)
              })
            })() : filteredData).map((rf) => (
              <motion.div key={rf.id} variants={itemVariants}>
                <Card
                  className="border-border hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    setSelectedTenant(rf)
                    setProfileDialogOpen(true)
                  }}
                >
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start gap-4">
                      {/* Property thumbnail */}
                      <div className="hidden sm:flex size-14 rounded-lg bg-muted overflow-hidden shrink-0">
                        {rf.leases[0]?.property?.images?.[0]?.url ? (
                          <img src={rf.leases[0].property.images[0].url} alt="" className="size-full object-cover" />
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
                            <h3 className="font-semibold text-foreground truncate">
                              {rf.tenant.firstName} {rf.tenant.lastName}
                            </h3>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <MapPin className="size-3" />
                              {rf.leases[0]?.property?.title || 'Bien non spécifié'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 border', getCategoryColor(rf.tenantCategory))}>
                              {getCategoryLabel(rf.tenantCategory)}
                            </Badge>
                            <Badge className={cn('shrink-0 text-xs w-fit', getStatusColor(rf.status))}>
                              {getStatusLabel(rf.status)}
                            </Badge>
                          </div>
                        </div>

                        {/* Info rows */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-muted-foreground">
                          {rf.monthlyIncome && (
                            <div className="flex items-center gap-2">
                              <CreditCard className="size-3.5 shrink-0" />
                              <span>{rf.monthlyIncome.toLocaleString('fr-FR')} FCFA/mois</span>
                            </div>
                          )}
                          {rf.employer && (
                            <div className="flex items-center gap-2">
                              <Building2 className="size-3.5 shrink-0" />
                              <span className="truncate">{rf.employer}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Calendar className="size-3.5 shrink-0" />
                            <span>Soumis le {formatDate(rf.createdAt)}</span>
                          </div>
                        </div>

                        {/* Quick actions */}
                        <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {rf.status === 'VALIDATED' && !rf.leases.some(l => l.id) && (
                            <>
                              <Button
                                size="sm"
                                className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                                onClick={() => { setSelectedFileId(rf.id); setAcceptDialogOpen(true) }}
                              >
                                <CheckCircle2 className="size-3.5" />
                                <span className="hidden lg:inline">Accepter</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 border-red-200 text-red-600 hover:bg-red-50 gap-1"
                                onClick={() => { setSelectedFileId(rf.id); setRejectDialogOpen(true) }}
                              >
                                <XCircle className="size-3.5" />
                                <span className="hidden lg:inline">Refuser</span>
                              </Button>
                            </>
                          )}
                          {rf.leases.some(l => l.id && !l.ownerSignedAt && !l.tenantSignedAt) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 border-red-200 text-red-600 hover:bg-red-50 gap-1"
                              onClick={() => {
                                const unsignedLease = rf.leases.find(l => !l.ownerSignedAt && !l.tenantSignedAt)
                                if (unsignedLease) handleDeleteLease(unsignedLease.id)
                              }}
                            >
                              <Trash2 className="size-3.5" />
                              <span className="hidden lg:inline">Supprimer le bail</span>
                            </Button>
                          )}
                          <QuickContactDialog
                            recipientId={rf.tenant.id}
                            recipientName={`${rf.tenant.firstName} ${rf.tenant.lastName}`}
                            propertyId={rf.leases[0]?.property?.id}
                            onSent={() => setDashboardSection('messages')}
                            trigger={
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 gap-1 text-muted-foreground hover:text-foreground"
                              >
                                <MessageSquare className="size-3.5" />
                                <span className="hidden lg:inline">Contacter</span>
                              </Button>
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Accept Dialog with Lease Terms ───────────────────────────────── */}
      <Dialog open={acceptDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setTermsErrors({})
          setAcceptDialogOpen(false)
          return
        }
        return
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-600" />
              Accepter la candidature
            </DialogTitle>
            <DialogDescription>
              Renseignez les termes du bail. Un bail sera créé et le locataire sera invité à le signer.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* Monthly rent */}
            <div className="space-y-2">
              <Label htmlFor="monthlyRent">
                Loyer mensuel (FCFA) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="monthlyRent"
                type="number"
                min="0"
                step="1000"
                placeholder="150000"
                value={leaseTerms.monthlyRent}
                onChange={(e) => setLeaseTerms(prev => ({ ...prev, monthlyRent: e.target.value }))}
                className={termsErrors.monthlyRent ? 'border-red-500' : ''}
              />
              {termsErrors.monthlyRent && (
                <p className="text-xs text-red-500">{termsErrors.monthlyRent}</p>
              )}
            </div>

            {/* Charges and deposit */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="charges">Charges (FCFA)</Label>
                <Input
                  id="charges"
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="25000"
                  value={leaseTerms.charges}
                  onChange={(e) => setLeaseTerms(prev => ({ ...prev, charges: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deposit">Dépôt de garantie (FCFA)</Label>
                <Input
                  id="deposit"
                  type="number"
                  min="0"
                  step="10000"
                  placeholder="150000"
                  value={leaseTerms.deposit}
                  onChange={(e) => setLeaseTerms(prev => ({ ...prev, deposit: e.target.value }))}
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">
                  Date de début <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={leaseTerms.startDate}
                  onChange={(e) => setLeaseTerms(prev => ({ ...prev, startDate: e.target.value }))}
                  className={termsErrors.startDate ? 'border-red-500' : ''}
                />
                {termsErrors.startDate && (
                  <p className="text-xs text-red-500">{termsErrors.startDate}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">
                  Date de fin <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="endDate"
                  type="date"
                  value={leaseTerms.endDate}
                  onChange={(e) => setLeaseTerms(prev => ({ ...prev, endDate: e.target.value }))}
                  className={termsErrors.endDate ? 'border-red-500' : ''}
                />
                {termsErrors.endDate && (
                  <p className="text-xs text-red-500">{termsErrors.endDate}</p>
                )}
              </div>
            </div>

            {/* Special conditions */}
            <div className="space-y-2">
              <Label htmlFor="specialConditions">Conditions particulières</Label>
              <Textarea
                id="specialConditions"
                placeholder="Ex: meublé, parking inclus, animaux acceptés..."
                value={leaseTerms.specialConditions}
                onChange={(e) => setLeaseTerms(prev => ({ ...prev, specialConditions: e.target.value }))}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setAcceptDialogOpen(false)
                setTermsErrors({})
              }}
              disabled={actionLoading}
            >
              Annuler
            </Button>
            <Button
              onClick={handleAccept}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {actionLoading ? (
                <><span className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> Traitement...</>
              ) : (
                <><CheckCircle2 className="size-4" /> Créer le bail</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Reject Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="size-5 text-red-600" />
              Refuser le dossier
            </DialogTitle>
            <DialogDescription>
              Le locataire sera notifié du refus avec la raison que vous indiquez.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-foreground mb-2 block">
              Raison du refus <span className="text-red-500">*</span>
            </label>
            <Textarea
              placeholder="Expliquez pourquoi ce dossier est refusé..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false)
                setRejectionReason('')
              }}
              disabled={actionLoading}
            >
              Annuler
            </Button>
            <Button
              onClick={handleReject}
              disabled={actionLoading || !rejectionReason.trim()}
              className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
            >
              {actionLoading ? 'Traitement...' : 'Confirmer le refus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Candidature Detail Modal ─────────────────────────────────────── */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="flex flex-col w-full h-full sm:h-auto sm:max-w-3xl max-h-dvh sm:max-h-[90vh] rounded-none sm:rounded-lg border-0 sm:border p-0 sm:p-6 overflow-hidden">
          {/* Mobile drag handle */}
          <div className="sm:hidden flex justify-center pt-2 pb-1 absolute top-0 left-0 right-0 z-10">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
          </div>

          {selectedTenant && (
            <div className="flex flex-col flex-1 min-h-0">
              {/* Sticky header */}
              <div className="shrink-0 px-4 sm:px-0 pt-10 sm:pt-0 pb-3">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50">
                      {selectedTenant.tenant.avatarUrl ? (
                        <img
                          src={selectedTenant.tenant.avatarUrl}
                          alt=""
                          className="size-10 rounded-full object-cover"
                        />
                      ) : (
                        <User className="size-5 text-brand-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="truncate block">
                        {selectedTenant.tenant.firstName} {selectedTenant.tenant.lastName}
                      </span>
                      <p className="text-sm font-normal text-muted-foreground truncate">
                        Candidature · {getStatusLabel(selectedTenant.status)}
                      </p>
                    </div>
                  </DialogTitle>
                </DialogHeader>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-0 pb-4">
                <div className="space-y-5">

                  {/* Property targeted by this candidature */}
                  {selectedTenant.leases?.[0]?.property && (
                    <>
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                          <Building2 className="size-4 text-brand-500" />
                          Bien concerné
                        </h4>
                        <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                          <div className="size-12 shrink-0 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                            {selectedTenant.leases[0].property.images?.[0]?.url ? (
                              <img src={selectedTenant.leases[0].property.images[0].url} alt="" className="size-full object-cover" />
                            ) : (
                              <Building2 className="size-5 text-neutral-300" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{selectedTenant.leases[0].property.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{selectedTenant.leases[0].property.address}, {selectedTenant.leases[0].property.city}</p>
                          </div>
                        </div>
                      </div>
                      <Separator />
                    </>
                  )}

                  {/* Status Timeline */}
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <ClipboardCheck className="size-4 text-brand-500" />
                      Statut de la candidature
                    </h4>
                    <div className="flex flex-wrap items-center gap-2">
                      {(() => {
                        const status = selectedTenant.status
                        const isRejected = status === 'REJECTED'
                        const steps = isRejected
                          ? [
                              { status: 'SUBMITTED', label: 'Soumis', color: 'bg-amber-50 text-amber-700 border-amber-200' },
                              { status: 'REJECTED', label: 'Refusé', color: 'bg-red-50 text-red-700 border-red-200' },
                            ]
                          : [
                              { status: 'SUBMITTED', label: 'Soumis', color: 'bg-amber-50 text-amber-700 border-amber-200' },
                              { status: 'VALIDATED', label: 'Validé TC', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                              { status: 'ACCEPTED', label: 'Accepté', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                            ]
                        const statusOrder = steps.map(s => s.status)
                        const currentIdx = statusOrder.indexOf(status)
                        return steps.map((step, i) => {
                          const stepIdx = i
                          const completed = stepIdx < currentIdx
                          const active = stepIdx === currentIdx
                          return (
                            <div key={step.status} className="flex items-center gap-1">
                              <div className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
                                completed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                active ? step.color : 'bg-muted text-muted-foreground border-border'
                              }`}>
                                {completed ? <CheckCircle2 className="size-3.5" /> :
                                 active ? <Eye className="size-3.5" /> :
                                 <div className="size-1.5 rounded-full bg-neutral-300" />}
                                {step.label}
                              </div>
                              {i < steps.length - 1 && (
                                <div className={`w-5 h-px ${completed ? 'bg-emerald-300' : 'bg-neutral-200'}`} />
                              )}
                            </div>
                          )
                        })
                      })()}
                    </div>

                    {selectedTenant.status === 'VALIDATED' && (
                      <div className="mt-3 p-3 rounded-lg bg-brand-50 border border-brand-200">
                        <p className="text-sm font-medium text-brand-700">
                          ✅ Le dossier du locataire a été validé par le Tiers de Confiance.
                        </p>
                        <p className="text-sm text-brand-600 mt-0.5">
                          Vous pouvez maintenant <strong>accepter</strong> ou <strong>refuser</strong> cette candidature.
                        </p>
                      </div>
                    )}

                    {selectedTenant.status === 'REJECTED' && selectedTenant.rejectionReason && (
                      <div className="mt-2 p-2.5 rounded-lg bg-red-50 border border-red-200">
                        <p className="text-xs font-medium text-red-700">Motif du refus :</p>
                        <p className="text-sm text-red-600">{selectedTenant.rejectionReason}</p>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Personal Info */}
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <User className="size-4 text-brand-500" />
                      Informations personnelles
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      {selectedTenant.tenant.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground p-2.5 rounded-lg border border-border bg-muted/20">
                          <Phone className="size-3.5 shrink-0" />
                          <span className="truncate">{selectedTenant.tenant.phone}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-muted-foreground p-2.5 rounded-lg border border-border bg-muted/20">
                        <Mail className="size-3.5 shrink-0" />
                        <span className="truncate">{selectedTenant.tenant.email}</span>
                      </div>
                      {selectedTenant.tenant.city && (
                        <div className="flex items-center gap-2 text-muted-foreground p-2.5 rounded-lg border border-border bg-muted/20">
                          <MapPin className="size-3.5 shrink-0" />
                          <span className="truncate">{selectedTenant.tenant.city}</span>
                        </div>
                      )}
                      {selectedTenant.tenant.birthDate && (
                        <div className="flex items-center gap-2 text-muted-foreground p-2.5 rounded-lg border border-border bg-muted/20">
                          <Calendar className="size-3.5 shrink-0" />
                          <span>{formatDate(selectedTenant.tenant.birthDate)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Financial Info */}
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <CreditCard className="size-4 text-brand-500" />
                      Situation financière
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {selectedTenant.monthlyIncome && (
                        <div className="p-2.5 rounded-lg border border-border bg-muted/20">
                          <p className="text-xs text-muted-foreground">Revenus mensuels</p>
                          <p className="font-medium text-foreground">
                            {selectedTenant.monthlyIncome.toLocaleString('fr-FR')} FCFA
                          </p>
                        </div>
                      )}
                      {selectedTenant.employer && (
                        <div className="p-2.5 rounded-lg border border-border bg-muted/20">
                          <p className="text-xs text-muted-foreground">Employeur</p>
                          <p className="font-medium text-foreground truncate">{selectedTenant.employer}</p>
                        </div>
                      )}
                      {selectedTenant.employmentType && (
                        <div className="p-2.5 rounded-lg border border-border bg-muted/20">
                          <p className="text-xs text-muted-foreground">Type d'emploi</p>
                          <p className="font-medium text-foreground">{selectedTenant.employmentType}</p>
                        </div>
                      )}
                      <div className="p-2.5 rounded-lg border border-border bg-muted/20">
                        <p className="text-xs text-muted-foreground">Score de confiance</p>
                        <p className={`font-semibold text-lg ${
                          selectedTenant.tenantTrustScore >= 70 ? 'text-emerald-600' :
                          selectedTenant.tenantTrustScore >= 50 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {selectedTenant.tenantTrustScore}/100
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Guarantor */}
                  {selectedTenant.guarantorName && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                          <Shield className="size-4 text-brand-500" />
                          Garant
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div className="p-2.5 rounded-lg border border-border bg-muted/20">
                            <p className="text-xs text-muted-foreground">Nom</p>
                            <p className="font-medium text-foreground">{selectedTenant.guarantorName}</p>
                          </div>
                          {selectedTenant.guarantorPhone && (
                            <div className="p-2.5 rounded-lg border border-border bg-muted/20">
                              <p className="text-xs text-muted-foreground">Téléphone</p>
                              <p className="font-medium text-foreground">{selectedTenant.guarantorPhone}</p>
                            </div>
                          )}
                          {selectedTenant.guarantorRelation && (
                            <div className="p-2.5 rounded-lg border border-border bg-muted/20">
                              <p className="text-xs text-muted-foreground">Relation</p>
                              <p className="font-medium text-foreground">{selectedTenant.guarantorRelation}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  <Separator />

                  {/* Documents */}
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <FileText className="size-4 text-brand-500" />
                      Documents ({selectedTenant.documents.length})
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {selectedTenant.documents.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Aucun document fourni</p>
                      ) : (
                        selectedTenant.documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="size-3.5 text-muted-foreground shrink-0" />
                              <span className="text-sm text-foreground truncate">{doc.name}</span>
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 shrink-0 ${getDocStatusColor(doc.status)}`}
                            >
                              {getDocStatusLabel(doc.status)}
                            </Badge>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Other candidatures history */}
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <ClipboardCheck className="size-4 text-brand-500" />
                      Historique des candidatures
                    </h4>
                    {selectedTenant.tenantOtherFiles.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucune autre candidature</p>
                    ) : (
                      <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                        {selectedTenant.tenantOtherFiles.map((otherFile) => (
                          <div
                            key={otherFile.id}
                            className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border"
                          >
                            <div className="text-sm min-w-0">
                              <span className="text-foreground font-medium truncate block">
                                {otherFile.leases[0]?.property?.title || 'Bien non spécifié'}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(otherFile.createdAt)}
                              </span>
                            </div>
                            <Badge className={`shrink-0 ml-2 ${getStatusColor(otherFile.status)}`}>
                              {getStatusLabel(otherFile.status)}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quick actions */}
                  {selectedTenant.status === 'VALIDATED' && !selectedTenant.leases.some(l => l.id) && (
                    <>
                      <Separator />
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                        <Button
                          className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white h-11 sm:h-9"
                          onClick={() => {
                            setProfileDialogOpen(false)
                            setSelectedFileId(selectedTenant.id)
                            setAcceptDialogOpen(true)
                          }}
                        >
                          <CheckCircle2 className="size-4 sm:size-3.5" />
                          Accepter
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1 gap-1.5 border-red-200 text-red-600 hover:bg-red-50 h-11 sm:h-9"
                          onClick={() => {
                            setProfileDialogOpen(false)
                            setSelectedFileId(selectedTenant.id)
                            setRejectDialogOpen(true)
                          }}
                        >
                          <XCircle className="size-4 sm:size-3.5" />
                          Refuser
                        </Button>
                        <QuickContactDialog
                          recipientId={selectedTenant.tenant.id}
                          recipientName={`${selectedTenant.tenant.firstName} ${selectedTenant.tenant.lastName}`}
                          propertyId={selectedTenant.leases[0]?.property?.id}
                          onSent={() => { setProfileDialogOpen(false); setDashboardSection('messages') }}
                          trigger={
                            <Button variant="outline" className="flex-1 gap-1.5 h-11 sm:h-9">
                              <MessageSquare className="size-4 sm:size-3.5" />
                              Contacter
                            </Button>
                          }
                        />
                      </div>
                    </>
                  )}
                  {selectedTenant.leases.length > 0 && selectedTenant.leases.some(l => !l.ownerSignedAt && !l.tenantSignedAt) && (
                    <>
                      <Separator />
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                        <Button
                          variant="outline"
                          className="flex-1 gap-1.5 border-red-200 text-red-600 hover:bg-red-50 h-11 sm:h-9"
                          onClick={() => {
                            const unsignedLease = selectedTenant.leases.find(l => !l.ownerSignedAt && !l.tenantSignedAt)
                            if (unsignedLease) {
                              handleDeleteLease(unsignedLease.id)
                              setProfileDialogOpen(false)
                            }
                          }}
                        >
                          <Trash2 className="size-4 sm:size-3.5" />
                          Supprimer le bail
                        </Button>
                        <QuickContactDialog
                          recipientId={selectedTenant.tenant.id}
                          recipientName={`${selectedTenant.tenant.firstName} ${selectedTenant.tenant.lastName}`}
                          propertyId={selectedTenant.leases[0]?.property?.id}
                          onSent={() => { setProfileDialogOpen(false); setDashboardSection('messages') }}
                          trigger={
                            <Button variant="outline" className="flex-1 gap-1.5 h-11 sm:h-9">
                              <MessageSquare className="size-4 sm:size-3.5" />
                              Contacter
                            </Button>
                          }
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => { if (!open) setDeleteConfirmId(null) }}
        title="Supprimer le bail"
        description="Cette action est irréversible. Toutes les données associées à ce bail seront définitivement supprimées."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={confirmDeleteLease}
        variant="destructive"
      />
    </motion.div>
  )
}
