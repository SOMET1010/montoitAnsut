'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MessageSquare, Send, ArrowLeft, Plus, Search, X,
  Check, CheckCheck, Building2, Loader2,
  Paperclip, FileText, Image as ImageIcon,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { useRealtimeMessages } from '@/hooks/use-realtime-messages'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Participant {
  id: string
  firstName: string
  lastName: string
  avatarUrl: string | null
  role: string
  activeRole: string
}

interface PropertyInfo {
  id: string
  title: string
  address: string
  city: string
  images: Array<{ id: string; url: string; order: number }>
}

interface MessageAttachment {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  url: string
}

interface Message {
  id: string
  content: string
  createdAt: string
  isRead: boolean
  senderId: string
  sender: {
    id: string
    firstName: string
    lastName: string
    avatarUrl: string | null
  }
  attachments?: MessageAttachment[]
}

interface ConversationListItem {
  id: string
  lastMessageAt: string | null
  createdAt: string
  propertyId: string | null
  participant1Id: string
  participant2Id: string
  participant1: Participant
  participant2: Participant
  property: PropertyInfo | null
  lastMessage: {
    id: string
    content: string
    createdAt: string
    senderId: string
    sender: { id: string; firstName: string; lastName: string }
  } | null
  messageCount: number
  unreadCount: number
}

interface ConversationDetail {
  id: string
  lastMessageAt: string | null
  createdAt: string
  propertyId: string | null
  participant1Id: string
  participant2Id: string
  participant1: Participant
  participant2: Participant
  property: PropertyInfo | null
  messages: Message[]
}

// ─── Role label helper ──────────────────────────────────────────────────────

function getRoleBadge(role: string): { label: string; className: string } {
  switch (role) {
    case 'LOCATAIRE':
      return { label: 'Locataire', className: 'bg-amber-100 text-amber-700' }
    case 'PROPRIETAIRE':
      return { label: 'Propriétaire', className: 'bg-emerald-100 text-emerald-700' }
    case 'AGENCE':
      return { label: 'Agence', className: 'bg-orange-100 text-orange-700' }
    case 'TIERS_CONFIANCE':
      return { label: 'TC', className: 'bg-orange-100 text-orange-700' }
    case 'ADMIN':
      return { label: 'Admin', className: 'bg-rose-100 text-rose-700' }
    default:
      return { label: role, className: 'bg-neutral-100 text-neutral-700' }
  }
}

// ─── Format time helper ─────────────────────────────────────────────────────

