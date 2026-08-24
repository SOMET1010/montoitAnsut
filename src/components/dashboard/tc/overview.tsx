'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ClipboardCheck, BadgeCheck, Clock, AlertTriangle, FileText,
  Home, ArrowRight, Shield, Building2, CheckCircle2, XCircle,
  MessageSquare, TrendingUp, User, Activity, Users, MapPin, Scale,
  Award, ShieldAlert,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { useRealtimeRentalFiles } from '@/hooks/use-realtime-rental-files'
import { useRealtimeDisputes } from '@/hooks/use-realtime-disputes'
import { useRealtimeCertifications } from '@/hooks/use-realtime-certifications'
import { useRealtimeFraudAlerts } from '@/hooks/use-realtime-fraud-alerts'
import { useRealtimeProperties } from '@/hooks/use-realtime-properties'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TcStats {
  pendingRentalFiles: number
  pendingOwnershipDocs: number
  pendingProperties: number
  totalReviewed: number
  overdueSlas: number
  slaCompliance: number
  pendingAgencyDocs: number
  pendingOwnerDocs: number
  pendingOwnerFiles: number
  rentalFilesByStatus: {
    SUBMITTED: number
    TC_REVIEW: number
  }
  ownerFilesByStatus?: {
    SUBMITTED: number
    TC_REVIEW: number
  }
  pendingOwnerDocsByType?: {
    TITRE_FONCIER: number
    ACTE_NOTARIE: number
    ATTESTATION_PROPRIETE: number
  }
  pendingAgencyDocsByType?: {
    AGREMENT: number
    RCCM: number
  }
}

interface AgentSummary {
  id: string
  firstName: string
  lastName: string
  email: string
  isActive: boolean
  _count: { missions: number }
}

interface MissionSummary {
  id: string
  status: string
  type: string
  scheduledAt: string
  property: { id: string; title: string; address: string; commune: string | null }
  agent: { id: string; firstName: string; lastName: string }
}

interface DisputeSummary {
  id: string
  type: string
  status: string
  description: string
  createdAt: string
  reportedBy: { firstName: string; lastName: string }
}

interface RentalFileSummary {
  id: string
  status: string
  monthlyIncome: number | null
  employer: string | null
  createdAt: string
  tenant: { firstName: string; lastName: string; phone: string }
  documents: Array<{ type: string; status: string; name: string }>
}

interface OwnershipDocSummary {
  id: string
  type: string
  name: string
  status: string
  createdAt: string
  owner: { firstName: string; lastName: string; phone: string }
}

interface RecentActivity {
  entity: string
  action: string
  createdAt: string
}

interface CertificationStats {
  PENDING: number
  GRANTED: number
  REVOKED: number
  EXPIRED: number
  TOTAL: number
}

interface FraudAlertStats {
  OPEN: number
  INVESTIGATING: number
  CONFIRMED: number
  DISMISSED: number
}

interface ApiTcResponse {
  stats?: TcStats
  pendingRentalFiles?: RentalFileSummary[]
  pendingOwnershipDocs?: OwnershipDocSummary[]
  recentActivities?: RecentActivity[]
}

const defaultStats: TcStats = {
  pendingRentalFiles: 0,
  pendingOwnershipDocs: 0,
  pendingProperties: 0,
  totalReviewed: 0,
  overdueSlas: 0,
  slaCompliance: 100,
  pendingAgencyDocs: 0,
  pendingOwnerDocs: 0,
  pendingOwnerFiles: 0,
  rentalFilesByStatus: { SUBMITTED: 0, TC_REVIEW: 0 },
  ownerFilesByStatus: { SUBMITTED: 0, TC_REVIEW: 0 },
  pendingOwnerDocsByType: { TITRE_FONCIER: 0, ACTE_NOTARIE: 0, ATTESTATION_PROPRIETE: 0 },
  pendingAgencyDocsByType: { AGREMENT: 0, RCCM: 0 },
}

const defaultCertStats: CertificationStats = { PENDING: 0, GRANTED: 0, REVOKED: 0, EXPIRED: 0, TOTAL: 0 }
const defaultFraudStats: FraudAlertStats = { OPEN: 0, INVESTIGATING: 0, CONFIRMED: 0, DISMISSED: 0 }

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } }
const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }

