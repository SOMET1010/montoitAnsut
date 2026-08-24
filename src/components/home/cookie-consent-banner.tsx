'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Cookie, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/auth-store'

const COOKIE_CONSENT_KEY = 'montoit-cookie-consent'

type ConsentChoice = 'accepted' | 'refused' | null

function getStoredConsent(): ConsentChoice {
  try {
    return localStorage.getItem(COOKIE_CONSENT_KEY) as ConsentChoice
  } catch {
    return null
  }
}

function setStoredConsent(value: 'accepted' | 'refused') {
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, value)
  } catch {
    // localStorage inaccessible (incognito, full, disabled) — just keep in-memory state
  }
}

export function CookieConsentBanner() {
  const [consent, setConsent] = useState<ConsentChoice>(null)
  const [isVisible, setIsVisible] = useState(false)
  const { setView } = useAuthStore()

  useEffect(() => {
    const stored = getStoredConsent()
    if (stored !== 'accepted' && stored !== 'refused') {
      // Small delay so the banner slides in smoothly after page mount
      const timer = setTimeout(() => setIsVisible(true), 600)
      return () => clearTimeout(timer)
    }
    setConsent(stored)
  }, [])

  const handleAccept = () => {
    setStoredConsent('accepted')
    setConsent('accepted')
    setIsVisible(false)
  }

  const handleRefuse = () => {
    setStoredConsent('refused')
    setConsent('refused')
    setIsVisible(false)
  }

  const handleDismiss = () => {
    // Close without saving a permanent choice — banner will show again on next page load
    setIsVisible(false)
  }

  const handleLearnMore = () => {
    setView('cookies')
  }

  return (
    <AnimatePresence>
      {isVisible && consent === null && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Bandeau de consentement aux cookies"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6"
        >
          <div className="mx-auto max-w-5xl bg-white border border-border rounded-2xl shadow-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
            {/* Icon */}
            <div className="hidden sm:flex items-center justify-center size-12 shrink-0 rounded-xl bg-brand-50 text-brand-500">
              <Cookie className="size-6" />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground mb-1">
                🍪 Nous utilisons des cookies
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Nous utilisons des cookies pour améliorer votre expérience sur Mon Toit,
                analyser notre trafic et personnaliser le contenu. En cliquant sur
                &laquo; Accepter &raquo;, vous consentez à l&apos;utilisation de tous les cookies.{' '}
                <button
                  onClick={handleLearnMore}
                  className="text-brand-500 hover:underline font-medium whitespace-nowrap"
                >
                  En savoir plus
                </button>
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <Button
                onClick={handleRefuse}
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none text-xs sm:text-sm"
              >
                Refuser
              </Button>
              <Button
                onClick={handleAccept}
                size="sm"
                className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm"
              >
                Accepter
              </Button>
            </div>

            {/* Close button — dismiss temporarily without saving a refusal */}
            <button
              onClick={handleDismiss}
              className="absolute top-3 right-3 sm:static text-neutral-400 hover:text-foreground transition-colors"
              aria-label="Fermer"
            >
              <X className="size-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
