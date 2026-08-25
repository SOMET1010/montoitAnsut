'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { MessageSquare, Send, FileText, Search, Paperclip, Image as ImageIcon, X, ShieldCheck } from 'lucide-react'
import { ContactTcDialog } from '@/components/messaging/contact-tc-dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { useRealtimeMessages } from '@/hooks/use-realtime-messages'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

interface MessageAttachment {
  id: string; fileName: string; fileType: string; fileSize: number; url: string
}

interface MessageItem {
  id: string; content: string; isRead: boolean; createdAt: string; senderId: string
  sender?: { id: string; firstName: string; lastName: string }
  attachments?: MessageAttachment[]
}

interface Conversation {
  id: string; lastMessageAt: string | null; createdAt: string
  participant1: { id: string; firstName: string; lastName: string; role: string }
  participant2: { id: string; firstName: string; lastName: string; role: string }
  messages: MessageItem[]
  property: { id: string; title: string } | null
}

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }
const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }

const messageTemplates = [
  { label: 'Confirmation de visite', content: 'Bonjour, votre demande de visite a été confirmée pour le bien {property}.' },
  { label: 'Rappel de paiement', content: 'Bonjour, nous vous rappelons que votre loyer est dû pour le mois en cours.' },
  { label: 'Bienvenue', content: 'Bienvenue dans votre nouveau logement ! N\'hésitez pas à nous contacter pour toute question.' },
  { label: 'Fin de bail', content: 'Votre bail arrive à échéance le {date}. Souhaitez-vous le renouveler ?' },
]

