import {
  FileText, Eye, FileSignature, MessageSquare, ScrollText,
  Building2, ClipboardCheck, Users, Shield,
  BarChart3, Settings, AlertTriangle, Clock, BadgeCheck,
  LayoutDashboard, Search, Heart, UserCheck, CreditCard, Bell, Wrench, UserCircle, Home, MapPin, Scale, FolderOpen, Lock,
  Award, Fingerprint, ShieldAlert, GraduationCap, Megaphone, Flag, Activity, Database,
  PlusCircle,
} from 'lucide-react'
import type { AuthUser } from '@/lib/auth-store'

// Single source of truth for per-role navigation, consumed by both the
// dashboard sidebar (src/components/dashboard/sidebar.tsx) and the site
// header's account dropdown (src/components/home/header.tsx). Previously
// each file hand-typed its own id/label/section list, which let them drift
// out of sync (e.g. a header entry pointing at a dashboardSection that no
// longer existed). Every item's navigation target is now defined exactly
// once, in `section` — the sidebar and header can each still choose their
// own label, grouping, and whether to show a given item at all.

export interface NavItem {
  // dashboardSection this item navigates to (passed to setDashboardSection)
  section: string
  icon: React.ElementType
  // present = shown in the dashboard sidebar
  sidebar?: { label: string; group?: string }
  // present = shown in the header account dropdown. `order` breaks ties when
  // the header's intended row order differs from the sidebar's (the two
  // surfaces don't always agree on ordering within a shared group) —
  // omit it to fall back to this item's position in the role's array.
  header?: { label: string; group: string; id?: string; order?: number }
}

