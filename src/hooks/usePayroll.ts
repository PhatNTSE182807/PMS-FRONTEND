import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { payrollApi } from '@/api/payroll.service'
import { getErrorMessage } from '@/api/apiError'
import { formatVnd } from '@/lib/format'
import { useAuth } from './useAuth'
import type { PayrollFilter, SimulatePayInput } from '@/types/payroll.dto'

export const payrollKeys = ['payroll'] as const

export function useMyPayslips() {
  const { user } = useAuth()
  return useQuery({ queryKey: [...payrollKeys, user?.userId, 'mine'], queryFn: payrollApi.mine, refetchOnWindowFocus: true })
}

export function usePayrollSimulation() {
  const { user } = useAuth()
  return useQuery({ queryKey: [...payrollKeys, user?.userId, 'simulation'], queryFn: payrollApi.simulation, staleTime: 5 * 60_000 })
}

export function useSimulatePayday() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: SimulatePayInput) => payrollApi.simulate(input),
    onSuccess: (slip) => {
      toast.success(`Simulated salary received: ${formatVnd(slip.netAmount)}`)
      void client.invalidateQueries({ queryKey: payrollKeys })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

/** Admin report of a month; polled so simulated paydays of Staff show up quickly. */
export function usePayrollReport(filter: PayrollFilter) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...payrollKeys, user?.userId, 'report', filter],
    queryFn: () => payrollApi.report(filter),
    refetchInterval: 15_000,
    placeholderData: (previous) => previous,
  })
}

export function usePayAll() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (month: string) => payrollApi.payAll(month),
    onSuccess: (result) => {
      toast.success(`Paid ${result.paidCount} people: ${formatVnd(result.total)}`)
      void client.invalidateQueries({ queryKey: payrollKeys })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function usePayAdjustment() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: payrollApi.adjust,
    onSuccess: () => {
      toast.success('Adjustment added.')
      void client.invalidateQueries({ queryKey: payrollKeys })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}