export function AgenceCommunication() {
  const { isAuthenticated, user } = useAuthStore()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedConv, setSelectedConv] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingFiles, setPendingFiles] = useState<{ file: File; preview: string }[]>([])

  const fetchData = useCallback(async () => {
    if (!isAuthenticated || !user) { setLoading(false); return }
    try {
      const d = await authFetch<{ conversations: Conversation[] }>('/api/messages')
      setConversations(d.conversations ?? [])
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) return
      console.error('Failed to fetch conversations:', err)
    } finally { setLoading(false) }
  }, [isAuthenticated, user])

  useEffect(() => { fetchData() }, [fetchData])

  // Realtime subscription — refresh on new incoming messages
  useRealtimeMessages({
    userId: user?.id,
    onNewMessage: () => { fetchData() },
  })

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const sendMessage = async () => {
    if ((!newMessage.trim() && pendingFiles.length === 0) || !selectedConv) return
    try {
      const body: Record<string, unknown> = { conversationId: selectedConv }
      if (newMessage.trim()) body.content = newMessage.trim()
      if (pendingFiles.length > 0) {
        body.attachments = await Promise.all(
          pendingFiles.map(async (pf) => ({
            fileName: pf.file.name,
            fileType: pf.file.type,
            fileSize: pf.file.size,
            base64: await fileToBase64(pf.file),
          }))
        )
      }
      await authFetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setNewMessage('')
      setPendingFiles([])
      fetchData()
      toast.success('Message envoyé')
    } catch { toast.error('Erreur lors de l\'envoi') }
  }

  const filteredConvs = conversations.filter((c) => {
    if (filter === 'owner') return c.participant1.role === 'PROPRIETAIRE' || c.participant2.role === 'PROPRIETAIRE'
    if (filter === 'tenant') return c.participant1.role === 'LOCATAIRE' || c.participant2.role === 'LOCATAIRE'
    return true
  })

  const selected = conversations.find((c) => c.id === selectedConv)

  if (loading) return <div className="space-y-4">{[1, 2].map((i) => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}</div>

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="size-5 sm:size-6 text-[#FF6C2F]" /> Communication
          </h1>
          <p className="text-muted-foreground mt-1">{conversations.length} conversation{conversations.length > 1 ? 's' : ''}</p>
        </div>
        <ContactTcDialog
          onMessageSent={(convId) => {
            fetchData()
            setSelectedConv(convId)
          }}
          trigger={
            <Button variant="outline" className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 shrink-0">
              <ShieldCheck className="size-4" />
              <span className="hidden sm:inline">TC</span>
            </Button>
          }
        />
      </motion.div>

      <motion.div variants={itemVariants} className="grid lg:grid-cols-3 gap-4">
        {/* Conversations List */}
        <Card className="border-border lg:col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="owner">Propriétaires</SelectItem>
                  <SelectItem value="tenant">Locataires</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-2 max-h-96 overflow-y-auto space-y-1">
            {filteredConvs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune conversation</p>
            ) : (
              filteredConvs.map((c) => {
                const other = c.participant1.id === user?.id ? c.participant2 : c.participant1
                const lastMsg = c.messages?.[c.messages.length - 1]
                const unread = c.messages?.filter((m) => !m.isRead && m.senderId !== user?.id).length ?? 0
                return (
                  <button key={c.id} onClick={() => setSelectedConv(c.id)}
                    className={`w-full text-left p-2.5 rounded-lg hover:bg-accent/50 transition-colors ${selectedConv === c.id ? 'bg-orange-50 border border-[#FF6C2F]/20' : ''}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">{other.firstName} {other.lastName}</p>
                      {unread > 0 && <Badge className="bg-[#FF6C2F] text-white text-[10px]">{unread}</Badge>}
                    </div>
                    {lastMsg && <p className="text-xs text-muted-foreground truncate mt-0.5">{lastMsg.content}</p>}
                    {c.property && <p className="text-[10px] text-muted-foreground mt-0.5">🏠 {c.property.title}</p>}
                  </button>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="border-border lg:col-span-2">
          <CardHeader className="pb-2">
            {selected ? (
              <CardTitle className="text-sm">
                {(() => {
                  const other = selected.participant1.id === user?.id ? selected.participant2 : selected.participant1
                  return `${other.firstName} ${other.lastName}`
                })()}
              </CardTitle>
            ) : (
              <CardTitle className="text-sm text-muted-foreground">Sélectionnez une conversation</CardTitle>
            )}
          </CardHeader>
          <CardContent>
            {selected ? (
              <div className="space-y-3">
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {(selected.messages ?? []).map((m) => {
                    const isMe = m.senderId === user?.id
                    const hasAttachments = m.attachments && m.attachments.length > 0
                    return (
                      <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-2.5 rounded-lg text-sm ${isMe ? 'bg-[#FF6C2F] text-white' : 'bg-muted'}`}>
                          {m.content && <p>{m.content}</p>}
                          {hasAttachments && (
                            <div className={`space-y-1.5 ${m.content ? 'mt-2' : ''}`}>
                              {m.attachments!.map((att) => (
                                <div key={att.id}>
                                  {att.fileType.startsWith('image/') ? (
                                    <a href={att.url} target="_blank" rel="noopener noreferrer">
                                      <img src={att.url} alt={att.fileName} className="max-w-full rounded-lg max-h-32 object-cover cursor-pointer hover:opacity-90 transition-opacity" />
                                    </a>
                                  ) : (
                                    <a href={att.url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 rounded-lg p-1.5 text-xs ${isMe ? 'bg-orange-600 text-white' : 'bg-background text-foreground border'}`}>
                                      <FileText className="size-3 shrink-0" />
                                      <span className="truncate">{att.fileName}</span>
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {pendingFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {pendingFiles.map((pf, i) => (
                      <div key={i} className="relative group">
                        {pf.file.type.startsWith('image/') ? (
                          <img src={pf.preview} alt={pf.file.name} className="size-10 rounded object-cover" />
                        ) : (
                          <div className="size-10 rounded bg-muted flex items-center justify-center">
                            <FileText className="size-4 text-muted-foreground" />
                          </div>
                        )}
                        <button onClick={() => { URL.revokeObjectURL(pf.preview); setPendingFiles((prev) => prev.filter((_, j) => j !== i)) }}
                          aria-label="Retirer la pièce jointe"
                          className="absolute -top-1 -right-1 size-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="size-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" onChange={(e) => {
                    const files = Array.from(e.target.files || []).map((f) => ({ file: f, preview: URL.createObjectURL(f) }))
                    setPendingFiles((prev) => [...prev, ...files])
                    e.target.value = ''
                  }} className="hidden" />
                  <Button size="icon" variant="outline" onClick={() => fileInputRef.current?.click()} aria-label="Joindre un fichier" className="shrink-0">
                    <Paperclip className="size-4" />
                  </Button>
                  <Input placeholder="Votre message..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()} />
                  <Button onClick={sendMessage} aria-label="Envoyer le message" className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0" size="icon"
                    disabled={!newMessage.trim() && pendingFiles.length === 0}>
                    <Send className="size-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <MessageSquare className="size-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sélectionnez une conversation pour commencer</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Message Templates */}
      <motion.div variants={itemVariants}>
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="size-4 text-[#FF6C2F]" /> Modèles de messages
            </CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            {messageTemplates.map((t, i) => (
              <div key={i} className="p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => { setNewMessage(t.content); toast.info('Modèle copié') }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setNewMessage(t.content); toast.info('Modèle copié')
                  }
                }}>
                <p className="text-sm font-medium text-foreground">{t.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{t.content}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
