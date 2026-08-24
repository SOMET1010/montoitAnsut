'use client'

import { useState } from 'react'
import { Loader2, MessageSquare, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { authFetch, AuthError } from '@/lib/auth-fetch'
import { toast } from 'sonner'

interface QuickContactDialogProps {
  /** User to contact — the conversation is created/reused with this recipient */
  recipientId: string
  recipientName: string
  /** Optional property context attached to the conversation */
  propertyId?: string
  /** Trigger element (e.g. a "Contacter" button) */
  trigger: React.ReactNode
  /** Called with the conversation id once the message is sent */
  onSent?: (conversationId: string) => void
}

interface SendMessageResponse {
  conversation: { id: string }
}

// Sends the first message to a known recipient, creating the conversation
// on the fly — used wherever a specific user (tenant, owner...) needs to be
// contacted directly, without going through the generic recipient search.
export function QuickContactDialog({ recipientId, recipientName, propertyId, trigger, onSent }: QuickContactDialogProps) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    if (!content.trim() || sending) return
    setSending(true)
    try {
      const data = await authFetch<SendMessageResponse>('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId,
          content: content.trim(),
          ...(propertyId ? { propertyId } : {}),
        }),
      })

      toast.success(`Message envoyé à ${recipientName}`)
      setContent('')
      setOpen(false)
      onSent?.(data.conversation.id)
    } catch (err) {
      toast.error(err instanceof AuthError ? err.message : 'Impossible d\'envoyer le message')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setContent('') }}>
      <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="size-4" />
            Contacter {recipientName}
          </DialogTitle>
        </DialogHeader>
        <Textarea
          placeholder="Écrivez votre message..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className="resize-none"
          autoFocus
        />
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
            Annuler
          </Button>
          <Button
            onClick={handleSend}
            disabled={!content.trim() || sending}
            className="gap-2"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
