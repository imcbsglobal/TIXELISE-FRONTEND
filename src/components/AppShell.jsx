import React, { useState } from 'react'
import {
  BarChart3,
  Building2,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Code2,
  Database,
  LayoutDashboard,
  LogOut,
  Percent,
  Printer,
  Receipt,
  Settings,
  Tags,
  Ticket,
  TicketPlus,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { loginRouteForRole, logout } from '../auth'
import { getSession } from '../session'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const NAVS = {
  platform_admin: {
    eyebrow: 'PLATFORM',
    roleLabel: 'Platform admin',
    items: [
      { to: '/platform', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/platform/tenants', label: 'Tenants', icon: Building2 },
    ],
  },
  tenant_admin: {
    eyebrow: 'TENANT',
    roleLabel: 'Tenant admin',
    items: [
      { to: '/tenant', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/tenant/events?view=grid', label: 'Events', icon: CalendarDays },
      {
        id: 'configuration',
        to: '/tenant/categories',
        label: 'Entries',
        icon: Settings,
        children: [
          { to: '/tenant/events', label: 'Event', icon: CalendarDays },
          { to: '/tenant/categories', label: 'Ticket types', icon: Tags },
          { to: '/tenant/prices', label: 'Prices', icon: Wallet },
          { to: '/tenant/assignments', label: 'Assignments', icon: UserCheck },
        ],
      },
      {
        id: 'sales-reports',
        to: '/tenant/sales',
        label: 'Reports',
        icon: Receipt,
        children: [
          { to: '/tenant/reports', label: 'Overview', icon: BarChart3 },
          { to: '/tenant/reports/staff', label: 'Staff report', icon: UserCheck },
          { to: '/tenant/sales', label: 'Sales', icon: Receipt },
          { to: '/tenant/tickets', label: 'Tickets', icon: Ticket },
          { to: '/tenant/audit', label: 'Audit log', icon: ClipboardList },
        ],
      },
      {
        id: 'master',
        to: '/tenant/master',
        label: 'Master',
        icon: Database,
        children: [
          { to: '/tenant/tax-master', label: 'Tax master', icon: Percent },
          { to: '/tenant/ticket-print', label: 'Ticket print', icon: Printer },
          { to: '/tenant/manual-tickets', label: 'Manual ticket', icon: TicketPlus },
        ],
      },
    ],
  },
}

const TITLES = {
  '/platform': 'Dashboard',
  '/platform/tenants': 'Tenants',
  '/tenant': 'Dashboard',
  '/tenant/events': 'Events',
  '/tenant/categories': 'Categories',
  '/tenant/prices': 'Prices',
  '/tenant/ticket-print': 'Ticket print',
  '/tenant/staff': 'User management',
  '/tenant/assignments': 'Assignments',
  '/tenant/company': 'Company',
  '/tenant/tax-master': 'Tax master',
  '/tenant/sales': 'Sales',
  '/tenant/tickets': 'Tickets',
  '/tenant/manual-tickets': 'Manual ticket',
  '/tenant/reports': 'Overview',
  '/tenant/reports/staff': 'Staff report',
  '/tenant/audit': 'Audit log',
}

export default function AppShell({ children }) {
  const session = getSession()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const [openGroups, setOpenGroups] = useState({})

  // Match both the path and any query the target declares. This lets the main
  // Events link (?view=grid) and the Entries > Event link (/tenant/events)
  // point at the same page without both being highlighted at once.
  function targetMatches(to, end = false) {
    const [path, query] = to.split('?')
    const targetSearch = query ? `?${query}` : ''
    if (targetSearch !== search) return false
    return end ? pathname === path : pathname === path || pathname.startsWith(`${path}/`)
  }

  const nav = NAVS[session?.role] || NAVS.platform_admin

  async function handleLogout() {
    await logout()
    navigate(loginRouteForRole(session?.role), { replace: true })
  }

  const isTenant = session?.role === 'tenant_admin'

  const initial = (session?.username || '?').charAt(0).toUpperCase()
  // The soft green wash is a dashboard-only treatment; every other page sits on the plain canvas.
  const isDashboard = pathname === '/tenant' || pathname === '/platform'

  return (
    <div className="dashboard-density grid min-h-screen grid-cols-1 md:grid-cols-[256px_1fr]">
      <aside className="sticky top-0 z-10 flex h-auto flex-row items-center gap-4 overflow-x-auto border-b border-border bg-card px-4 py-3 md:h-screen md:flex-col md:items-stretch md:gap-0 md:overflow-visible md:border-b-0 md:border-r md:px-5 md:py-8">
        {/* md:self-start is required: the sidebar is a stretched column, and
            without it the logo's auto width is pulled to the full column while
            the height stays fixed, distorting the wordmark. */}
        <DropdownMenu>
          <div className="flex shrink-0 items-center gap-1.5 md:self-start">
            <img
              src="/assets/tixelise-logo-green.png"
              alt="Tixelise"
              className="h-7 w-auto md:h-8"
            />
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Open account menu"
                title="Account menu"
                className="group grid h-7 w-7 shrink-0 place-items-center rounded-[8px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none data-[state=open]:bg-muted data-[state=open]:text-foreground"
              >
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
              </button>
            </DropdownMenuTrigger>
          </div>

          <DropdownMenuContent align="start" className="w-60">
            {isTenant ? (
              <>
                <DropdownMenuItem onSelect={() => navigate('/tenant/staff')}>
                  <Users className="h-4 w-4 shrink-0 text-muted-foreground" /> User management
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate('/tenant/company')}>
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" /> Company setup
                </DropdownMenuItem>
                {/* Tenant-only, and deliberately last: emptying an organization's
                    history is a development tool, not day-to-day work. */}
                <DropdownMenuItem onSelect={() => navigate('/tenant/developer')}>
                  <Code2 className="h-4 w-4 shrink-0 text-muted-foreground" /> Developer option
                </DropdownMenuItem>
              </>
            ) : null}
            <DropdownMenuItem onSelect={() => handleLogout()}>
              <LogOut className="h-4 w-4 shrink-0 text-muted-foreground" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <p className="hidden px-3 text-[10.5px] font-bold tracking-[0.16em] text-primary md:mb-2.5 md:mt-7 md:block">
          {nav.eyebrow}
        </p>

        <nav className="flex flex-row gap-1 md:flex-col">
          {nav.items.map((item) => {
            if (item.children) {
              const childActive = item.children.some((child) => targetMatches(child.to))
              // Nested routes (e.g. /reports/staff) must not also light up their parent.
              const activeChild = item.children
                .filter((child) => targetMatches(child.to))
                .sort((a, b) => b.to.length - a.to.length)[0]
              const open = openGroups[item.id] ?? childActive
              return (
                <div key={item.id || item.to} className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => setOpenGroups((current) => ({ ...current, [item.id]: !open }))}
                    aria-expanded={open}
                    className={cn(
                      'flex items-center gap-3 whitespace-nowrap rounded-[13px] px-3.5 py-3 text-left text-[15px] font-semibold transition-colors',
                      childActive ? 'text-[#00794e]' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0" />
                    {item.label}
                    <ChevronDown
                      className={cn('ml-auto h-4 w-4 shrink-0 transition-transform md:ml-0', open && 'rotate-180')}
                    />
                  </button>

                  {open ? (
                    <div className="flex flex-col gap-0.5 md:ml-[21px] md:mt-1 md:border-l md:border-border md:pl-3.5">
                      {item.children.map((child) => {
                        const active = activeChild?.to === child.to
                        return (
                          <a
                            key={child.to}
                            href={child.to}
                            className={cn(
                              'flex items-center gap-2.5 whitespace-nowrap rounded-[13px] px-3.5 py-2.5 text-[14px] font-semibold transition-colors',
                              active
                                ? 'bg-accent text-[#00794e]'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                            )}
                            onClick={(e) => {
                              e.preventDefault()
                              navigate(child.to)
                            }}
                          >
                            <child.icon className="h-4 w-4 shrink-0" />
                            {child.label}
                          </a>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            }

            const Icon = item.icon
            const active = targetMatches(item.to, item.end)
            return (
              <a
                key={item.to}
                href={item.to}
                className={cn(
                  'flex items-center gap-3 whitespace-nowrap rounded-[13px] px-3.5 py-3 text-[15px] font-semibold transition-colors',
                  active ? 'bg-accent text-[#00794e]' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                onClick={(e) => {
                  e.preventDefault()
                  navigate(item.to)
                }}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {item.label}
              </a>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2.5 md:ml-0 md:mt-auto md:border-t md:border-border md:pt-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#00895a] to-[#05a26c] text-[15px] font-bold text-white">
            {initial}
          </span>
          <span className="hidden flex-col leading-tight md:flex">
            <strong className="max-w-[120px] truncate text-sm text-foreground">{session?.username}</strong>
            <small className="text-xs text-muted-foreground">{nav.roleLabel}</small>
          </span>
        </div>
      </aside>

      <div
        className={cn(
          'dashboard-main flex min-h-screen min-w-0 flex-col bg-background',
          isDashboard && 'bg-gradient-to-b from-[#e3f1e7] via-[#f0f7f2] to-white',
        )}
      >
        <div className="flex-1 p-5 md:p-8">{children}</div>
      </div>
    </div>
  )
}
