'use client'

import { 
  FileText, Eye, FileSignature, MessageSquare, ScrollText, 
  Building2, ClipboardCheck, Users, Shield, 
  BarChart3, Settings, AlertTriangle, Clock, BadgeCheck,
  LayoutDashboard, ChevronLeft, ChevronRight,
  Search, Heart, UserCheck, CreditCard, Bell, Wrench, UserCircle, Home, MapPin, Scale, FolderOpen, Lock,
  Award, Fingerprint, ShieldAlert, GraduationCap, Megaphone, Flag, Activity, Database, RefreshCw,
  PlusCircle
} from 'lucide-react'
import Image from 'next/image'
import { useAuthStore, type AuthUser } from '@/lib/auth-store'
import { getRoleLabel, getRoleColor } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { usePaymentAlerts } from '@/hooks/use-payment-alerts'

interface SidebarItem {
  id: string
  label: string
  icon: React.ElementType
}

interface SidebarSection {
  title?: string
  items: SidebarItem[]
}

export function getSidebarSections(role: AuthUser['role']): SidebarSection[] {
  switch (role) {
    case 'LOCATAIRE':
      return [
        {
          items: [
            { id: 'overview', label: 'Tableau de bord', icon: LayoutDashboard },
          ],
        },
        {
          title: 'LOCATION',
          items: [
            { id: 'search-properties', label: 'Chercher un bien', icon: Search },
            { id: 'favorites', label: 'Mes favoris', icon: Heart },
            { id: 'applications', label: 'Mes candidatures', icon: UserCheck },
            { id: 'my-visits', label: 'Mes visites', icon: Eye },
            { id: 'my-leases', label: 'Mes locations', icon: Home },
            { id: 'payments', label: 'Mes paiements', icon: CreditCard },
          ],
        },
        {
          title: 'MESSAGES',
          items: [
            { id: 'messages', label: 'Mes messages', icon: MessageSquare },
            { id: 'disputes', label: 'Mes litiges', icon: Scale },
            { id: 'notifications', label: 'Mes notifications', icon: Bell },
          ],
        },
        {
          title: 'COMPTE',
          items: [
            { id: 'settings', label: 'Paramètres', icon: Settings },
          ],
        },
      ]
    case 'PROPRIETAIRE':
      return [
        {
          items: [
            { id: 'overview', label: 'Tableau de bord', icon: LayoutDashboard },
          ],
        },
        {
          title: 'MES BIENS',
          items: [
            { id: 'my-properties', label: 'Mes biens', icon: Building2 },
          ],
        },
        {
          title: 'LOCATION',
          items: [
            { id: 'my-tenants', label: 'Mes locataires', icon: UserCircle },
            { id: 'visit-requests', label: 'Demandes de visite', icon: Eye },
            { id: 'candidatures', label: 'Mes candidatures', icon: ClipboardCheck },
            { id: 'my-leases', label: 'Mes baux', icon: FileSignature },
            { id: 'mandats', label: 'Mes mandats', icon: ScrollText },
            { id: 'maintenance', label: 'Maintenance', icon: Wrench },
            { id: 'payments', label: 'Paiements', icon: CreditCard },
          ],
        },
        {
          title: 'MESSAGES',
          items: [
            { id: 'messages', label: 'Messages', icon: MessageSquare },
            { id: 'disputes', label: 'Litiges', icon: Scale },
            { id: 'notifications', label: 'Notifications', icon: Bell },
          ],
        },
        {
          title: 'PARAMÈTRES',
          items: [
            { id: 'settings', label: 'Paramètres', icon: Settings },
          ],
        },
      ]
    case 'AGENCE':
      return [
        {
          items: [
            { id: 'overview', label: 'Tableau de bord', icon: LayoutDashboard },
          ],
        },
        {
          title: 'GESTION',
          items: [
            { id: 'portfolio', label: 'Nos biens', icon: Building2 },
            { id: 'mandats', label: 'Mandats', icon: ScrollText },
            { id: 'candidatures', label: 'Candidatures', icon: ClipboardCheck },
            { id: 'visits', label: 'Visites', icon: Eye },
            { id: 'contracts', label: 'Contrats', icon: FileSignature },
          ],
        },
        {
          title: 'ÉQUIPE',
          items: [
            { id: 'team', label: 'Équipe', icon: Users },
          ],
        },
        {
          title: 'FINANCES',
          items: [
            { id: 'finances', label: 'Finances', icon: BarChart3 },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          ],
        },
        {
          title: 'OUTILS',
          items: [
            { id: 'communication', label: 'Communication', icon: MessageSquare },
            { id: 'disputes', label: 'Litiges', icon: Scale },
            { id: 'marketing', label: 'Marketing', icon: Megaphone },
            { id: 'client-files', label: 'Dossiers clients', icon: FolderOpen },
          ],
        },
        {
          title: 'COMPTE',
          items: [
            { id: 'settings', label: 'Paramètres', icon: Settings },
          ],
        },
      ]
    case 'TIERS_CONFIANCE':
      return [
        {
          items: [
            { id: 'overview', label: 'Tableau de bord', icon: LayoutDashboard },
          ],
        },
        {
          title: 'VALIDATION',
          items: [
            { id: 'all-properties', label: 'Tous les biens', icon: Building2 },
            { id: 'property-verifications', label: 'Vérification biens', icon: Home },
            { id: 'dossier-validations', label: 'Dossiers de validation', icon: FolderOpen },
            { id: 'oneci-verification', label: 'Vérification ONECI', icon: Fingerprint },
          ],
        },
        {
          title: 'UTILISATEURS',
          items: [
            { id: 'users', label: 'Tous les utilisateurs', icon: Users },
          ],
        },
        {
          title: 'CERTIFICATION',
          items: [
            { id: 'certifications', label: 'Certifications', icon: Award },
          ],
        },
        {
          title: 'ÉTAT DES LIEUX',
          items: [
            { id: 'inventory-reports', label: 'Rapports existants', icon: FileText },
          ],
        },
        {
          title: 'MISSIONS',
          items: [
            { id: 'agents', label: 'Agents', icon: Users },
            { id: 'missions', label: 'Missions', icon: MapPin },
          ],
        },
        {
          title: 'FORMATION',
          items: [
            { id: 'documentation', label: 'Centre de documentation', icon: GraduationCap },
          ],
        },
        {
          title: 'SÉCURITÉ',
          items: [
            { id: 'fraud-alerts', label: 'Alertes fraude', icon: ShieldAlert },
          ],
        },
        {
          title: 'SUIVI',
          items: [
            { id: 'messaging', label: 'Messagerie', icon: MessageSquare },
            { id: 'sla-monitoring', label: 'Suivi SLA', icon: Clock },
            { id: 'litiges', label: 'Litiges', icon: Scale },
            { id: 'notifications', label: 'Notifications', icon: Bell },
          ],
        },
        {
          title: 'COMPTE',
          items: [
            { id: 'settings', label: 'Paramètres', icon: Settings },
          ],
        },
      ]
    case 'ADMIN':
      return [
        {
          items: [
            { id: 'overview', label: 'Tableau de bord', icon: LayoutDashboard },
          ],
        },
        {
          title: 'GESTION',
          items: [
            { id: 'users', label: 'Utilisateurs', icon: Users },
            { id: 'moderation', label: 'Modération contenu', icon: ClipboardCheck },
            { id: 'trust-agents', label: 'Tiers de Confiance', icon: Shield },
          ],
        },
        {
          title: 'SUPERVISION',
          items: [
            { id: 'signalements', label: 'Signalements', icon: Flag },
            { id: 'disputes', label: 'Litiges', icon: AlertTriangle },
            { id: 'notifications', label: 'Notifications', icon: Bell },
          ],
        },
        {
          title: 'SYSTÈME',
          items: [
            { id: 'system', label: 'Système', icon: Activity },
            { id: 'security', label: 'Sécurité', icon: Lock },
            { id: 'reports', label: 'Rapports', icon: BarChart3 },
          ],
        },
        {
          title: 'CONFIGURATION',
          items: [
            { id: 'config', label: 'Configuration', icon: Settings },
            { id: 'backups', label: 'Sauvegardes', icon: Database },
          ],
        },
      ]
    default:
      return []
  }
}

