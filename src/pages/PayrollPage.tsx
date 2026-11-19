import { AdminPayroll } from '@/components/features/payroll/AdminPayroll'
import { MyPayslips } from '@/components/features/payroll/MyPayslips'
import { useAuth } from '@/hooks/useAuth'

/** Admin: everyone's payroll and payments. Staff and Managers: their own payslips. */
export default function PayrollPage() {
  const { user } = useAuth()
  return user?.role === 'ADMIN' ? <AdminPayroll /> : <MyPayslips />
}
