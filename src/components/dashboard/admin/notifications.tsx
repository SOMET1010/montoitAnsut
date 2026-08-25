'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, AlertTriangle, Shield, Eye, Check, Mail, Settings, CheckCheck, CreditCard, MessageSquare, Calendar, FileText, Scale, Star, Target, CheckCircle, Award, BadgeCheck, Wrench, Home } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { usePagination } from '@/hooks/use-pagination'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { useRealtimeNotifications } from '@/hooks/use-realtime-notifications'
import { useNotificationStore } from '@/lib/notification-store'

interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  actionUrl: string | null
  entityId: string | null
}

interface NotificationsResponse {
  data: NotificationItem[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
  unreadCount: number
}

const typeIcons: Record<string, typeof AlertTriangle> = {
  CRITICAL: AlertTriangle,
  SECURITY: Shield,
  SENSITIVE: Eye,
  SYSTEM: Settings,
  INFO: Bell,
  PAYMENT_ALERT: CreditCard,
  MESSAGE: MessageSquare,
  VISIT_REMINDER: Calendar,
  DOSSIER_UPDATE: FileText,
  MAINTENANCE: Wrench,
  LEASE_UPDATE: Home,
  DISPUTE_UPDATE: Scale,
  DISPUTE_ASSIGNED: Scale,
  APPLICATION: FileText,
  REVIEW: Star,
  MISSION_ASSIGNED: Target,
  MISSION_COMPLETED: CheckCircle,
  FRAUD_ALERT: AlertTriangle,
  CERTIFICATION: Award,
  PROPERTY_VERIFICATION: BadgeCheck,
  VERIFICATION_RESULT: BadgeCheck,
  PROMOTION: Bell,
}

const typeColors: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700',
  SECURITY: 'bg-red-100 text-red-700',
  SENSITIVE: 'bg-teal-100 text-teal-700',
  SYSTEM: 'bg-neutral-100 text-neutral-700',
  INFO: 'bg-green-100 text-green-700',
  PAYMENT_ALERT: 'bg-emerald-100 text-emerald-700',
  MESSAGE: 'bg-amber-100 text-amber-700',
  VISIT_REMINDER: 'bg-amber-100 text-amber-700',
  DOSSIER_UPDATE: 'bg-brand-50 text-brand-600',
  MAINTENANCE: 'bg-orange-100 text-orange-700',
  LEASE_UPDATE: 'bg-teal-100 text-teal-700',
  DISPUTE_UPDATE: 'bg-rose-100 text-rose-700',
  DISPUTE_ASSIGNED: 'bg-rose-100 text-rose-700',
  APPLICATION: 'bg-indigo-100 text-indigo-700',
  REVIEW: 'bg-yellow-100 text-yellow-700',
  MISSION_ASSIGNED: 'bg-violet-100 text-violet-700',
  MISSION_COMPLETED: 'bg-violet-100 text-violet-700',
  FRAUD_ALERT: 'bg-red-100 text-red-700',
  CERTIFICATION: 'bg-sky-100 text-sky-700',
  PROPERTY_VERIFICATION: 'bg-teal-100 text-teal-700',
  VERIFICATION_RESULT: 'bg-teal-100 text-teal-700',
  PROMOTION: 'bg-purple-100 text-purple-700',
}

