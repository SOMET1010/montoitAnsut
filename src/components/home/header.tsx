'use client'

import { useState } from 'react'
import {
  Menu,
  LayoutDashboard,
  Heart,
  Eye,
  FileSignature,
  FolderOpen,
  MessageSquare,
  UserCircle,
  LogOut,
  Building2,
  PlusCircle,
  ClipboardCheck,
  Bell,
  Settings,
  Users,
  Shield,
  AlertTriangle,
  BarChart3,
  BadgeCheck,
  Clock,
  Home,
  Search,
  HelpCircle,
  CreditCard,
  Star,
  Wrench,
  History,
  UserCheck,
  ChevronRight,
} from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AnimatedSheet } from '@/components/ui/sheet'
import { useAuthStore, type AppView, type AuthUser } from '@/lib/auth-store'
import { getRoleLabel, getRoleColor as getRoleBadgeStyle } from '@/lib/roles'
import { ThemeToggle } from '@/components/theme-toggle'
import { cn } from '@/lib/utils'
import { usePaymentAlerts } from '@/hooks/use-payment-alerts'

const navLinks: { label: string; view: AppView; icon: React.ElementType }[] = [
  { label: 'ACCUEIL', view: 'home', icon: Home },
  { label: 'NOS BIENS', view: 'nos-biens', icon: Search },
  { label: 'A PROPOS', view: 'a-propos', icon: Building2 },
  { label: 'FAQ', view: 'faq', icon: HelpCircle },
  { label: 'NOUS CONTACTER', view: 'nous-contacter', icon: MessageSquare },
]

// ─── Dropdown menu items per role ────────────────────────────────────────────

interface UserMenuItem {
  id: string
  label: string
  icon: React.ElementType
  section: string
  group?: string
}

