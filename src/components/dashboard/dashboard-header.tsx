'use client'

import { Fragment, useState } from 'react'
import { Bell, LogOut, Home, Menu, ArrowLeftRight, Building2, User as UserIcon, Info, ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AnimatedSheet } from '@/components/ui/sheet'
import { useAuthStore } from '@/lib/auth-store'
import { getRoleLabel, getRoleColor } from '@/lib/roles'
import { getBreadcrumbTrail } from '@/lib/nav-config'
import { cn } from '@/lib/utils'
import { SidebarContent } from './sidebar'
import { ThemeToggle, LiveClock } from '@/components/theme-toggle'
import { useNotifications } from '@/hooks/use-notifications'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { toast } from 'sonner'

export function DashboardHeader() {
  const { user, logout, setView, switchRole, setDashboardSection, dashboardSection } = useAuthStore()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [switchingRole, setSwitchingRole] = useState(false)
  const [roleSwitchModalOpen, setRoleSwitchModalOpen] = useState(false)
  const [pendingRole, setPendingRole] = useState<'LOCATAIRE' | 'PROPRIETAIRE' | null>(null)
  const [switchRolePassword, setSwitchRolePassword] = useState('')
  const [switchRoleError, setSwitchRoleError] = useState<string | null>(null)
  const { unreadCount } = useNotifications()

  if (!user) return null

  const effectiveRole = user.activeRole || user.role
  const canSwitchRole = ['LOCATAIRE', 'PROPRIETAIRE'].includes(user.role) || ['LOCATAIRE', 'PROPRIETAIRE'].includes(user.activeRole || user.role)
  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()

  const handleSwitchRole = (newRole: 'LOCATAIRE' | 'PROPRIETAIRE') => {
    setPendingRole(newRole)
    setSwitchRolePassword('')
    setSwitchRoleError(null)
    setRoleSwitchModalOpen(true)
  }

  const handleConfirmSwitchRole = async () => {
    if (!pendingRole || !switchRolePassword) return
    setSwitchRoleError(null)
    setSwitchingRole(true)
    try {
      await switchRole(pendingRole, switchRolePassword)
      toast.success(`Mode ${getRoleLabel(pendingRole)} activé`)
      setRoleSwitchModalOpen(false)
      setPendingRole(null)
      setSwitchRolePassword('')
    } catch (err) {
      setSwitchRoleError(err instanceof Error ? err.message : 'Erreur lors du changement de rôle')
    } finally {
      setSwitchingRole(false)
    }
  }

  const handleLogout = async () => {
    setMobileMenuOpen(false)
    await logout()
    toast.success('Déconnexion réussie')
  }

  return (
    <>
      <header className="h-16 border-b border-border bg-background flex items-center justify-between px-4 sm:px-6 shrink-0">
        {/* Left */}
        <div className="flex items-center gap-3">
          {/* Hamburger — mobile only */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden shrink-0"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu className="size-5 text-muted-foreground" />
          </Button>

          <button
            onClick={() => setView('home')}
            className="flex items-center gap-2 text-muted-foreground hover:text-brand-500 transition-colors"
            title="Retour à l'accueil"
          >
            <Home className="size-5" />
          </button>
          <div className="hidden sm:block min-w-0">
            <Breadcrumb>
              <BreadcrumbList className="flex-nowrap">
                {getBreadcrumbTrail(effectiveRole, dashboardSection).map((crumb, i, arr) => (
                  <Fragment key={i}>
                    {i > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem className="whitespace-nowrap">
                      {i === arr.length - 1 || !crumb.section ? (
                        <BreadcrumbPage className="text-sm font-medium">{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <button type="button" onClick={() => setDashboardSection(crumb.section!)} className="text-sm">
                            {crumb.label}
                          </button>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </div>

        {/* Right - Actions */}
        <div className="flex items-center gap-1 sm:gap-2">
          <LiveClock />
          <ThemeToggle />

          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications" onClick={() => setDashboardSection('notifications')}>
            <Bell className="size-5 text-muted-foreground" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-0.5 -right-0.5 size-4 p-0 flex items-center justify-center bg-brand-500 text-white text-[10px]">
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </Button>

          {/* Role Switch Button */}
          {canSwitchRole && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSwitchRole(effectiveRole === 'LOCATAIRE' ? 'PROPRIETAIRE' : 'LOCATAIRE')}
              disabled={switchingRole}
              className="hidden sm:flex items-center gap-1.5 h-8 px-2.5 text-xs border-brand-200 text-brand-600 hover:bg-brand-50 hover:text-brand-700"
            >
              <ArrowLeftRight className="size-3.5" />
              {switchingRole ? '...' : effectiveRole === 'LOCATAIRE' ? 'Mode Propriétaire' : 'Mode Locataire'}
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-2">
                <Avatar className="size-8">
                  {user.avatarUrl && (
                    <AvatarImage src={user.avatarUrl} alt={`${user.firstName} ${user.lastName}`} />
                  )}
                  <AvatarFallback className="bg-brand-100 text-brand-700 text-sm font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:flex flex-col items-start">
                  <span className="text-sm font-medium text-foreground leading-tight">
                    {user.firstName} {user.lastName}
                  </span>
                  <span className={cn('text-[10px] font-medium leading-tight', getRoleColor(effectiveRole))}>
                    {getRoleLabel(effectiveRole)}
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem className="text-sm text-muted-foreground cursor-default">
                {user.email || user.phone}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* Role switch options */}
              {canSwitchRole && (
                <>
                  {effectiveRole !== 'LOCATAIRE' && (
                    <DropdownMenuItem onClick={() => handleSwitchRole('LOCATAIRE')} disabled={switchingRole} className="cursor-pointer">
                      <UserIcon className="size-4 mr-2" />
                      Passer en mode Locataire
                    </DropdownMenuItem>
                  )}
                  {effectiveRole !== 'PROPRIETAIRE' && (
                    <DropdownMenuItem onClick={() => handleSwitchRole('PROPRIETAIRE')} disabled={switchingRole} className="cursor-pointer">
                      <Building2 className="size-4 mr-2" />
                      Passer en mode Propriétaire
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600 cursor-pointer">
                <LogOut className="size-4 mr-2" />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ─── Mobile Drawer sidebar (framer-motion powered) ──────────── */}
      <AnimatedSheet
        open={mobileMenuOpen}
        onOpenChange={setMobileMenuOpen}
        side="left"
        className="w-72 p-0"
        showCloseButton={false}
      >
        <SidebarContent onNavigate={() => setMobileMenuOpen(false)} />

        {/* Role switch in mobile sidebar */}
        {canSwitchRole && (
          <div className="border-t border-border px-3 py-2 shrink-0">
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase px-3 mb-1.5">Changer de rôle</p>
            <div className="flex gap-1.5">
              <button
                onClick={() => { setMobileMenuOpen(false); handleSwitchRole('LOCATAIRE') }}
                disabled={switchingRole}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors',
                  effectiveRole === 'LOCATAIRE'
                    ? 'bg-amber-100 text-amber-700'
                    : 'text-muted-foreground hover:bg-accent'
                )}
              >
                <UserIcon className="size-3.5" />
                Locataire
              </button>
              <button
                onClick={() => { setMobileMenuOpen(false); handleSwitchRole('PROPRIETAIRE') }}
                disabled={switchingRole}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors',
                  effectiveRole === 'PROPRIETAIRE'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'text-muted-foreground hover:bg-accent'
                )}
              >
                <Building2 className="size-3.5" />
                Propriétaire
              </button>
            </div>
          </div>
        )}

        {/* Bottom logout */}
        <div className="border-t border-border p-3 shrink-0">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left"
          >
            <LogOut className="size-5 shrink-0" />
            <span>Déconnexion</span>
          </button>
        </div>
      </AnimatedSheet>

      {/* Role Switch Confirmation Modal */}
      <Dialog open={roleSwitchModalOpen} onOpenChange={setRoleSwitchModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="size-5 text-brand-500" />
              Confirmer le changement de rôle
            </DialogTitle>
            <DialogDescription>
              Vous allez basculer vers le mode {pendingRole === 'LOCATAIRE' ? 'Locataire' : 'Propriétaire'}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="flex items-center justify-center gap-4 mb-6">
              {/* Current role */}
              <div className="flex flex-col items-center gap-2 px-4 py-3 rounded-xl border-2 min-w-[100px] opacity-50">
                {(() => {
                  const currentRole = user?.activeRole || user?.role
                  if (currentRole === 'LOCATAIRE') {
                    return <UserIcon className="size-8 text-amber-500" />
                  }
                  return <Building2 className="size-8 text-emerald-500" />
                })()}
                <span className="text-xs font-medium text-muted-foreground">
                  {(() => {
                    const currentRole = user?.activeRole || user?.role
                    return currentRole === 'LOCATAIRE' ? 'Locataire' : 'Propriétaire'
                  })()}
                </span>
              </div>
              {/* Arrow */}
              <div className="flex items-center">
                <ArrowRight className="size-6 text-brand-500" />
              </div>
              {/* Target role */}
              <div className={cn(
                'flex flex-col items-center gap-2 px-4 py-3 rounded-xl border-2 min-w-[100px]',
                pendingRole === 'LOCATAIRE'
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-emerald-300 bg-emerald-50'
              )}>
                {pendingRole === 'LOCATAIRE' ? (
                  <UserIcon className="size-8 text-amber-500" />
                ) : (
                  <Building2 className="size-8 text-emerald-500" />
                )}
                <span className={cn(
                  'text-xs font-semibold',
                  pendingRole === 'LOCATAIRE' ? 'text-amber-700' : 'text-emerald-700'
                )}>
                  {pendingRole === 'LOCATAIRE' ? 'Locataire' : 'Propriétaire'}
                </span>
              </div>
            </div>

            <div className={cn(
              'p-3 rounded-lg border',
              pendingRole === 'LOCATAIRE'
                ? 'bg-amber-50 border-amber-200'
                : 'bg-emerald-50 border-emerald-200'
            )}>
              <div className="flex items-start gap-2">
                <Info className={cn(
                  'size-4 shrink-0 mt-0.5',
                  pendingRole === 'LOCATAIRE' ? 'text-amber-500' : 'text-emerald-500'
                )} />
                <div>
                  <p className={cn(
                    'text-xs font-medium',
                    pendingRole === 'LOCATAIRE' ? 'text-amber-700' : 'text-emerald-700'
                  )}>
                    {pendingRole === 'LOCATAIRE'
                      ? 'En mode Locataire, vous pourrez :'
                      : 'En mode Propriétaire, vous pourrez :'}
                  </p>
                  <ul className={cn(
                    'text-[11px] mt-1 space-y-0.5 list-disc list-inside',
                    pendingRole === 'LOCATAIRE' ? 'text-amber-600' : 'text-emerald-600'
                  )}>
                    {pendingRole === 'LOCATAIRE' ? (
                      <>
                        <li>Chercher et sauvegarder des biens</li>
                        <li>Soumettre des candidatures de location</li>
                        <li>Planifier des visites</li>
                        <li>Gérer vos paiements et baux</li>
                      </>
                    ) : (
                      <>
                        <li>Publier et gérer vos biens</li>
                        <li>Traiter les demandes de visite</li>
                        <li>Gérer les dossiers locatifs</li>
                        <li>Suivre vos baux et paiements</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground text-center mt-3">
              Vous pouvez revenir à votre rôle actuel à tout moment depuis les paramètres.
            </p>

            <div className="mt-4 space-y-1.5">
              <Label htmlFor="switchRolePassword" className="text-xs font-medium text-foreground">
                Confirmez avec votre mot de passe
              </Label>
              <Input
                id="switchRolePassword"
                type="password"
                value={switchRolePassword}
                onChange={(e) => setSwitchRolePassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmSwitchRole() }}
                placeholder="••••••••"
                className="h-9 text-sm"
                autoFocus
              />
              {switchRoleError && (
                <p className="text-xs text-red-600">{switchRoleError}</p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setRoleSwitchModalOpen(false)
                setPendingRole(null)
              }}
              disabled={switchingRole}
              className="border-border"
            >
              Annuler
            </Button>
            <Button
              onClick={handleConfirmSwitchRole}
              disabled={switchingRole || !switchRolePassword}
              className={cn(
                pendingRole === 'LOCATAIRE'
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white'
              )}
            >
              {switchingRole ? (
                <>
                  <Loader2 className="size-4 mr-1.5 animate-spin" />
                  Changement...
                </>
              ) : (
                <>
                  <ArrowLeftRight className="size-4 mr-1.5" />
                  Confirmer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
