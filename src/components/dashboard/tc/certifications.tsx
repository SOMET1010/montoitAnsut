'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Award, Plus, Search, Check, X, Eye, ShieldCheck, ShieldX, Clock,
  BadgeCheck, Loader2, User, Building2, FileText, Home, ChevronsUpDown,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { usePagination } from '@/hooks/use-pagination'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { useRealtimeCertifications } from '@/hooks/use-realtime-certifications'
import { ViewModeToggle, type ViewMode } from './view-mode-toggle'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CertificationUser {
  id: string
  firstName: string
  lastName: string
  email: string
}

interface CertificationProperty {
  id: string
  title: string
}

interface Certification {
  id: string
  type: string
  status: string
  notes: string | null
  revokedAt: string | null
  revocationReason: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
  user: CertificationUser
  grantedBy: CertificationUser
  property: CertificationProperty | null
}

interface CertStats {
  PENDING: number
  GRANTED: number
  REVOKED: number
  EXPIRED: number
  TOTAL: number
}

// ─── Label maps ─────────────────────────────────────────────────────────────

const typeLabels: Record<string, string> = {
  USER_IDENTITY: 'Identité',
  PROPERTY: 'Bien immobilier',
  AGENCY: 'Agence',
}

const typeIcons: Record<string, React.ElementType> = {
  USER_IDENTITY: User,
  PROPERTY: Home,
  AGENCY: Building2,
}

const typeColors: Record<string, string> = {
  USER_IDENTITY: 'bg-amber-100 text-amber-700',
  PROPERTY: 'bg-emerald-100 text-emerald-700',
  AGENCY: 'bg-rose-100 text-rose-700',
}

const statusLabels: Record<string, string> = {
  PENDING: 'En attente',
  GRANTED: 'Certifié',
  REVOKED: 'Révoqué',
  EXPIRED: 'Expiré',
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  GRANTED: 'bg-green-100 text-green-700',
  REVOKED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-gray-100 text-gray-500',
}

const statusFilterOptions = [
  { value: 'ALL', label: 'Tous' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'GRANTED', label: 'Certifié' },
  { value: 'REVOKED', label: 'Révoqué' },
  { value: 'EXPIRED', label: 'Expiré' },
]

const typeFilterOptions = [
  { value: 'ALL', label: 'Tous types' },
  { value: 'USER_IDENTITY', label: 'Identité' },
  { value: 'PROPERTY', label: 'Bien immobilier' },
  { value: 'AGENCY', label: 'Agence' },
]

// ─── Component ──────────────────────────────────────────────────────────────

