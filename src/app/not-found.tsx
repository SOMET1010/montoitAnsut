'use client'

import { useRouter } from 'next/navigation'
import { Home, Search, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Error code */}
        <div className="space-y-2">
          <p className="text-[120px] font-bold leading-none text-brand-500 drop-shadow-sm">
            404
          </p>
          <h1 className="text-2xl font-bold text-foreground">
            Page introuvable
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
            La page que vous cherchez n&apos;existe pas ou a été déplacée.
            Vérifiez l&apos;URL ou retournez à l&apos;accueil.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-95"
          >
            <Home className="size-4" />
            Accueil
          </button>
          <button
            onClick={() => router.push('/?view=nos-biens')}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all hover:bg-accent active:scale-95"
          >
            <Search className="size-4" />
            Voir les biens
          </button>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all hover:bg-accent active:scale-95"
          >
            <ArrowLeft className="size-4" />
            Retour
          </button>
        </div>

        {/* Decorative */}
        <div className="pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Mon Toit — Location de biens immobiliers en Côte d&apos;Ivoire
          </p>
        </div>
      </div>
    </div>
  )
}