export const NAV_ITEMS: Record<AuthUser['role'], NavItem[]> = {
  LOCATAIRE: [
    { section: 'overview', icon: LayoutDashboard,
      sidebar: { label: 'Tableau de bord' }, header: { label: 'Tableau de bord', group: 'ESPACE', id: 'dashboard' } },
    { section: 'search-properties', icon: Search,
      sidebar: { label: 'Chercher un bien', group: 'LOCATION' } },
    { section: 'favorites', icon: Heart,
      sidebar: { label: 'Mes favoris', group: 'LOCATION' }, header: { label: 'Mes favoris', group: 'LOCATION' } },
    { section: 'applications', icon: UserCheck,
      sidebar: { label: 'Mes candidatures', group: 'LOCATION' }, header: { label: 'Mes candidatures', group: 'LOCATION' } },
    { section: 'my-visits', icon: Eye,
      sidebar: { label: 'Mes visites', group: 'LOCATION' }, header: { label: 'Mes visites', group: 'LOCATION', id: 'visits' } },
    { section: 'my-leases', icon: Home,
      sidebar: { label: 'Mes locations', group: 'LOCATION' }, header: { label: 'Mes locations', group: 'LOCATION', id: 'leases' } },
    { section: 'payments', icon: CreditCard,
      sidebar: { label: 'Mes paiements', group: 'LOCATION' }, header: { label: 'Mes paiements', group: 'LOCATION' } },
    { section: 'messages', icon: MessageSquare,
      sidebar: { label: 'Mes messages', group: 'MESSAGES' }, header: { label: 'Mes messages', group: 'MESSAGES' } },
    { section: 'disputes', icon: Scale,
      sidebar: { label: 'Mes litiges', group: 'MESSAGES' } },
    { section: 'notifications', icon: Bell,
      sidebar: { label: 'Mes notifications', group: 'MESSAGES' }, header: { label: 'Mes notifications', group: 'MESSAGES' } },
    { section: 'settings', icon: Settings,
      sidebar: { label: 'Paramètres', group: 'COMPTE' }, header: { label: 'Mon profil', group: 'COMPTE', id: 'profile' } },
  ],

  PROPRIETAIRE: [
    { section: 'overview', icon: LayoutDashboard,
      sidebar: { label: 'Tableau de bord' }, header: { label: 'Tableau de bord', group: 'ESPACE', id: 'dashboard' } },
    { section: 'my-properties', icon: Building2,
      sidebar: { label: 'Mes biens', group: 'MES BIENS' }, header: { label: 'Mes biens', group: 'MES BIENS', id: 'properties' } },
    { section: 'my-properties', icon: PlusCircle,
      header: { label: 'Ajouter un bien', group: 'MES BIENS', id: 'add-property' } },
    { section: 'my-tenants', icon: UserCircle,
      sidebar: { label: 'Mes locataires', group: 'LOCATION' } },
    { section: 'visit-requests', icon: Eye,
      sidebar: { label: 'Demandes de visite', group: 'LOCATION' }, header: { label: 'Demandes de visite', group: 'LOCATION', id: 'visits' } },
    { section: 'candidatures', icon: ClipboardCheck,
      sidebar: { label: 'Mes candidatures', group: 'LOCATION' }, header: { label: 'Dossiers locatifs', group: 'LOCATION', id: 'rental-files' } },
    { section: 'my-leases', icon: FileSignature,
      sidebar: { label: 'Mes baux', group: 'LOCATION' }, header: { label: 'Mes baux', group: 'LOCATION', id: 'leases' } },
    { section: 'mandats', icon: ScrollText,
      sidebar: { label: 'Mes mandats', group: 'LOCATION' } },
    { section: 'maintenance', icon: Wrench,
      sidebar: { label: 'Maintenance', group: 'LOCATION' } },
    { section: 'payments', icon: CreditCard,
      sidebar: { label: 'Paiements', group: 'LOCATION' }, header: { label: 'Paiements', group: 'LOCATION' } },
    { section: 'messages', icon: MessageSquare,
      sidebar: { label: 'Messages', group: 'MESSAGES' }, header: { label: 'Messages', group: 'MESSAGES' } },
    { section: 'disputes', icon: Scale,
      sidebar: { label: 'Litiges', group: 'MESSAGES' } },
    { section: 'notifications', icon: Bell,
      sidebar: { label: 'Notifications', group: 'MESSAGES' }, header: { label: 'Notifications', group: 'MESSAGES' } },
    { section: 'settings', icon: Settings,
      sidebar: { label: 'Paramètres', group: 'COMPTE' }, header: { label: 'Mon profil', group: 'COMPTE', id: 'profile' } },
  ],

  AGENCE: [
    { section: 'overview', icon: LayoutDashboard,
      sidebar: { label: 'Tableau de bord' }, header: { label: 'Tableau de bord', group: 'ESPACE', id: 'dashboard' } },
    { section: 'portfolio', icon: Building2,
      sidebar: { label: 'Nos biens', group: 'GESTION' }, header: { label: 'Nos biens', group: 'NOS BIENS', id: 'properties' } },
    { section: 'mandats', icon: ScrollText,
      sidebar: { label: 'Mandats', group: 'GESTION' } },
    { section: 'candidatures', icon: ClipboardCheck,
      sidebar: { label: 'Candidatures', group: 'GESTION' }, header: { label: 'Dossiers locatifs', group: 'LOCATION', id: 'rental-files', order: 3 } },
    { section: 'visits', icon: Eye,
      sidebar: { label: 'Visites', group: 'GESTION' }, header: { label: 'Demandes de visite', group: 'LOCATION', order: 2 } },
    { section: 'contracts', icon: FileSignature,
      sidebar: { label: 'Contrats', group: 'GESTION' }, header: { label: 'Nos baux', group: 'LOCATION', id: 'leases' } },
    { section: 'team', icon: Users,
      sidebar: { label: 'Équipe', group: 'ÉQUIPE' } },
    { section: 'finances', icon: BarChart3,
      sidebar: { label: 'Finances', group: 'FINANCES' }, header: { label: 'Paiements', group: 'LOCATION', id: 'payments' } },
    { section: 'analytics', icon: BarChart3,
      sidebar: { label: 'Analytics', group: 'FINANCES' } },
    { section: 'communication', icon: MessageSquare,
      sidebar: { label: 'Communication', group: 'OUTILS' }, header: { label: 'Messages', group: 'MESSAGES', id: 'messages' } },
    { section: 'disputes', icon: Scale,
      sidebar: { label: 'Litiges', group: 'OUTILS' } },
    { section: 'marketing', icon: Megaphone,
      sidebar: { label: 'Marketing', group: 'OUTILS' } },
    { section: 'client-files', icon: FolderOpen,
      sidebar: { label: 'Dossiers clients', group: 'OUTILS' } },
    { section: 'notifications', icon: Bell,
      header: { label: 'Notifications', group: 'MESSAGES' } },
    { section: 'settings', icon: Settings,
      sidebar: { label: 'Paramètres', group: 'COMPTE' }, header: { label: 'Profil agence', group: 'COMPTE', id: 'profile' } },
  ],

  TIERS_CONFIANCE: [
    { section: 'overview', icon: LayoutDashboard,
      sidebar: { label: 'Tableau de bord' }, header: { label: 'Tableau de bord', group: 'ESPACE', id: 'dashboard' } },
    { section: 'all-properties', icon: Building2,
      sidebar: { label: 'Tous les biens', group: 'VALIDATION' } },
    { section: 'property-verifications', icon: Home,
      sidebar: { label: 'Vérification biens', group: 'VALIDATION' } },
    { section: 'dossier-validations', icon: FolderOpen,
      sidebar: { label: 'Dossiers de validation', group: 'VALIDATION' }, header: { label: 'Dossiers', group: 'VALIDATION' } },
    { section: 'oneci-verification', icon: Fingerprint,
      sidebar: { label: 'Vérification ONECI', group: 'VALIDATION' } },
    { section: 'users', icon: Users,
      sidebar: { label: 'Tous les utilisateurs', group: 'GESTION' } },
    { section: 'certifications', icon: Award,
      sidebar: { label: 'Certifications', group: 'GESTION' } },
    { section: 'documentation', icon: GraduationCap,
      sidebar: { label: 'Centre de documentation', group: 'GESTION' } },
    { section: 'agents', icon: Users,
      sidebar: { label: 'Agents', group: 'MISSIONS' } },
    { section: 'missions', icon: MapPin,
      sidebar: { label: 'Missions', group: 'MISSIONS' } },
    { section: 'inventory-reports', icon: FileText,
      sidebar: { label: 'Rapports existants', group: 'MISSIONS' } },
    { section: 'messaging', icon: MessageSquare,
      sidebar: { label: 'Messagerie', group: 'SUIVI' } },
    { section: 'sla-monitoring', icon: Clock,
      sidebar: { label: 'Suivi SLA', group: 'SUIVI' }, header: { label: 'Suivi SLA', group: 'SUIVI', id: 'sla' } },
    { section: 'litiges', icon: Scale,
      sidebar: { label: 'Litiges', group: 'SUIVI' } },
    { section: 'fraud-alerts', icon: ShieldAlert,
      sidebar: { label: 'Alertes fraude', group: 'SUIVI' } },
    { section: 'notifications', icon: Bell,
      sidebar: { label: 'Notifications', group: 'SUIVI' }, header: { label: 'Notifications', group: 'SUIVI' } },
    { section: 'settings', icon: Settings,
      sidebar: { label: 'Paramètres', group: 'COMPTE' }, header: { label: 'Mon profil', group: 'COMPTE', id: 'profile' } },
  ],

  ADMIN: [
    { section: 'overview', icon: LayoutDashboard,
      sidebar: { label: 'Tableau de bord' }, header: { label: 'Tableau de bord', group: 'ESPACE', id: 'dashboard' } },
    { section: 'users', icon: Users,
      sidebar: { label: 'Utilisateurs', group: 'GESTION' }, header: { label: 'Utilisateurs', group: 'GESTION' } },
    { section: 'moderation', icon: ClipboardCheck,
      sidebar: { label: 'Modération contenu', group: 'GESTION' } },
    { section: 'trust-agents', icon: Shield,
      sidebar: { label: 'Tiers de Confiance', group: 'GESTION' } },
    { section: 'properties-moderation', icon: Building2,
      header: { label: 'Modération biens', group: 'GESTION', id: 'properties' } },
    { section: 'tc-management', icon: Shield,
      header: { label: 'Gestion TC', group: 'GESTION', id: 'tc' } },
    { section: 'signalements', icon: Flag,
      sidebar: { label: 'Signalements', group: 'SUPERVISION' } },
    { section: 'disputes', icon: AlertTriangle,
      sidebar: { label: 'Litiges', group: 'SUPERVISION' }, header: { label: 'Litiges', group: 'SUPERVISION' } },
    { section: 'notifications', icon: Bell,
      sidebar: { label: 'Notifications', group: 'SUPERVISION' }, header: { label: 'Notifications', group: 'SUPERVISION' } },
    { section: 'system', icon: Activity,
      sidebar: { label: 'Système', group: 'SYSTÈME' } },
    { section: 'security', icon: Lock,
      sidebar: { label: 'Sécurité', group: 'SYSTÈME' } },
    { section: 'reports', icon: BarChart3,
      sidebar: { label: 'Rapports', group: 'SYSTÈME' }, header: { label: 'Rapports', group: 'SUPERVISION', order: 7.5 } },
    { section: 'config', icon: Settings,
      sidebar: { label: 'Configuration', group: 'CONFIGURATION' } },
    { section: 'backups', icon: Database,
      sidebar: { label: 'Sauvegardes', group: 'CONFIGURATION' } },
    { section: 'settings', icon: Settings,
      header: { label: 'Paramètres', group: 'COMPTE', id: 'profile' } },
  ],
}

