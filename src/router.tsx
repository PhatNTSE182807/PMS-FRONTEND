import { createBrowserRouter } from 'react-router-dom'
import { ClassicLayout } from '@/components/layout/ClassicLayout'
import { HomeRedirect } from '@/components/layout/HomeRedirect'
import { RequireAuth } from '@/components/layout/RequireAuth'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import UserDashboardPage from '@/pages/UserDashboardPage'

export const router = createBrowserRouter([
  {
    element: <ClassicLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
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
  { path: '*', element: <HomeRedirect /> },
])