// ─── Role-aware actionUrl mapping ───────────────────────────────────────────
const ROLE_ACTION_URL_MAP: Record<string, Record<string, string>> = {
  TIERS_CONFIANCE: {
    'messages': 'messaging',
    'my-properties': 'all-properties',
    'owner-file': 'owner-validations',
    'rental-file': 'dossier-validations',
    'rental-files': 'dossier-validations',
    'rental-files-queue': 'dossier-validations',
    'candidatures': 'dossier-validations',
    'applications': 'dossier-validations',
    'lease': 'dossier-validations',
    'payments': 'overview',
    'visit-requests': 'overview',
    'my-visits': 'overview',
    'my-leases': 'overview',
    'maintenance': 'overview',
    'reviews': 'overview',
    'mandats': 'overview',
    'properties-moderation': 'property-verifications',
    'signalements': 'litiges',
    'visits': 'overview',
    'trust-score': 'overview',
    'history': 'overview',
    'my-tenants': 'overview',
  },
  PROPRIETAIRE: {
    'rental-file': 'owner-file',
    'my-visits': 'visit-requests',
  },
  AGENCE: {
    'my-properties': 'portfolio',
    'my-visits': 'visits',
    'my-leases': 'contracts',
    'history': 'overview',
    'trust-score': 'overview',
    'owner-file': 'portfolio',
    'rental-file': 'candidatures',
  },
}

