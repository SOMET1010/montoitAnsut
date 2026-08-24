import type { AuthUser } from '@/lib/auth-store'

// Single source of truth for role display (label + color) — previously
// duplicated with diverging colors between sidebar.tsx and header.tsx
// (e.g. AGENCE was orange in one and teal in the other for the same role).

export function getRoleLabel(role: AuthUser['role']): string {
  switch (role) {
    case 'LOCATAIRE': return 'Locataire'
    case 'PROPRIETAIRE': return 'Propriétaire'
    case 'AGENCE': return 'Agence'
    case 'TIERS_CONFIANCE': return 'Tiers de Confiance'
    case 'ADMIN': return 'Administration'
    default: return role
  }
}

// Includes a border color so it works both as a plain badge (sidebar) and
// an outlined badge (header dropdown).
export function getRoleColor(role: AuthUser['role']): string {
  switch (role) {
    case 'LOCATAIRE': return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'PROPRIETAIRE': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    case 'AGENCE': return 'bg-orange-100 text-orange-700 border-orange-200'
    case 'TIERS_CONFIANCE': return 'bg-orange-100 text-orange-700 border-orange-200'
    case 'ADMIN': return 'bg-rose-100 text-rose-700 border-rose-200'
    default: return 'bg-neutral-100 text-neutral-700 border-neutral-200'
  }
}
