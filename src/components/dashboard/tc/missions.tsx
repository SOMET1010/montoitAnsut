'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import {
  MapPin, User, Calendar, ChevronLeft, ChevronRight, Plus,
  Search, Clock, CheckCircle2, XCircle, Loader2, Home, FileText,
  Camera, MessageSquare, AlertTriangle, Flame, CircleDot, Link2,
  Check,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { usePagination } from '@/hooks/use-pagination'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { useAuthStore } from '@/lib/auth-store'
import { ViewModeToggle, type ViewMode } from './view-mode-toggle'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useInAppBrowser } from '@/hooks/capacitor'
import { useRealtimeMissions } from '@/hooks/use-realtime-missions'

// ─── Types ──────────────────────────────────────────────────────────────────

type MissionStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
type MissionType = 'PROPERTY_VERIFICATION' | 'INVENTORY_REPORT'
type DossierPriority = 'NORMAL' | 'HIGH' | 'URGENT'

interface Mission {
  id: string
  type: MissionType
  status: MissionStatus
  priority: DossierPriority
  scheduledAt: string
  notes: string | null
  tcComment: string | null
  completedAt: string | null
  photoUrls: string
  feedback: string | null
  reportUrl: string | null
  createdAt: string
  property: {
    id: string
    title: string
    address: string
    commune: string
  }
  agent: {
    id: string
    firstName: string
    lastName: string
    email: string
  } | null
}

interface AgentOption {
  id: string
  firstName: string
  lastName: string
  email: string
  isActive?: boolean
}

interface PropertyOption {
  id: string
  title: string
  address: string
  commune: string
}

interface ApiAgentsResponse {
  agents: AgentOption[]
}

interface ApiPropertiesResponse {
  properties: PropertyOption[]
  pagination?: { total: number }
}

// ─── Labels & Colors ────────────────────────────────────────────────────────

const statusLabels: Record<MissionStatus, string> = {
  ASSIGNED: 'Assignée',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
}

