import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ─── Semantic status palette ──────────────────────────────────────────────────
// Single source of truth for "what color means what" across the app. Every
// domain-specific status (property, lease, application, payment, dispute...)
// maps onto one of these five tones instead of picking its own shade of
// green/emerald/blue/sky at random.

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const TONE_CLASSES: Record<StatusTone, string> = {
  success: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900',
  warning: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
  danger: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900',
  info: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900',
  neutral: 'bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-800/60 dark:text-neutral-400 dark:border-neutral-700',
}

export const TONE_DOT_CLASSES: Record<StatusTone, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-sky-500',
  neutral: 'bg-neutral-400',
}

interface StatusBadgeProps {
  tone: StatusTone
  label: string
  className?: string
}

/** Generic status pill — pick a tone (what it means), pass the label (what to call it). */
export function StatusBadge({ tone, label, className }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn('font-medium', TONE_CLASSES[tone], className)}>
      {label}
    </Badge>
  )
}

// ─── Property rental status ───────────────────────────────────────────────────
// The most duplicated status in the app (properties.tsx, search-properties.tsx,
// property-map-leaflet.tsx each reimplemented this independently, with the map
// pin using a different palette than the map popup badge).

export type PropertyRentalStatus = 'disponible' | 'loue' | 'reserve'

export const PROPERTY_RENTAL_STATUS: Record<PropertyRentalStatus, { label: string; tone: StatusTone }> = {
  disponible: { label: 'Disponible', tone: 'success' },
  loue: { label: 'Loué', tone: 'danger' },
  reserve: { label: 'Réservé', tone: 'warning' },
}

/** Solid (non-outline) status pill for use over photos/maps, where the outline variant lacks contrast. */
export function PropertyStatusBadge({ status, className }: { status: string; className?: string }) {
  const { label, tone } = PROPERTY_RENTAL_STATUS[status as PropertyRentalStatus] ?? PROPERTY_RENTAL_STATUS.disponible
  const solidClasses: Record<StatusTone, string> = {
    success: 'bg-emerald-500 text-white',
    warning: 'bg-amber-500 text-white',
    danger: 'bg-red-500 text-white',
    info: 'bg-sky-500 text-white',
    neutral: 'bg-neutral-500 text-white',
  }
  return (
    <Badge className={cn('border-0', solidClasses[tone], className)}>
      {label}
    </Badge>
  )
}
