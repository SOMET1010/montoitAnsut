'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GlobalErrorBoundary]', error)
  }, [error])

  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Mon Toit — Erreur critique</title>
      </head>
      <body className="antialiased bg-background text-foreground">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center space-y-6">
            {/* Icon */}
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="size-8 text-destructive" />
            </div>

            {/* Title */}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">
                Erreur critique
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Une erreur critique s&apos;est produite dans l&apos;application.
                Veuillez réessayer ou contacter le support si le problème persiste.
              </p>
              {error.digest && (
                <p className="text-xs text-muted-foreground/50 mt-2">
                  Référence technique : {error.digest}
                </p>
              )}
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
                Retour à l&apos;accueil
              </a>
            </div>

            {/* Support info */}
            <p className="text-xs text-muted-foreground pt-4 border-t border-border">
              Mon Toit — Si le problème persiste, contactez-nous à&nbsp;
              <a href="mailto:support@mon-toit.ci" className="text-brand-500 hover:underline">
                support@mon-toit.ci
              </a>
            </p>
          </div>
        </div>
      </body>
    </html>
  )
}