export interface SidebarItem { id: string; label: string; icon: React.ElementType }
export interface SidebarSection { title?: string; items: SidebarItem[] }

export function getSidebarSections(role: AuthUser['role']): SidebarSection[] {
  const items = NAV_ITEMS[role] ?? []
  const sections: SidebarSection[] = []
  const groupIndex = new Map<string | undefined, number>()

  for (const item of items) {
    if (!item.sidebar) continue
    const { label, group } = item.sidebar
    let idx = groupIndex.get(group)
    if (idx === undefined) {
      idx = sections.length
      sections.push({ title: group, items: [] })
      groupIndex.set(group, idx)
    }
    sections[idx].items.push({ id: item.section, label, icon: item.icon })
  }

  return sections
}

export interface UserMenuItem { id: string; label: string; icon: React.ElementType; section: string; group?: string }

export function getUserMenuItems(role: AuthUser['role']): UserMenuItem[] {
  const items = NAV_ITEMS[role] ?? []
  return items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.header)
    .sort((a, b) => (a.item.header!.order ?? a.index) - (b.item.header!.order ?? b.index))
    .map(({ item }) => ({
      id: item.header!.id ?? item.section,
      label: item.header!.label,
      icon: item.icon,
      section: item.section,
      group: item.header!.group,
    }))
}