const docTypeLabels: Record<string, string> = {
  TITRE_FONCIER: 'Titre foncier',
  ACTE_NOTARIE: 'Acte notarié',
  ATTESTATION_PROPRIETE: 'Attestation de propriété',
  RCCM: 'RCCM',
  AGREMENT: 'Agrément',
}

const actionLabels: Record<string, string> = {
  RENTAL_FILE_APPROVED: 'Dossier locatif validé',
  RENTAL_FILE_REJECTED: 'Dossier locatif rejeté',
  RENTAL_FILE_INFO_REQUESTED: 'Info demandée (dossier)',
  OWNERSHIP_DOC_APPROVED: 'Document validé',
  OWNERSHIP_DOC_REJECTED: 'Document rejeté',
  OWNERSHIP_DOC_INFO_REQUESTED: 'Info demandée (document)',
  PROPERTY_APPROVED: 'Bien approuvé',
  PROPERTY_REJECTED: 'Bien rejeté',
  INVENTORY_REPORT_CREATED: 'État des lieux créé',
  INVENTORY_REPORT_UPDATED: 'État des lieux modifié',
}

const actionIcons: Record<string, React.ElementType> = {
  RENTAL_FILE_APPROVED: CheckCircle2,
  RENTAL_FILE_REJECTED: XCircle,
  RENTAL_FILE_INFO_REQUESTED: MessageSquare,
  OWNERSHIP_DOC_APPROVED: CheckCircle2,
  OWNERSHIP_DOC_REJECTED: XCircle,
  OWNERSHIP_DOC_INFO_REQUESTED: MessageSquare,
  PROPERTY_APPROVED: CheckCircle2,
  PROPERTY_REJECTED: XCircle,
  INVENTORY_REPORT_CREATED: FileText,
  INVENTORY_REPORT_UPDATED: FileText,
}

const missionStatusLabels: Record<string, string> = {
  ASSIGNED: 'Assignée',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
}

const missionStatusColors: Record<string, string> = {
  ASSIGNED: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-brand-100 text-brand-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-700',
}

const disputeTypeLabels: Record<string, string> = {
  UNPAID_RENT: 'Loyer impayé',
  PROPERTY_DAMAGE: 'Dégât matériel',
  HARASSMENT: 'Harcèlement',
  FRAUD: 'Fraude',
  OTHER: 'Autre',
}

const disputeStatusLabels: Record<string, string> = {
  OPEN: 'Ouvert',
  IN_REVIEW: 'En cours',
  RESOLVED: 'Résolu',
  CLOSED: 'Fermé',
}

const disputeStatusColors: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-700',
  IN_REVIEW: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-700',
}

// ─── Component ──────────────────────────────────────────────────────────────

