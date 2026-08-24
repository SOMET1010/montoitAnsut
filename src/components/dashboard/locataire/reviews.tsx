'use client'

import { useState, useEffect, useCallback } from 'react'
import { Star, User, Plus } from 'lucide-react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { useRealtimeRatings } from '@/hooks/use-realtime-ratings'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

// ─── Types ──────────────────────────────────────────────────────────────────
interface RatingItem {
  id: string
  score: number
  comment: string | null
  createdAt: string
  lease: {
    id: string
    startDate: string
    endDate: string
    property: {
      id: string
      title: string
      address: string
      city: string
    }
  }
  toUser?: {
    id: string
    firstName: string
    lastName: string
    avatarUrl: string | null
  }
  fromUser?: {
    id: string
    firstName: string
    lastName: string
    avatarUrl: string | null
  }
}

interface LeaseOption {
  id: string
  startDate: string
  endDate: string
  status: string
  property: {
    id: string
    title: string
    images: Array<{ url: string }>
  }
  owner: {
    id: string
    firstName: string
    lastName: string
  }
}

interface ReviewsResponse {
  data: {
    given: RatingItem[]
    received: RatingItem[]
  }
  stats: {
    givenCount: number
    receivedCount: number
    averageScoreReceived: number
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function StarsDisplay({ score, size = 'sm' }: { score: number; size?: 'sm' | 'lg' }) {
  const s = size === 'lg' ? 'size-5' : 'size-3.5'
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${s} ${i <= score ? 'fill-amber-400 text-amber-400' : 'text-neutral-200'}`}
        />
      ))}
    </div>
  )
}

function InteractiveStars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(0)}
          className="p-0.5 transition-transform hover:scale-110"
        >
          <Star
            className={`size-8 transition-colors ${
              i <= (hovered || value)
                ? 'fill-amber-400 text-amber-400'
                : 'text-neutral-200 hover:text-amber-300'
            }`}
          />
        </button>
      ))}
    </div>
  )
}

// ─── Animation Variants ────────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

type TabType = 'given' | 'received'

export function Reviews() {
  const { user, isAuthenticated } = useAuthStore()
  const [ratingsGiven, setRatingsGiven] = useState<RatingItem[]>([])
  const [ratingsReceived, setRatingsReceived] = useState<RatingItem[]>([])
  const [stats, setStats] = useState<ReviewsResponse['stats'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('given')

  // Review form state
  const [showReviewDialog, setShowReviewDialog] = useState(false)
  const [leases, setLeases] = useState<LeaseOption[]>([])
  const [selectedLeaseId, setSelectedLeaseId] = useState<string>('')
  const [ratingScore, setRatingScore] = useState(0)
  const [ratingComment, setRatingComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchReviews = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return }
    try {
      const result = await authFetch<ReviewsResponse>('/api/reviews')
      setRatingsGiven(result.data?.given ?? [])
      setRatingsReceived(result.data?.received ?? [])
      setStats(result.stats ?? null)
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) { setRatingsGiven([]); setRatingsReceived([]); return }
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setRatingsGiven([])
      setRatingsReceived([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  const fetchLeases = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const result = await authFetch<{ activeLeases: LeaseOption[] }>('/api/dashboard/locataire')
      setLeases(result.activeLeases ?? [])
    } catch {
      // Silently fail — leases are for the review form only
    }
  }, [isAuthenticated])

  useEffect(() => { fetchReviews() }, [fetchReviews])
  useEffect(() => { fetchLeases() }, [fetchLeases])

  useRealtimeRatings({
    userId: user?.id,
    onRatingChange: useCallback(() => {
      fetchReviews()
    }, [fetchReviews]),
  })

  const selectedLease = leases.find((l) => l.id === selectedLeaseId)

  const handleSubmitReview = async () => {
    if (!selectedLeaseId || ratingScore === 0) {
      toast.error('Veuillez sélectionner un bail et une note')
      return
    }

    setSubmitting(true)
    try {
      await authFetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaseId: selectedLeaseId,
          toUserId: selectedLease?.owner.id,
          score: ratingScore,
          comment: ratingComment || undefined,
          propertyId: selectedLease?.property.id,
        }),
      })
      toast.success('Avis envoyé avec succès')
      setShowReviewDialog(false)
      setSelectedLeaseId('')
      setRatingScore(0)
      setRatingComment('')
      // Refresh reviews
      fetchReviews()
    } catch (err) {
      if (err instanceof AuthError) {
        toast.error(err.message || "Erreur lors de l'envoi de l'avis")
      } else {
        toast.error("Erreur lors de l'envoi de l'avis")
      }
    } finally {
      setSubmitting(false)
    }
  }

  const activeRatings = activeTab === 'given' ? ratingsGiven : ratingsReceived

  // ─── Loading skeleton ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-32 bg-muted animate-pulse rounded" />
          <div className="h-4 w-56 bg-muted animate-pulse rounded mt-2" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  // ─── Error state ───────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Mes avis</h1>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-sm text-amber-700">Impossible de charger vos avis. Veuillez réessayer.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants} className="bg-gradient-to-r from-brand-500/10 to-transparent rounded-xl p-4 sm:p-6 -mx-4 sm:-mx-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-brand-100 shrink-0">
              <Star className="size-6 text-brand-500" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Mes avis</h1>
              <p className="text-muted-foreground mt-0.5">Vos évaluations et commentaires</p>
            </div>
          </div>
          <Button
            onClick={() => setShowReviewDialog(true)}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">Laisser un avis</span>
            <span className="sm:hidden">Avis</span>
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge variant="secondary" className="bg-brand-50 text-brand-700">
            <Star className="size-3 mr-1" /> {stats?.givenCount ?? 0} donnés
          </Badge>
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
            {stats?.receivedCount ?? 0} reçus
          </Badge>
          {(stats?.averageScoreReceived ?? 0) > 0 && (
            <Badge variant="secondary" className="bg-amber-50 text-amber-700">
              Ø {stats!.averageScoreReceived!.toFixed(1)}/5
            </Badge>
          )}
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="border-border">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-foreground">{stats?.givenCount ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Avis donnés</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4 text-center">
              <div className="flex justify-center mb-1">
                <StarsDisplay score={Math.round(stats?.averageScoreReceived ?? 0)} size="lg" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-foreground">
                {stats?.averageScoreReceived ? stats.averageScoreReceived.toFixed(1) : '—'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Note moyenne ({stats?.receivedCount ?? 0} avis reçu{stats?.receivedCount !== 1 ? 's' : ''})
              </p>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Tab Toggle */}
      <motion.div variants={itemVariants}>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('given')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'given'
                ? 'bg-brand-500 text-white'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            Avis donnés ({stats?.givenCount ?? 0})
          </button>
          <button
            onClick={() => setActiveTab('received')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'received'
                ? 'bg-brand-500 text-white'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            Avis reçus ({stats?.receivedCount ?? 0})
          </button>
        </div>
      </motion.div>

      {/* Ratings List */}
      <AnimatePresence mode="wait">
        {activeRatings.length === 0 ? (
          /* Empty State */
          <motion.div key="empty" variants={itemVariants} initial="hidden" animate="show" exit="hidden">
            <Card className="border-dashed border-border bg-muted/50">
              <CardContent className="py-12 flex flex-col items-center text-center">
                <div className="flex size-16 items-center justify-center rounded-full bg-amber-50 mb-4">
                  <Star className="size-7 text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  {activeTab === 'given'
                    ? "Vous n'avez pas encore donné d'avis"
                    : "Vous n'avez pas encore reçu d'avis"}
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {activeTab === 'given'
                    ? `${user?.firstName}, partagez votre expérience locative pour aider les autres locataires.`
                    : 'Les propriétaires vous évalueront après vos locations.'}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div key={activeTab} variants={containerVariants} initial="hidden" animate="show" className="space-y-3">
            {activeRatings.map((rating) => {
              const otherUser = activeTab === 'given' ? rating.toUser : rating.fromUser
              const property = rating.lease?.property

              return (
                <motion.div key={rating.id} variants={itemVariants}>
                  <Card className="border-border">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Avatar */}
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50">
                          {otherUser?.avatarUrl ? (
                            <img src={otherUser.avatarUrl} alt="" className="size-10 rounded-full object-cover" />
                          ) : (
                            <User className="size-5 text-brand-500" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {otherUser ? `${otherUser.firstName} ${otherUser.lastName}` : 'Utilisateur'}
                            </p>
                            <span className="text-xs text-muted-foreground shrink-0">{formatDate(rating.createdAt)}</span>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <StarsDisplay score={rating.score} />
                            <span className="text-xs font-medium text-muted-foreground">{rating.score}/5</span>
                          </div>
                          {rating.comment && (
                            <p className="text-sm text-muted-foreground line-clamp-3 mb-1">
                              &ldquo;{rating.comment}&rdquo;
                            </p>
                          )}
                          {property && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-muted-foreground">
                              {property.title} — {property.city}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Review Creation Dialog ──────────────────────────────────────────── */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="size-5 text-amber-400" />
              Laisser un avis
            </DialogTitle>
            <DialogDescription>
              Partagez votre expérience locative. Votre avis aidera les autres locataires.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Lease selector */}
            <div className="space-y-2">
              <Label htmlFor="lease-select" className="text-sm font-medium">
                Bail concerné
              </Label>
              <Select value={selectedLeaseId} onValueChange={(val) => { setSelectedLeaseId(val); setRatingScore(0) }}>
                <SelectTrigger className="w-full" id="lease-select">
                  <SelectValue placeholder="Sélectionnez un bail" />
                </SelectTrigger>
                <SelectContent>
                  {leases.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      Aucun bail disponible
                    </SelectItem>
                  ) : (
                    leases.map((lease) => (
                      <SelectItem key={lease.id} value={lease.id}>
                        {lease.property.title} — {new Date(lease.startDate).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Owner info (auto-populated) */}
            {selectedLease && (
              <div className="p-3 rounded-lg bg-muted flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-full bg-brand-50 shrink-0">
                  <User className="size-4 text-brand-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Propriétaire</p>
                  <p className="text-sm font-medium text-foreground">
                    {selectedLease.owner.firstName} {selectedLease.owner.lastName}
                  </p>
                </div>
              </div>
            )}

            {/* Star rating */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Votre note</Label>
              <div className="flex items-center gap-3">
                <InteractiveStars value={ratingScore} onChange={setRatingScore} />
                {ratingScore > 0 && (
                  <span className="text-sm font-semibold text-foreground">{ratingScore}/5</span>
                )}
              </div>
              {ratingScore > 0 && (
                <p className="text-xs text-muted-foreground">
                  {ratingScore === 1 && 'Très insatisfait'}
                  {ratingScore === 2 && 'Insatisfait'}
                  {ratingScore === 3 && 'Neutre'}
                  {ratingScore === 4 && 'Satisfait'}
                  {ratingScore === 5 && 'Très satisfait'}
                </p>
              )}
            </div>

            {/* Comment */}
            <div className="space-y-2">
              <Label htmlFor="review-comment" className="text-sm font-medium">
                Commentaire <span className="text-muted-foreground font-normal">(optionnel)</span>
              </Label>
              <Textarea
                id="review-comment"
                placeholder="Décrivez votre expérience locative..."
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowReviewDialog(false)
                setSelectedLeaseId('')
                setRatingScore(0)
                setRatingComment('')
              }}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSubmitReview}
              disabled={submitting || !selectedLeaseId || ratingScore === 0}
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50"
            >
              {submitting ? 'Envoi...' : 'Envoyer l\'avis'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
