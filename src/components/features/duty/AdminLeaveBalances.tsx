import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { dutyApi } from '@/api/duty.service'
import { getErrorMessage } from '@/api/apiError'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Label } from '@/components/ui/form-controls'
import { ErrorState, Spinner } from '@/components/ui/states'
import { dutyKeys } from '@/hooks/useDuty'
import { EMPLOYMENT_LABEL } from '@/lib/duty'
import type { LeaveBalanceRow } from '@/types/duty.dto'
import { t, tMaybe } from '@/i18n'

function Row({ row }: { row: LeaveBalanceRow }) {
  const client = useQueryClient()
  const [days, setDays] = useState(String(row.entitledDays))
  const save = useMutation({
    mutationFn: () => dutyApi.setLeaveBalance(row.employeeId, row.year, Number(days), row.revision),
    onSuccess: () => { toast.success(t('Paid leave of {fullName} saved.', { fullName: row.fullName })); void client.invalidateQueries({ queryKey: dutyKeys }) },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  return (
    <tr>
      <td className="px-4 py-2 font-medium text-slate-900">{row.fullName}<span className="block text-xs font-normal text-slate-500">{tMaybe(row.employeeCode)}</span></td>
      <td className="px-4 py-2 text-slate-700">{tMaybe(row.lotName) ?? '—'}</td>
      <td className="px-4 py-2 text-slate-700">{tMaybe(EMPLOYMENT_LABEL[row.employmentType])}</td>
      <td className="px-4 py-2 text-slate-700 tabular-nums">{tMaybe(row.paidDaysUsed)}</td>
      <td className="px-4 py-2">
        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
          <Input type="number" min={row.paidDaysUsed} max={365} className="w-20" aria-label={t('Paid leave days of {fullName}', { fullName: row.fullName })} value={days} onChange={(e) => setDays(e.target.value)} />
          <Button type="submit" size="sm" variant="outline" disabled={save.isPending || Number(days) === row.entitledDays}>{t('Save')}</Button>
        </form>
      </td>
    </tr>
  )
}

/** Admin: paid leave days per year of every Staff member (12 by default). */
export default function AdminLeaveBalances() {
  const [year, setYear] = useState(new Date().getFullYear())
  const rows = useQuery({ queryKey: [...dutyKeys, 'leave-balances', year], queryFn: () => dutyApi.leaveBalances(year) })
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{t('Paid leave allowance')}</h2>
          <p className="text-sm text-slate-600">{t('Days of paid leave each Staff member gets this year. Leave beyond it is unpaid.')}</p>
        </div>
        <Label className="grid gap-1">{t('Year')}<Input type="number" className="w-28" value={year} onChange={(e) => setYear(Number(e.target.value) || year)} /></Label>
      </div>
      {rows.isPending ? <div className="p-6"><Spinner /></div> : rows.isError ? (
        <ErrorState message={tMaybe(getErrorMessage(rows.error))} onRetry={() => rows.refetch()} />
      ) : (
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
              <tr><th className="px-4 py-2">{t('Staff')}</th><th className="px-4 py-2">{t('Lot')}</th><th className="px-4 py-2">{t('Type')}</th><th className="px-4 py-2">{t('Paid days used')}</th><th className="px-4 py-2">{t('Allowance')}</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.data.map((r) => <Row key={`${r.employeeId}-${r.revision}-${r.entitledDays}`} row={r} />)}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