// ─── Reusable sidebar navigation content ────────────────────────────────────
// Used by both the desktop Sidebar and the mobile Sheet menu

interface SidebarContentProps {
  collapsed?: boolean
  onNavigate?: () => void  // called after clicking a nav item (to close mobile Sheet)
}

// Map detail sections to their parent sidebar item
const detailToParent: Record<string, string> = {
  'payment-detail': 'payments',
  'application-detail': 'applications',
  'visit-detail': 'my-visits',
  'lease-detail': 'my-leases',
  'add-property': 'my-properties',
  'tenant-detail': 'my-tenants',
  'property-verify-detail': 'property-verifications',
  'inventory-report-form': 'inventory-reports',
}

export function SidebarContent({ collapsed = false, onNavigate }: SidebarContentProps) {
  const { user, dashboardSection, setDashboardSection, setView } = useAuthStore()
  const { unpaidCount } = usePaymentAlerts()

  if (!user) return null

  // Use activeRole for sidebar navigation (allows role switching)
  const effectiveRole = user.activeRole || user.role
  const sections = getSidebarSections(effectiveRole)

  // Determine the active section (map detail views to parent)
  const activeSection = detailToParent[dashboardSection] || dashboardSection

  const handleItemClick = (id: string) => {
    if (id === 'search-properties') {
      setView('nos-biens')
    } else {
      setDashboardSection(id)
    }
    onNavigate?.()
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-16 border-b border-border shrink-0">
        <Image
          src="/favicon-96x96.png"
          alt="Mon Toit"
          width={24}
          height={24}
          className="shrink-0"
        />
        {!collapsed && (
          <span className="text-lg font-bold text-brand-500 truncate">MON TOIT</span>
        )}
      </div>

      {/* Role badge */}
      {!collapsed && (
        <div className="px-4 py-3 border-b border-border shrink-0">
          <span className={cn(
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
            getRoleColor(effectiveRole)
          )}>
            {getRoleLabel(effectiveRole)}
          </span>
        </div>
      )}

      {/* Navigation with sections */}
      <ScrollArea className="flex-1 min-h-0">
        <nav className="py-2 px-2">
          {sections.map((section, sIdx) => (
            <div key={sIdx} className={sIdx > 0 ? 'mt-3' : ''}>
              {/* Section title */}
              {section.title && !collapsed && (
                <p className="px-3 mb-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                  {section.title}
                </p>
              )}
              {/* Section items */}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon
                  const isActive = activeSection === item.id
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => handleItemClick(item.id)}
                        className={cn(
                          'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-brand-50 text-brand-700'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                          collapsed && 'justify-center px-0'
                        )}
                        title={collapsed ? item.label : undefined}
                      >
                        <Icon className={cn('size-5 shrink-0', isActive ? 'text-brand-500' : 'text-muted-foreground')} />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {!collapsed && effectiveRole === 'LOCATAIRE' && item.id === 'my-leases' && unpaidCount > 0 && (
                          <Badge className="ml-auto size-5 p-0 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold min-w-5 h-5 rounded-full">
                            {unpaidCount > 9 ? '9+' : unpaidCount}
                          </Badge>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
      </ScrollArea>
    </div>
  )
}

// ─── Desktop Sidebar ─────────────────────────────────────────────────────────

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col border-r border-border bg-background transition-all duration-300 h-full',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <SidebarContent collapsed={collapsed} />

      {/* Collapse button */}
      <div className="border-t border-border p-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full justify-center"
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </Button>
      </div>
    </aside>
  )
}
