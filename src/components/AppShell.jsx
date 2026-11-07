import React, { useState } from 'react'
import {
  BarChart3,
  Building2,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Database,
  LayoutDashboard,
  LogOut,
  Percent,
  Printer,
  Receipt,
  Rocket,
  Tags,
  Ticket,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { loginRouteForRole, logout } from '../auth'
import { getSession } from '../session'
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
      { to: '/tenant/setup', label: 'Setup', icon: Rocket },
      { to: '/tenant/events', label: 'Events', icon: CalendarDays },
      {
        id: 'master',
        to: '/tenant/master',
        label: 'Master',
        icon: Database,
        children: [
          { to: '/tenant/company', label: 'Company', icon: Building2 },
          { to: '/tenant/tax-master', label: 'Tax master', icon: Percent },
          { to: '/tenant/categories', label: 'Categories', icon: Tags },
          { to: '/tenant/prices', label: 'Prices', icon: Wallet },
          { to: '/tenant/ticket-print', label: 'Ticket print', icon: Printer },
          { to: '/tenant/staff', label: 'Staff', icon: Users },
          { to: '/tenant/assignments', label: 'Assignments', icon: UserCheck },
        ],
      },
      {
        id: 'sales-reports',
        to: '/tenant/sales',
        label: 'Sales & Reports',
        icon: Receipt,
        children: [
          { to: '/tenant/sales', label: 'Sales', icon: Receipt },
          { to: '/tenant/reports', label: 'Reports', icon: BarChart3 },
          { to: '/tenant/reports/staff', label: 'Staff report', icon: UserCheck },
          { to: '/tenant/tickets', label: 'Tickets', icon: Ticket },
          { to: '/tenant/audit', label: 'Audit log', icon: ClipboardList },
        ],
      },
    ],
  },
}

const TITLES = {
  '/platform': 'Dashboard',
  '/platform/tenants': 'Tenants',
  '/tenant': 'Dashboard',
  '/tenant/setup': 'Setup',
  '/tenant/events': 'Events',
  '/tenant/categories': 'Categories',
  '/tenant/prices': 'Prices',
  '/tenant/ticket-print': 'Ticket print',
  '/tenant/staff': 'Staff',
  '/tenant/assignments': 'Assignments',
  '/tenant/company': 'Company',
  '/tenant/tax-master': 'Tax master',
  '/tenant/sales': 'Sales',
  '/tenant/tickets': 'Tickets',
  '/tenant/reports': 'Reports',
  '/tenant/reports/staff': 'Staff report',
  '/tenant/audit': 'Audit log',
}

export default function AppShell({ children }) {
  const session = getSession()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [openGroups, setOpenGroups] = useState({})

  const nav = NAVS[session?.role] || NAVS.platform_admin

  async function handleLogout() {
    await logout()
    navigate(loginRouteForRole(session?.role), { replace: true })
  }

  const initial = (session?.username || '?').charAt(0).toUpperCase()
  // The soft green wash is a dashboard-only treatment; every other page sits on the plain canvas.
  const isDashboard = pathname === '/tenant' || pathname === '/platform'

  return (
    <div className="dashboard-density grid min-h-screen grid-cols-1 md:grid-cols-[256px_1fr]">
      <aside className="sticky top-0 z-10 flex h-auto flex-row items-center gap-4 overflow-x-auto border-b border-border bg-card px-4 py-3 md:h-screen md:flex-col md:items-stretch md:gap-0 md:overflow-visible md:border-b-0 md:border-r md:px-5 md:py-8">
        {/* md:self-start is required: the sidebar is a stretched column, and
            without it the logo's auto width is pulled to the full column while
            the height stays fixed, distorting the wordmark. */}
        <img
          src="/assets/tixelise-logo-green.png"
          alt="Tixelise"
          className="h-7 w-auto shrink-0 md:h-8 md:self-start"
        />

        <p className="hidden px-3 text-[10.5px] font-bold tracking-[0.16em] text-primary md:mb-2.5 md:mt-7 md:block">
          {nav.eyebrow}
        </p>

        <nav className="flex flex-row gap-1 md:flex-col">
          {nav.items.map((item) => {
            if (item.children) {
              const childActive = item.children.some((child) => pathname.startsWith(child.to))
              // Nested routes (e.g. /reports/staff) must not also light up their parent.
              const activeChild = item.children
                .filter((child) => pathname === child.to || pathname.startsWith(`${child.to}/`))
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
            const active = item.end ? pathname === item.to : pathname.startsWith(item.to)
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
          <button
            className="ml-auto grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-[#00794e]"
            onClick={handleLogout}
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="h-[17px] w-[17px]" />
          </button>
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
