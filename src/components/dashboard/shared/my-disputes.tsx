'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle, Scale, AlertOctagon, HandMetal, CircleDot, ClipboardList,
  Plus, X, Send, FileText, Calendar, User, ShieldCheck, CheckCircle2, XCircle,
  Clock, ArrowUpRight, Flame, Loader2, Eye, Search,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { useRealtimeDisputes } from '@/hooks/use-realtime-disputes'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

type DisputeType = 'UNPAID_RENT' | 'PROPERTY_DAMAGE' | 'HARASSMENT' | 'FRAUD' | 'OTHER'
type DisputeStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED'

interface Dispute {
  id: string
  type: DisputeType
  description: string
  status: DisputeStatus
  priority: string
  resolution: string | null
  createdAt: string
  resolvedAt: string | null
  lease: {
    id: string
    startDate: string
    endDate: string
    monthlyRent: number
    property: {
      id: string
      title: string
      address: string
      commune: string
      city: string
    } | null
  } | null
  reporter: {
    id: string
    firstName: string
    lastName: string
    role: string
  } | null
}

// ─── Labels & Colors ────────────────────────────────────────────────────────

const typeOptions = [
  { value: 'UNPAID_RENT', label: 'Loyer impayé', icon: AlertOctagon, color: 'bg-red-50 text-red-600' },
  { value: 'PROPERTY_DAMAGE', label: 'Dégât matériel', icon: AlertTriangle, color: 'bg-orange-50 text-orange-600' },
  { value: 'HARASSMENT', label: 'Harcèlement', icon: HandMetal, color: 'bg-rose-50 text-rose-600' },
  { value: 'FRAUD', label: 'Fraude', icon: Scale, color: 'bg-red-50 text-red-600' },
  { value: 'OTHER', label: 'Autre', icon: CircleDot, color: 'bg-gray-50 text-gray-600' },
]

const typeLabels: Record<string, string> = {
  UNPAID_RENT: 'Loyer impayé',
  PROPERTY_DAMAGE: 'Dégât matériel',
  HARASSMENT: 'Harcèlement',
  FRAUD: 'Fraude',
  OTHER: 'Autre',
}

const statusLabels: Record<string, string> = {
  OPEN: 'Ouvert',
  IN_REVIEW: 'En cours',
  RESOLVED: 'Résolu',
  CLOSED: 'Fermé',
}

const statusColors: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-700',
  IN_REVIEW: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-500',
}

const statusIcons: Record<string, React.ElementType> = {
  OPEN: AlertOctagon,
  IN_REVIEW: Clock,
  RESOLVED: CheckCircle2,
  CLOSED: XCircle,
}

// ─── Component ──────────────────────────────────────────────────────────────