export function TcOverview() {
  const { user, isAuthenticated, setDashboardSection, setDossierValidationFilter } = useAuthStore()
  const [stats, setStats] = useState<TcStats>(defaultStats)
  const [pendingRentalFiles, setPendingRentalFiles] = useState<RentalFileSummary[]>([])
  const [pendingOwnershipDocs, setPendingOwnershipDocs] = useState<OwnershipDocSummary[]>([])
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([])
  const [agents, setAgents] = useState<AgentSummary[]>([])
  const [recentMissions, setRecentMissions] = useState<MissionSummary[]>([])
  const [recentDisputes, setRecentDisputes] = useState<DisputeSummary[]>([])
  const [certStats, setCertStats] = useState<CertificationStats>(defaultCertStats)
  const [fraudStats, setFraudStats] = useState<FraudAlertStats>(defaultFraudStats)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    try {
      const [d, pendingProps, agentsData, missionsData, litigesData, certData, fraudData] = await Promise.all([
        authFetch<ApiTcResponse>('/api/dashboard/tc'),
        authFetch<{ pagination: { total: number } }>('/api/tc/verifications?limit=1'),
        authFetch<AgentSummary[]>('/api/tc/agents').catch(() => [] as AgentSummary[]),
        authFetch<MissionSummary[]>('/api/tc/missions?limit=5').catch(() => [] as MissionSummary[]),
        authFetch<DisputeSummary[]>('/api/tc/litiges?limit=5').catch(() => [] as DisputeSummary[]),
        authFetch<{ stats: CertificationStats }>('/api/tc/certifications').catch(() => ({ stats: defaultCertStats })),
        authFetch<{ stats: FraudAlertStats }>('/api/tc/fraud-alerts').catch(() => ({ stats: defaultFraudStats })),
      ])

      const mergedStats: TcStats = {
        ...defaultStats,
        ...d.stats,
        pendingProperties: pendingProps.pagination?.total || 0,
      }

      setStats(mergedStats)
      setPendingRentalFiles(d.pendingRentalFiles ?? [])
      setPendingOwnershipDocs(d.pendingOwnershipDocs ?? [])
      setRecentActivities(d.recentActivities ?? [])
      setAgents(Array.isArray(agentsData) ? agentsData : [])
      setRecentMissions(Array.isArray(missionsData) ? missionsData : [])
      setRecentDisputes(Array.isArray(litigesData) ? litigesData : [])
      setCertStats(certData?.stats || defaultCertStats)
      setFraudStats(fraudData?.stats || defaultFraudStats)
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) {
        setStats(defaultStats)
        return
      }
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setStats(defaultStats)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useRealtimeRentalFiles({
    userId: user?.id,
    watchAll: true,
    onRentalFileChange: () => { fetchData() },
  })

  useRealtimeDisputes({
    userId: user?.id,
    watchAll: true,
    onDisputeChange: () => { fetchData() },
  })

  useRealtimeCertifications({
    userId: user?.id,
    watchAll: true,
    onCertificationChange: () => { fetchData() },
  })

  useRealtimeFraudAlerts({
    userId: user?.id,
    watchAll: true,
    onFraudAlertChange: () => { fetchData() },
  })

  useRealtimeProperties({
    userId: user?.id,
    watchAll: true,
    onPropertyChange: () => { fetchData() },
  })

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
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Bonjour, {user?.firstName} 👋</h1>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-sm text-amber-700">Impossible de charger vos données. Veuillez réessayer.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Computed stats
  const activeAgents = agents.filter(a => a.isActive).length
  const agentsOnMission = agents.filter(a => a._count.missions > 0).length
  const pendingMissions = recentMissions.filter(m => m.status === 'ASSIGNED' || m.status === 'IN_PROGRESS').length
  const openDisputes = recentDisputes.filter(d => d.status === 'OPEN' || d.status === 'IN_REVIEW').length

  // ─── Main status cards ──────────────────────────────────────────────────

  const mainCards = [
    {
      id: 'dossier-validations',
      label: 'Dossiers locataires',
      count: stats.pendingRentalFiles,
      icon: ClipboardCheck,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      hoverBg: 'hover:border-amber-300',
      breakdown: [
        { label: 'Soumis', count: stats.rentalFilesByStatus?.SUBMITTED ?? 0, color: 'text-amber-600' },
        { label: 'En revue TC', count: stats.rentalFilesByStatus?.TC_REVIEW ?? 0, color: 'text-orange-600' },
      ],
    },
    {
      id: 'owner-validations',
      label: 'Validations propriétaires',
      count: stats.pendingOwnerDocs,
      icon: BadgeCheck,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      hoverBg: 'hover:border-emerald-300',
      breakdown: [
        { label: 'Titre foncier', count: stats.pendingOwnerDocsByType?.TITRE_FONCIER ?? 0, color: 'text-emerald-600' },
        { label: 'Acte notarié', count: stats.pendingOwnerDocsByType?.ACTE_NOTARIE ?? 0, color: 'text-emerald-600' },
      ],
    },
    {
      id: 'owner-dossiers',
      label: 'Dossiers propriétaires',
      count: stats.pendingOwnerFiles,
      icon: FileText,
      color: 'text-sky-600',
      bgColor: 'bg-sky-50',
      borderColor: 'border-sky-200',
      hoverBg: 'hover:border-sky-300',
      breakdown: [
        { label: 'Soumis', count: stats.ownerFilesByStatus?.SUBMITTED ?? 0, color: 'text-sky-600' },
        { label: 'Complément demandé', count: stats.ownerFilesByStatus?.TC_REVIEW ?? 0, color: 'text-orange-600' },
      ],
    },
    {
      id: 'agency-validations',
      label: 'Validations agences',
      count: stats.pendingAgencyDocs,
      icon: Building2,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50',
      borderColor: 'border-rose-200',
      hoverBg: 'hover:border-rose-300',
      breakdown: [
        { label: 'Agrément', count: stats.pendingAgencyDocsByType?.AGREMENT ?? 0, color: 'text-rose-600' },
        { label: 'RCCM', count: stats.pendingAgencyDocsByType?.RCCM ?? 0, color: 'text-rose-600' },
      ],
    },
  ]

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants}>
        <Card className="border-border bg-gradient-to-r from-brand-500/10 to-transparent">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-xl bg-brand-100">
                  <ClipboardCheck className="size-6 text-brand-600" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-foreground">Bonjour, {user?.firstName} 👋</h1>
                  <p className="text-muted-foreground text-sm">Espace Tiers de Confiance — Validation, contrôle et supervision</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge className="bg-amber-50 text-amber-700 border-amber-200 border text-[10px]">
                      <ClipboardCheck className="size-3 mr-0.5" /> {stats.pendingRentalFiles} dossier{stats.pendingRentalFiles !== 1 ? 's' : ''} en attente
                    </Badge>
                    <Badge className="bg-brand-50 text-brand-700 border-brand-200 border text-[10px]">
                      <Home className="size-3 mr-0.5" /> {stats.pendingProperties} bien{stats.pendingProperties !== 1 ? 's' : ''} à vérifier
                    </Badge>
                    <Badge className="bg-orange-50 text-orange-700 border-orange-200 border text-[10px]">
                      <Scale className="size-3 mr-0.5" /> {openDisputes} litige{openDisputes !== 1 ? 's' : ''} ouvert{openDisputes !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── 4 Main Status Cards ──────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {mainCards.map((card) => {
          const Icon = card.icon
          return (
            <Card
              key={card.id}
              className={cn(
                'border-2 cursor-pointer transition-all duration-200',
                card.borderColor,
                card.hoverBg,
                'hover:shadow-lg'
              )}
              onClick={() => {
                const filterMap: Record<string, string> = {
                  'dossier-validations': 'locataire',
                  'owner-validations': 'proprietaire',
                  'owner-dossiers': 'proprietaire',
                  'agency-validations': 'agence',
                }
                setDossierValidationFilter(filterMap[card.id] || 'all')
                setDashboardSection('dossier-validations')
              }}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className={cn('flex size-12 items-center justify-center rounded-xl', card.bgColor)}>
                    <Icon className={cn('size-6', card.color)} />
                  </div>
                  <div className="text-right">
                    <p className={cn('text-3xl font-bold', card.color)}>{card.count}</p>
                    <p className="text-xs text-muted-foreground">en attente</p>
                  </div>
                </div>

                <h3 className="text-base font-semibold text-foreground mb-2">{card.label}</h3>

                {/* Breakdown */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {card.breakdown.map((item) => (
                    <div key={item.label} className="flex items-center gap-1 text-xs">
                      <span className={cn('font-semibold', item.color)}>{item.count}</span>
                      <span className="text-muted-foreground">{item.label}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-1 text-xs font-medium text-brand-500">
                  Voir les détails <ArrowRight className="size-3" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </motion.div>

      {/* ─── Agents & Missions Row ──────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Agents actifs */}
        <Card
          className="border-border cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setDashboardSection('agents')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-teal-50">
                <Users className="size-5 text-teal-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">{activeAgents}</p>
                <p className="text-xs text-muted-foreground">Agents actifs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Missions en cours */}
        <Card
          className="border-border cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setDashboardSection('missions')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50">
                <MapPin className="size-5 text-brand-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">{pendingMissions}</p>
                <p className="text-xs text-muted-foreground">Missions en cours</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Biens à vérifier */}
        <Card
          className="border-border cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setDashboardSection('property-verifications')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50">
                <Home className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.pendingProperties}</p>
                <p className="text-xs text-muted-foreground">Biens à vérifier</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Litiges ouverts */}
        <Card
          className="border-border cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setDashboardSection('litiges')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn('flex size-10 items-center justify-center rounded-lg', openDisputes > 0 ? 'bg-red-50' : 'bg-green-50')}>
                <Scale className={cn('size-5', openDisputes > 0 ? 'text-red-600' : 'text-green-600')} />
              </div>
              <div>
                <p className={cn('text-xl sm:text-2xl font-bold', openDisputes > 0 ? 'text-red-600' : 'text-green-600')}>
                  {openDisputes}
                </p>
                <p className="text-xs text-muted-foreground">Litiges ouverts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Certifications */}
        <Card
          className="border-border cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setDashboardSection('certifications')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-orange-50">
                <Award className="size-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">{certStats.GRANTED}</p>
                <p className="text-xs text-muted-foreground">Certifications</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fraud alerts */}
        {fraudStats.OPEN > 0 && (
          <Card
            className="border-red-200 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setDashboardSection('fraud-alerts')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-red-50">
                  <ShieldAlert className="size-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold text-red-600">{fraudStats.OPEN}</p>
                  <p className="text-xs text-muted-foreground">Alertes fraude</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        {fraudStats.OPEN === 0 && (
          <Card
            className="border-border cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setDashboardSection('fraud-alerts')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-green-50">
                  <ShieldAlert className="size-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold text-green-600">0</p>
                  <p className="text-xs text-muted-foreground">Alertes fraude</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* ─── Two-column: Recent Missions + Recent Disputes ──────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Missions */}
        <motion.div variants={itemVariants}>
          <Card className="border-border h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Missions récentes</CardTitle>
                  <CardDescription>{recentMissions.length} mission(s)</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="text-brand-500 gap-1" onClick={() => setDashboardSection('missions')}>
                  Voir tout <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 max-h-72 overflow-y-auto">
              {recentMissions.length === 0 ? (
                <div className="py-8 text-center">
                  <MapPin className="size-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Aucune mission récente</p>
                </div>
              ) : (
                recentMissions.map((mission) => (
                  <div
                    key={mission.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => setDashboardSection('missions')}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-8 rounded-full bg-brand-50 flex items-center justify-center shrink-0">
                        <MapPin className="size-4 text-brand-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {mission.property.title || mission.property.address}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {mission.agent.firstName} {mission.agent.lastName} · {new Date(mission.scheduledAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                    </div>
                    <Badge className={missionStatusColors[mission.status] || 'bg-gray-100 text-gray-700'}>
                      {missionStatusLabels[mission.status] || mission.status}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Disputes */}
        <motion.div variants={itemVariants}>
          <Card className="border-border h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Litiges récents</CardTitle>
                  <CardDescription>{recentDisputes.length} litige(s)</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="text-brand-500 gap-1" onClick={() => setDashboardSection('litiges')}>
                  Voir tout <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 max-h-72 overflow-y-auto">
              {recentDisputes.length === 0 ? (
                <div className="py-8 text-center">
                  <Scale className="size-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Aucun litige</p>
                </div>
              ) : (
                recentDisputes.map((dispute) => (
                  <div
                    key={dispute.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => setDashboardSection('litiges')}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        'size-8 rounded-full flex items-center justify-center shrink-0',
                        dispute.status === 'OPEN' ? 'bg-red-50' : dispute.status === 'IN_REVIEW' ? 'bg-amber-50' : 'bg-green-50'
                      )}>
                        <Scale className={cn(
                          'size-4',
                          dispute.status === 'OPEN' ? 'text-red-600' : dispute.status === 'IN_REVIEW' ? 'text-amber-600' : 'text-green-600'
                        )} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{disputeTypeLabels[dispute.type] || dispute.type}</p>
                        <p className="text-xs text-muted-foreground">
                          {dispute.reportedBy.firstName} {dispute.reportedBy.lastName}
                        </p>
                      </div>
                    </div>
                    <Badge className={disputeStatusColors[dispute.status] || 'bg-gray-100 text-gray-700'}>
                      {disputeStatusLabels[dispute.status] || dispute.status}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ─── Quick Action: Property Verifications ────────────────────────────── */}
      {stats.pendingProperties > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-brand-200 bg-brand-50/30">
            <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-brand-500 text-white shrink-0">
                  <Home className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{stats.pendingProperties} bien(s) en attente de vérification</p>
                  <p className="text-xs text-muted-foreground">Ces annonces nécessitent votre validation avant publication</p>
                </div>
              </div>
              <Button
                onClick={() => setDashboardSection('property-verifications')}
                className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
              >
                Vérifier
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ─── Fraud Alerts Quick Action ─────────────────────────────────────── */}
      {fraudStats.OPEN > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-red-200 bg-red-50/30">
            <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-red-500 text-white shrink-0">
                  <ShieldAlert className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{fraudStats.OPEN} alerte(s) de fraude ouverte(s)</p>
                  <p className="text-xs text-muted-foreground">Des investigations nécessitent votre attention</p>
                </div>
              </div>
              <Button
                onClick={() => setDashboardSection('fraud-alerts')}
                className="bg-red-600 hover:bg-red-700 text-white shrink-0"
              >
                Voir les alertes
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ─── Pending Certifications Quick Action ─────────────────────────────── */}
      {certStats.PENDING > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-amber-200 bg-amber-50/30">
            <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500 text-white shrink-0">
                  <Award className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{certStats.PENDING} certification(s) en attente</p>
                  <p className="text-xs text-muted-foreground">Des utilisateurs attendent leur certification</p>
                </div>
              </div>
              <Button
                onClick={() => setDashboardSection('certifications')}
                className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
              >
                Traiter
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ─── Two-column: Recent Rental Files + Activities ──────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pending Rental Files */}
        <motion.div variants={itemVariants}>
          <Card className="border-border h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Dossiers locataires récents</CardTitle>
                  <CardDescription>{pendingRentalFiles.length} en attente de validation</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="text-brand-500 gap-1" onClick={() => setDashboardSection('dossier-validations')}>
                  Voir tout <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 max-h-72 overflow-y-auto">
              {pendingRentalFiles.length === 0 ? (
                <div className="py-8 text-center">
                  <ClipboardCheck className="size-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Aucun dossier en attente</p>
                </div>
              ) : (
                pendingRentalFiles.slice(0, 5).map((rf) => (
                  <div
                    key={rf.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => setDashboardSection('dossier-validations')}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-8 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                        <User className="size-4 text-amber-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {rf.tenant.firstName} {rf.tenant.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{rf.documents.length} document(s)</p>
                      </div>
                    </div>
                    <Badge className={rf.status === 'SUBMITTED' ? 'bg-amber-100 text-amber-700' : 'bg-orange-100 text-orange-700'}>
                      {rf.status === 'SUBMITTED' ? 'Soumis' : 'En revue TC'}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Activities */}
        <motion.div variants={itemVariants}>
          <Card className="border-border h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Activité récente</CardTitle>
                  <CardDescription>Vos dernières actions de vérification</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="text-brand-500 gap-1" onClick={() => setDashboardSection('settings')}>
                  Activité <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 max-h-72 overflow-y-auto">
              {recentActivities.length === 0 ? (
                <div className="py-8 text-center">
                  <Activity className="size-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Aucune activité récente</p>
                </div>
              ) : (
                recentActivities.map((activity, idx) => {
                  const Icon = actionIcons[activity.action] || FileText
                  const label = actionLabels[activity.action] || activity.action
                  const isApproved = activity.action.includes('APPROVED')
                  const isRejected = activity.action.includes('REJECTED')
                  return (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                      <div className={cn(
                        'size-8 rounded-full flex items-center justify-center shrink-0',
                        isApproved ? 'bg-green-50' : isRejected ? 'bg-red-50' : 'bg-amber-50'
                      )}>
                        <Icon className={cn(
                          'size-4',
                          isApproved ? 'text-green-600' : isRejected ? 'text-red-600' : 'text-amber-600'
                        )} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{label}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(activity.createdAt).toLocaleDateString('fr-FR', {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ─── SLA Compliance Bar ─────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50 shrink-0">
                  <Shield className="size-5 text-brand-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">Conformité SLA</p>
                  <p className="text-xs text-muted-foreground">Objectif : 100% sous 48h</p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                {stats.slaCompliance >= 90 ? (
                  <Badge className="bg-green-100 text-green-700 text-[10px] sm:text-xs">✓ Conforme</Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-700 text-[10px] sm:text-xs">⚠ En dessous</Badge>
                )}
                <span className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground">{stats.slaCompliance}%</span>
              </div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  stats.slaCompliance >= 90 ? 'bg-green-500' : stats.slaCompliance >= 70 ? 'bg-amber-500' : 'bg-red-500'
                )}
                style={{ width: `${stats.slaCompliance}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

    </motion.div>
  )
}
