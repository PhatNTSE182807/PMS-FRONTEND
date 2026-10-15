import { lazy } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { ClassicLayout } from '@/components/layout/ClassicLayout'
import { HomeRedirect } from '@/components/layout/HomeRedirect'
import { RequireAuth } from '@/components/layout/RequireAuth'
import LoginPage from '@/pages/LoginPage'
import OtpLoginPage from '@/pages/OtpLoginPage'
import RegisterPage from '@/pages/RegisterPage'
import UserDashboardPage from '@/pages/UserDashboardPage'

// Admin pages are code-split: drivers never download the dashboard (or its chart library).
const ParkingLotsPage = lazy(() => import('@/pages/admin/ParkingLotsPage'))
const StaffAccountsPage = lazy(() => import('@/pages/admin/StaffAccountsPage'))
const CustomerAccountsPage = lazy(() => import('@/pages/admin/CustomerAccountsPage'))
const RevenueReportPage = lazy(() => import('@/pages/admin/RevenueReportPage'))
const ParkingCapacityPage = lazy(() => import('@/pages/admin/ParkingCapacityPage'))

export const router = createBrowserRouter([
  {
    element: <ClassicLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/login-otp', element: <OtpLoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      {
        path: '/me',
        element: (
          <RequireAuth>
            <UserDashboardPage />
          </RequireAuth>
        ),
      },
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
      { index: true, element: <Navigate to="staff" replace /> },
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
      { index: true, element: <Navigate to="lots" replace /> },
      { path: 'lots', element: <ParkingLotsPage /> },
    ],
  },
  { path: '*', element: <HomeRedirect /> },
])
