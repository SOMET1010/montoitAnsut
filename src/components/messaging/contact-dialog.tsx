'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Send, Search, X, Building2, User as UserIcon, MessageSquare, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { useToast } from '@/hooks/use-toast'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Recipient {
  id: string
  firstName: string
  lastName: string
  role: string
  companyName: string | null
  phone: string | null
  email: string | null
  avatarUrl: string | null
  type: 'PROPRIETAIRE' | 'AGENCE'
  properties: Array<{ id: string; title: string; city: string }>
}

interface RecipientsResponse {
  recipients: Recipient[]
}

interface SendMessageResponse {
  message: {
    id: string
    content: string
    createdAt: string
    isRead: boolean
    senderId: string
  }
  conversation: {
    id: string
    participant1Id: string
    participant2Id: string
    propertyId: string | null
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getRoleBadge(role: string) {
  switch (role) {
    case 'PROPRIETAIRE': return { label: 'Propriétaire', cls: 'bg-emerald-100 text-emerald-700' }
    case 'AGENCE': return { label: 'Agence', cls: 'bg-orange-100 text-orange-700' }
    case 'LOCATAIRE': return { label: 'Locataire', cls: 'bg-amber-100 text-amber-700' }
    default: return { label: role, cls: 'bg-neutral-100 text-neutral-600' }
  }
}

function getRoleIcon(type: 'PROPRIETAIRE' | 'AGENCE') {
  return type === 'PROPRIETAIRE'
    ? <Building2 className="size-3" />
    : <UserIcon className="size-3" />
}

// ─── Component ──────────────────────────────────────────────────────────────

interface ContactDialogProps {
  /** Optional trigger button; defaults to a "Contacter" button */
  trigger?: React.ReactNode
  /** Callback after a message is successfully sent */
  onMessageSent?: (conversationId: string) => void
  /** Pre-selected recipient ID (e.g. from lease detail) */
  defaultRecipientId?: string
}

export function ContactDialog({ trigger, onMessageSent, defaultRecipientId }: ContactDialogProps) {
  const { user, isAuthenticated } = useAuthStore()
  const { toast } = useToast()

  const [open, setOpen] = useState(false)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [loadingRecipients, setLoadingRecipients] = useState(false)
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null)
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [searchValue, setSearchValue] = useState('')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Fetch recipients ───────────────────────────────────────────────────

  const fetchRecipients = useCallback(async (search?: string) => {
    if (!isAuthenticated) return
    setLoadingRecipients(true)
    try {
      const query = search ? `?search=${encodeURIComponent(search)}` : ''
      const data = await authFetch<RecipientsResponse>(`/api/locataire/my-recipients${query}`)
      setRecipients(data.recipients || [])

      // Auto-select default recipient if provided
      if (defaultRecipientId && !selectedRecipient && !search) {
        const defaultRecipient = data.recipients?.find((r) => r.id === defaultRecipientId)
        if (defaultRecipient) {
          setSelectedRecipient(defaultRecipient)
        }
      }
    } catch {
      setRecipients([])
    } finally {
      setLoadingRecipients(false)
    }
  }, [isAuthenticated, defaultRecipientId, selectedRecipient])

  useEffect(() => {
    if (open) {
      fetchRecipients()
    }
  }, [open, fetchRecipients])

  // ─── Debounced search ───────────────────────────────────────────────────

  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchRecipients(value)
    }, 300)
  }, [fetchRecipients])

  // ─── Send message ───────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!selectedRecipient || !messageText.trim() || sending) return

    setSending(true)
    try {
      const data = await authFetch<SendMessageResponse>('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId: selectedRecipient.id,
          content: messageText.trim(),
        }),
      })

      toast({
        title: 'Message envoyé',
        description: `Votre message a été envoyé à ${selectedRecipient.firstName} ${selectedRecipient.lastName}`,
      })

      setMessageText('')
      setSelectedRecipient(null)
      setSearchValue('')
      setOpen(false)

      onMessageSent?.(data.conversation.id)
    } catch (err) {
      if (err instanceof AuthError) {
        toast({
          title: 'Erreur',
          description: err.message,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Erreur',
          description: 'Impossible d\'envoyer le message. Veuillez réessayer.',
          variant: 'destructive',
        })
      }
    } finally {
      setSending(false)
    }
  }

  // ─── Reset on close ─────────────────────────────────────────────────────

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setMessageText('')
      setSelectedRecipient(null)
      setSearchValue('')
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
            <MessageSquare className="size-4" />
            Contacter
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contacter un propriétaire ou une agence</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* ─── Recipient selector ──────────────────────────────────────── */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Destinataire</label>

            {selectedRecipient ? (
              <div className="flex items-center gap-2 p-2.5 bg-brand-50 rounded-lg border border-brand-200">
                <Avatar className="size-8 shrink-0">
                  {selectedRecipient.avatarUrl ? (
                    <AvatarImage src={selectedRecipient.avatarUrl} alt={`${selectedRecipient.firstName} ${selectedRecipient.lastName}`} />
                  ) : null}
                  <AvatarFallback className="bg-brand-100 text-brand-700 text-xs">
                    {selectedRecipient.firstName[0]}{selectedRecipient.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {selectedRecipient.companyName || `${selectedRecipient.firstName} ${selectedRecipient.lastName}`}
                  </p>
                  <Badge className={`text-[10px] px-1.5 py-0 ${getRoleBadge(selectedRecipient.type).cls}`}>
                    {getRoleIcon(selectedRecipient.type)}
                    <span className="ml-0.5">{getRoleBadge(selectedRecipient.type).label}</span>
                  </Badge>
                </div>
                <button
                  onClick={() => setSelectedRecipient(null)}
                  className="shrink-0 p-1 rounded-md hover:bg-muted transition-colors"
                  aria-label="Désélectionner le destinataire"
                >
                  <X className="size-4 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <Command className="rounded-lg border shadow-none" shouldFilter={false}>
                <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
                  <Search className="size-4 shrink-0 opacity-50 mr-2" />
                  <input
                    placeholder="Rechercher un propriétaire ou une agence..."
                    value={searchValue}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  {loadingRecipients && (
                    <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                  )}
                </div>
                <CommandList>
                  <CommandEmpty>
                    <div className="py-6 text-center">
                      <MessageSquare className="size-6 text-neutral-300 mx-auto mb-1" />
                      <p className="text-sm text-muted-foreground">
                        {recipients.length === 0
                          ? 'Aucun propriétaire ou agence trouvé. Vous devez avoir un bail actif.'
                          : 'Aucun résultat'}
                      </p>
                    </div>
                  </CommandEmpty>
                  {recipients.length > 0 && (
                    <>
                      {/* Propriétaires group */}
                      {recipients.filter((r) => r.type === 'PROPRIETAIRE').length > 0 && (
                        <CommandGroup heading="Propriétaires">
                          {recipients
                            .filter((r) => r.type === 'PROPRIETAIRE')
                            .map((recipient) => (
                              <CommandItem
                                key={recipient.id}
                                value={recipient.id}
                                onSelect={() => {
                                  setSelectedRecipient(recipient)
                                  setSearchValue('')
                                }}
                                className="cursor-pointer"
                              >
                                <Avatar className="size-8 shrink-0">
                                  {recipient.avatarUrl ? (
                                    <AvatarImage src={recipient.avatarUrl} alt={`${recipient.firstName} ${recipient.lastName}`} />
                                  ) : null}
                                  <AvatarFallback className="bg-brand-100 text-brand-700 text-xs">
                                    {recipient.firstName[0]}{recipient.lastName[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium truncate">
                                      {recipient.firstName} {recipient.lastName}
                                    </p>
                                    <Badge className={`text-[9px] px-1.5 py-0 shrink-0 ${getRoleBadge(recipient.type).cls}`}>
                                      {getRoleIcon(recipient.type)}
                                      <span className="ml-0.5">{getRoleBadge(recipient.type).label}</span>
                                    </Badge>
                                  </div>
                                  {recipient.properties.length > 0 && (
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                                      {recipient.properties[0].title}
                                      {recipient.properties.length > 1 && ` (+${recipient.properties.length - 1})`}
                                    </p>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      )}
                      {/* Agences group */}
                      {recipients.filter((r) => r.type === 'AGENCE').length > 0 && (
                        <CommandGroup heading="Agences">
                          {recipients
                            .filter((r) => r.type === 'AGENCE')
                            .map((recipient) => (
                              <CommandItem
                                key={recipient.id}
                                value={recipient.id}
                                onSelect={() => {
                                  setSelectedRecipient(recipient)
                                  setSearchValue('')
                                }}
                                className="cursor-pointer"
                              >
                                <Avatar className="size-8 shrink-0">
                                  {recipient.avatarUrl ? (
                                    <AvatarImage src={recipient.avatarUrl} alt={`${recipient.firstName} ${recipient.lastName}`} />
                                  ) : null}
                                  <AvatarFallback className="bg-orange-100 text-orange-700 text-xs">
                                    {recipient.companyName
                                      ? recipient.companyName.substring(0, 2).toUpperCase()
                                      : `${recipient.firstName[0]}${recipient.lastName[0]}`}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium truncate">
                                      {recipient.companyName || `${recipient.firstName} ${recipient.lastName}`}
                                    </p>
                                    <Badge className={`text-[9px] px-1.5 py-0 shrink-0 ${getRoleBadge(recipient.type).cls}`}>
                                      {getRoleIcon(recipient.type)}
                                      <span className="ml-0.5">{getRoleBadge(recipient.type).label}</span>
                                    </Badge>
                                  </div>
                                  {recipient.properties.length > 0 && (
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                                      {recipient.properties[0].title}
                                      {recipient.properties.length > 1 && ` (+${recipient.properties.length - 1})`}
                                    </p>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      )}
                    </>
                  )}
                </CommandList>
              </Command>
            )}
          </div>

          {/* ─── Message text area ───────────────────────────────────────── */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Message</label>
            <Textarea
              placeholder="Écrivez votre message..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* ─── Send button ─────────────────────────────────────────────── */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={sending}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSend}
              disabled={!selectedRecipient || !messageText.trim() || sending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Envoyer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
