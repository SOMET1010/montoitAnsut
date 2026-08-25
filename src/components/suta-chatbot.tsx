'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Trash2, Sparkles, GripVertical, MapPin, ArrowRight, BedDouble, Mic, Square, Volume2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { apiFetch } from '@/lib/capacitor'
import { useAuthStore } from '@/lib/auth-store'

interface PropertyResultCard {
  id: string
  title: string
  price: number
  commune: string | null
  city: string
  type: string
  bedrooms: number | null
  area: number
  image: string | null
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  properties?: PropertyResultCard[]
  mapImage?: string | null
  mapLabel?: string | null
}

// Generate a stable session ID per browser session
function getSessionId(): string {
  if (typeof window === 'undefined') return 'server'
  const key = 'suta-session-id'
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = `suta-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    sessionStorage.setItem(key, id)
  }
  return id
}

const SUGGESTIONS = [
  'Comment chercher un logement ?',
  'Comment publier une annonce ?',
  'Qu\'est-ce que le Tiers de Confiance ?',
  'Comment payer mon loyer ?',
  'Comment déposer un dossier de location ?',
]

export function SutaChatbot() {
  const { setView, setSelectedPropertyId } = useAuthStore()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string>('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartPos = useRef({ x: 0, y: 0 })
  const chatPanelRef = useRef<HTMLDivElement>(null)

  // Voice (Azure AI Speech)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null)
  const [ttsLoadingMsgId, setTtsLoadingMsgId] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)

  // Initialize session ID on client
  useEffect(() => {
    setSessionId(getSessionId())
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  // Handle drag functionality for both panel and button
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Prevent drag when clicking interactive elements inside header
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('input') || target.closest('a')) return

    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    setIsDragging(true)
    dragStartPos.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    }
  }, [position])

  useEffect(() => {
    if (!isDragging) return

    const handlePointerMove = (e: PointerEvent) => {
      const newX = e.clientX - dragStartPos.current.x
      const newY = e.clientY - dragStartPos.current.y

      // Constrain within viewport
      const panelWidth = window.innerWidth < 640 ? window.innerWidth - 16 : 380
      const panelHeight = window.innerWidth < 640 ? window.innerHeight - 16 : 500
      const maxX = Math.max(0, window.innerWidth - panelWidth)
      const maxY = Math.max(0, window.innerHeight - panelHeight)

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      })
    }

    const handlePointerUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)

    return () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isDragging])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setShowSuggestions(false)

    try {
      const res = await apiFetch('/api/suta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim(), sessionId }),
        credentials: 'include',
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erreur de connexion')
      }

      const assistantMessage: Message = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        properties: data.properties,
        mapImage: data.mapImage,
        mapLabel: data.mapLabel,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage: Message = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content: 'Désolé, une erreur est survenue. Veuillez réessayer dans un instant. 🙏',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, sessionId])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  // ── Voice input (Azure AI Speech) ───────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType })
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        if (blob.size === 0) return

        setIsTranscribing(true)
        try {
          const res = await apiFetch('/api/suta/speech-to-text', {
            method: 'POST',
            headers: { 'Content-Type': mimeType },
            body: blob,
            credentials: 'include',
          })
          const data = await res.json()
          if (!res.ok || !data.text) throw new Error(data.error || 'Transcription impossible')
          sendMessage(data.text)
        } catch {
          // Silently drop — voice input is best-effort, user can type instead
        } finally {
          setIsTranscribing(false)
        }
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
    } catch {
      // Mic permission denied or unavailable — nothing to do, user can type
    }
  }, [sendMessage])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    setIsRecording(false)
  }, [])

  const toggleRecording = useCallback(() => {
    if (isRecording) stopRecording()
    else startRecording()
  }, [isRecording, startRecording, stopRecording])

  // ── Voice output (Azure AI Speech) ──────────────────────────────────────
  const playMessageAudio = useCallback(async (msg: Message) => {
    if (playingMsgId === msg.id) {
      audioPlayerRef.current?.pause()
      setPlayingMsgId(null)
      return
    }

    setTtsLoadingMsgId(msg.id)
    try {
      const res = await apiFetch('/api/suta/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msg.content }),
        credentials: 'include',
      })
      if (!res.ok) throw new Error('TTS failed')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      audioPlayerRef.current?.pause()
      const audio = new Audio(url)
      audioPlayerRef.current = audio
      audio.onended = () => setPlayingMsgId(null)
      setPlayingMsgId(msg.id)
      await audio.play()
    } catch {
      // Voice playback is best-effort
    } finally {
      setTtsLoadingMsgId(null)
    }
  }, [playingMsgId])

  const clearConversation = async () => {
    try {
      await apiFetch(`/api/suta?sessionId=${sessionId}`, { method: 'DELETE', credentials: 'include' })
    } catch {
      // Ignore delete errors
    }
    setMessages([])
    setShowSuggestions(true)
  }

  // Welcome message
  const welcomeShown = useRef(false)
  useEffect(() => {
    if (isOpen && !welcomeShown.current && messages.length === 0) {
      welcomeShown.current = true
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: 'Salut ! 👋 Je suis **SUTA**, ton assistant intelligent sur Mon Toit. Je peux t\'aider à comprendre toutes les fonctionnalités de la plateforme, que tu sois Locataire, Propriétaire, Agence ou Tiers de Confiance.\n\nComment puis-je t\'aider aujourd\'hui ?',
          timestamp: new Date(),
        },
      ])
    }
  }, [isOpen, messages.length])

  return (
    <>
      {/* Floating Button — uses the SUTA logo image */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-24 right-4 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-brand-500 p-1 shadow-lg shadow-brand-500/30 hover:shadow-xl hover:shadow-brand-500/40 transition-shadow sm:bottom-6 sm:right-6"
            style={{
              transform: `translate(${position.x}px, ${position.y}px)`,
            }}
            aria-label="Ouvrir le chat SUTA"
          >
            <div className="relative h-full w-full">
              <img
                src="/suta-avatar.jpg"
                alt="SUTA"
                className="h-full w-full rounded-full object-cover"
              />
              <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-400" />
              </span>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            ref={chatPanelRef}
            className="fixed inset-2 z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:inset-auto sm:bottom-4 sm:right-4 sm:top-auto sm:left-auto sm:h-auto sm:w-[380px]"
            style={{
              transform: `translate(${position.x}px, ${position.y}px)`,
            }}
          >
            {/* Header */}
            <div
              className="flex items-center gap-2.5 border-b border-white/10 bg-brand-500 px-3 py-2.5 text-white sm:gap-3 sm:px-4 sm:py-3 cursor-move select-none touch-none"
              onPointerDown={handlePointerDown}
            >
              <GripVertical className="h-4 w-4 text-white/60 flex-shrink-0 hidden sm:block" />
              <div className="relative flex-shrink-0">
                <img
                  src="/suta-avatar.jpg"
                  alt="SUTA"
                  className="h-9 w-9 rounded-full border-2 border-white/30 object-cover sm:h-10 sm:w-10"
                />
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-brand-500 bg-green-400 sm:h-3 sm:w-3" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm leading-tight sm:text-base">SUTA</h3>
                <p className="text-[11px] text-white/80 flex items-center gap-1 sm:text-xs">
                  <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  Assistant IA Mon Toit
                </p>
              </div>
              <div className="flex items-center gap-0.5 sm:gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearConversation}
                  className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10 sm:h-8 sm:w-8"
                  title="Effacer la conversation"
                >
                  <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10 sm:h-8 sm:w-8"
                  title="Fermer"
                >
                  <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-3 py-3 sm:px-4 sm:py-4">
              <div ref={scrollRef} className="space-y-3 sm:space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2 sm:gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {/* Avatar */}
                    {msg.role === 'assistant' ? (
                      <div className="flex-shrink-0">
                        <img
                          src="/suta-avatar.jpg"
                          alt="SUTA"
                          className="h-7 w-7 rounded-full object-cover sm:h-8 sm:w-8"
                        />
                      </div>
                    ) : (
                      <div className="flex-shrink-0 h-7 w-7 rounded-full bg-muted flex items-center justify-center sm:h-8 sm:w-8">
                        <span className="text-[10px] font-medium text-muted-foreground sm:text-xs">Vous</span>
                      </div>
                    )}

                    {/* Bubble */}
                    <div className={`flex flex-col gap-2 max-w-[82%] sm:max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`rounded-2xl px-3 py-2 text-[13px] leading-relaxed sm:px-4 sm:py-2.5 sm:text-sm ${
                          msg.role === 'user'
                            ? 'bg-brand-500 text-white rounded-tr-sm'
                            : 'bg-muted text-foreground rounded-tl-sm'
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words">
                          {msg.content.split(/(\*\*.*?\*\*)/).map((part, i) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                              return <strong key={i}>{part.slice(2, -2)}</strong>
                            }
                            return <span key={i}>{part}</span>
                          })}
                        </div>
                      </div>

                      {/* Listen to this reply (Azure AI Speech TTS) */}
                      {msg.role === 'assistant' && msg.id !== 'welcome' && (
                        <button
                          onClick={() => playMessageAudio(msg)}
                          disabled={ttsLoadingMsgId === msg.id}
                          className="flex items-center gap-1 text-[10.5px] text-muted-foreground hover:text-brand-500 transition-colors px-1"
                        >
                          {ttsLoadingMsgId === msg.id ? (
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          ) : (
                            <Volume2 className={`h-2.5 w-2.5 ${playingMsgId === msg.id ? 'text-brand-500' : ''}`} />
                          )}
                          {playingMsgId === msg.id ? 'Lecture...' : 'Écouter'}
                        </button>
                      )}

                      {/* Map image (Azure Maps) */}
                      {msg.mapImage && (
                        <div className="w-full overflow-hidden rounded-xl border border-border">
                          <img src={msg.mapImage} alt={msg.mapLabel || 'Carte'} className="w-full h-auto" />
                          {msg.mapLabel && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted text-[11px] text-muted-foreground">
                              <MapPin className="h-3 w-3 text-brand-500" />
                              {msg.mapLabel}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Property result cards */}
                      {msg.properties && msg.properties.length > 0 && (
                        <div className="w-full space-y-1.5">
                          {msg.properties.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => {
                                setSelectedPropertyId(p.id)
                                setView('property-detail')
                                setIsOpen(false)
                              }}
                              className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-card p-2 text-left hover:border-brand-500/40 hover:bg-brand-500/5 transition-colors"
                            >
                              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                                {p.image ? (
                                  <img src={p.image} alt={p.title} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                    <MapPin className="h-4 w-4" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[12px] font-semibold text-foreground">{p.title}</p>
                                <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                                  <span className="truncate">{p.commune || p.city}</span>
                                  {p.bedrooms !== null && (
                                    <span className="flex items-center gap-0.5 shrink-0"><BedDouble className="h-2.5 w-2.5" />{p.bedrooms}</span>
                                  )}
                                </div>
                                <p className="text-[11px] font-bold text-brand-500">{p.price.toLocaleString('fr-FR')} F/mois</p>
                              </div>
                              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {isLoading && (
                  <div className="flex gap-2 sm:gap-2.5">
                    <img
                      src="/suta-avatar.jpg"
                      alt="SUTA"
                      className="h-7 w-7 rounded-full object-cover flex-shrink-0 sm:h-8 sm:w-8"
                    />
                    <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2.5 sm:px-4 sm:py-3">
                      <div className="flex gap-1 sm:gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce sm:h-2 sm:w-2" style={{ animationDelay: '0ms' }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce sm:h-2 sm:w-2" style={{ animationDelay: '150ms' }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce sm:h-2 sm:w-2" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Suggestions */}
              {showSuggestions && messages.length <= 1 && (
                <div className="mt-3 space-y-1.5 sm:mt-4 sm:space-y-2">
                  <p className="text-[11px] text-muted-foreground font-medium px-0.5 sm:text-xs">Suggestions :</p>
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => sendMessage(suggestion)}
                      className="w-full text-left rounded-xl border border-border bg-card px-2.5 py-1.5 text-[13px] text-foreground hover:border-brand-500/40 hover:bg-brand-500/5 transition-colors sm:px-3 sm:py-2 sm:text-sm"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <form onSubmit={handleSubmit} className="border-t border-border px-3 py-2 sm:px-4 sm:py-3 safe-area-bottom">
              <div className="flex items-center gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isRecording ? 'Je t\'écoute...' : isTranscribing ? 'Transcription...' : 'Posez votre question...'}
                  disabled={isLoading || isRecording || isTranscribing}
                  className="flex-1 rounded-full border-border bg-muted text-[13px] focus:border-brand-500 focus:ring-brand-500/20 sm:text-sm"
                />
                <Button
                  type="button"
                  size="icon"
                  onClick={toggleRecording}
                  disabled={isLoading || isTranscribing}
                  title={isRecording ? 'Arrêter l\'enregistrement' : 'Parler à SUTA'}
                  className={`h-9 w-9 rounded-full flex-shrink-0 sm:h-10 sm:w-10 ${
                    isRecording
                      ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                      : 'bg-muted hover:bg-accent text-muted-foreground'
                  }`}
                >
                  {isTranscribing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
                  ) : isRecording ? (
                    <Square className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  ) : (
                    <Mic className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  )}
                </Button>
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() || isLoading}
                  aria-label="Envoyer le message"
                  className="h-9 w-9 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex-shrink-0 sm:h-10 sm:w-10"
                >
                  <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
