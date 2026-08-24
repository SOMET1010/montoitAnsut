'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[ErrorBoundary]', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-8 text-destructive" />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            Une erreur est survenue
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Désolé, un problème inattendu s&apos;est produit. 
            {error.digest && (
              <span className="block mt-1 text-xs text-muted-foreground/60">
                Référence : {error.digest}
              </span>
            )}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-95"
          >
            <RefreshCw className="size-4" />
            Réessayer
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all hover:bg-accent active:scale-95"
          >
            <Home className="size-4" />
            Retour à l&apos;accueil
          </a>
        </div>
      </div>
    </div>
  )
}