function getUserMenuItems(role: AuthUser['role']): UserMenuItem[] {
  switch (role) {
    case 'LOCATAIRE':
      return [
        { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, section: 'overview', group: 'ESPACE' },
        { id: 'favorites', label: 'Mes favoris', icon: Heart, section: 'favorites', group: 'LOCATION' },
        { id: 'applications', label: 'Mes candidatures', icon: UserCheck, section: 'applications', group: 'LOCATION' },
        { id: 'visits', label: 'Mes visites', icon: Eye, section: 'my-visits', group: 'LOCATION' },
        { id: 'leases', label: 'Mes locations', icon: Home, section: 'my-leases', group: 'LOCATION' },
        { id: 'payments', label: 'Mes paiements', icon: CreditCard, section: 'payments', group: 'LOCATION' },
        { id: 'messages', label: 'Messages', icon: MessageSquare, section: 'messages', group: 'MESSAGES' },
        { id: 'notifications', label: 'Notifications', icon: Bell, section: 'notifications', group: 'MESSAGES' },
        { id: 'profile', label: 'Mon profil', icon: UserCircle, section: 'settings', group: 'COMPTE' },
      ]
    case 'PROPRIETAIRE':
      return [
        { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, section: 'overview', group: 'ESPACE' },
        { id: 'properties', label: 'Mes biens', icon: Building2, section: 'my-properties', group: 'MES BIENS' },
        { id: 'add-property', label: 'Ajouter un bien', icon: PlusCircle, section: 'my-properties', group: 'MES BIENS' },
        { id: 'visits', label: 'Demandes de visite', icon: Eye, section: 'visit-requests', group: 'LOCATION' },
        { id: 'rental-files', label: 'Dossiers locatifs', icon: ClipboardCheck, section: 'candidatures', group: 'LOCATION' },
        { id: 'leases', label: 'Mes baux', icon: FileSignature, section: 'my-leases', group: 'LOCATION' },
        { id: 'payments', label: 'Paiements', icon: CreditCard, section: 'payments', group: 'LOCATION' },
        { id: 'messages', label: 'Messages', icon: MessageSquare, section: 'messages', group: 'MESSAGES' },
        { id: 'notifications', label: 'Notifications', icon: Bell, section: 'notifications', group: 'MESSAGES' },
        { id: 'profile', label: 'Mon profil', icon: UserCircle, section: 'settings', group: 'COMPTE' },
      ]
    case 'AGENCE':
      return [
        { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, section: 'overview', group: 'ESPACE' },
        { id: 'properties', label: 'Nos biens', icon: Building2, section: 'portfolio', group: 'NOS BIENS' },
        { id: 'visits', label: 'Demandes de visite', icon: Eye, section: 'visits', group: 'LOCATION' },
        { id: 'rental-files', label: 'Dossiers locatifs', icon: ClipboardCheck, section: 'candidatures', group: 'LOCATION' },
        { id: 'leases', label: 'Nos baux', icon: FileSignature, section: 'contracts', group: 'LOCATION' },
        { id: 'payments', label: 'Paiements', icon: CreditCard, section: 'finances', group: 'LOCATION' },
        { id: 'messages', label: 'Messages', icon: MessageSquare, section: 'communication', group: 'MESSAGES' },
        { id: 'notifications', label: 'Notifications', icon: Bell, section: 'notifications', group: 'MESSAGES' },
        { id: 'profile', label: 'Profil agence', icon: UserCircle, section: 'settings', group: 'COMPTE' },
      ]
    case 'TIERS_CONFIANCE':
      return [
        { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, section: 'overview', group: 'ESPACE' },
        { id: 'dossier-validations', label: 'Dossiers', icon: FolderOpen, section: 'dossier-validations', group: 'VALIDATION' },
        { id: 'sla', label: 'Suivi SLA', icon: Clock, section: 'sla-monitoring', group: 'SUIVI' },
        { id: 'notifications', label: 'Notifications', icon: Bell, section: 'notifications', group: 'SUIVI' },
        { id: 'profile', label: 'Mon profil', icon: UserCircle, section: 'settings', group: 'COMPTE' },
      ]
    case 'ADMIN':
      return [
        { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, section: 'overview', group: 'ESPACE' },
        { id: 'users', label: 'Utilisateurs', icon: Users, section: 'users', group: 'GESTION' },
        { id: 'properties', label: 'Modération biens', icon: Building2, section: 'properties-moderation', group: 'GESTION' },
        { id: 'tc', label: 'Gestion TC', icon: Shield, section: 'tc-management', group: 'GESTION' },
        { id: 'disputes', label: 'Litiges', icon: AlertTriangle, section: 'disputes', group: 'SUPERVISION' },
        { id: 'reports', label: 'Rapports', icon: BarChart3, section: 'reports', group: 'SUPERVISION' },
        { id: 'notifications', label: 'Notifications', icon: Bell, section: 'notifications', group: 'SUPERVISION' },
        { id: 'profile', label: 'Paramètres', icon: Settings, section: 'settings', group: 'COMPTE' },
      ]
    default:
      return []
  }
}

// ─── User Avatar Dropdown (Desktop) ─────────────────────────────────────────

function UserDropdown() {
  const { user, setView, setDashboardSection, logout } = useAuthStore()
  if (!user) return null

  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
  const menuItems = getUserMenuItems(user.activeRole || user.role)

  const handleMenuItem = (item: UserMenuItem) => {
    setDashboardSection(item.section)
    setView('dashboard')
  }

  const handleLogout = async () => {
    await logout()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full" aria-label="Menu utilisateur">
          <Avatar className="h-9 w-9 border-2 border-brand-200 hover:border-brand-400 transition-colors">
            <AvatarFallback className="bg-brand-100 text-brand-700 text-sm font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-0 overflow-hidden">
        {/* Profile header */}
        <div className="px-4 py-3 bg-muted border-b border-border">
          <p className="text-sm font-semibold text-foreground truncate">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {user.email || user.phone}
          </p>
          <Badge
            variant="outline"
            className={cn(
              'mt-2 text-[10px] font-medium px-2 py-0 h-5 border',
              getRoleBadgeStyle(user.activeRole || user.role)
            )}
          >
            {getRoleLabel(user.activeRole || user.role)}
          </Badge>
        </div>

        {/* Menu items */}
        <div className="py-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <DropdownMenuItem
                key={item.id}
                onClick={() => handleMenuItem(item)}
                className="px-3 py-2 cursor-pointer gap-3 text-sm text-foreground focus:bg-brand-50 focus:text-brand-700"
              >
                <Icon className="size-4 text-muted-foreground shrink-0" />
                <span>{item.label}</span>
              </DropdownMenuItem>
            )
          })}
        </div>

        <DropdownMenuSeparator />

        {/* Logout */}
        <div className="py-1">
          <DropdownMenuItem
            onClick={handleLogout}
            className="px-3 py-2 cursor-pointer gap-3 text-sm text-red-600 focus:bg-red-50 focus:text-red-700 dark:focus:bg-red-950/30"
          >
            <LogOut className="size-4 shrink-0" />
            <span>Déconnexion</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── Main Header ─────────────────────────────────────────────────────────────