const statusColors: Record<MissionStatus, string> = {
  ASSIGNED: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-brand-100 text-brand-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

const statusDotColors: Record<MissionStatus, string> = {
  ASSIGNED: 'bg-amber-500',
  IN_PROGRESS: 'bg-brand-500',
  COMPLETED: 'bg-green-500',
  CANCELLED: 'bg-gray-400',
}

const typeLabels: Record<MissionType, string> = {
  PROPERTY_VERIFICATION: 'Vérification bien',
  INVENTORY_REPORT: 'État des lieux',
}

const typeColors: Record<MissionType, string> = {
  PROPERTY_VERIFICATION: 'bg-amber-50 text-amber-700 border-amber-200',
  INVENTORY_REPORT: 'bg-brand-50 text-brand-700 border-brand-200',
}

const priorityLabels: Record<DossierPriority, string> = {
  NORMAL: 'Normale',
  HIGH: 'Haute',
  URGENT: 'Urgente',
}

const priorityColors: Record<DossierPriority, string> = {
  NORMAL: 'bg-gray-100 text-gray-600',
  HIGH: 'bg-amber-100 text-amber-700',
  URGENT: 'bg-red-100 text-red-700',
}

const priorityIcons: Record<DossierPriority, React.ElementType> = {
  NORMAL: CircleDot,
  HIGH: AlertTriangle,
  URGENT: Flame,
}

function PriorityBadge({ priority }: { priority: DossierPriority }) {
  const Icon = priorityIcons[priority]
  return (
    <Badge className={cn('gap-1 text-xs', priorityColors[priority])}>
      <Icon className="size-3" />
      {priorityLabels[priority]}
    </Badge>
  )
}

// ─── Calendar Helpers ───────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

// ─── Component ──────────────────────────────────────────────────────────────

export function MissionsManagement() {
  const { user, isAuthenticated, selectedItemId, setSelectedItemId } = useAuthStore()

  // Data
  const [missions, setMissions] = useState<Mission[]>([])
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // View
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [activeTab, setActiveTab] = useState<string>('calendar')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<MissionStatus | 'ALL'>('ALL')
  const [agentFilter, setAgentFilter] = useState<string>('ALL')
  const [typeFilter, setTypeFilter] = useState<MissionType | 'ALL'>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<DossierPriority | 'ALL'>('ALL')

  // Calendar
  const today = new Date()
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  // Dialogs
  const [createDialog, setCreateDialog] = useState(false)
  const [detailDialog, setDetailDialog] = useState<{ open: boolean; mission: Mission | null }>({
    open: false, mission: null,
  })

  // Create form
  const [createForm, setCreateForm] = useState({
    propertyId: '',
    agentId: '',
    type: 'PROPERTY_VERIFICATION' as MissionType,
    scheduledAt: '',
    notes: '',
    priority: 'NORMAL' as DossierPriority,
  })
  const [creating, setCreating] = useState(false)

  // Combobox states
  const [propertySearchOpen, setPropertySearchOpen] = useState(false)
  const [agentSearchOpen, setAgentSearchOpen] = useState(false)
  const [propertySearch, setPropertySearch] = useState('')
  const [agentSearch, setAgentSearch] = useState('')

  const { openInWebView } = useInAppBrowser()

  // Photo URL input
  const [newPhotoUrl, setNewPhotoUrl] = useState('')

  // TC Feedback
  const [feedbackValue, setFeedbackValue] = useState('')
  const [savingFeedback, setSavingFeedback] = useState(false)

  // ─── Fetch ──────────────────────────────────────────────────────────────

  const fetchMissions = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    try {
      const data = await authFetch<Mission[]>('/api/tc/missions')
      setMissions(Array.isArray(data) ? data : [])
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) {
        setMissions([])
        return
      }
      setMissions([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  const fetchAgents = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const data = await authFetch<AgentOption[] | ApiAgentsResponse>('/api/tc/agents?isActive=true')
      setAgents(Array.isArray(data) ? data : (data as ApiAgentsResponse).agents || [])
    } catch {
      // Silent fail
    }
  }, [isAuthenticated])

  const fetchProperties = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const data = await authFetch<ApiPropertiesResponse>('/api/tc/verifications')
      setProperties(data.properties || [])
    } catch {
      // Silent fail
    }
  }, [isAuthenticated])

  useEffect(() => {
    fetchMissions()
    fetchAgents()
    fetchProperties()
  }, [fetchMissions, fetchAgents, fetchProperties])

  // Auto-navigate to mission detail when selectedItemId matches
  useEffect(() => {
    if (!selectedItemId || missions.length === 0) return
    const match = missions.find(m => m.id === selectedItemId)
    if (!match) return
    setSelectedItemId('')
    setDetailDialog({ open: true, mission: match })
  }, [selectedItemId, missions, setSelectedItemId])

  useRealtimeMissions({
    userId: user?.id,
    watchAll: true,
    onMissionChange: useCallback(() => {
      fetchMissions()
    }, [fetchMissions]),
  })

  // ─── Calendar data ─────────────────────────────────────────────────────

  const missionsByDate = useMemo(() => {
    const map: Record<string, Mission[]> = {}
    missions.forEach((m) => {
      const dateKey = formatDateKey(new Date(m.scheduledAt))
      if (!map[dateKey]) map[dateKey] = []
      map[dateKey].push(m)
    })
    return map
  }, [missions])

  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(calYear, calMonth)
    const firstDay = getFirstDayOfMonth(calYear, calMonth)
    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1
    const days: (number | null)[] = []
    for (let i = 0; i < adjustedFirstDay; i++) days.push(null)
    for (let d = 1; d <= daysInMonth; d++) days.push(d)
    return days
  }, [calYear, calMonth])

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1) }
    else setCalMonth(calMonth - 1)
  }

  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1) }
    else setCalMonth(calMonth + 1)
  }

  const selectedDayMissions = useMemo(() => {
    if (!selectedDay) return []
    return missionsByDate[selectedDay] || []
  }, [selectedDay, missionsByDate])

  const todayKey = formatDateKey(today)

  // ─── Filtered missions ────────────────────────────────────────────────

  const filteredMissions = missions.filter((m) => {
    if (statusFilter !== 'ALL' && m.status !== statusFilter) return false
    if (agentFilter !== 'ALL' && m.agent?.id !== agentFilter) return false
    if (typeFilter !== 'ALL' && m.type !== typeFilter) return false
    if (priorityFilter !== 'ALL' && m.priority !== priorityFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        m.property.title.toLowerCase().includes(q) ||
        m.property.address.toLowerCase().includes(q) ||
        (m.agent && `${m.agent.firstName} ${m.agent.lastName}`.toLowerCase().includes(q))
      )
    }
    return true
  })

  const {
    paginatedItems: pagedMissions,
    page: missionsPage,
    totalPages: missionsTotalPages,
    total: missionsTotal,
    pageSize: missionsPageSize,
    setPage: setMissionsPage,
  } = usePagination({
    items: filteredMissions,
    pageSize: 10,
    resetSignal: `${search}|${statusFilter}|${agentFilter}|${typeFilter}|${priorityFilter}`,
  })

  // ─── Create mission ───────────────────────────────────────────────────

  const openCreateDialog = () => {
    setCreateForm({
      propertyId: '',
      agentId: '',
      type: 'PROPERTY_VERIFICATION',
      scheduledAt: '',
      notes: '',
      priority: 'NORMAL',
    })
    setCreateDialog(true)
  }

  const handleCreate = async () => {
    if (!createForm.propertyId || !createForm.agentId || !createForm.scheduledAt) {
      toast.error('Veuillez remplir tous les champs requis')
      return
    }
    setCreating(true)
    try {
      await authFetch('/api/tc/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      toast.success('Mission créée avec succès !')
      setCreateDialog(false)
      await fetchMissions()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la création')
    } finally {
      setCreating(false)
    }
  }

  // ─── Status workflow ──────────────────────────────────────────────────

  const handleStatusChange = async (missionId: string, newStatus: MissionStatus) => {
    setActionLoading(missionId)
    try {
      await authFetch('/api/tc/missions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: missionId, status: newStatus }),
      })
      toast.success('Statut mis à jour !')
      setDetailDialog({ open: false, mission: null })
      await fetchMissions()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setActionLoading(null)
    }
  }

  // ─── Priority change ──────────────────────────────────────────────────

  const handlePriorityChange = async (missionId: string, priority: DossierPriority) => {
    try {
      await authFetch('/api/tc/missions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: missionId, priority }),
      })
      toast.success(`Priorité mise à jour : ${priorityLabels[priority]}`)
      await fetchMissions()
      setDetailDialog((prev) => {
        if (prev.mission?.id === missionId) {
          return { ...prev, mission: { ...prev.mission, priority } as Mission }
        }
        return prev
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
  }

  // ─── Add photo URL ────────────────────────────────────────────────────

  const handleAddPhoto = async () => {
    if (!detailDialog.mission || !newPhotoUrl.trim()) return
    setActionLoading(detailDialog.mission.id)
    try {
      await authFetch('/api/tc/missions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: detailDialog.mission.id,
          photoUrls: [newPhotoUrl.trim()],
        }),
      })
      toast.success('Photo ajoutée !')
      const oldUrls: string[] = JSON.parse(detailDialog.mission.photoUrls || '[]')
      const updatedUrls = [...oldUrls, newPhotoUrl.trim()]
      setNewPhotoUrl('')
      setDetailDialog((prev) => {
        if (prev.mission) {
          return { ...prev, mission: { ...prev.mission, photoUrls: JSON.stringify(updatedUrls) } as Mission }
        }
        return prev
      })
      await fetchMissions()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setActionLoading(null)
    }
  }

  // ─── Save TC Feedback ─────────────────────────────────────────────────

  const handleSaveFeedback = async () => {
    if (!detailDialog.mission) return
    setSavingFeedback(true)
    try {
      await authFetch('/api/tc/missions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: detailDialog.mission.id,
          feedback: feedbackValue,
        }),
      })
      toast.success('Retour TC sauvegardé !')
      setDetailDialog((prev) => {
        if (prev.mission) {
          return { ...prev, mission: { ...prev.mission, feedback: feedbackValue } as Mission }
        }
        return prev
      })
      await fetchMissions()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSavingFeedback(false)
    }
  }

  // ─── Loading skeleton ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <Card className="border-border bg-gradient-to-r from-brand-500/10 to-transparent">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-brand-100">
                <MapPin className="size-6 text-brand-600" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">Missions de vérification</h1>
                <p className="text-muted-foreground text-sm">Planifiez et suivez les missions terrain</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 border text-[10px]">
                    <Clock className="size-3 mr-0.5" /> {missions.filter(m => m.status === 'ASSIGNED').length} assignées
                  </Badge>
                  <Badge className="bg-brand-50 text-brand-700 border-brand-200 border text-[10px]">
                    <CircleDot className="size-3 mr-0.5" /> {missions.filter(m => m.status === 'IN_PROGRESS').length} en cours
                  </Badge>
                  <Badge className="bg-green-50 text-green-700 border-green-200 border text-[10px]">
                    <CheckCircle2 className="size-3 mr-0.5" /> {missions.filter(m => m.status === 'COMPLETED').length} terminées
                  </Badge>
                  <Badge className="bg-slate-50 text-slate-700 border-slate-200 border text-[10px]">
                    <MapPin className="size-3 mr-0.5" /> {missions.length} total
                  </Badge>
                </div>
              </div>
            </div>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shrink-0 shadow-sm" onClick={openCreateDialog}>
              <Plus className="size-4" /> Nouvelle mission
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card
          className={cn('border-border cursor-pointer transition-all hover:shadow-sm', statusFilter === 'ALL' && 'ring-1 ring-brand-400 bg-brand-50/20')}
          onClick={() => setStatusFilter('ALL')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50">
                <MapPin className="size-5 text-brand-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">{missions.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn('border-border cursor-pointer transition-all hover:shadow-sm', statusFilter === 'ASSIGNED' && 'ring-1 ring-amber-400 bg-amber-50/20')}
          onClick={() => setStatusFilter(statusFilter === 'ASSIGNED' ? 'ALL' : 'ASSIGNED')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50">
                <Clock className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-amber-600">{missions.filter(m => m.status === 'ASSIGNED').length}</p>
                <p className="text-xs text-muted-foreground">Assignées</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn('border-border cursor-pointer transition-all hover:shadow-sm', statusFilter === 'IN_PROGRESS' && 'ring-1 ring-orange-400 bg-orange-50/20')}
          onClick={() => setStatusFilter(statusFilter === 'IN_PROGRESS' ? 'ALL' : 'IN_PROGRESS')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-orange-50">
                <CircleDot className="size-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-orange-600">{missions.filter(m => m.status === 'IN_PROGRESS').length}</p>
                <p className="text-xs text-muted-foreground">En cours</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn('border-border cursor-pointer transition-all hover:shadow-sm', statusFilter === 'COMPLETED' && 'ring-1 ring-green-400 bg-green-50/20')}
          onClick={() => setStatusFilter(statusFilter === 'COMPLETED' ? 'ALL' : 'COMPLETED')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-green-50">
                <CheckCircle2 className="size-5 text-green-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-green-600">{missions.filter(m => m.status === 'COMPLETED').length}</p>
                <p className="text-xs text-muted-foreground">Terminées</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Toggle: Calendar / List */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <TabsList className="bg-muted">
            <TabsTrigger value="calendar" className="gap-1.5">
              <Calendar className="size-4" /> Calendrier
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-1.5">
              <Search className="size-4" /> Liste
            </TabsTrigger>
          </TabsList>

          {activeTab === 'list' && (
            <div className="flex gap-2 items-center">
              <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
            </div>
          )}
        </div>

        {/* ─── CALENDAR VIEW ────────────────────────────────────────────── */}
        <TabsContent value="calendar" className="mt-4">
          <div className="grid lg:grid-cols-3 gap-4">
            {/* Calendar grid */}
            <Card className="border-border lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={prevMonth}>
                    <ChevronLeft className="size-4" />
                  </Button>
                  <CardTitle className="text-base font-semibold">
                    {MONTH_NAMES[calMonth]} {calYear}
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={nextMonth}>
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {DAY_NAMES.map((d) => (
                    <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day, idx) => {
                    if (day === null) return <div key={`empty-${idx}`} className="aspect-square" />
                    const dateKey = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    const dayMissions = missionsByDate[dateKey] || []
                    const isToday = dateKey === todayKey
                    const isSelected = dateKey === selectedDay
                    return (
                      <button
                        key={dateKey}
                        onClick={() => setSelectedDay(dateKey === selectedDay ? null : dateKey)}
                        className={cn(
                          'aspect-square flex flex-col items-center justify-center rounded-lg text-sm relative transition-colors',
                          isSelected ? 'bg-brand-500 text-white' : isToday ? 'bg-brand-50 text-brand-700 font-semibold' : 'hover:bg-muted text-foreground',
                          dayMissions.length > 0 && !isSelected && 'font-medium'
                        )}
                      >
                        <span>{day}</span>
                        {dayMissions.length > 0 && (
                          <div className="flex gap-0.5 mt-0.5">
                            {dayMissions.slice(0, 3).map((m, mi) => (
                              <div key={mi} className={cn('size-1.5 rounded-full', isSelected ? 'bg-white' : statusDotColors[m.status])} />
                            ))}
                            {dayMissions.length > 3 && (
                              <span className={cn('text-[8px] leading-none', isSelected ? 'text-white/70' : 'text-muted-foreground')}>
                                +{dayMissions.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Day detail panel */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">
                  {selectedDay
                    ? new Date(selectedDay + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
                    : 'Sélectionnez un jour'}
                </CardTitle>
                {selectedDay && <CardDescription>{selectedDayMissions.length} mission(s)</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                {!selectedDay ? (
                  <div className="py-8 text-center">
                    <Calendar className="size-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Cliquez sur un jour pour voir les missions</p>
                  </div>
                ) : selectedDayMissions.length === 0 ? (
                  <div className="py-8 text-center">
                    <Clock className="size-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Aucune mission ce jour</p>
                  </div>
                ) : (
                  selectedDayMissions.map((m) => (
                    <div
                      key={m.id}
                      className="p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => {
                        setFeedbackValue(m.feedback || '')
                        setNewPhotoUrl('')
                        setDetailDialog({ open: true, mission: m })
                      }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5">
                          <Badge className={typeColors[m.type]} variant="outline">{typeLabels[m.type]}</Badge>
                          <PriorityBadge priority={m.priority} />
                        </div>
                        <Badge className={statusColors[m.status]}>{statusLabels[m.status]}</Badge>
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">{m.property.title}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="size-3 shrink-0" />
                        <span className="truncate">{m.property.address}, {m.property.commune}</span>
                      </p>
                      {m.agent && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <User className="size-3 shrink-0" />
                          {m.agent.firstName} {m.agent.lastName}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── LIST VIEW ────────────────────────────────────────────────── */}
        <TabsContent value="list" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1 min-w-0 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Rechercher une mission..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as MissionStatus | 'ALL')}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Statut" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les statuts</SelectItem>
                  {Object.entries(statusLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as DossierPriority | 'ALL')}>
                <SelectTrigger className="w-[130px]"><SelectValue placeholder="Priorité" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Toutes priorités</SelectItem>
                  {Object.entries(priorityLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={agentFilter} onValueChange={setAgentFilter}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Agent" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les agents</SelectItem>
                  {agents.map((a) => (<SelectItem key={a.id} value={a.id}>{a.firstName} {a.lastName}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as MissionType | 'ALL')}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les types</SelectItem>
                  {Object.entries(typeLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Empty state */}
          {filteredMissions.length === 0 ? (
            <Card className="border-border">
              <CardContent className="py-12 text-center">
                <Calendar className="size-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">Aucune mission trouvée</p>
                <p className="text-sm text-muted-foreground mt-1">Créez une nouvelle mission pour commencer</p>
              </CardContent>
            </Card>
          ) : viewMode === 'card' ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              <AnimatePresence mode="popLayout" initial={false} key={`page-${missionsPage}`}>
                {pagedMissions.map((m) => (
                  <motion.div key={m.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}>
                    <Card className="border-border hover:shadow-md transition-shadow">
                      <CardContent className="p-4 sm:p-6">
                        {/* Header row */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={cn('flex size-10 items-center justify-center rounded-lg shrink-0', m.type === 'PROPERTY_VERIFICATION' ? 'bg-amber-50' : 'bg-brand-50')}>
                              {m.type === 'PROPERTY_VERIFICATION' ? <Home className="size-5 text-amber-600" /> : <FileText className="size-5 text-brand-500" />}
                            </div>
                            <div className="min-w-0 flex flex-col gap-1">
                              <Badge className={typeColors[m.type]} variant="outline">{typeLabels[m.type]}</Badge>
                              <PriorityBadge priority={m.priority} />
                            </div>
                          </div>
                          <Badge className={statusColors[m.status]}>{statusLabels[m.status]}</Badge>
                        </div>

                        <h3 className="font-semibold text-foreground truncate mb-1">{m.property.title}</h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
                          <MapPin className="size-3.5 shrink-0" />
                          <span className="truncate">{m.property.address}, {m.property.commune}</span>
                        </p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                          {m.agent && (
                            <div className="flex items-center gap-1">
                              <User className="size-3.5 shrink-0" />
                              <span>{m.agent.firstName} {m.agent.lastName}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Calendar className="size-3.5 shrink-0" />
                            <span>{new Date(m.scheduledAt).toLocaleDateString('fr-FR')}</span>
                          </div>
                        </div>
                        <Button
                          size="sm" variant="outline"
                          className="w-full text-brand-500 border-brand-200 hover:bg-brand-50"
                          onClick={() => {
                            setFeedbackValue(m.feedback || '')
                            setNewPhotoUrl('')
                            setDetailDialog({ open: true, mission: m })
                          }}
                        >
                          Voir les détails
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
              <PaginationControls
                page={missionsPage}
                totalPages={missionsTotalPages}
                total={missionsTotal}
                limit={missionsPageSize}
                onPageChange={setMissionsPage}
                className="sm:col-span-2"
              />
            </div>
          ) : (
            <Card className="border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left font-medium text-muted-foreground p-3">Bien</th>
                      <th className="text-left font-medium text-muted-foreground p-3 hidden md:table-cell">Agent</th>
                      <th className="text-center font-medium text-muted-foreground p-3">Type</th>
                      <th className="text-center font-medium text-muted-foreground p-3 hidden md:table-cell">Priorité</th>
                      <th className="text-left font-medium text-muted-foreground p-3 hidden sm:table-cell">Date</th>
                      <th className="text-center font-medium text-muted-foreground p-3">Statut</th>
                      <th className="text-right font-medium text-muted-foreground p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence mode="popLayout" initial={false} key={`page-${missionsPage}`}>
                      {pagedMissions.map((m) => (
                        <motion.tr key={m.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="border-b border-border hover:bg-muted/30 transition-colors">
                          <td className="p-3">
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate max-w-[180px]">{m.property.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{m.property.commune}</p>
                            </div>
                          </td>
                          <td className="p-3 hidden md:table-cell">
                            {m.agent ? <span className="text-muted-foreground">{m.agent.firstName} {m.agent.lastName}</span> : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="p-3 text-center">
                            <Badge className={typeColors[m.type]} variant="outline">{typeLabels[m.type]}</Badge>
                          </td>
                          <td className="p-3 text-center hidden md:table-cell">
                            <PriorityBadge priority={m.priority} />
                          </td>
                          <td className="p-3 hidden sm:table-cell text-muted-foreground">
                            {new Date(m.scheduledAt).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="p-3 text-center">
                            <Badge className={statusColors[m.status]}>{statusLabels[m.status]}</Badge>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-end">
                              <Button size="sm" variant="ghost" className="text-brand-500 hover:text-brand-600 hover:bg-brand-50 h-8 px-3 text-xs"
                                onClick={() => {
                                  setFeedbackValue(m.feedback || '')
                                  setNewPhotoUrl('')
                                  setDetailDialog({ open: true, mission: m })
                                }}>
                                Détails
                              </Button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
              <div className="px-4 pb-3">
                <PaginationControls
                  page={missionsPage}
                  totalPages={missionsTotalPages}
                  total={missionsTotal}
                  limit={missionsPageSize}
                  onPageChange={setMissionsPage}
                />
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Create Mission Dialog ──────────────────────────────────────── */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5 text-brand-500" />
              Nouvelle mission
            </DialogTitle>
            <DialogDescription>Planifiez une nouvelle mission de vérification terrain</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Bien à vérifier — Searchable Combobox */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Bien à vérifier *</Label>
              <Popover open={propertySearchOpen} onOpenChange={setPropertySearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={propertySearchOpen}
                    className="w-full justify-between font-normal"
                  >
                    {createForm.propertyId
                      ? (() => {
                          const p = properties.find((x) => x.id === createForm.propertyId)
                          return p ? `${p.title} — ${p.commune}` : 'Sélectionner un bien'
                        })()
                      : 'Rechercher un bien...'
                    }
                    <Search className="size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start" style={{ width: 'var(--radix-popover-trigger-width)' }}>
                  <Command>
                    <CommandInput
                      placeholder="Rechercher par titre, adresse ou commune..."
                      value={propertySearch}
                      onValueChange={setPropertySearch}
                    />
                    <CommandList>
                      <CommandEmpty>Aucun bien trouvé</CommandEmpty>
                      <CommandGroup>
                        {properties
                          .filter((p) => {
                            if (!propertySearch) return true
                            const q = propertySearch.toLowerCase()
                            return (
                              p.title.toLowerCase().includes(q) ||
                              p.address.toLowerCase().includes(q) ||
                              p.commune.toLowerCase().includes(q)
                            )
                          })
                          .map((p) => (
                            <CommandItem
                              key={p.id}
                              value={p.id}
                              onSelect={() => {
                                setCreateForm((prev) => ({ ...prev, propertyId: p.id }))
                                setPropertySearchOpen(false)
                                setPropertySearch('')
                              }}
                            >
                              <Check className={cn('size-4 shrink-0', createForm.propertyId === p.id ? 'opacity-100' : 'opacity-0')} />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{p.title}</p>
                                <p className="text-xs text-muted-foreground truncate">{p.address}, {p.commune}</p>
                              </div>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {properties.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Aucun bien en attente de vérification</p>
              )}
            </div>

            {/* Agent — Searchable Combobox */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Agent *</Label>
              <Popover open={agentSearchOpen} onOpenChange={setAgentSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={agentSearchOpen}
                    className="w-full justify-between font-normal"
                  >
                    {createForm.agentId
                      ? (() => {
                          const a = agents.find((x) => x.id === createForm.agentId)
                          return a ? `${a.firstName} ${a.lastName}` : 'Sélectionner un agent'
                        })()
                      : 'Rechercher un agent...'
                    }
                    <Search className="size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start" style={{ width: 'var(--radix-popover-trigger-width)' }}>
                  <Command>
                    <CommandInput
                      placeholder="Rechercher par nom ou email..."
                      value={agentSearch}
                      onValueChange={setAgentSearch}
                    />
                    <CommandList>
                      <CommandEmpty>Aucun agent trouvé</CommandEmpty>
                      <CommandGroup>
                        {agents
                          .filter((a) => a.isActive !== false)
                          .filter((a) => {
                            if (!agentSearch) return true
                            const q = agentSearch.toLowerCase()
                            return (
                              `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) ||
                              a.email.toLowerCase().includes(q)
                            )
                          })
                          .map((a) => (
                            <CommandItem
                              key={a.id}
                              value={a.id}
                              onSelect={() => {
                                setCreateForm((prev) => ({ ...prev, agentId: a.id }))
                                setAgentSearchOpen(false)
                                setAgentSearch('')
                              }}
                            >
                              <Check className={cn('size-4 shrink-0', createForm.agentId === a.id ? 'opacity-100' : 'opacity-0')} />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium">{a.firstName} {a.lastName}</p>
                                <p className="text-xs text-muted-foreground">{a.email}</p>
                              </div>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Type + Priorité side by side on larger screens */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Type de mission *</Label>
                <Select value={createForm.type} onValueChange={(v) => setCreateForm((prev) => ({ ...prev, type: v as MissionType }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PROPERTY_VERIFICATION">Vérification bien</SelectItem>
                    <SelectItem value="INVENTORY_REPORT">État des lieux</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Priorité</Label>
                <Select value={createForm.priority} onValueChange={(v) => setCreateForm((prev) => ({ ...prev, priority: v as DossierPriority }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NORMAL"><span className="flex items-center gap-1.5"><CircleDot className="size-3" /> Normale</span></SelectItem>
                    <SelectItem value="HIGH"><span className="flex items-center gap-1.5"><AlertTriangle className="size-3" /> Haute</span></SelectItem>
                    <SelectItem value="URGENT"><span className="flex items-center gap-1.5"><Flame className="size-3" /> Urgente</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date planifiée */}
            <div className="space-y-2">
              <Label htmlFor="scheduledAt" className="text-xs font-medium text-muted-foreground">Date planifiée *</Label>
              <Input
                id="scheduledAt"
                type="date"
                value={createForm.scheduledAt}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, scheduledAt: e.target.value }))}
                className="w-full"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-xs font-medium text-muted-foreground">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Instructions ou informations complémentaires..."
                value={createForm.notes}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Quick summary */}
            {createForm.propertyId && createForm.agentId && createForm.scheduledAt && (
              <div className="p-3 rounded-lg bg-brand-50 border border-brand-100">
                <p className="text-xs text-brand-700 font-medium mb-1">Récapitulatif</p>
                <div className="space-y-1 text-xs text-brand-600">
                  <p>• Bien : {properties.find(p => p.id === createForm.propertyId)?.title || '—'}</p>
                  <p>• Agent : {agents.find(a => a.id === createForm.agentId)?.firstName || '—'} {agents.find(a => a.id === createForm.agentId)?.lastName || ''}</p>
                  <p>• Date : {new Date(createForm.scheduledAt).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setCreateDialog(false)}
              disabled={creating}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 w-full sm:w-auto"
              onClick={handleCreate}
              disabled={creating || !createForm.propertyId || !createForm.agentId || !createForm.scheduledAt}
            >
              {creating && <Loader2 className="size-4 animate-spin" />}
              Créer la mission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Mission Detail Dialog ──────────────────────────────────────── */}
      <Dialog
        open={detailDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setDetailDialog({ open: false, mission: null })
            setNewPhotoUrl('')
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détail de la mission</DialogTitle>
            <DialogDescription>{detailDialog.mission && typeLabels[detailDialog.mission.type]}</DialogDescription>
          </DialogHeader>
          {detailDialog.mission && (
            <div className="space-y-4 py-2">
              {/* Status + Priority */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Badge className={statusColors[detailDialog.mission.status]}>
                    {statusLabels[detailDialog.mission.status]}
                  </Badge>
                  <PriorityBadge priority={detailDialog.mission.priority} />
                </div>
              </div>

              {/* Priority changer */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Changer priorité :</span>
                {(['NORMAL', 'HIGH', 'URGENT'] as DossierPriority[]).map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    variant={detailDialog.mission!.priority === p ? 'default' : 'outline'}
                    className={cn(
                      'gap-1 text-xs',
                      detailDialog.mission!.priority === p && p === 'URGENT' && 'bg-red-600 hover:bg-red-700 text-white',
                      detailDialog.mission!.priority === p && p === 'HIGH' && 'bg-amber-600 hover:bg-amber-700 text-white',
                      detailDialog.mission!.priority === p && p === 'NORMAL' && 'bg-gray-600 hover:bg-gray-700 text-white',
                    )}
                    onClick={() => handlePriorityChange(detailDialog.mission!.id, p)}
                  >
                    {priorityLabels[p]}
                  </Button>
                ))}
              </div>

              {/* Property */}
              <div className="p-3 rounded-lg border border-border bg-muted/30">
                <p className="text-sm font-medium text-foreground">{detailDialog.mission.property.title}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="size-3 shrink-0" />
                  {detailDialog.mission.property.address}, {detailDialog.mission.property.commune}
                </p>
              </div>

              {/* Agent */}
              {detailDialog.mission.agent && (
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-brand-500/10 flex items-center justify-center shrink-0">
                    <User className="size-4 text-brand-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {detailDialog.mission.agent.firstName} {detailDialog.mission.agent.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">{detailDialog.mission.agent.email}</p>
                  </div>
                </div>
              )}

              {/* Scheduled date */}
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">Planifié le :</span>
                <span className="font-medium text-foreground">
                  {new Date(detailDialog.mission.scheduledAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>

              {/* Completed date */}
              {detailDialog.mission.completedAt && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-4 text-green-600" />
                  <span className="text-muted-foreground">Terminé le :</span>
                  <span className="font-medium text-foreground">
                    {new Date(detailDialog.mission.completedAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              )}

              {/* Notes */}
              {detailDialog.mission.notes && (
                <div className="p-3 rounded-lg bg-muted/30 border border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm text-foreground">{detailDialog.mission.notes}</p>
                </div>
              )}

              {/* TC Comment */}
              {detailDialog.mission.tcComment && (
                <div className="p-3 rounded-lg bg-brand-50 border border-brand-200">
                  <p className="text-xs font-medium text-brand-700 mb-1">Commentaire TC</p>
                  <p className="text-sm text-foreground">{detailDialog.mission.tcComment}</p>
                </div>
              )}

              {/* ─── Photos de vérification (US-TA-023) ──────────────────── */}
              <div className="p-3 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Camera className="size-4 text-muted-foreground" />
                  <p className="text-xs font-medium text-muted-foreground">Photos de vérification</p>
                </div>
                {(() => {
                  const urls: string[] = JSON.parse(detailDialog.mission.photoUrls || '[]')
                  return (
                    <div className="space-y-2">
                      {urls.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {urls.map((url, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => openInWebView(url)}
                              className="block w-full text-left"
                            >
                              <div className="aspect-square rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden hover:border-brand-300 transition-colors cursor-pointer">
                                <img
                                  src={url}
                                  alt={`Photo ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement
                                    target.style.display = 'none'
                                    target.parentElement!.innerHTML = `<div class="flex flex-col items-center justify-center text-muted-foreground"><svg class="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg><span class="text-[10px] mt-1">Photo ${idx + 1}</span></div>`
                                  }}
                                />
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Aucune photo ajoutée</p>
                      )}
                      {/* Add photo URL */}
                      <div className="flex gap-2 mt-2">
                        <Input
                          placeholder="Ajouter une URL de photo..."
                          value={newPhotoUrl}
                          onChange={(e) => setNewPhotoUrl(e.target.value)}
                          className="text-sm"
                        />
                        <Button
                          size="sm"
                          className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
                          onClick={handleAddPhoto}
                          disabled={!newPhotoUrl.trim() || actionLoading !== null}
                        >
                          <Link2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* ─── Retour TC (US-TA-055) ────────────────────────────────── */}
              {detailDialog.mission.status === 'COMPLETED' && (
                <div className="p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="size-4 text-brand-500" />
                    <p className="text-xs font-medium text-muted-foreground">Retour TC</p>
                  </div>
                  <Textarea
                    placeholder="Ajoutez votre retour sur cette mission..."
                    value={feedbackValue}
                    onChange={(e) => setFeedbackValue(e.target.value)}
                    rows={3}
                  />
                  <div className="flex justify-end mt-2">
                    <Button
                      size="sm"
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                      onClick={handleSaveFeedback}
                      disabled={savingFeedback}
                    >
                      {savingFeedback && <Loader2 className="size-3.5 animate-spin mr-1" />}
                      Sauvegarder le retour
                    </Button>
                  </div>
                </div>
              )}

              {/* Status workflow buttons */}
              <div className="flex gap-2 pt-2 border-t border-border">
                {detailDialog.mission.status === 'ASSIGNED' && (
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1 flex-1"
                    onClick={() => handleStatusChange(detailDialog.mission!.id, 'IN_PROGRESS')}
                    disabled={actionLoading === detailDialog.mission.id}>
                    {actionLoading === detailDialog.mission.id ? <Loader2 className="size-4 animate-spin" /> : <Clock className="size-4" />}
                    Démarrer
                  </Button>
                )}
                {detailDialog.mission.status === 'IN_PROGRESS' && (
                  <>
                    <Button className="bg-green-600 hover:bg-green-700 text-white gap-1 flex-1"
                      onClick={() => handleStatusChange(detailDialog.mission!.id, 'COMPLETED')}
                      disabled={actionLoading === detailDialog.mission.id}>
                      {actionLoading === detailDialog.mission.id ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                      Terminer
                    </Button>
                    <Button variant="outline" className="text-gray-600 border-gray-200 hover:bg-gray-50 gap-1"
                      onClick={() => handleStatusChange(detailDialog.mission!.id, 'CANCELLED')}
                      disabled={actionLoading === detailDialog.mission.id}>
                      <XCircle className="size-4" /> Annuler
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
