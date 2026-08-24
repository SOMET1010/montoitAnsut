'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ShieldCheck, Search, Check, X, Fingerprint, CreditCard,
  CheckCircle2, XCircle, Clock, User, Loader2, AlertTriangle,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { usePagination } from '@/hooks/use-pagination'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { useRealtimeUsers } from '@/hooks/use-realtime-users'
import { useRealtimeFacialVerifications } from '@/hooks/use-realtime-facial-verifications'
import { ViewModeToggle, type ViewMode } from './view-mode-toggle'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface OneciUser {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  nni: string | null
  oneciVerified: boolean
  oneciVerifiedAt: string | null
  neofaceVerified: boolean
  neofaceVerifiedAt: string | null
  role: string
}

interface OneciStats {
  totalUsers: number
  oneciVerified: number
  neofaceVerified: number
  oneciPending: number
  neofacePending: number
}

// ─── Filter options ────────────────────────────────────────────────────────

const filterOptions = [
  { value: 'ALL', label: 'Tous' },
  { value: 'ONECI_VERIFIED', label: 'ONECI vérifié' },
  { value: 'ONECI_PENDING', label: 'ONECI en attente' },
  { value: 'NEOFACE_VERIFIED', label: 'NeoFace vérifié' },
  { value: 'NEOFACE_PENDING', label: 'NeoFace en attente' },
]

// ─── Component ──────────────────────────────────────────────────────────────