export function CertificationsManagement() {
  const { isAuthenticated, user, selectedItemId, setSelectedItemId } = useAuthStore()
  const [certifications, setCertifications] = useState<Certification[]>([])
  const [stats, setStats] = useState<CertStats>({ PENDING: 0, GRANTED: 0, REVOKED: 0, EXPIRED: 0, TOTAL: 0 })
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Create certification dialog
  const [createDialog, setCreateDialog] = useState(false)
  const [createForm, setCreateForm] = useState({
    userId: '',
    type: 'USER_IDENTITY',
    notes: '',
    propertyId: '',
  })
  const [userSearch, setUserSearch] = useState('')
  const [userResults, setUserResults] = useState<CertificationUser[]>([])
  const [userSearchLoading, setUserSearchLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Revoke dialog
  const [revokeDialog, setRevokeDialog] = useState<{ open: boolean; cert: Certification | null }>({
    open: false, cert: null,
  })
  const [revokeReason, setRevokeReason] = useState('')

  // View details dialog
  const [detailsDialog, setDetailsDialog] = useState<{ open: boolean; cert: Certification | null }>({
    open: false, cert: null,
  })

  // ─── Fetch ─────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (typeFilter !== 'ALL') params.set('type', typeFilter)
      if (search.trim()) params.set('search', search.trim())

      const data = await authFetch<{ certifications: Certification[]; stats: CertStats }>(
        `/api/tc/certifications?${params.toString()}`
      )
      setCertifications(data.certifications || [])
      setStats(data.stats || { PENDING: 0, GRANTED: 0, REVOKED: 0, EXPIRED: 0, TOTAL: 0 })
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) {
        setCertifications([])
        return
      }
      setCertifications([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, statusFilter, typeFilter, search])

  // ─── Realtime subscription (TC watches all certifications) ───────
  useRealtimeCertifications({
    userId: user?.id,
    watchAll: true,
    onCertificationChange: () => { fetchData() },
  })

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const {
    paginatedItems: pagedCerts,
    page: certsPage,
    totalPages: certsTotalPages,
    total: certsTotal,
    pageSize: certsPageSize,
    setPage: setCertsPage,
  } = usePagination({
    items: certifications,
    pageSize: 10,
    resetSignal: `${search}|${statusFilter}|${typeFilter}`,
  })

  // Auto-navigate to certification detail when selectedItemId matches
  useEffect(() => {
    if (!selectedItemId || certifications.length === 0) return
    const match = certifications.find(c => c.id === selectedItemId)
    if (!match) return
    setSelectedItemId('')
    setDetailsDialog({ open: true, cert: match })
  }, [selectedItemId, certifications, setSelectedItemId])

  // ─── User search for create dialog ───────────────────────────────────

  useEffect(() => {
    if (!userSearch.trim()) {
      setUserResults([])
      return
    }

    const timer = setTimeout(async () => {
      setUserSearchLoading(true)
      try {
        const data = await authFetch<{ users: CertificationUser[] }>(
          `/api/tc/oneci?search=${encodeURIComponent(userSearch.trim())}`
        )
        setUserResults(Array.isArray(data.users) ? data.users : [])
      } catch {
        setUserResults([])
      } finally {
        setUserSearchLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [userSearch])

  // ─── Actions ──────────────────────────────────────────────────────────

  const handleGrant = async (certId: string) => {
    setActionLoading(certId)
    try {
      await authFetch('/api/tc/certifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: certId, action: 'GRANT' }),
      })
      toast.success('Certification accordée')
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRevoke = async () => {
    if (!revokeDialog.cert) return
    setActionLoading(revokeDialog.cert.id)
    try {
      await authFetch('/api/tc/certifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: revokeDialog.cert.id,
          action: 'REVOKE',
          revocationReason: revokeReason.trim() || null,
        }),
      })
      toast.success('Certification révoquée')
      setRevokeDialog({ open: false, cert: null })
      setRevokeReason('')
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCreate = async () => {
    if (!createForm.userId) {
      toast.error('Veuillez sélectionner un utilisateur')
      return
    }
    setSubmitting(true)
    try {
      await authFetch('/api/tc/certifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: createForm.userId,
          type: createForm.type,
          notes: createForm.notes.trim() || null,
          propertyId: createForm.type === 'PROPERTY' ? createForm.propertyId || null : null,
        }),
      })
      toast.success('Certification créée')
      setCreateDialog(false)
      setCreateForm({ userId: '', type: 'USER_IDENTITY', notes: '', propertyId: '' })
      setUserSearch('')
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  const getSelectedUserName = () => {
    if (!createForm.userId) return ''
    const u = userResults.find((r) => r.id === createForm.userId)
    return u ? `${u.firstName} ${u.lastName}` : ''
  }

  // ─── Loading ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <Card className="border-border bg-gradient-to-r from-brand-500/10 to-transparent">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-brand-100">
                <Award className="size-6 text-brand-600" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">Certifications</h1>
                <p className="text-muted-foreground text-sm">Gérez les certifications d&apos;identité, de biens et d&apos;agences</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 border text-[10px]">
                    <Clock className="size-3 mr-0.5" /> {stats.PENDING} en attente
                  </Badge>
                  <Badge className="bg-green-50 text-green-700 border-green-200 border text-[10px]">
                    <BadgeCheck className="size-3 mr-0.5" /> {stats.GRANTED} certifiées
                  </Badge>
                  <Badge className="bg-slate-50 text-slate-700 border-slate-200 border text-[10px]">
                    <Award className="size-3 mr-0.5" /> {stats.TOTAL} total
                  </Badge>
                </div>
              </div>
            </div>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shrink-0 shadow-sm"
              onClick={() => setCreateDialog(true)}
            >
              <Plus className="size-4" /> Nouvelle certification
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Row — cliquable pour filtrer */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card
          className={cn('border-border cursor-pointer transition-all hover:border-amber-300 hover:shadow-sm', statusFilter === 'PENDING' && 'ring-1 ring-amber-400 bg-amber-50/20')}
          onClick={() => setStatusFilter(statusFilter === 'PENDING' ? 'ALL' : 'PENDING')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50">
                <Clock className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-amber-600">{stats.PENDING}</p>
                <p className="text-xs text-muted-foreground">En attente</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn('border-border cursor-pointer transition-all hover:border-green-300 hover:shadow-sm', statusFilter === 'GRANTED' && 'ring-1 ring-green-400 bg-green-50/20')}
          onClick={() => setStatusFilter(statusFilter === 'GRANTED' ? 'ALL' : 'GRANTED')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-green-50">
                <BadgeCheck className="size-5 text-green-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.GRANTED}</p>
                <p className="text-xs text-muted-foreground">Certifiées</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn('border-border cursor-pointer transition-all hover:border-red-300 hover:shadow-sm', statusFilter === 'REVOKED' && 'ring-1 ring-red-400 bg-red-50/20')}
          onClick={() => setStatusFilter(statusFilter === 'REVOKED' ? 'ALL' : 'REVOKED')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-red-50">
                <ShieldX className="size-5 text-red-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-red-600">{stats.REVOKED}</p>
                <p className="text-xs text-muted-foreground">Révoquées</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn('border-border cursor-pointer transition-all hover:border-brand-200 hover:shadow-sm', statusFilter === 'ALL' && 'ring-1 ring-brand-200')}
          onClick={() => setStatusFilter('ALL')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50">
                <Award className="size-5 text-brand-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.TOTAL}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar: Search + Filters + View Toggle */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Status filters */}
          {statusFilterOptions.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={statusFilter === opt.value ? 'default' : 'outline'}
              className={cn(
                'text-xs',
                statusFilter === opt.value
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  : 'hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200'
              )}
              onClick={() => setStatusFilter(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
          <div className="w-px bg-border mx-1" />
          {/* Type filters — searchable dropdown */}
          <Popover open={typeDropdownOpen} onOpenChange={setTypeDropdownOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs justify-between min-w-[140px]"
              >
                {typeFilter === 'ALL'
                  ? 'Tous types'
                  : typeLabels[typeFilter] || typeFilter}
                <ChevronsUpDown className="size-3.5 opacity-50 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Rechercher un type..." />
                <CommandList>
                  <CommandEmpty>Aucun type trouvé</CommandEmpty>
                  <CommandGroup>
                    {typeFilterOptions.map((opt) => (
                      <CommandItem
                        key={opt.value}
                        value={opt.label}
                        onSelect={() => {
                          setTypeFilter(opt.value)
                          setTypeDropdownOpen(false)
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 size-4',
                            typeFilter === opt.value ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        {opt.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Empty state */}
      {certifications.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <Award className="size-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">Aucune certification trouvée</p>
            <p className="text-sm text-muted-foreground mt-1">
              Créez votre première certification ou ajustez les filtres
            </p>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 mt-4"
              onClick={() => setCreateDialog(true)}
            >
              <Plus className="size-4" /> Créer une certification
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === 'card' ? (
        /* ─── Card View ──────────────────────────────────────────── */
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          <AnimatePresence mode="popLayout" initial={false} key={`page-${certsPage}`}>
            {pagedCerts.map((cert) => {
              const TypeIcon = typeIcons[cert.type] || Award
              return (
                <motion.div
                  key={cert.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="border hover:shadow-md transition-shadow">
                    <CardContent className="p-4 sm:p-5">
                      {/* Top row: type + status */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            'size-9 rounded-lg flex items-center justify-center',
                            cert.type === 'USER_IDENTITY' ? 'bg-amber-50' :
                            cert.type === 'PROPERTY' ? 'bg-emerald-50' : 'bg-rose-50'
                          )}>
                            <TypeIcon className={cn(
                              'size-4',
                              cert.type === 'USER_IDENTITY' ? 'text-amber-600' :
                              cert.type === 'PROPERTY' ? 'text-emerald-600' : 'text-rose-600'
                            )} />
                          </div>
                          <Badge className={typeColors[cert.type] || 'bg-gray-100 text-gray-700'}>
                            {typeLabels[cert.type] || cert.type}
                          </Badge>
                        </div>
                        <Badge className={statusColors[cert.status] || 'bg-gray-100 text-gray-700'}>
                          {statusLabels[cert.status] || cert.status}
                        </Badge>
                      </div>

                      {/* User info */}
                      <div className="mb-2">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {cert.user.firstName} {cert.user.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{cert.user.email}</p>
                      </div>

                      {/* Property info for PROPERTY type */}
                      {cert.type === 'PROPERTY' && cert.property && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                          <Home className="size-3.5 shrink-0" />
                          <span className="truncate">{cert.property.title}</span>
                        </div>
                      )}

                      {/* Granted by + date */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <span>Par {cert.grantedBy.firstName} {cert.grantedBy.lastName}</span>
                        <span>·</span>
                        <span>{new Date(cert.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>

                      {/* Notes preview */}
                      {cert.notes && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                          {cert.notes}
                        </p>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-2 border-t border-border">
                        {cert.status === 'PENDING' && (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white gap-1"
                            onClick={() => handleGrant(cert.id)}
                            disabled={actionLoading === cert.id}
                          >
                            {actionLoading === cert.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                            Certifier
                          </Button>
                        )}
                        {cert.status === 'GRANTED' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50 gap-1"
                            onClick={() => setRevokeDialog({ open: true, cert })}
                            disabled={actionLoading === cert.id}
                          >
                            <ShieldX className="size-3.5" /> Révoquer
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-muted-foreground hover:text-foreground"
                          onClick={() => setDetailsDialog({ open: true, cert })}
                        >
                          <Eye className="size-3.5" /> Détails
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
          <PaginationControls
            page={certsPage}
            totalPages={certsTotalPages}
            total={certsTotal}
            limit={certsPageSize}
            onPageChange={setCertsPage}
            className="sm:col-span-2"
          />
        </div>
      ) : (
        /* ─── List View ──────────────────────────────────────────── */
        <Card className="border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left font-medium text-muted-foreground p-3">Utilisateur</th>
                  <th className="text-left font-medium text-muted-foreground p-3 hidden sm:table-cell">Type</th>
                  <th className="text-center font-medium text-muted-foreground p-3">Statut</th>
                  <th className="text-left font-medium text-muted-foreground p-3 hidden md:table-cell">Certifié par</th>
                  <th className="text-left font-medium text-muted-foreground p-3 hidden lg:table-cell">Date</th>
                  <th className="text-right font-medium text-muted-foreground p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout" initial={false} key={`page-${certsPage}`}>
                  {pagedCerts.map((cert) => {
                    const TypeIcon = typeIcons[cert.type] || Award
                    return (
                      <motion.tr
                        key={cert.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="border-b border-border hover:bg-muted/30 transition-colors"
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={cn(
                              'size-8 rounded-full flex items-center justify-center shrink-0',
                              cert.type === 'USER_IDENTITY' ? 'bg-amber-50' :
                              cert.type === 'PROPERTY' ? 'bg-emerald-50' : 'bg-rose-50'
                            )}>
                              <TypeIcon className={cn(
                                'size-4',
                                cert.type === 'USER_IDENTITY' ? 'text-amber-600' :
                                cert.type === 'PROPERTY' ? 'text-emerald-600' : 'text-rose-600'
                              )} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate">
                                {cert.user.firstName} {cert.user.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">{cert.user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 hidden sm:table-cell">
                          <Badge className={typeColors[cert.type] || 'bg-gray-100 text-gray-700'}>
                            {typeLabels[cert.type] || cert.type}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <Badge className={statusColors[cert.status] || 'bg-gray-100 text-gray-700'}>
                            {statusLabels[cert.status] || cert.status}
                          </Badge>
                        </td>
                        <td className="p-3 hidden md:table-cell">
                          <span className="text-muted-foreground truncate block max-w-[120px]">
                            {cert.grantedBy.firstName} {cert.grantedBy.lastName}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground hidden lg:table-cell">
                          {new Date(cert.createdAt).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-1">
                            {cert.status === 'PENDING' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50 h-8 w-8 p-0"
                                onClick={() => handleGrant(cert.id)}
                                disabled={actionLoading === cert.id}
                                title="Certifier"
                              >
                                <Check className="size-4" />
                              </Button>
                            )}
                            {cert.status === 'GRANTED' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                                onClick={() => setRevokeDialog({ open: true, cert })}
                                disabled={actionLoading === cert.id}
                                title="Révoquer"
                              >
                                <ShieldX className="size-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground hover:text-foreground h-8 w-8 p-0"
                              onClick={() => setDetailsDialog({ open: true, cert })}
                              title="Détails"
                            >
                              <Eye className="size-4" />
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    )
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-3">
            <PaginationControls
              page={certsPage}
              totalPages={certsTotalPages}
              total={certsTotal}
              limit={certsPageSize}
              onPageChange={setCertsPage}
            />
          </div>
        </Card>
      )}

      {/* ─── Create Certification Dialog ────────────────────────────── */}
      <Dialog open={createDialog} onOpenChange={(open) => { if (!open) setCreateDialog(false) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle certification</DialogTitle>
            <DialogDescription>Créez une certification pour un utilisateur</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* User search */}
            <div className="space-y-2">
              <Label>Utilisateur *</Label>
              {createForm.userId ? (
                <div className="flex items-center justify-between p-2 rounded-lg bg-brand-50 border border-brand-200">
                  <span className="text-sm font-medium text-foreground">{getSelectedUserName()}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600"
                    onClick={() => setCreateForm((prev) => ({ ...prev, userId: '' }))}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher par nom ou email..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-9"
                    />
                    {userSearchLoading && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground animate-spin" />
                    )}
                  </div>
                  {userResults.length > 0 && (
                    <div className="max-h-32 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                      {userResults.map((u) => (
                        <button
                          key={u.id}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                          onClick={() => {
                            setCreateForm((prev) => ({ ...prev, userId: u.id }))
                            setUserSearch('')
                            setUserResults([])
                          }}
                        >
                          <span className="font-medium text-foreground">{u.firstName} {u.lastName}</span>
                          <span className="text-muted-foreground ml-2">{u.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label>Type de certification *</Label>
              <div className="flex flex-wrap gap-2">
                {(['USER_IDENTITY', 'PROPERTY', 'AGENCY'] as const).map((t) => {
                  const TIcon = typeIcons[t]
                  return (
                    <Button
                      key={t}
                      size="sm"
                      variant={createForm.type === t ? 'default' : 'outline'}
                      className={cn(
                        'gap-1.5',
                        createForm.type === t
                          ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                          : 'hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200'
                      )}
                      onClick={() => setCreateForm((prev) => ({ ...prev, type: t }))}
                    >
                      <TIcon className="size-3.5" /> {typeLabels[t]}
                    </Button>
                  )
                })}
              </div>
            </div>

            {/* Property ID for PROPERTY type */}
            {createForm.type === 'PROPERTY' && (
              <div className="space-y-2">
                <Label>ID du bien immobilier (optionnel)</Label>
                <Input
                  placeholder="cuid du bien..."
                  value={createForm.propertyId}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, propertyId: e.target.value }))}
                />
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Notes sur la certification..."
                value={createForm.notes}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>


          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateDialog(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleCreate}
              disabled={submitting || !createForm.userId}
            >
              {submitting && <Loader2 className="size-4 animate-spin mr-2" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Revoke Dialog ────────────────────────────────────────────── */}
      <Dialog
        open={revokeDialog.open}
        onOpenChange={(open) => {
          if (!open) { setRevokeDialog({ open: false, cert: null }); setRevokeReason('') }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Révoquer la certification</DialogTitle>
            <DialogDescription>
              Révoquer la certification de {revokeDialog.cert?.user.firstName} {revokeDialog.cert?.user.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Veuillez indiquer la raison de la révocation. L&apos;utilisateur sera notifié.
            </p>
            <Textarea
              placeholder="Raison de la révocation..."
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setRevokeDialog({ open: false, cert: null }); setRevokeReason('') }}
            >
              Annuler
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleRevoke}
              disabled={actionLoading !== null}
            >
              {actionLoading !== null && <Loader2 className="size-4 animate-spin mr-2" />}
              Confirmer la révocation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── View Details Dialog ──────────────────────────────────────── */}
      <Dialog
        open={detailsDialog.open}
        onOpenChange={(open) => { if (!open) setDetailsDialog({ open: false, cert: null }) }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Détails de la certification</DialogTitle>
          </DialogHeader>
          {detailsDialog.cert && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3">
                <Badge className={typeColors[detailsDialog.cert.type] || 'bg-gray-100 text-gray-700'}>
                  {typeLabels[detailsDialog.cert.type] || detailsDialog.cert.type}
                </Badge>
                <Badge className={statusColors[detailsDialog.cert.status] || 'bg-gray-100 text-gray-700'}>
                  {statusLabels[detailsDialog.cert.status] || detailsDialog.cert.status}
                </Badge>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Utilisateur</span>
                  <span className="font-medium text-foreground">
                    {detailsDialog.cert.user.firstName} {detailsDialog.cert.user.lastName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium text-foreground">{detailsDialog.cert.user.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Certifié par</span>
                  <span className="font-medium text-foreground">
                    {detailsDialog.cert.grantedBy.firstName} {detailsDialog.cert.grantedBy.lastName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date de création</span>
                  <span className="font-medium text-foreground">
                    {new Date(detailsDialog.cert.createdAt).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </span>
                </div>
                {detailsDialog.cert.revokedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Révoquée le</span>
                    <span className="font-medium text-red-600">
                      {new Date(detailsDialog.cert.revokedAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                )}
                {detailsDialog.cert.revocationReason && (
                  <div>
                    <span className="text-muted-foreground block mb-1">Raison de révocation</span>
                    <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">
                      {detailsDialog.cert.revocationReason}
                    </p>
                  </div>
                )}
                {detailsDialog.cert.property && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bien immobilier</span>
                    <span className="font-medium text-foreground">{detailsDialog.cert.property.title}</span>
                  </div>
                )}
              </div>

              {detailsDialog.cert.notes && (
                <div>
                  <span className="text-sm text-muted-foreground block mb-1">Notes</span>
                  <p className="text-sm text-foreground bg-muted p-3 rounded-lg">
                    {detailsDialog.cert.notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