export function MyDisputes() {
  const { user, isAuthenticated } = useAuthStore()

  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [activeTab, setActiveTab] = useState('active')

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [newType, setNewType] = useState<DisputeType | ''>('')
  const [newDescription, setNewDescription] = useState('')
  const [newLeaseId, setNewLeaseId] = useState('')
  const [userLeases, setUserLeases] = useState<Array<{
    id: string
    propertyTitle: string
    status: string
  }>>([])
  const [submitting, setSubmitting] = useState(false)

  // Detail dialog
  const [detailDispute, setDetailDispute] = useState<Dispute | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // ─── Fetch disputes ──────────────────────────────────────────────────

  const fetchDisputes = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    try {
      const data = await authFetch<{ data: Dispute[]; pagination: any }>('/api/disputes')
      setDisputes(data.data || [])
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) {
        setDisputes([])
        return
      }
      console.error('Failed to fetch disputes:', err)
      setDisputes([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  // ─── Fetch user leases for the create dialog ────────────────────────

  const fetchUserLeases = useCallback(async () => {
    try {
      const data = await authFetch<{
        data: Array<{ id: string; propertyTitle: string; status: string }>
      }>('/api/leases?status=all&limit=100')
      setUserLeases(data.data || [])
    } catch {
      setUserLeases([])
    }
  }, [])

  // ─── Realtime subscription ───────────────────────────────────────────

  useRealtimeDisputes({
    userId: user?.id,
    onDisputeChange: () => { fetchDisputes() },
  })

  useEffect(() => {
    fetchDisputes()
  }, [fetchDisputes])

  // ─── Stats ─────────────────────────────────────────────────────────────

  const openCount = disputes.filter((d) => d.status === 'OPEN').length
  const inReviewCount = disputes.filter((d) => d.status === 'IN_REVIEW').length
  const resolvedCount = disputes.filter((d) => d.status === 'RESOLVED' || d.status === 'CLOSED').length

  // ─── Filtered disputes ────────────────────────────────────────────────

  const currentList = activeTab === 'resolved'
    ? disputes.filter((d) => d.status === 'RESOLVED' || d.status === 'CLOSED')
    : disputes.filter((d) => d.status === 'OPEN' || d.status === 'IN_REVIEW')

  const filteredDisputes = currentList.filter((d) => {
    if (statusFilter !== 'ALL' && d.status !== statusFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        d.description.toLowerCase().includes(q) ||
        typeLabels[d.type].toLowerCase().includes(q) ||
        (d.lease?.property?.title?.toLowerCase().includes(q) ?? false)
      )
    }
    return true
  })

  // ─── Create dispute ───────────────────────────────────────────────────

  const handleCreateDispute = async () => {
    if (!newType || !newDescription.trim() || !newLeaseId || submitting) return

    setSubmitting(true)
    try {
      await authFetch('/api/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newType,
          description: newDescription.trim(),
          leaseId: newLeaseId,
        }),
      })

      toast.success('Litige signalé avec succès !')
      setCreateOpen(false)
      setNewType('')
      setNewDescription('')
      setNewLeaseId('')
      await fetchDisputes()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la création du litige')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Loading ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded-lg bg-muted animate-pulse" />
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Mes litiges</h1>
          <p className="text-muted-foreground mt-1">Signalez et suivez vos litiges</p>
        </div>
        <Button
          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          onClick={() => {
            fetchUserLeases()
            setCreateOpen(true)
          }}
        >
          <Plus className="size-4" />
          Nouveau litige
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-red-50 shrink-0">
                <AlertOctagon className="size-4 text-red-600" />
              </div>
              <div>
                <p className="text-lg sm:text-xl font-bold text-red-600">{openCount}</p>
                <p className="text-xs text-muted-foreground">Ouverts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-amber-50 shrink-0">
                <Clock className="size-4 text-amber-600" />
              </div>
              <div>
                <p className="text-lg sm:text-xl font-bold text-amber-600">{inReviewCount}</p>
                <p className="text-xs text-muted-foreground">En cours</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-green-50 shrink-0">
                <CheckCircle2 className="size-4 text-green-600" />
              </div>
              <div>
                <p className="text-lg sm:text-xl font-bold text-green-600">{resolvedCount}</p>
                <p className="text-xs text-muted-foreground">Résolus</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + Search */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <TabsList className="bg-muted">
            <TabsTrigger value="active" className="gap-1.5">
              En cours
              <Badge className="bg-brand-100 text-brand-700 text-[10px] px-1.5 py-0 ml-1">
                {disputes.filter((d) => d.status === 'OPEN' || d.status === 'IN_REVIEW').length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="resolved" className="gap-1.5">
              Résolus
            </TabsTrigger>
          </TabsList>

          <div className="relative w-full sm:w-auto sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Status filter chips */}
        <div className="flex gap-2 flex-wrap mt-3">
          <Button
            size="sm"
            variant={statusFilter === 'ALL' ? 'default' : 'outline'}
            className={statusFilter === 'ALL' ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : ''}
            onClick={() => setStatusFilter('ALL')}
          >
            Tous
          </Button>
          {Object.entries(statusLabels).map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant={statusFilter === key ? 'default' : 'outline'}
              className={cn(
                statusFilter === key && key === 'OPEN' && 'bg-red-600 hover:bg-red-700 text-white',
                statusFilter === key && key === 'IN_REVIEW' && 'bg-amber-600 hover:bg-amber-700 text-white',
                statusFilter === key && key === 'RESOLVED' && 'bg-green-600 hover:bg-green-700 text-white',
                statusFilter === key && key === 'CLOSED' && 'bg-gray-600 hover:bg-gray-700 text-white',
              )}
              onClick={() => setStatusFilter(key)}
            >
              {label}
            </Button>
          ))}
        </div>

        {/* Active tab content */}
        <TabsContent value="active" className="mt-4">
          {filteredDisputes.length === 0 ? (
            <Card className="border-border">
              <CardContent className="py-12 text-center">
                <ShieldCheck className="size-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">
                  Aucun litige en cours
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Si vous avez un problème avec votre bail, vous pouvez signaler un litige.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredDisputes.map((dispute) => {
                const typeConfig = typeOptions.find((t) => t.value === dispute.type)
                const TypeIcon = typeConfig?.icon || CircleDot
                const StatusIcon = statusIcons[dispute.status]
                return (
                  <Card
                    key={dispute.id}
                    className="border-border hover:shadow-sm transition-shadow cursor-pointer"
                    onClick={() => {
                      setDetailDispute(dispute)
                      setDetailOpen(true)
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className={cn('flex size-10 items-center justify-center rounded-lg shrink-0', typeConfig?.color || 'bg-gray-50')}>
                            <TypeIcon className="size-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={cn(typeConfig?.color?.replace('text-', 'text-').replace('bg-', 'bg-')) || 'bg-gray-100'}>
                                {typeLabels[dispute.type]}
                              </Badge>
                              <Badge className={statusColors[dispute.status]}>
                                <StatusIcon className="size-3 mr-1" />
                                {statusLabels[dispute.status]}
                              </Badge>
                            </div>
                            <p className="text-sm text-foreground mt-2 line-clamp-2">
                              {dispute.description}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                              {dispute.lease?.property && (
                                <span className="flex items-center gap-1">
                                  <FileText className="size-3" />
                                  {dispute.lease.property.title}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Calendar className="size-3" />
                                {new Date(dispute.createdAt).toLocaleDateString('fr-FR')}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDetailDispute(dispute)
                            setDetailOpen(true)
                          }}
                        >
                          <Eye className="size-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Resolved tab content */}
        <TabsContent value="resolved" className="mt-4">
          {filteredDisputes.length === 0 ? (
            <Card className="border-border">
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="size-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">Aucun litige résolu</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredDisputes.map((dispute) => {
                const typeConfig = typeOptions.find((t) => t.value === dispute.type)
                const TypeIcon = typeConfig?.icon || CircleDot
                const StatusIcon = statusIcons[dispute.status]
                return (
                  <Card
                    key={dispute.id}
                    className="border-border opacity-80 hover:shadow-sm transition-shadow cursor-pointer"
                    onClick={() => {
                      setDetailDispute(dispute)
                      setDetailOpen(true)
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className={cn('flex size-10 items-center justify-center rounded-lg shrink-0', typeConfig?.color || 'bg-gray-50')}>
                            <TypeIcon className="size-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={cn(typeConfig?.color)}>
                                {typeLabels[dispute.type]}
                              </Badge>
                              <Badge className={statusColors[dispute.status]}>
                                <StatusIcon className="size-3 mr-1" />
                                {statusLabels[dispute.status]}
                              </Badge>
                            </div>
                            <p className="text-sm text-foreground mt-2 line-clamp-2">
                              {dispute.description}
                            </p>
                            {dispute.resolution && (
                              <p className="text-xs text-green-700 bg-green-50 p-2 rounded-lg mt-2 line-clamp-2">
                                Résolution : {dispute.resolution}
                              </p>
                            )}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                              {dispute.lease?.property && (
                                <span>{dispute.lease.property.title}</span>
                              )}
                              <span>
                                {new Date(dispute.createdAt).toLocaleDateString('fr-FR')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Create Dispute Dialog ─────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Signaler un litige</DialogTitle>
            <DialogDescription>
              Utilisez ce formulaire pour signaler un problème lié à votre bail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Lease selection */}
            <div className="space-y-2">
              <Label htmlFor="lease">Bail concerné *</Label>
              <Select value={newLeaseId} onValueChange={setNewLeaseId}>
                <SelectTrigger id="lease">
                  <SelectValue placeholder="Sélectionnez un bail" />
                </SelectTrigger>
                <SelectContent>
                  {userLeases.map((lease) => (
                    <SelectItem key={lease.id} value={lease.id}>
                      {lease.propertyTitle} ({lease.status === 'ACTIVE' ? 'Actif' : lease.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label htmlFor="type">Type de litige *</Label>
              <Select value={newType} onValueChange={(v) => setNewType(v as DisputeType)}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Sélectionnez un type" />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <opt.icon className="size-4" />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Décrivez le problème en détail..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={5}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false)
                setNewType('')
                setNewDescription('')
                setNewLeaseId('')
              }}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              onClick={handleCreateDispute}
              disabled={!newType || !newDescription.trim() || !newLeaseId || submitting}
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Signaler le litige
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Detail Dialog ─────────────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={(open) => {
        if (!open) {
          setDetailOpen(false)
          setDetailDispute(null)
        }
      }}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détail du litige</DialogTitle>
          </DialogHeader>
          {detailDispute && (
            <div className="space-y-4 py-2">
              {/* Type + Status badges */}
              <div className="flex items-center gap-2 flex-wrap">
                {(() => {
                  const tc = typeOptions.find((t) => t.value === detailDispute.type)
                  const TypeIcon = tc?.icon || CircleDot
                  return (
                    <>
                      <Badge className={tc?.color || 'bg-gray-100 text-gray-700 flex items-center gap-1'}>
                        <TypeIcon className="size-3" />
                        {typeLabels[detailDispute.type]}
                      </Badge>
                      <Badge className={statusColors[detailDispute.status]}>
                        {statusLabels[detailDispute.status]}
                      </Badge>
                    </>
                  )
                })()}
              </div>

              {/* Description */}
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{detailDispute.description}</p>
              </div>

              {/* Lease info */}
              {detailDispute.lease && (
                <div className="p-3 rounded-lg border border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Bail concerné</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center gap-2">
                      <FileText className="size-3.5 text-muted-foreground" />
                      <span className="font-medium">{detailDispute.lease.property?.title || 'Bien'}</span>
                    </div>
                    {detailDispute.lease.property?.address && (
                      <p className="text-muted-foreground text-xs pl-5">
                        {detailDispute.lease.property.address}
                      </p>
                    )}
                    <p className="text-muted-foreground text-xs pl-5">
                      Loyer : {detailDispute.lease.monthlyRent.toLocaleString('fr-FR')} FCFA/mois
                    </p>
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="p-3 rounded-lg border border-border bg-muted/30">
                <p className="text-xs font-medium text-muted-foreground mb-2">Suivi</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="size-2 rounded-full bg-red-500 shrink-0" />
                    <span className="text-muted-foreground">
                      Signalé le {new Date(detailDispute.createdAt).toLocaleDateString('fr-FR', {
                        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                  {detailDispute.status === 'IN_REVIEW' && (
                    <div className="flex items-center gap-2 text-xs">
                      <div className="size-2 rounded-full bg-amber-500 shrink-0" />
                      <span className="text-amber-600 font-medium">En cours de traitement par le Tiers de Confiance</span>
                    </div>
                  )}
                  {detailDispute.resolvedAt && (
                    <div className="flex items-center gap-2 text-xs">
                      <div className="size-2 rounded-full bg-green-500 shrink-0" />
                      <span className="text-green-700">
                        Résolu le {new Date(detailDispute.resolvedAt).toLocaleDateString('fr-FR', {
                          day: 'numeric', month: 'long', year: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Resolution */}
              {detailDispute.resolution && (
                <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                  <p className="text-xs font-medium text-green-700 mb-1">Résolution</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{detailDispute.resolution}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