export function OneciVerification() {
  const { user, isAuthenticated } = useAuthStore()
  const [users, setUsers] = useState<OneciUser[]>([])
  const [stats, setStats] = useState<OneciStats>({ totalUsers: 0, oneciVerified: 0, neofaceVerified: 0, oneciPending: 0, neofacePending: 0 })
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Reject dialog
  const [rejectDialog, setRejectDialog] = useState<{
    open: boolean
    userId: string
    action: 'REJECT_ONECI' | 'REJECT_NEOFACE'
    userName: string
  }>({ open: false, userId: '', action: 'REJECT_ONECI', userName: '' })
  const [rejectComment, setRejectComment] = useState('')

  // ─── Fetch ─────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    try {
      const params = new URLSearchParams()
      if (filter !== 'ALL') params.set('filter', filter)
      if (search.trim()) params.set('search', search.trim())

      const data = await authFetch<{ users: OneciUser[]; stats: OneciStats }>(
        `/api/tc/oneci?${params.toString()}`
      )
      setUsers(data.users || [])
      setStats(data.stats || { totalUsers: 0, oneciVerified: 0, neofaceVerified: 0, oneciPending: 0, neofacePending: 0 })
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) {
        setUsers([])
        return
      }
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, filter, search])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useRealtimeUsers({
    userId: user?.id,
    watchAll: true,
    onUserChange: () => { fetchData() },
  })

  useRealtimeFacialVerifications({
    userId: user?.id,
    watchAll: true,
    onFacialVerificationChange: () => { fetchData() },
  })

  const {
    paginatedItems: pagedUsers,
    page,
    totalPages,
    total,
    pageSize,
    setPage,
  } = usePagination({
    items: users,
    pageSize: 10,
    resetSignal: `${filter}|${search}`,
  })

  // ─── Actions ──────────────────────────────────────────────────────────

  const handleAction = async (userId: string, action: string, comment?: string) => {
    setActionLoading(userId)
    try {
      await authFetch('/api/tc/oneci', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action, comment }),
      })
      toast.success(
        action.startsWith('VERIFY') ? 'Vérification confirmée' : 'Vérification rejetée'
      )
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setActionLoading(null)
    }
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
      <div className="bg-gradient-to-r from-brand-500/10 to-transparent rounded-xl p-4 sm:p-6 -mx-4 sm:-mx-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-brand-100 shrink-0">
            <ShieldCheck className="size-6 text-brand-500" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Vérification ONECI</h1>
            <p className="text-muted-foreground mt-0.5">Vérifiez l&apos;identité des utilisateurs via ONECI et NeoFace</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge variant="secondary" className="bg-brand-50 text-brand-700">
            <User className="size-3 mr-1" /> {stats.totalUsers} utilisateurs
          </Badge>
          <Badge variant="secondary" className="bg-green-50 text-green-700">
            <ShieldCheck className="size-3 mr-1" /> {stats.oneciVerified} ONECI
          </Badge>
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
            <Fingerprint className="size-3 mr-1" /> {stats.neofaceVerified} NeoFace
          </Badge>
          <Badge variant="secondary" className="bg-amber-50 text-amber-700">
            <Clock className="size-3 mr-1" /> {stats.oneciPending + stats.neofacePending} en attente
          </Badge>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50">
                <User className="size-5 text-brand-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.totalUsers}</p>
                <p className="text-xs text-muted-foreground">Total utilisateurs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-green-50">
                <ShieldCheck className="size-5 text-green-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.oneciVerified}</p>
                <p className="text-xs text-muted-foreground">ONECI vérifié</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50">
                <Fingerprint className="size-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-emerald-600">{stats.neofaceVerified}</p>
                <p className="text-xs text-muted-foreground">NeoFace vérifié</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50">
                <Clock className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-amber-600">{stats.oneciPending}</p>
                <p className="text-xs text-muted-foreground">En attente</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
        </div>
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={filter === opt.value ? 'default' : 'outline'}
              className={cn(
                'text-xs',
                filter === opt.value
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  : 'hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200'
              )}
              onClick={() => setFilter(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {users.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <ShieldCheck className="size-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">Aucun utilisateur trouvé</p>
            <p className="text-sm text-muted-foreground mt-1">Ajustez les filtres ou la recherche</p>
          </CardContent>
        </Card>
      ) : viewMode === 'card' ? (
        /* ─── Card View ──────────────────────────────────────────── */
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          <AnimatePresence mode="popLayout" initial={false} key={`page-${page}`}>
            {pagedUsers.map((u) => (
              <motion.div
                key={u.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="border hover:shadow-md transition-shadow">
                  <CardContent className="p-4 sm:p-5">
                    {/* User header */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="size-10 rounded-full bg-brand-50 flex items-center justify-center shrink-0">
                        <User className="size-5 text-brand-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">
                          {u.firstName} {u.lastName}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {u.role === 'LOCATAIRE' ? 'Locataire' :
                         u.role === 'PROPRIETAIRE' ? 'Propriétaire' :
                         u.role === 'AGENCE' ? 'Agence' : u.role}
                      </Badge>
                    </div>

                    {/* Contact + NNI */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground mb-3">
                      {u.phone && (
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{u.phone}</span>
                        </div>
                      )}
                      {u.nni && (
                        <div className="flex items-center gap-1.5">
                          <CreditCard className="size-3.5 shrink-0" />
                          <span>NNI: {u.nni}</span>
                        </div>
                      )}
                    </div>

                    {/* Verification badges */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      <div className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium',
                        u.oneciVerified
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      )}>
                        {u.oneciVerified
                          ? <CheckCircle2 className="size-3.5" />
                          : <Clock className="size-3.5" />
                        }
                        ONECI {u.oneciVerified ? 'vérifié' : 'en attente'}
                      </div>
                      <div className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium',
                        u.neofaceVerified
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      )}>
                        {u.neofaceVerified
                          ? <CheckCircle2 className="size-3.5" />
                          : <Clock className="size-3.5" />
                        }
                        NeoFace {u.neofaceVerified ? 'vérifié' : 'en attente'}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                      {!u.oneciVerified && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white gap-1"
                          onClick={() => handleAction(u.id, 'VERIFY_ONECI')}
                          disabled={actionLoading === u.id}
                        >
                          {actionLoading === u.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                          Vérifier ONECI
                        </Button>
                      )}
                      {u.oneciVerified && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50 gap-1"
                          onClick={() => setRejectDialog({
                            open: true, userId: u.id, action: 'REJECT_ONECI',
                            userName: `${u.firstName} ${u.lastName}`,
                          })}
                          disabled={actionLoading === u.id}
                        >
                          <XCircle className="size-3.5" /> Rejeter ONECI
                        </Button>
                      )}
                      {!u.neofaceVerified && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-green-600 hover:bg-green-700 text-white border-green-600 gap-1"
                          onClick={() => handleAction(u.id, 'VERIFY_NEOFACE')}
                          disabled={actionLoading === u.id}
                        >
                          {actionLoading === u.id ? <Loader2 className="size-3.5 animate-spin" /> : <Fingerprint className="size-3.5" />}
                          Vérifier NeoFace
                        </Button>
                      )}
                      {u.neofaceVerified && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50 gap-1"
                          onClick={() => setRejectDialog({
                            open: true, userId: u.id, action: 'REJECT_NEOFACE',
                            userName: `${u.firstName} ${u.lastName}`,
                          })}
                          disabled={actionLoading === u.id}
                        >
                          <XCircle className="size-3.5" /> Rejeter NeoFace
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
          <PaginationControls
            page={page}
            totalPages={totalPages}
            total={total}
            limit={pageSize}
            onPageChange={setPage}
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
                  <th className="text-center font-medium text-muted-foreground p-3 hidden sm:table-cell">ONECI</th>
                  <th className="text-center font-medium text-muted-foreground p-3 hidden md:table-cell">NeoFace</th>
                  <th className="text-left font-medium text-muted-foreground p-3 hidden lg:table-cell">NNI</th>
                  <th className="text-right font-medium text-muted-foreground p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout" initial={false} key={`page-${page}`}>
                  {pagedUsers.map((u) => (
                    <motion.tr
                      key={u.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="border-b border-border hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="size-8 rounded-full bg-brand-50 flex items-center justify-center shrink-0">
                            <User className="size-4 text-brand-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {u.firstName} {u.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-center hidden sm:table-cell">
                        <Badge className={u.oneciVerified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                          {u.oneciVerified ? '✓ Vérifié' : 'En attente'}
                        </Badge>
                      </td>
                      <td className="p-3 text-center hidden md:table-cell">
                        <Badge className={u.neofaceVerified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                          {u.neofaceVerified ? '✓ Vérifié' : 'En attente'}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground hidden lg:table-cell">
                        {u.nni || '—'}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          {!u.oneciVerified && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50 h-8 w-8 p-0"
                              onClick={() => handleAction(u.id, 'VERIFY_ONECI')}
                              disabled={actionLoading === u.id}
                              title="Vérifier ONECI"
                            >
                              <ShieldCheck className="size-4" />
                            </Button>
                          )}
                          {u.oneciVerified && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                              onClick={() => setRejectDialog({
                                open: true, userId: u.id, action: 'REJECT_ONECI',
                                userName: `${u.firstName} ${u.lastName}`,
                              })}
                              disabled={actionLoading === u.id}
                              title="Rejeter ONECI"
                            >
                              <XCircle className="size-4" />
                            </Button>
                          )}
                          {!u.neofaceVerified && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-8 w-8 p-0"
                              onClick={() => handleAction(u.id, 'VERIFY_NEOFACE')}
                              disabled={actionLoading === u.id}
                              title="Vérifier NeoFace"
                            >
                              <Fingerprint className="size-4" />
                            </Button>
                          )}
                          {u.neofaceVerified && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                              onClick={() => setRejectDialog({
                                open: true, userId: u.id, action: 'REJECT_NEOFACE',
                                userName: `${u.firstName} ${u.lastName}`,
                              })}
                              disabled={actionLoading === u.id}
                              title="Rejeter NeoFace"
                            >
                              <XCircle className="size-4" />
                            </Button>
                          )}
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
              page={page}
              totalPages={totalPages}
              total={total}
              limit={pageSize}
              onPageChange={setPage}
            />
          </div>
        </Card>
      )}

      {/* ─── Reject Dialog ────────────────────────────────────────────── */}
      <Dialog
        open={rejectDialog.open}
        onOpenChange={(open) => {
          if (!open) { setRejectDialog({ open: false, userId: '', action: 'REJECT_ONECI', userName: '' }); setRejectComment('') }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Rejeter la vérification {rejectDialog.action.includes('ONECI') ? 'ONECI' : 'NeoFace'}
            </DialogTitle>
            <DialogDescription>
              Rejeter la vérification de {rejectDialog.userName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Veuillez indiquer la raison du rejet. L&apos;utilisateur sera notifié.
            </p>
            <Textarea
              placeholder="Commentaire..."
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setRejectDialog({ open: false, userId: '', action: 'REJECT_ONECI', userName: '' }); setRejectComment('') }}
            >
              Annuler
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                handleAction(rejectDialog.userId, rejectDialog.action, rejectComment.trim() || undefined)
                setRejectDialog({ open: false, userId: '', action: 'REJECT_ONECI', userName: '' })
                setRejectComment('')
              }}
            >
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
