'use client'

import { useState, useEffect, useCallback } from 'react'
import { Star, User, MessageSquare, Send } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
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
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { useRealtimeRatings } from '@/hooks/use-realtime-ratings'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

// ─── Types ──────────────────────────────────────────────────────────────────
interface ReviewItem {
  id: string
  score: number
  comment: string | null
  reply: string | null
  repliedAt: string | null
  createdAt: string
  fromUser?: {
    id: string
    firstName: string
    lastName: string
    avatarUrl: string | null
  }
  toUser?: {
    id: string
    firstName: string
    lastName: string
    avatarUrl: string | null
  }
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
}

interface LeaseToReview {
  id: string
  startDate: string
  endDate: string
  status: string
  tenant: {
    id: string
    firstName: string
    lastName: string
    avatarUrl: string | null
  }
  property: {
    id: string
    title: string
    address: string
    city: string
  }
}

interface OwnerReviewsResponse {
  data: {
    received: ReviewItem[]
    given: ReviewItem[]
    leasesToReview: LeaseToReview[]
  }
  stats: {
    receivedCount: number
    givenCount: number
    averageScoreReceived: number
    pendingReviews: number
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
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
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

type TabType = 'received' | 'to-give'

// ─── Main Component ─────────────────────────────────────────────────────────
export function OwnerReviews() {
  const { user, isAuthenticated } = useAuthStore()
  const [reviewsReceived, setReviewsReceived] = useState<ReviewItem[]>([])
  const [reviewsGiven, setReviewsGiven] = useState<ReviewItem[]>([])
  const [leasesToReview, setLeasesToReview] = useState<LeaseToReview[]>([])
  const [stats, setStats] = useState<OwnerReviewsResponse['stats'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('received')

  // Reply dialog state
  const [replyDialogOpen, setReplyDialogOpen] = useState(false)
  const [replyReviewId, setReplyReviewId] = useState<string>('')
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)

  // New review dialog state
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
  const [selectedLease, setSelectedLease] = useState<LeaseToReview | null>(null)
  const [ratingScore, setRatingScore] = useState(0)
  const [ratingComment, setRatingComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchReviews = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    try {
      const result = await authFetch<OwnerReviewsResponse>('/api/owner/reviews')
      setReviewsReceived(result.data?.received ?? [])
      setReviewsGiven(result.data?.given ?? [])
      setLeasesToReview(result.data?.leasesToReview ?? [])
      setStats(result.stats ?? null)
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) {
        setReviewsReceived([])
        setReviewsGiven([])
        setLeasesToReview([])
        return
      }
      setReviewsReceived([])
      setReviewsGiven([])
      setLeasesToReview([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Realtime subscription for reviews
  useRealtimeRatings({
    userId: user?.id,
    onRatingChange: () => { fetchReviews() },
  })

  // ─── Reply handler ────────────────────────────────────────────────────────
  const handleReply = async () => {
    if (!replyText.trim()) {
      toast.error('Veuillez écrire une réponse')
      return
    }
    setReplying(true)
    try {
      await authFetch(`/api/reviews/${replyReviewId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: replyText.trim() }),
      })
      toast.success('Réponse envoyée avec succès')
      setReplyDialogOpen(false)
      setReplyText('')
      fetchReviews()
    } catch (err) {
      if (err instanceof AuthError) {
        toast.error(err.message || 'Erreur lors de l\'envoi de la réponse')
      } else {
        toast.error('Erreur lors de l\'envoi de la réponse')
      }
    } finally {
      setReplying(false)
    }
  }

  // ─── New review handler ───────────────────────────────────────────────────
  const handleSubmitReview = async () => {
    if (!selectedLease || ratingScore === 0) {
      toast.error('Veuillez sélectionner une note')
      return
    }
    setSubmitting(true)
    try {
      await authFetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaseId: selectedLease.id,
          toUserId: selectedLease.tenant.id,
          score: ratingScore,
          comment: ratingComment || undefined,
          propertyId: selectedLease.property.id,
        }),
      })
      toast.success('Avis envoyé avec succès')
      setReviewDialogOpen(false)
      setSelectedLease(null)
      setRatingScore(0)
      setRatingComment('')
      fetchReviews()
    } catch (err) {
      if (err instanceof AuthError) {
        toast.error(err.message || 'Erreur lors de l\'envoi de l\'avis')
      } else {
        toast.error('Erreur lors de l\'envoi de l\'avis')
      }
    } finally {
      setSubmitting(false)
    }
  }

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

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Avis</h1>
          <p className="text-muted-foreground mt-1">Gérez vos avis et évaluations</p>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="border-border">
            <CardContent className="p-4 text-center">
              <p className="text-xl sm:text-2xl font-bold text-foreground">{stats?.receivedCount ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Avis reçus</p>
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
              <p className="text-xs text-muted-foreground mt-1">Note moyenne</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4 text-center">
              <p className="text-xl sm:text-2xl font-bold text-foreground">{stats?.givenCount ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Avis donnés</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4 text-center">
              <p className="text-xl sm:text-2xl font-bold text-brand-500">{stats?.pendingReviews ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Avis à donner</p>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Tab Toggle */}
      <motion.div variants={itemVariants}>
        <div className="flex gap-2">
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
          <button
            onClick={() => setActiveTab('to-give')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'to-give'
                ? 'bg-brand-500 text-white'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            Avis à donner ({stats?.pendingReviews ?? 0})
          </button>
        </div>
      </motion.div>

      {/* ─── Avis reçus Tab ──────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {activeTab === 'received' ? (
          <motion.div key="received" variants={containerVariants} initial="hidden" animate="show" className="space-y-3">
            {reviewsReceived.length === 0 ? (
              <motion.div variants={itemVariants}>
                <Card className="border-dashed border-border bg-muted/50">
                  <CardContent className="py-12 flex flex-col items-center text-center">
                    <div className="flex size-16 items-center justify-center rounded-full bg-amber-50 mb-4">
                      <Star className="size-7 text-amber-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-1">
                      Aucun avis reçu
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      Les locataires vous évalueront après leur location.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              reviewsReceived.map((review) => (
                <motion.div key={review.id} variants={itemVariants}>
                  <Card className="border-border">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        {/* Avatar */}
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50">
                          {review.fromUser?.avatarUrl ? (
                            <img src={review.fromUser.avatarUrl} alt="" className="size-10 rounded-full object-cover" />
                          ) : (
                            <User className="size-5 text-brand-500" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {review.fromUser
                                ? `${review.fromUser.firstName} ${review.fromUser.lastName}`
                                : 'Locataire'}
                            </p>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {formatDate(review.createdAt)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <StarsDisplay score={review.score} />
                            <span className="text-xs font-medium text-muted-foreground">{review.score}/5</span>
                          </div>
                          {review.comment && (
                            <p className="text-sm text-muted-foreground line-clamp-3 mb-2">
                              &ldquo;{review.comment}&rdquo;
                            </p>
                          )}
                          {review.lease?.property && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-muted-foreground">
                              {review.lease.property.title} — {review.lease.property.city}
                            </Badge>
                          )}

                          {/* Reply section */}
                          {review.reply ? (
                            <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border">
                              <p className="text-xs font-medium text-muted-foreground mb-1">
                                Votre réponse · {review.repliedAt ? formatDate(review.repliedAt) : ''}
                              </p>
                              <p className="text-sm text-foreground">{review.reply}</p>
                            </div>
                          ) : (
                            <div className="mt-3">
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 text-brand-600 border-brand-200 hover:bg-brand-50"
                                onClick={() => {
                                  setReplyReviewId(review.id)
                                  setReplyText('')
                                  setReplyDialogOpen(true)
                                }}
                              >
                                <MessageSquare className="size-3.5" />
                                Répondre
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </motion.div>
        ) : (
          /* ─── Avis à donner Tab ──────────────────────────────────────────── */
          <motion.div key="to-give" variants={containerVariants} initial="hidden" animate="show" className="space-y-3">
            {leasesToReview.length === 0 ? (
              <motion.div variants={itemVariants}>
                <Card className="border-dashed border-border bg-muted/50">
                  <CardContent className="py-12 flex flex-col items-center text-center">
                    <div className="flex size-16 items-center justify-center rounded-full bg-amber-50 mb-4">
                      <Star className="size-7 text-amber-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-1">
                      Aucun avis à donner
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      Vous pourrez laisser un avis sur vos locataires à la fin de chaque bail.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              leasesToReview.map((lease) => (
                <motion.div key={lease.id} variants={itemVariants}>
                  <Card className="border-border hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50">
                            {lease.tenant.avatarUrl ? (
                              <img
                                src={lease.tenant.avatarUrl}
                                alt=""
                                className="size-10 rounded-full object-cover"
                              />
                            ) : (
                              <User className="size-5 text-brand-500" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {lease.tenant.firstName} {lease.tenant.lastName}
                            </p>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-muted-foreground mt-0.5">
                              {lease.property.title} — {lease.property.city}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              Bail du {formatDate(lease.startDate)} au {formatDate(lease.endDate)}
                            </p>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
                          onClick={() => {
                            setSelectedLease(lease)
                            setRatingScore(0)
                            setRatingComment('')
                            setReviewDialogOpen(true)
                          }}
                        >
                          <Star className="size-3.5" />
                          <span className="hidden sm:inline">Laisser un avis</span>
                          <span className="sm:hidden">Avis</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Reply Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="size-5 text-brand-500" />
              Répondre à l&apos;avis
            </DialogTitle>
            <DialogDescription>
              Votre réponse sera visible publiquement sous l&apos;avis du locataire.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Écrivez votre réponse..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setReplyDialogOpen(false)
                setReplyText('')
              }}
              disabled={replying}
            >
              Annuler
            </Button>
            <Button
              onClick={handleReply}
              disabled={replying || !replyText.trim()}
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50"
            >
              {replying ? 'Envoi...' : (
                <>
                  <Send className="size-3.5" />
                  Envoyer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── New Review Dialog ────────────────────────────────────────────────── */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="size-5 text-amber-400" />
              Laisser un avis
            </DialogTitle>
            <DialogDescription>
              Évaluez votre expérience avec ce locataire.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Tenant info */}
            {selectedLease && (
              <div className="p-3 rounded-lg bg-muted flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-brand-50 shrink-0">
                  {selectedLease.tenant.avatarUrl ? (
                    <img
                      src={selectedLease.tenant.avatarUrl}
                      alt=""
                      className="size-10 rounded-full object-cover"
                    />
                  ) : (
                    <User className="size-5 text-brand-500" />
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Locataire</p>
                  <p className="text-sm font-medium text-foreground">
                    {selectedLease.tenant.firstName} {selectedLease.tenant.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedLease.property.title} — {selectedLease.property.city}
                  </p>
                </div>
              </div>
            )}

            {/* Star rating */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Votre note</label>
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
              <label htmlFor="owner-review-comment" className="text-sm font-medium text-foreground">
                Commentaire <span className="text-muted-foreground font-normal">(optionnel)</span>
              </label>
              <Textarea
                id="owner-review-comment"
                placeholder="Décrivez votre expérience avec ce locataire..."
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
                setReviewDialogOpen(false)
                setSelectedLease(null)
                setRatingScore(0)
                setRatingComment('')
              }}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSubmitReview}
              disabled={submitting || ratingScore === 0}
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
