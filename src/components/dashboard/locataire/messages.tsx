'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageSquare, Send, ArrowLeft, Plus, Search, Paperclip, X, FileText, Image as ImageIcon, ShieldCheck } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { ContactDialog } from '@/components/messaging/contact-dialog'
import { ContactTcDialog } from '@/components/messaging/contact-tc-dialog'
import { motion, AnimatePresence } from 'framer-motion'
import { useRealtimeMessages, type RealtimeMessagePayload } from '@/hooks/use-realtime-messages'

interface Participant {
  id: string
  firstName: string
  lastName: string
  avatarUrl: string | null
}

interface PropertyImage {
  id: string
  url: string
  order: number
}

interface PropertyInfo {
  id: string
  title: string
  images: PropertyImage[]
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
  sender: Participant
  attachments?: MessageAttachment[]
}

interface Conversation {
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
  unreadCount: number
}

export function Messages() {
  const { user, isAuthenticated } = useAuthStore()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingFiles, setPendingFiles] = useState<{ file: File; preview: string }[]>([])

  const fetchConversations = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    try {
      const data = await authFetch<{ conversations: Conversation[]; totalUnread: number }>('/api/messages')
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

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  const selected = conversations.find((c) => c.id === selectedId)

  // ─── Realtime subscription for incoming messages ────────────────
  useRealtimeMessages({
    userId: user?.id,
    onNewMessage: (payload: RealtimeMessagePayload) => {
      // Find the conversation in local state
      const conv = conversations.find((c) => c.id === payload.conversation_id)
      if (!conv) {
        // Unknown conversation — refresh the list
        fetchConversations()
        return
      }

      // Determine sender info from participants
      const isMe = payload.sender_id === user?.id
      const sender = conv.participant1Id === payload.sender_id ? conv.participant1 : conv.participant2

      const newMessage: Message = {
        id: payload.id,
        content: payload.content,
        createdAt: payload.created_at,
        isRead: payload.is_read,
        senderId: payload.sender_id,
        sender: {
          id: sender.id,
          firstName: sender.firstName,
          lastName: sender.lastName,
          avatarUrl: sender.avatarUrl,
        },
      }

      // Add to full messages if this conversation is selected
      if (selectedId === payload.conversation_id) {
        setFullMessages((prev) => [...prev, newMessage])
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
      }

      // Update conversation in the list
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== payload.conversation_id) return c
          return {
            ...c,
            messages: [...c.messages, newMessage],
            lastMessageAt: payload.created_at,
            unreadCount: selectedId === payload.conversation_id
              ? c.unreadCount
              : c.unreadCount + 1,
          }
        }).sort((a, b) => {
          // Move updated conversation to top
          const aTime = a.lastMessageAt || a.createdAt
          const bTime = b.lastMessageAt || b.createdAt
          return new Date(bTime).getTime() - new Date(aTime).getTime()
        })
      )
    },
  })

  // Fetch full message history when selecting a conversation
  const [fullMessages, setFullMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)

  useEffect(() => {
    if (!selectedId) {
      setFullMessages([])
      return
    }
    setLoadingMessages(true)
    authFetch<{ conversation: Conversation }>(`/api/messages?conversationId=${selectedId}`)
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

  // Auto-scroll to bottom when selecting a conversation or messages change
  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }, [selectedId, fullMessages.length])

  // Cleanup file previews on unmount
  useEffect(() => {
    return () => {
      pendingFiles.forEach((f) => URL.revokeObjectURL(f.preview))
    }
  }, [pendingFiles])

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

      const data = await authFetch<{ message: Message; conversation: Conversation }>('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      // Update conversations list
      setConversations((prev) => {
        const convIndex = prev.findIndex((c) => c.id === data.conversation.id)
        if (convIndex >= 0) {
          const updated = [...prev]
          updated[convIndex] = {
            ...updated[convIndex],
            messages: [...updated[convIndex].messages, data.message],
            lastMessageAt: new Date().toISOString(),
          }
          return updated
        }
        return [
          {
            ...data.conversation,
            messages: [data.message],
            unreadCount: 0,
          },
          ...prev,
        ]
      })

      setFullMessages((prev) => [...prev, data.message])
      setMessageText('')
      setPendingFiles([])

      if (!selectedId && data.conversation.id) {
        setSelectedId(data.conversation.id)
      }

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } catch (err) {
      console.error('Send message error:', err)
    } finally {
      setSending(false)
    }
  }

  const formatTime = (dateStr: string) => {
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

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded-lg bg-muted animate-pulse" />
        <div className="h-[500px] rounded-xl bg-muted animate-pulse" />
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Messages</h1>
          <p className="text-muted-foreground mt-1">Vos conversations</p>
        </div>
        <div className="flex items-center gap-2">
          <ContactTcDialog
            onMessageSent={(convId) => {
              fetchConversations()
              setSelectedId(convId)
            }}
            trigger={
              <Button variant="outline" className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 shrink-0">
                <ShieldCheck className="size-4" />
                <span className="hidden sm:inline">TC</span>
              </Button>
            }
          />
          <ContactDialog
            onMessageSent={(convId) => {
              fetchConversations()
              setSelectedId(convId)
            }}
            trigger={
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                <Plus className="size-4" />
                Nouvelle conversation
              </Button>
            }
          />
        </div>
      </div>

      <Card className="border-border overflow-hidden">
        <div className="flex h-[calc(100dvh-12rem)] min-h-[400px]">
          {/* Conversation list */}
          <div className={`w-full sm:w-80 border-r border-border flex flex-col min-h-0 ${selectedId ? 'hidden sm:flex' : ''}`}>
            <div className="p-3 border-b border-border shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9"
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0">
              {filteredConversations.length === 0 ? (
                <div className="py-12 text-center">
                  <MessageSquare className="size-8 text-neutral-300 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Aucune conversation</p>
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const other = conv.participant1Id === user?.id ? conv.participant2 : conv.participant1
                  const lastMsg = conv.messages?.[conv.messages.length - 1]
                  return (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedId(conv.id)}
                      className={`w-full flex items-start gap-3 p-3 text-left hover:bg-accent transition-colors border-b border-border ${
                        selectedId === conv.id ? 'bg-brand-50' : ''
                      }`}
                    >
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
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>
                            {other.firstName} {other.lastName}
                          </p>
                          {lastMsg && (
                            <span className="text-xs text-muted-foreground shrink-0 ml-2">
                              {formatTime(lastMsg.createdAt)}
                            </span>
                          )}
                        </div>
                        {conv.property && (
                          <p className="text-xs text-muted-foreground truncate">{conv.property.title}</p>
                        )}
                        {lastMsg && (
                          <p className={`text-xs truncate mt-0.5 ${conv.unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                            {lastMsg.senderId === user?.id ? 'Vous : ' : ''}{lastMsg.content}
                          </p>
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Chat area */}
          <div className={`flex-1 flex flex-col min-h-0 ${!selectedId ? 'hidden sm:flex' : ''}`}>
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
                    <button onClick={() => setSelectedId(null)} className="sm:hidden">
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
                      <p className="text-sm font-medium">{otherPerson.firstName} {otherPerson.lastName}</p>
                      {selected.property && (
                        <p className="text-xs text-muted-foreground truncate">{selected.property.title}</p>
                      )}
                    </div>
                  </div>

                  {/* Messages area */}
                  <div className="overflow-y-auto flex-1 min-h-0">
                    <div className="p-4 space-y-3">
                      {loadingMessages ? (
                        <div className="flex items-center justify-center py-8">
                          <span className="size-5 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
                        </div>
                      ) : fullMessages.map((msg) => {
                        const isMe = msg.senderId === user?.id
                        const hasAttachments = msg.attachments && msg.attachments.length > 0
                        return (
                          <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className="flex items-end gap-2 max-w-[75%] sm:max-w-[70%]">
                              {!isMe && (
                                <Avatar className="size-6 shrink-0">
                                  <AvatarFallback className="bg-brand-100 text-brand-700 text-[10px]">
                                    {msg.sender.firstName[0]}{msg.sender.lastName[0]}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                              <div>
                                <div className={`rounded-2xl px-4 py-2.5 text-sm break-words ${
                                  isMe ? 'bg-brand-500 text-white rounded-br-md' : 'bg-muted text-foreground rounded-bl-md'
                                }`}>
                                  {msg.content && <p>{msg.content}</p>}
                                  {hasAttachments && (
                                    <div className={`space-y-1.5 ${msg.content ? 'mt-2' : ''}`}>
                                      {msg.attachments!.map((att) => (
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
                                              className={`flex items-center gap-2 rounded-lg p-2 text-xs ${
                                                isMe ? 'bg-brand-600 text-white' : 'bg-background text-foreground border'
                                              }`}
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
                                <p className={`text-[10px] mt-0.5 px-1 ${isMe ? 'text-right text-muted-foreground' : 'text-muted-foreground'}`}>
                                  {formatTime(msg.createdAt)}
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
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
                              aria-label="Retirer la pièce jointe"
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
                        aria-label="Joindre un fichier"
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
                        aria-label="Envoyer le message"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
                      >
                        <Send className="size-4" />
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
                  <div className="text-center">
                    <MessageSquare className="size-12 text-neutral-300 mx-auto mb-3" />
                    <p className="text-muted-foreground">Sélectionnez une conversation</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">ou démarrez une nouvelle discussion</p>
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
