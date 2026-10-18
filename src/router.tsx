import { lazy } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { CustomerShell } from '@/components/customer/CustomerShell'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { ClassicLayout } from '@/components/layout/ClassicLayout'
import { StaffLayout } from '@/components/layout/StaffLayout'
import { HomeRedirect } from '@/components/layout/HomeRedirect'
import { RequireAuth } from '@/components/layout/RequireAuth'
import HomePage from '@/pages/HomePage'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import CustomerDashboardPage from '@/pages/customer/CustomerDashboardPage'
import CustomerProfilePage from '@/pages/customer/CustomerProfilePage'
import RegisterVehiclePage from '@/pages/customer/RegisterVehiclePage'
import CustomerBookingsPage from '@/pages/customer/CustomerBookingsPage'

// Admin pages are code-split: drivers never download the dashboard (or its chart library).
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'))
const ParkingLotsPage = lazy(() => import('@/pages/admin/ParkingLotsPage'))
const StaffAccountsPage = lazy(() => import('@/pages/admin/StaffAccountsPage'))
const CustomerAccountsPage = lazy(() => import('@/pages/admin/CustomerAccountsPage'))
const RevenueReportPage = lazy(() => import('@/pages/admin/RevenueReportPage'))
const ParkingCapacityPage = lazy(() => import('@/pages/admin/ParkingCapacityPage'))
const ManagerConsolePage = lazy(() => import('@/pages/management/ManagerConsolePage'))
const ManagerReservationsPage = lazy(() => import('@/pages/management/ManagerReservationsPage'))
const ManagerApprovalsPage = lazy(() => import('@/pages/management/ManagerApprovalsPage'))
const ManagerPricingPage = lazy(() => import('@/pages/management/ManagerPricingPage'))
const ManagerStaffPage = lazy(() => import('@/pages/management/ManagerStaffPage'))
const StaffGatePage = lazy(() => import('@/pages/staff/StaffGatePage'))
const StaffCheckoutPage = lazy(() => import('@/pages/staff/StaffCheckoutPage'))
const StaffExceptionsPage = lazy(() => import('@/pages/staff/StaffExceptionsPage'))
const StaffCashTallyPage = lazy(() => import('@/pages/staff/StaffCashTallyPage'))

export const router = createBrowserRouter([
  // Public landing page, outside ClassicLayout: it has its own navigation bar.
  { path: '/', element: <HomePage /> },
  {
    element: <ClassicLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  // Signed-in customer area with its own navigation bar.
  {
    path: '/me',
    element: (
      <RequireAuth>
        <CustomerShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <CustomerDashboardPage /> },
      { path: 'profile', element: <CustomerProfilePage /> },
      { path: 'vehicles', element: <RegisterVehiclePage /> },
      { path: 'bookings', element: <CustomerBookingsPage /> },
    ],
  },
  {
    path: '/admin',
    element: (
      <RequireAuth roles={['ADMIN']}>
        <AdminLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard', element: <AdminDashboardPage /> },
      { path: 'staff', element: <StaffAccountsPage /> },
      { path: 'customers', element: <CustomerAccountsPage /> },
      { path: 'lots', element: <ParkingLotsPage /> },
      { path: 'revenue', element: <RevenueReportPage /> },
      { path: 'capacity', element: <ParkingCapacityPage /> },
    ],
  },
  {
    path: '/management',
    element: <RequireAuth roles={['MANAGER']}><AdminLayout /></RequireAuth>,
    children: [
      { index: true, element: <Navigate to="console" replace /> },
      { path: 'console', element: <ManagerConsolePage /> },
      { path: 'reservations', element: <ManagerReservationsPage /> },
      { path: 'approvals', element: <ManagerApprovalsPage /> },
      { path: 'pricing', element: <ManagerPricingPage /> },
      { path: 'staff', element: <ManagerStaffPage /> },
      { path: 'lots', element: <ParkingLotsPage /> },
    ],
  },
  {
    path: '/staff',
    element: <RequireAuth roles={['STAFF']}><StaffLayout /></RequireAuth>,
    children: [
      { index: true, element: <Navigate to="gate" replace /> },
      { path: 'gate', element: <StaffGatePage /> },
      { path: 'checkout', element: <StaffCheckoutPage /> },
      { path: 'exceptions', element: <StaffExceptionsPage /> },
      { path: 'cash-tally', element: <StaffCashTallyPage /> },
    ],
  },
  { path: '*', element: <HomeRedirect /> },
])
