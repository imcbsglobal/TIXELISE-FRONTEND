import React from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { homeFor, loginRouteForRole } from './auth'
import { getSession } from './session'
import AppShell from './components/AppShell'
import Login from './pages/Login'
import Placeholder from './pages/Placeholder'
import Dashboard from './pages/platform/Dashboard'
import Tenants from './pages/platform/Tenants'
import TenantDashboard from './pages/tenant/Dashboard'
import Events from './pages/tenant/Events'
import Categories from './pages/tenant/Categories'
import Prices from './pages/tenant/Prices'
import Staff from './pages/tenant/Staff'
import Agents from './pages/tenant/Agents'
import Assignments from './pages/tenant/Assignments'
import Company from './pages/tenant/Company'
import TaxMaster from './pages/tenant/TaxMaster'
import TicketPrint from './pages/tenant/TicketPrint'
import Sales from './pages/tenant/Sales'
import Tickets from './pages/tenant/Tickets'
import ManualTickets from './pages/tenant/ManualTickets'
import Reports from './pages/tenant/Reports'
import StaffReport from './pages/tenant/StaffReport'
import AgentReport from './pages/tenant/AgentReport'
import Audit from './pages/tenant/Audit'
import Developer from './pages/tenant/Developer'

function RequireRole({ role, children }) {
  const session = getSession()
  const location = useLocation()
  if (!session?.access) return <Navigate to={loginRouteForRole(role)} replace state={{ from: location }} />
  if (session.role !== role) return <Navigate to={homeFor(session.role)} replace />
  return children
}

function HomeRedirect() {
  const session = getSession()
  return <Navigate to={session?.access ? homeFor(session.role) : '/login'} replace />
}

function TenantPage({ children }) {
  return (
    <RequireRole role="tenant_admin">
      <AppShell>{children}</AppShell>
    </RequireRole>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/login/suser" element={<Login />} />
      <Route path="/login/superuser" element={<Login />} />

      <Route
        path="/platform"
        element={
          <RequireRole role="platform_admin">
            <AppShell>
              <Dashboard />
            </AppShell>
          </RequireRole>
        }
      />
      <Route
        path="/platform/tenants"
        element={
          <RequireRole role="platform_admin">
            <AppShell>
              <Tenants />
            </AppShell>
          </RequireRole>
        }
      />
      <Route path="/tenant" element={<TenantPage><TenantDashboard /></TenantPage>} />
      <Route path="/tenant/events" element={<TenantPage><Events /></TenantPage>} />
      <Route path="/tenant/categories" element={<TenantPage><Categories /></TenantPage>} />
      <Route path="/tenant/prices" element={<TenantPage><Prices /></TenantPage>} />
      <Route path="/tenant/staff" element={<TenantPage><Staff /></TenantPage>} />
      <Route path="/tenant/agents" element={<TenantPage><Agents /></TenantPage>} />
      <Route path="/tenant/assignments" element={<TenantPage><Assignments /></TenantPage>} />
      <Route path="/tenant/company" element={<TenantPage><Company /></TenantPage>} />
      <Route path="/tenant/tax-master" element={<TenantPage><TaxMaster /></TenantPage>} />
      <Route path="/tenant/ticket-print" element={<TenantPage><TicketPrint /></TenantPage>} />
      <Route path="/tenant/sales" element={<TenantPage><Sales /></TenantPage>} />
      <Route path="/tenant/tickets" element={<TenantPage><Tickets /></TenantPage>} />
      <Route path="/tenant/manual-tickets" element={<TenantPage><ManualTickets /></TenantPage>} />
      <Route path="/tenant/reports" element={<TenantPage><Reports /></TenantPage>} />
      <Route path="/tenant/reports/staff" element={<TenantPage><StaffReport /></TenantPage>} />
      <Route path="/tenant/reports/agents" element={<TenantPage><AgentReport /></TenantPage>} />
      <Route path="/tenant/audit" element={<TenantPage><Audit /></TenantPage>} />
      <Route path="/tenant/developer" element={<TenantPage><Developer /></TenantPage>} />

      <Route
        path="/pos"
        element={
          <RequireRole role="pos_staff">
            <Placeholder title="POS terminal" />
          </RequireRole>
        }
      />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  )
}
