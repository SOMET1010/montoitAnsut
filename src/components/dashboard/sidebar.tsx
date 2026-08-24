'use client'

import {
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import Image from 'next/image'
import { useAuthStore } from '@/lib/auth-store'
import { getRoleLabel, getRoleColor } from '@/lib/roles'
import { getSidebarSections, detailToParent } from '@/lib/nav-config'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { usePaymentAlerts } from '@/hooks/use-payment-alerts'

// ─── Reusable sidebar navigation content ────────────────────────────────────
// Used by both the desktop Sidebar and the mobile Sheet menu

interface SidebarContentProps {
  collapsed?: boolean
  onNavigate?: () => void  // called after clicking a nav item (to close mobile Sheet)
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