function formatTime(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  } else if (diffDays === 1) {
    return 'Hier'
  } else if (diffDays < 7) {
    return date.toLocaleDateString('fr-FR', { weekday: 'short' })
  }
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function formatMessageTime(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// ─── Component ──────────────────────────────────────────────────────────────

export function TcMessaging() {
  const { user, isAuthenticated } = useAuthStore()

  // Data
  const [conversations, setConversations] = useState<ConversationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [fullMessages, setFullMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // New conversation dialog
  const [newConvOpen, setNewConvOpen] = useState(false)
  const [newRecipientId, setNewRecipientId] = useState('')
  const [newRecipientSearch, setNewRecipientSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{
    id: string; firstName: string; lastName: string; avatarUrl: string | null; role: string
  }>>([])
  const [searchingUsers, setSearchingUsers] = useState(false)
  const [newPropertyId, setNewPropertyId] = useState('')

  // Mobile toggle
  const [showChat, setShowChat] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingFiles, setPendingFiles] = useState<{ file: File; preview: string }[]>([])

  // ─── Fetch conversations ────────────────────────────────────────────────

  const fetchConversations = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    try {
      const data = await authFetch<{ conversations: ConversationListItem[]; totalUnread: number }>(
        '/api/tc/messages'
      )
      setConversations(data.conversations || [])
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) {
        setConversations([])
        return
      }
      setConversations([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useRealtimeMessages({
    userId: user?.id,
    onNewMessage: () => fetchConversations(),
  })

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // ─── Fetch messages when selecting conversation ─────────────────────────

  useEffect(() => {
    if (!selectedId) {
      setFullMessages([])
      return
    }
    setLoadingMessages(true)
    authFetch<{ conversation: ConversationDetail }>(
      `/api/tc/messages?conversationId=${selectedId}`
    )
      .then((data) => {
        setFullMessages(data.conversation?.messages || [])
        // Update unread count in conversations list
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedId ? { ...c, unreadCount: 0 } : c
          )
        )
      })
      .catch(() => setFullMessages([]))
      .finally(() => setLoadingMessages(false))
  }, [selectedId])

  // Auto-scroll to bottom
  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }, [fullMessages])

  // Cleanup file previews
  useEffect(() => {
    return () => {
      pendingFiles.forEach((f) => URL.revokeObjectURL(f.preview))
    }
  }, [pendingFiles])

  // ─── Derived data ───────────────────────────────────────────────────────

  const selected = conversations.find((c) => c.id === selectedId)
  const otherPerson = selected
    ? selected.participant1Id === user?.id ? selected.participant2 : selected.participant1
    : null

  // Filter conversations by search query
  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery.trim()) return true
    const other = conv.participant1Id === user?.id ? conv.participant2 : conv.participant1
    const name = `${other.firstName} ${other.lastName}`.toLowerCase()
    const propertyTitle = conv.property?.title?.toLowerCase() || ''
    const query = searchQuery.toLowerCase()
    return name.includes(query) || propertyTitle.includes(query)
  })

  // ─── Send message ───────────────────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newFiles = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }))
    setPendingFiles((prev) => [...prev, ...newFiles])
    e.target.value = ''
  }

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handleSendMessage = async () => {
    if ((!messageText.trim() && pendingFiles.length === 0) || sending) return

    setSending(true)
    try {
      const body: Record<string, unknown> = {}
      if (messageText.trim()) {
        body.content = messageText.trim()
      }
      if (selectedId) {
        body.conversationId = selectedId
      }

      if (pendingFiles.length > 0) {
        const attachments = await Promise.all(
          pendingFiles.map(async (pf) => ({
            fileName: pf.file.name,
            fileType: pf.file.type,
            fileSize: pf.file.size,
            base64: await fileToBase64(pf.file),
          }))
        )
        body.attachments = attachments
      }

      const data = await authFetch<{ message: Message; conversation: ConversationDetail }>(
        '/api/tc/messages',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )

      // Update conversations list
      setConversations((prev) => {
        const convIndex = prev.findIndex((c) => c.id === data.conversation.id)
        if (convIndex >= 0) {
          const updated = [...prev]
          updated[convIndex] = {
            ...updated[convIndex],
            lastMessage: {
              id: data.message.id,
              content: data.message.content,
              createdAt: data.message.createdAt,
              senderId: data.message.senderId,
              sender: {
                id: data.message.sender.id,
                firstName: data.message.sender.firstName,
                lastName: data.message.sender.lastName,
              },
            },
            lastMessageAt: new Date().toISOString(),
          }
          return updated
        }
        // New conversation — add it
        return [
          {
            ...data.conversation,
            lastMessage: {
              id: data.message.id,
              content: data.message.content,
              createdAt: data.message.createdAt,
              senderId: data.message.senderId,
              sender: {
                id: data.message.sender.id,
                firstName: data.message.sender.firstName,
                lastName: data.message.sender.lastName,
              },
            },
            messageCount: 1,
            unreadCount: 0,
          },
          ...prev,
        ]
      })

      // Add new message to fullMessages
      setFullMessages((prev) => [...prev, data.message])
      setMessageText('')
      setPendingFiles([])

      // If it was a new conversation, select it
      if (!selectedId && data.conversation.id) {
        setSelectedId(data.conversation.id)
        setShowChat(true)
      }

      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'envoi")
    } finally {
      setSending(false)
    }
  }

  // ─── Start new conversation ─────────────────────────────────────────────

  const handleStartConversation = async () => {
    if (!newRecipientId || !messageText.trim() || sending) return

    setSending(true)
    try {
      const body: Record<string, string> = {
        recipientId: newRecipientId,
        content: messageText.trim(),
      }
      if (newPropertyId) {
        body.propertyId = newPropertyId
      }

      const data = await authFetch<{ message: Message; conversation: ConversationDetail }>(
        '/api/tc/messages',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )

      setConversations((prev) => {
        const exists = prev.find((c) => c.id === data.conversation.id)
        if (exists) return prev
        return [
          {
            ...data.conversation,
            lastMessage: {
              id: data.message.id,
              content: data.message.content,
              createdAt: data.message.createdAt,
              senderId: data.message.senderId,
              sender: {
                id: data.message.sender.id,
                firstName: data.message.sender.firstName,
                lastName: data.message.sender.lastName,
              },
            },
            messageCount: 1,
            unreadCount: 0,
          },
          ...prev,
        ]
      })

      setSelectedId(data.conversation.id)
      setShowChat(true)
      setMessageText('')
      setNewConvOpen(false)
      setNewRecipientId('')
      setNewRecipientSearch('')
      setSearchResults([])
      setNewPropertyId('')
      toast.success('Conversation créée !')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la création")
    } finally {
      setSending(false)
    }
  }

  // ─── Search users ───────────────────────────────────────────────────────

  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([])
      return
    }

    setSearchingUsers(true)
    try {
      const data = await authFetch<{
        users: Array<{
          id: string; firstName: string; lastName: string; avatarUrl: string | null; role: string
        }>
      }>(`/api/users?q=${encodeURIComponent(query)}`)
      setSearchResults(data.users || [])
    } catch {
      setSearchResults([])
    } finally {
      setSearchingUsers(false)
    }
  }, [])

  // Debounce user search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(newRecipientSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [newRecipientSearch, searchUsers])

  // ─── Mark as read when viewing conversation ─────────────────────────────

  const markAsRead = useCallback(async (convId: string) => {
    try {
      await authFetch('/api/tc/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId }),
      })
    } catch {
      // Silently fail
    }
  }, [])

  // ─── Select conversation handler ────────────────────────────────────────

  const handleSelectConversation = (convId: string) => {
    setSelectedId(convId)
    setShowChat(true)
    markAsRead(convId)
  }

  // ─── Back to list (mobile) ──────────────────────────────────────────────

  const handleBackToList = () => {
    setShowChat(false)
    setSelectedId(null)
  }

  // ─── Loading skeleton ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded-lg bg-muted animate-pulse" />
        <div className="h-[560px] rounded-xl bg-muted animate-pulse" />
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <Card className="border-border bg-gradient-to-r from-brand-500/10 to-transparent">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-brand-100">
                <MessageSquare className="size-6 text-brand-600" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">Messagerie</h1>
                <p className="text-muted-foreground text-sm">Communiquez avec les utilisateurs de la plateforme</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge className="bg-brand-50 text-brand-700 border-brand-200 border text-[10px]">
                    <MessageSquare className="size-3 mr-0.5" /> {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
                  </Badge>
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 border text-[10px]">
                    <MessageSquare className="size-3 mr-0.5 text-amber-500" /> {conversations.reduce((sum, c) => sum + c.unreadCount, 0)} non lu{conversations.reduce((sum, c) => sum + c.unreadCount, 0) !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>
            </div>
            <Dialog open={newConvOpen} onOpenChange={setNewConvOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-sm">
                  <Plus className="size-4" />
                  <span className="hidden sm:inline">Nouvelle conversation</span>
                  <span className="sm:hidden">Nouveau</span>
                </Button>
              </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle conversation</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {/* Recipient search */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Destinataire</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par nom ou email..."
                    value={newRecipientSearch}
                    onChange={(e) => setNewRecipientSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {newRecipientId && (
                  <div className="flex items-center gap-2 mt-2 p-2 bg-brand-50 rounded-lg">
                    <Avatar className="size-6">
                      <AvatarFallback className="bg-brand-100 text-brand-700 text-xs">
                        {searchResults.find((r) => r.id === newRecipientId)?.firstName?.[0]}
                        {searchResults.find((r) => r.id === newRecipientId)?.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">
                      {searchResults.find((r) => r.id === newRecipientId)?.firstName}{' '}
                      {searchResults.find((r) => r.id === newRecipientId)?.lastName}
                    </span>
                    {searchResults.find((r) => r.id === newRecipientId)?.role && (
                      <Badge className={cn('text-[10px]', getRoleBadge(searchResults.find((r) => r.id === newRecipientId)?.role || '').className)}>
                        {getRoleBadge(searchResults.find((r) => r.id === newRecipientId)?.role || '').label}
                      </Badge>
                    )}
                    <button onClick={() => setNewRecipientId('')} className="ml-auto">
                      <X className="size-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                )}
                {searchingUsers && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    Recherche...
                  </div>
                )}
                {!newRecipientId && searchResults.length > 0 && (
                  <div className="mt-2 max-h-48 overflow-y-auto border rounded-lg divide-y">
                    {searchResults.map((result) => {
                      const badge = getRoleBadge(result.role)
                      return (
                        <button
                          key={result.id}
                          onClick={() => {
                            setNewRecipientId(result.id)
                            setNewRecipientSearch('')
                            setSearchResults([])
                          }}
                          className="w-full flex items-center gap-2 p-2.5 hover:bg-accent transition-colors text-left"
                        >
                          <Avatar className="size-7">
                            {result.avatarUrl ? (
                              <AvatarImage src={result.avatarUrl} alt={`${result.firstName} ${result.lastName}`} />
                            ) : null}
                            <AvatarFallback className="bg-brand-100 text-brand-700 text-xs">
                              {result.firstName[0]}{result.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium">{result.firstName} {result.lastName}</span>
                          </div>
                          <Badge className={cn('text-[10px] shrink-0', badge.className)}>
                            {badge.label}
                          </Badge>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Optional property link */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Bien lié (optionnel)</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="ID du bien (optionnel)"
                    value={newPropertyId}
                    onChange={(e) => setNewPropertyId(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Message input */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Message</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Écrivez votre message..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleStartConversation()
                      }
                    }}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleStartConversation}
                    disabled={!newRecipientId || !messageText.trim() || sending}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
                  >
                    <Send className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
        </CardContent>
      </Card>

      {/* Two-panel layout */}
      <Card className="border-border overflow-hidden">
        <div className="flex h-[calc(100dvh-12rem)] min-h-[400px]">
          {/* Left Panel: Conversation List */}
          <div className={cn(
            'w-full sm:w-80 border-r border-border flex flex-col shrink-0 min-h-0',
            showChat ? 'hidden sm:flex' : ''
          )}>
            {/* Search */}
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher une conversation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9"
                />
              </div>
            </div>

            {/* Conversation list */}
            <div className="overflow-y-auto flex-1 min-h-0">
              {filteredConversations.length === 0 ? (
                <div className="py-12 text-center px-4">
                  <MessageSquare className="size-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">Aucune conversation</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Démarrez une nouvelle conversation.
                  </p>
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const other = conv.participant1Id === user?.id ? conv.participant2 : conv.participant1
                  const badge = getRoleBadge(other.role || other.activeRole)
                  return (
                    <button
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv.id)}
                      className={cn(
                        'w-full flex items-start gap-3 p-3 text-left hover:bg-accent transition-colors border-b border-border',
                        selectedId === conv.id ? 'bg-brand-50' : ''
                      )}
                    >
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <Avatar className="size-10">
                          {other.avatarUrl ? (
                            <AvatarImage src={other.avatarUrl} alt={`${other.firstName} ${other.lastName}`} />
                          ) : null}
                          <AvatarFallback className="bg-brand-100 text-brand-700 text-xs">
                            {other.firstName[0]}{other.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        {conv.unreadCount > 0 && (
                          <Badge className="absolute -top-1 -right-1 size-5 p-0 flex items-center justify-center bg-brand-500 text-white text-[10px] border-2 border-background">
                            {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                          </Badge>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className={cn(
                              'text-sm truncate',
                              conv.unreadCount > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground'
                            )}>
                              {other.firstName} {other.lastName}
                            </p>
                            <Badge className={cn('text-[9px] px-1 py-0 shrink-0', badge.className)}>
                              {badge.label}
                            </Badge>
                          </div>
                          {conv.lastMessage && (
                            <span className="text-[10px] text-muted-foreground shrink-0 ml-1">
                              {formatTime(conv.lastMessage.createdAt)}
                            </span>
                          )}
                        </div>
                        {conv.property && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Building2 className="size-3 text-muted-foreground shrink-0" />
                            <p className="text-xs text-muted-foreground truncate">{conv.property.title}</p>
                          </div>
                        )}
                        {conv.lastMessage && (
                          <p className={cn(
                            'text-xs truncate mt-0.5',
                            conv.unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'
                          )}>
                            {conv.lastMessage.senderId === user?.id ? 'Vous : ' : ''}{conv.lastMessage.content}
                          </p>
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Right Panel: Chat View */}
          <div className={cn(
            'flex-1 flex flex-col min-w-0 min-h-0',
            !showChat ? 'hidden sm:flex' : ''
          )}>
            <AnimatePresence mode="wait">
              {selected && otherPerson ? (
                <motion.div
                  key={selected.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col h-full min-h-0"
                >
                  {/* Chat header */}
                  <div className="flex items-center gap-3 p-3 border-b border-border shrink-0">
                    <button onClick={handleBackToList} className="sm:hidden shrink-0">
                      <ArrowLeft className="size-5 text-muted-foreground" />
                    </button>
                    <Avatar className="size-9">
                      {otherPerson.avatarUrl ? (
                        <AvatarImage src={otherPerson.avatarUrl} alt={`${otherPerson.firstName} ${otherPerson.lastName}`} />
                      ) : null}
                      <AvatarFallback className="bg-brand-100 text-brand-700 text-xs">
                        {otherPerson.firstName[0]}{otherPerson.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">
                          {otherPerson.firstName} {otherPerson.lastName}
                        </p>
                        <Badge className={cn(
                          'text-[9px] px-1 py-0 shrink-0',
                          getRoleBadge(otherPerson.role || otherPerson.activeRole).className
                        )}>
                          {getRoleBadge(otherPerson.role || otherPerson.activeRole).label}
                        </Badge>
                      </div>
                      {selected.property && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Building2 className="size-3 text-muted-foreground shrink-0" />
                          <p className="text-xs text-muted-foreground truncate">
                            {selected.property.title} — {selected.property.city}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Messages area */}
                  <div className="overflow-y-auto flex-1 min-h-0">
                    <div className="p-4 space-y-3">
                      {loadingMessages ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="size-6 text-brand-500 animate-spin" />
                        </div>
                      ) : fullMessages.length === 0 ? (
                        <div className="flex items-center justify-center py-12">
                          <p className="text-sm text-muted-foreground">Aucun message. Envoyez le premier !</p>
                        </div>
                      ) : (
                        fullMessages.map((msg) => {
                          const isMe = msg.senderId === user?.id
                          return (
                            <motion.div
                              key={msg.id}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.15 }}
                              className={cn('flex', isMe ? 'justify-end' : 'justify-start')}
                            >
                              <div className="flex items-end gap-2 max-w-[80%] sm:max-w-[70%]">
                                {!isMe && (
                                  <Avatar className="size-6 shrink-0">
                                    <AvatarFallback className="bg-brand-100 text-brand-700 text-[10px]">
                                      {msg.sender.firstName[0]}{msg.sender.lastName[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                )}
                                <div>
                                  <div className={cn(
                                    'rounded-2xl px-4 py-2.5 text-sm break-words',
                                    isMe
                                      ? 'bg-brand-500 text-white rounded-br-md'
                                      : 'bg-muted text-foreground rounded-bl-md'
                                  )}>
                                    {msg.content && <p>{msg.content}</p>}
                                    {msg.attachments && msg.attachments.length > 0 && (
                                      <div className={`space-y-1.5 ${msg.content ? 'mt-2' : ''}`}>
                                        {msg.attachments.map((att) => (
                                          <div key={att.id}>
                                            {att.fileType.startsWith('image/') ? (
                                              <a href={att.url} target="_blank" rel="noopener noreferrer">
                                                <img
                                                  src={att.url}
                                                  alt={att.fileName}
                                                  className="max-w-full rounded-lg max-h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                                />
                                              </a>
                                            ) : (
                                              <a
                                                href={att.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={cn(
                                                  'flex items-center gap-2 rounded-lg p-2 text-xs',
                                                  isMe ? 'bg-brand-600 text-white' : 'bg-background text-foreground border'
                                                )}
                                              >
                                                {att.fileType.startsWith('image/') ? (
                                                  <ImageIcon className="size-4 shrink-0" />
                                                ) : (
                                                  <FileText className="size-4 shrink-0" />
                                                )}
                                                <span className="truncate">{att.fileName}</span>
                                              </a>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div className={cn(
                                    'flex items-center gap-1 mt-0.5 px-1',
                                    isMe ? 'justify-end' : 'justify-start'
                                  )}>
                                    <span className="text-[10px] text-muted-foreground">
                                      {formatMessageTime(msg.createdAt)}
                                    </span>
                                    {isMe && (
                                      msg.isRead ? (
                                        <CheckCheck className="size-3 text-brand-500" />
                                      ) : (
                                        <Check className="size-3 text-muted-foreground" />
                                      )
                                    )}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )
                        })
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  {/* Message input */}
                  <div className="p-3 border-t border-border shrink-0">
                    {pendingFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {pendingFiles.map((pf, i) => (
                          <div key={i} className="relative group">
                            {pf.file.type.startsWith('image/') ? (
                              <img src={pf.preview} alt={pf.file.name} className="size-12 rounded-lg object-cover" />
                            ) : (
                              <div className="size-12 rounded-lg bg-muted flex items-center justify-center">
                                <FileText className="size-5 text-muted-foreground" />
                              </div>
                            )}
                            <button
                              onClick={() => removePendingFile(i)}
                              className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="size-3" />
                            </button>
                            <p className="text-[10px] text-muted-foreground truncate max-w-12">{pf.file.name}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={sending}
                        className="shrink-0"
                      >
                        <Paperclip className="size-4" />
                      </Button>
                      <Input
                        placeholder="Votre message..."
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleSendMessage()
                          }
                        }}
                        className="flex-1 h-10"
                        disabled={sending}
                      />
                      <Button
                        size="icon"
                        onClick={handleSendMessage}
                        disabled={(!messageText.trim() && pendingFiles.length === 0) || sending}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
                      >
                        {sending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Send className="size-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex items-center justify-center"
                >
                  <div className="text-center px-4">
                    <MessageSquare className="size-14 text-muted-foreground/20 mx-auto mb-4" />
                    <p className="text-muted-foreground font-medium">Sélectionnez une conversation</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">
                      ou démarrez une nouvelle discussion
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