export function Header() {
  const [open, setOpen] = useState(false)
  const { currentView, setView, isAuthenticated, user, setDashboardSection, logout } = useAuthStore()
  const { unpaidCount } = usePaymentAlerts()

  const handleNavClick = (view: AppView) => {
    setOpen(false)
    setView(view)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleLogin = () => {
    setOpen(false)
    setView('login')
  }

  const handleRegister = () => {
    setOpen(false)
    setView('register')
  }

  // Navigate to a dashboard section from mobile menu
  const handleMobileDashboardItem = (section: string) => {
    setOpen(false)
    setDashboardSection(section)
    setView('dashboard')
  }

  const handleLogout = async () => {
    setOpen(false)
    await logout()
  }

  // Group menu items by their group label for the mobile menu
  const menuItems = user ? getUserMenuItems(user.activeRole || user.role) : []
  const groupedItems: { group: string; items: UserMenuItem[] }[] = []
  for (const item of menuItems) {
    const last = groupedItems[groupedItems.length - 1]
    if (last && last.group === (item.group || '')) {
      last.items.push(item)
    } else {
      groupedItems.push({ group: item.group || '', items: [item] })
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-background border-b border-border shadow-sm safe-area-top">
      <div className="mx-auto max-w-7xl flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
        {/* Logo */}
        <button
          onClick={() => handleNavClick('home')}
          className="flex items-center gap-2 shrink-0"
        >
          <Image
            src="/favicon-96x96.png"
            alt="Mon Toit"
            width={32}
            height={32}
            className="shrink-0"
            priority
          />
          <span className="text-xl font-bold tracking-tight text-brand-500">
            MON TOIT
          </span>
        </button>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = currentView === link.view
            return (
              <button
                key={link.label}
                onClick={() => handleNavClick(link.view)}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? 'text-brand-500 bg-brand-50'
                    : 'text-foreground hover:text-brand-500 hover:bg-brand-50'
                }`}
              >
                {link.label}
              </button>
            )
          })}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden lg:flex items-center gap-3">
          <ThemeToggle />
          {isAuthenticated && user ? (
            <UserDropdown />
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={handleLogin}>
                Se connecter
              </Button>
      <Button size="sm" className="bg-brand-500 hover:bg-brand-600 text-white" onClick={handleRegister}>
        S&apos;inscrire
      </Button>
            </>
          )}
        </div>

        {/* ─── Mobile: Theme toggle + Hamburger ──────────────────────── */}
        <div className="lg:hidden flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="icon" aria-label="Menu" onClick={() => setOpen(true)}>
            <Menu className="size-5" />
          </Button>

          <AnimatedSheet
            open={open}
            onOpenChange={setOpen}
            side="right"
            className="w-80 p-0"
            showCloseButton={false}
          >
            {isAuthenticated && user ? (
              /* ── AUTHENTICATED: profile card + role menu ── */
              <>
                {/* Profile header */}
                <div className="px-5 pt-5 pb-4 bg-gradient-to-br from-brand-50 to-background border-b border-border">
                  <div className="flex items-center gap-2.5 mb-3">
                    <Avatar className="h-11 w-11 border-2 border-brand-300">
                      <AvatarFallback className="bg-brand-500 text-white text-base font-bold">
                        {`${user.firstName[0]}${user.lastName[0]}`.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-bold text-foreground truncate">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email || user.phone}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[11px] font-semibold px-2.5 py-0.5 h-6 border',
                      getRoleBadgeStyle(user.activeRole || user.role)
                    )}
                  >
                    {getRoleLabel(user.activeRole || user.role)}
                  </Badge>
                </div>

                {/* Scrollable menu sections */}
                <ScrollArea className="flex-1">
                  <div className="py-2">
                    {groupedItems.map((group, gIdx) => (
                      <div key={gIdx} className={gIdx > 0 ? 'mt-1' : ''}>
                        {/* Group label */}
                        {group.group && (
                          <p className="px-5 pt-3 pb-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                            {group.group}
                          </p>
                        )}
                        {/* Group items */}
                        <ul className="px-3 space-y-0.5">
                          {group.items.map((item) => {
                            const Icon = item.icon
                            return (
                              <li key={item.id}>
                                <button
                                  onClick={() => handleMobileDashboardItem(item.section)}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-foreground rounded-lg hover:bg-brand-50 hover:text-brand-700 transition-colors text-left group"
                                >
                                  <Icon className="size-[18px] text-muted-foreground group-hover:text-brand-500 shrink-0 transition-colors" />
                                  <span className="flex-1">{item.label}</span>
                                  {(user.activeRole || user.role) === 'LOCATAIRE' && item.id === 'leases' && unpaidCount > 0 && (
                                    <Badge className="size-5 p-0 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold min-w-5 h-5 rounded-full">
                                      {unpaidCount > 9 ? '9+' : unpaidCount}
                                    </Badge>
                                  )}
                                  <ChevronRight className="size-3.5 text-muted-foreground/50 group-hover:text-brand-400 shrink-0 transition-colors" />
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {/* Bottom: public nav + logout */}
                <div className="border-t border-border bg-muted/80">
                  {/* Quick public nav */}
                  <div className="px-3 py-2 flex gap-1">
                    {navLinks.map((link) => {
                      const Icon = link.icon
                      const isActive = currentView === link.view
                      return (
                        <button
                          key={link.label}
                          onClick={() => handleNavClick(link.view)}
                          className={cn(
                            'flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] font-medium transition-colors',
                            isActive
                              ? 'text-brand-600 bg-brand-50'
                              : 'text-muted-foreground hover:text-brand-600 hover:bg-brand-50'
                          )}
                        >
                          <Icon className="size-4" />
                          {link.label}
                        </button>
                      )
                    })}
                  </div>

                  <Separator />

                  {/* Logout */}
                  <div className="px-3 py-2">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left"
                    >
                      <LogOut className="size-[18px] shrink-0" />
                      <span>Déconnexion</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* ── NOT AUTHENTICATED: classic nav + login ── */
              <>
                <div className="px-4 pt-4">
                  <div className="flex items-center gap-2">
                    <Image
                      src="/favicon-96x96.png"
                      alt="Mon Toit"
                      width={24}
                      height={24}
                      className="shrink-0"
                    />
                    <span className="text-brand-500 font-bold text-lg">MON TOIT</span>
                  </div>
                </div>

                <nav className="flex flex-col gap-1 px-4 pt-2">
                  {navLinks.map((link) => {
                    const Icon = link.icon
                    const isActive = currentView === link.view
                    return (
                      <button
                        key={link.label}
                        onClick={() => handleNavClick(link.view)}
                        className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors text-left ${
                          isActive
                            ? 'text-brand-500 bg-brand-50'
                            : 'text-foreground hover:text-brand-500 hover:bg-brand-50'
                        }`}
                      >
                        <Icon className="size-4" />
                        {link.label}
                      </button>
                    )
                  })}
                </nav>

                <div className="px-4 mt-4 pt-4 border-t border-border">
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" className="w-full" onClick={handleLogin}>
                      Se connecter
                    </Button>
                    <Button className="w-full bg-brand-500 hover:bg-brand-600 text-white" onClick={handleRegister}>
                      S&apos;inscrire
                    </Button>
                  </div>
                </div>
              </>
            )}
          </AnimatedSheet>
        </div>
      </div>
    </header>
  )
}