// ─── Breadcrumb support ─────────────────────────────────────────────────────

// Sub-views reachable only by drilling into a list (not a sidebar item
// themselves) — maps each to the sidebar item that should stay highlighted,
// and whose label prefixes the breadcrumb trail, while the sub-view is open.
export const detailToParent: Record<string, string> = {
  'payment-detail': 'payments',
  'application-detail': 'applications',
  'visit-detail': 'my-visits',
  'lease-detail': 'my-leases',
  'tenant-detail': 'my-tenants',
  'property-verify-detail': 'property-verifications',
  'inventory-report-form': 'inventory-reports',
  'rental-file': 'settings',
  'owner-file': 'candidatures',
  'rental-file-detail': 'dossier-validations',
  'owner-file-detail': 'dossier-validations',
  'agency-detail': 'dossier-validations',
}

// Human labels for dashboardSections that have no NAV_ITEMS entry (either
// because they're a detail/sub-view, or a standalone view not linked from
// any sidebar/header item) — keeps the breadcrumb from ever showing a raw
// section id.
const EXTRA_SECTION_LABELS: Record<string, string> = {
  'rental-file': 'Mon dossier locatif',
  'owner-file': 'Dossier propriétaire',
  'rental-file-detail': 'Détail dossier locatif',
  'owner-file-detail': 'Détail dossier propriétaire',
  'agency-detail': 'Détail agence',
  'payment-detail': 'Détail paiement',
  'application-detail': 'Détail candidature',
  'visit-detail': 'Détail visite',
  'lease-detail': 'Détail bail',
  'tenant-detail': 'Détail locataire',
  'property-verify-detail': 'Détail vérification',
  'inventory-report-form': 'État des lieux',
  'rental-files-list': 'Dossiers locatifs',
  'rental-files-queue': "File d'attente dossiers",
  'reviews': 'Avis',
  'history': 'Historique',
  'trust-score': 'Score de confiance',
  'renewals': 'Renouvellements',
  'owner-validations': 'Validations propriétaires',
  'owner-dossiers': 'Dossiers propriétaires',
  'agency-validations': 'Validations agence',
}

export function getSectionLabel(role: AuthUser['role'], section: string): string {
  if (section === 'overview') return 'Tableau de bord'
  const items = NAV_ITEMS[role] ?? []
  for (const item of items) {
    if (item.section !== section) continue
    if (item.sidebar) return item.sidebar.label
    if (item.header) return item.header.label
  }
  return EXTRA_SECTION_LABELS[section] ?? section
}

export interface BreadcrumbCrumb { label: string; section?: string }

export function getBreadcrumbTrail(role: AuthUser['role'], section: string): BreadcrumbCrumb[] {
  if (section === 'overview') {
    return [{ label: 'Tableau de bord' }]
  }
  const parentSection = detailToParent[section]
  if (parentSection) {
    return [
      { label: 'Tableau de bord', section: 'overview' },
      { label: getSectionLabel(role, parentSection), section: parentSection },
      { label: getSectionLabel(role, section) },
    ]
  }
  return [
    { label: 'Tableau de bord', section: 'overview' },
    { label: getSectionLabel(role, section) },
  ]
}