function mapActionUrl(actionUrl: string, role: string): string {
  const roleMap = ROLE_ACTION_URL_MAP[role]
  if (roleMap && roleMap[actionUrl]) {
    return roleMap[actionUrl]
  }
  return actionUrl
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "À l'instant"
  if (diffMin < 60) return `Il y a ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `Il y a ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `Il y a ${diffD}j`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export function AdminNotifications() {
  const { user, isAuthenticated } = useAuthStore()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [markingRead, setMarkingRead] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [notifPage, setNotifPage] = useState(1)
  const NOTIF_PAGE_SIZE = 10

  // Reset à la page 1 quand on change d'onglet
  useEffect(() => { setNotifPage(1) }, [activeTab])

  const tabFilteredCount = (tab: string) => {
    if (tab === 'unread') return notifications.filter((n) => !n.isRead).length
    if (tab === 'critical') return notifications.filter((n) => n.type === 'CRITICAL' || n.type === 'SECURITY').length
    return notifications.length
  }
  const currentTabTotal = tabFilteredCount(activeTab)
  const notifTotalPages = Math.max(1, Math.ceil(currentTabTotal / NOTIF_PAGE_SIZE))
  const [prefs, setPrefs] = useState({
    criticalErrors: true,
    securityAlerts: true,
    sensitiveActions: true,
    systemUpdates: true,
    emailDigest: true,
  })

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return }

    try {
      const result = await authFetch<NotificationsResponse>('/api/notifications?limit=50')
      setNotifications(result.data ?? [])
      setUnreadCount(result.unreadCount ?? 0)
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) return
      // Silently fail — don't use mock data
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => { fetchData() }, [fetchData])

  useRealtimeNotifications({
    userId: user?.id,
    onNotificationChange: useCallback(() => {
      fetchData()
    }, [fetchData]),
  })

  const togglePref = (key: keyof typeof prefs) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const { setDashboardSection, setSelectedItemId } = useAuthStore()

  const handleMarkAsRead = async (notification: NotificationItem) => {
    try {
      await authFetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: [notification.id] }),
      })
      setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
      useNotificationStore.setState((state) => ({
        unreadCount: Math.max(0, state.unreadCount - 1),
      }))
      if (notification.actionUrl) {
        const role = user?.activeRole || user?.role || ''
        const section = mapActionUrl(notification.actionUrl, role)
        if (notification.entityId) {
          setSelectedItemId(notification.entityId)
        }
        setDashboardSection(section)
      }
    } catch {
      // Silently fail
    }
  }

  const handleMarkAllAsRead = async () => {
    setMarkingRead(true)
    try {
      await authFetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      })
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      setUnreadCount(0)
      useNotificationStore.setState({ unreadCount: 0 })
      toast.success('Toutes marquées comme lues')
    } catch {
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setMarkingRead(false)
    }
  }

  if (loading) return <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}</div>

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Centre de notifications</h1>
          <p className="text-muted-foreground mt-1">{unreadCount} notification(s) non lue(s)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1" onClick={handleMarkAllAsRead} disabled={markingRead}>
            <CheckCheck className="size-3.5" /> Tout marquer comme lu
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted">
          <TabsTrigger value="all">Toutes ({notifications.length})</TabsTrigger>
          <TabsTrigger value="unread">Non lues ({unreadCount})</TabsTrigger>
          <TabsTrigger value="critical">Critiques</TabsTrigger>
          <TabsTrigger value="preferences">Préférences</TabsTrigger>
        </TabsList>

        {['all', 'unread', 'critical'].map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4 space-y-3">
            {(activeTab === tab
              ? notifications.filter((n) => {
                  if (tab === 'unread') return !n.isRead
                  if (tab === 'critical') return n.type === 'CRITICAL' || n.type === 'SECURITY'
                  return true
                }).slice((notifPage - 1) * NOTIF_PAGE_SIZE, notifPage * NOTIF_PAGE_SIZE)
              : []
            )
              .map((notification) => {
                const Icon = typeIcons[notification.type] || Bell
                const colorClass = typeColors[notification.type] || 'bg-neutral-100 text-neutral-700'
                return (
                  <Card key={notification.id} className={`border-border cursor-pointer ${!notification.isRead ? 'border-l-4 border-l-brand-500' : 'opacity-70'}`} onClick={() => { if (!notification.isRead || notification.actionUrl) handleMarkAsRead(notification) }}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                          <Icon className="size-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-foreground">{notification.title}</p>
                            {!notification.isRead && <div className="size-2 rounded-full bg-brand-500" />}
                          </div>
                          <p className="text-sm text-muted-foreground">{notification.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">{formatTimeAgo(notification.createdAt)}</p>
                        </div>
                        <div className="flex gap-1">
                          {!notification.isRead ? (
                            <Button size="icon" variant="ghost" className="size-7" title="Marquer comme lu" onClick={() => handleMarkAsRead(notification)}>
                              <Check className="size-3.5" />
                            </Button>
                          ) : (
                            <Button size="icon" variant="ghost" className="size-7" aria-label="Notification lue" onClick={() => { if (notification.actionUrl) handleMarkAsRead(notification) }}>
                              <Mail className="size-3.5 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            {activeTab === tab && currentTabTotal > 0 && (
              <PaginationControls
                page={notifPage}
                totalPages={notifTotalPages}
                total={currentTabTotal}
                limit={NOTIF_PAGE_SIZE}
                onPageChange={setNotifPage}
              />
            )}
            {notifications.filter((n) => {
              if (tab === 'unread') return !n.isRead
              if (tab === 'critical') return n.type === 'CRITICAL' || n.type === 'SECURITY'
              return true
            }).length === 0 && (
              <Card className="border-border">
                <CardContent className="py-8 text-center">
                  <Bell className="size-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-muted-foreground">Aucune notification</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}

        <TabsContent value="preferences" className="mt-4 space-y-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Settings className="size-5 text-brand-500" />
                Préférences de notification
              </CardTitle>
              <CardDescription>Configurer quelles notifications afficher</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'criticalErrors' as const, label: 'Erreurs critiques', desc: 'Alertes en cas d\'erreur système' },
                { key: 'securityAlerts' as const, label: 'Alertes de sécurité', desc: 'Tentatives de connexion suspectes' },
                { key: 'sensitiveActions' as const, label: 'Actions sensibles', desc: 'Changement de rôle, suspension, etc.' },
                { key: 'systemUpdates' as const, label: 'Mises à jour système', desc: 'Sauvegardes, maintenance, etc.' },
                { key: 'emailDigest' as const, label: 'Résumé par email', desc: 'Recevoir un résumé quotidien' },
              ].map((pref) => (
                <div key={pref.key} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">{pref.label}</p>
                    <p className="text-xs text-muted-foreground">{pref.desc}</p>
                  </div>
                  <Switch checked={prefs[pref.key]} onCheckedChange={() => togglePref(pref.key)} />
                </div>
              ))}
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2" onClick={() => toast.success('Préférences sauvegardées')}>
                <Check className="size-4" /> Sauvegarder
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}
