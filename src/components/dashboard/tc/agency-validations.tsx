'use client'

import { useCallback, useEffect, useState } from 'react'
import { Building2, Check, X, FileText, MessageSquare, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { usePagination } from '@/hooks/use-pagination'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { useRealtimeOwnershipDocs } from '@/hooks/use-realtime-ownership-docs'
import { ViewModeToggle, type ViewMode } from './view-mode-toggle'
import { DocumentPreviewDialog } from './document-preview-dialog'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// Agency validation uses ownership docs of type AGREMENT or RCCM
interface AgencyDoc {
  id: string
  type: string
  url: string
  name: string
  status: string
  tcComment: string | null
  createdAt: string
  owner: {
    id: string
    firstName: string
    lastName: string
    phone: string
    email: string
    avatarUrl: string | null
  }
}

export function AgencyValidations({ showHeaderAndStats = true }: { showHeaderAndStats?: boolean }) {
  const { user, isAuthenticated } = useAuthStore()
  const [docs, setDocs] = useState<AgencyDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'AGREMENT' | 'RCCM' | 'PENDING'>('ALL')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Dialogs
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectComment, setRejectComment] = useState('')
  const [requestInfoId, setRequestInfoId] = useState<string | null>(null)
  const [requestInfoComment, setRequestInfoComment] = useState('')

  // Document preview
  const [previewDoc, setPreviewDoc] = useState<{ url: string; name: string; type: string } | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    try {
      // Fetch only AGREMENT and RCCM type ownership docs
      const [agrementRes, rccmRes] = await Promise.all([
        authFetch<{ docs: AgencyDoc[] }>('/api/tc/ownership-docs?type=AGREMENT'),
        authFetch<{ docs: AgencyDoc[] }>('/api/tc/ownership-docs?type=RCCM'),
      ])
      const allDocs = [...(agrementRes.docs || []), ...(rccmRes.docs || [])]
      setDocs(allDocs)
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) {
        setDocs([])
        return
      }
      setDocs([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useRealtimeOwnershipDocs({
    userId: user?.id,
    watchAll: true,
    onOwnershipDocChange: () => { fetchData() },
  })

  const handleAction = async (docId: string, action: 'APPROVE' | 'REJECT' | 'REQUEST_INFO', comment?: string) => {
    setActionLoading(docId)
    try {
      await authFetch('/api/tc/ownership-docs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docIds: [docId], action, comment }),
      })
      toast.success(action === 'APPROVE' ? 'Document validé' : action === 'REJECT' ? 'Document rejeté' : 'Demande envoyée')
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setActionLoading(null)
    }
  }

  const openPreview = (doc: AgencyDoc) => {
    setPreviewDoc({ url: doc.url, name: doc.name, type: doc.type })
    setPreviewOpen(true)
  }

  const filteredDocs = docs.filter((d) => {
    if (typeFilter === 'PENDING') return d.status === 'PENDING'
    if (typeFilter !== 'ALL' && d.type !== typeFilter) return false
    if (!search) return true
    const s = search.toLowerCase()
    return (
      d.owner.firstName.toLowerCase().includes(s) ||
      d.owner.lastName.toLowerCase().includes(s) ||
      d.name.toLowerCase().includes(s)
    )
  })

  const {
    paginatedItems: pagedDocs,
    page,
    totalPages,
    total,
    pageSize,
    setPage,
  } = usePagination({
    items: filteredDocs,
    pageSize: 10,
    resetSignal: `${typeFilter}|${search}`,
  })

  if (loading) return <div className="space-y-4">{[1, 2].map((i) => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}</div>

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
{showHeaderAndStats && (<>
      {/* Header */}
      <Card className="border-border bg-gradient-to-r from-brand-500/10 to-transparent">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-brand-100">
                <Building2 className="size-6 text-brand-600" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">Validations agences</h1>
                <p className="text-muted-foreground text-sm">Vérifiez les agréments et RCCM des agences immobilières</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 border text-[10px]">
                    <Building2 className="size-3 mr-0.5" /> {filteredDocs.length} document{filteredDocs.length !== 1 ? 's' : ''}
                  </Badge>
                  <Badge className="bg-brand-50 text-brand-700 border-brand-200 border text-[10px]">
                    <FileText className="size-3 mr-0.5" /> {filteredDocs.filter(d => d.type === 'AGREMENT').length} agrément{filteredDocs.filter(d => d.type === 'AGREMENT').length !== 1 ? 's' : ''}
                  </Badge>
                  <Badge className="bg-teal-50 text-teal-700 border-teal-200 border text-[10px]">
                    <FileText className="size-3 mr-0.5" /> {filteredDocs.filter(d => d.type === 'RCCM').length} RCCM
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card
          className={cn('border-border cursor-pointer transition-all hover:shadow-sm', typeFilter === 'ALL' && 'ring-1 ring-brand-400 bg-brand-50/20')}
          onClick={() => setTypeFilter('ALL')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50">
                <Building2 className="size-5 text-brand-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">{docs.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn('border-border cursor-pointer transition-all hover:shadow-sm', typeFilter === 'AGREMENT' && 'ring-1 ring-amber-400 bg-amber-50/20')}
          onClick={() => setTypeFilter(typeFilter === 'AGREMENT' ? 'ALL' : 'AGREMENT')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50">
                <FileText className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-amber-600">{docs.filter(d => d.type === 'AGREMENT').length}</p>
                <p className="text-xs text-muted-foreground">Agréments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn('border-border cursor-pointer transition-all hover:shadow-sm', typeFilter === 'RCCM' && 'ring-1 ring-teal-400 bg-teal-50/20')}
          onClick={() => setTypeFilter(typeFilter === 'RCCM' ? 'ALL' : 'RCCM')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-teal-50">
                <FileText className="size-5 text-teal-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-teal-600">{docs.filter(d => d.type === 'RCCM').length}</p>
                <p className="text-xs text-muted-foreground">RCCM</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn('border-border cursor-pointer transition-all hover:shadow-sm', typeFilter === 'PENDING' && 'ring-1 ring-rose-400 bg-rose-50/20')}
          onClick={() => setTypeFilter(typeFilter === 'PENDING' ? 'ALL' : 'PENDING')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-rose-50">
                <Building2 className="size-5 text-rose-600" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-rose-600">{docs.filter(d => d.status === 'PENDING').length}</p>
                <p className="text-xs text-muted-foreground">En attente</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
        </>)}

      {/* Search + View Toggle */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une agence..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
      </div>

      {filteredDocs.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <Building2 className="size-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">Aucune agence en attente de validation</p>
            <p className="text-sm text-muted-foreground mt-1">Les demandes d&apos;agrément apparaîtront ici</p>
          </CardContent>
        </Card>
      ) : viewMode === 'card' ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {pagedDocs.map((doc) => (
            <Card key={doc.id} className="border-border">
              <CardContent className="p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div className="size-10 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                    <Building2 className="size-5 text-brand-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{doc.owner.firstName} {doc.owner.lastName}</h3>
                    <p className="text-sm text-muted-foreground truncate">{doc.owner.phone}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {doc.type === 'AGREMENT' ? 'Agrément' : 'RCCM'}
                  </Badge>
                </div>

                <div
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted mb-3 cursor-pointer hover:bg-muted/80 transition-colors"
                  onClick={() => openPreview(doc)}
                >
                  <FileText className="size-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-brand-600 hover:underline">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">Soumis le {new Date(doc.createdAt).toLocaleDateString('fr-FR')}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white gap-1"
                    onClick={() => handleAction(doc.id, 'APPROVE')}
                    disabled={actionLoading === doc.id}
                  >
                    <Check className="size-4" /> Valider
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50 gap-1"
                    onClick={() => setRejectId(doc.id)}
                    disabled={actionLoading === doc.id}
                  >
                    <X className="size-4" /> Rejeter
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-amber-600 gap-1"
                    onClick={() => setRequestInfoId(doc.id)}
                    disabled={actionLoading === doc.id}
                  >
                    <MessageSquare className="size-4" /> Compléter
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          <PaginationControls
            page={page}
            totalPages={totalPages}
            total={total}
            limit={pageSize}
            onPageChange={setPage}
          />
        </div>
      ) : (
        <Card className="border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-bold text-foreground">Agence</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-foreground">Document</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-foreground hidden sm:table-cell">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-foreground hidden md:table-cell">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedDocs.map((doc) => (
                  <tr key={doc.id} className="border-b border-border hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-foreground truncate max-w-[140px]">{doc.owner.firstName} {doc.owner.lastName}</p>
                      <p className="text-xs text-muted-foreground truncate">{doc.owner.phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => openPreview(doc)} className="text-sm text-brand-600 hover:underline">
                        {doc.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Badge variant="outline" className="text-xs">
                        {doc.type === 'AGREMENT' ? 'Agrément' : 'RCCM'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                      {new Date(doc.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" className="text-green-600 h-8 w-8 p-0" onClick={() => handleAction(doc.id, 'APPROVE')} disabled={actionLoading === doc.id}>
                          <Check className="size-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-600 h-8 w-8 p-0" onClick={() => setRejectId(doc.id)} disabled={actionLoading === doc.id}>
                          <X className="size-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-amber-600 h-8 w-8 p-0" onClick={() => setRequestInfoId(doc.id)} disabled={actionLoading === doc.id}>
                          <MessageSquare className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
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

      {/* Reject Dialog */}
      <Dialog open={rejectId !== null} onOpenChange={(open) => { if (!open) { setRejectId(null); setRejectComment('') } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeter le document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Veuillez indiquer la raison du rejet.</p>
            <Textarea placeholder="Raison du rejet..." value={rejectComment} onChange={(e) => setRejectComment(e.target.value)} rows={3} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setRejectId(null); setRejectComment('') }}>Annuler</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => { if (rejectId) handleAction(rejectId, 'REJECT', rejectComment); setRejectId(null); setRejectComment('') }} disabled={!rejectComment.trim()}>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Info Dialog */}
      <Dialog open={requestInfoId !== null} onOpenChange={(open) => { if (!open) { setRequestInfoId(null); setRequestInfoComment('') } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Demander des compléments</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Précisez les documents ou informations manquantes.</p>
            <Textarea placeholder="Documents complémentaires requis..." value={requestInfoComment} onChange={(e) => setRequestInfoComment(e.target.value)} rows={3} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setRequestInfoId(null); setRequestInfoComment('') }}>Annuler</Button>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => { if (requestInfoId) handleAction(requestInfoId, 'REQUEST_INFO', requestInfoComment); setRequestInfoId(null); setRequestInfoComment('') }} disabled={!requestInfoComment.trim()}>Envoyer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Preview */}
      <DocumentPreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} document={previewDoc} />
    </motion.div>
  )
}
