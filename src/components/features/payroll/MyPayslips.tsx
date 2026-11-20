import { useState } from 'react'
import { Sparkles, Wallet } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Checkbox, Input, Label } from '@/components/ui/form-controls'
import { EmptyState, ErrorState, Spinner } from '@/components/ui/states'
import { useMyPayslips, usePayrollSimulation, useSimulatePayday } from '@/hooks/usePayroll'
import { useAuth } from '@/hooks/useAuth'
import { useDutyStatus } from '@/hooks/useDuty'
import { formatDate, formatVnd } from '@/lib/format'
import { monthLabel } from '@/lib/duty'
import type { PaySlip } from '@/types/payroll.dto'
import { PayslipDetail, SlipStatus } from './PayslipDetail'

const MONTHLY = { MANAGER: 10_000_000, STAFF: 5_800_000 } as const
const HOURLY = 30_000

/** Creates a simulated, already received payslip for the signed-in person. */
function SimulateDialog({ backup, onClose }: { backup: boolean; onClose: () => void }) {
  const { user } = useAuth()
  const simulate = useSimulatePayday()
  const [includeBase, setIncludeBase] = useState(!backup)
  const [hours, setHours] = useState(backup ? 8 : 0)
  const base = includeBase && !backup ? (user?.role === 'MANAGER' ? MONTHLY.MANAGER : MONTHLY.STAFF) : 0
  const total = base + Math.round(hours * HOURLY)
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Simulate payday</h2>
          <p className="mt-1 text-sm text-slate-600">Creates a received payslip marked “Simulated”. It is listed for the Admin too and does not replace your real salary.</p>
        </div>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); simulate.mutate({ includeBase: includeBase && !backup, overtimeHours: hours }, { onSuccess: onClose }) }}>
          {!backup && (
            <Label className="flex items-center gap-2"><Checkbox checked={includeBase} onChange={(e) => setIncludeBase(e.target.checked)} />
              Base salary ({formatVnd(user?.role === 'MANAGER' ? MONTHLY.MANAGER : MONTHLY.STAFF)})
            </Label>
          )}
          <Label className="grid gap-1">{backup ? 'Hours worked' : 'Overtime hours'} (× {formatVnd(HOURLY)})
            <Input type="number" min={0} max={200} step={1} value={hours} onChange={(e) => setHours(Math.max(0, Math.trunc(Number(e.target.value))))} />
          </Label>
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-3 ring-1 ring-slate-200">
            <span className="font-semibold text-slate-800">You receive</span>
            <span className="text-lg font-bold text-slate-950 tabular-nums">{formatVnd(total)}</span>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="success" disabled={simulate.isPending || total <= 0 || hours < 0 || hours > 200}>{simulate.isPending && <Spinner />}Receive</Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Staff and Managers: the salary they received, month by month. */
export function MyPayslips() {
  const slips = useMyPayslips()
  const simulation = usePayrollSimulation()
  const [open, setOpen] = useState<PaySlip | null>(null)
  const [simulating, setSimulating] = useState(false)
  const { user } = useAuth()
  const duty = useDutyStatus(user?.role === 'STAFF')
  const backup = duty.data?.employmentType === 'Backup'
  return (
    <div className="space-y-6">
      <PageHeader title="My payslips"
        actions={simulation.data?.enabled
          ? <Button onClick={() => setSimulating(true)}><Sparkles />Simulate payday</Button>
          : <Wallet className="size-9 text-indigo-700" />} />
      <Card className="divide-y divide-slate-100">
        {slips.isPending ? <div className="p-6"><Spinner /></div> : slips.isError ? (
          <ErrorState message={getErrorMessage(slips.error)} onRetry={() => slips.refetch()} />
        ) : slips.data.length === 0 ? (
          <EmptyState icon={Wallet} title="No salary received yet" description="Your salary is paid at the start of each month." />
        ) : slips.data.map((slip) => (
          <button key={slip.id} type="button" onClick={() => setOpen(slip)}
            className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 sm:px-5">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{monthLabel(slip.month)}</p>
              <p className="text-sm text-slate-600">Received {formatDate(slip.paidAt)}</p>
            </div>
            <SlipStatus slip={slip} />
            <span className="text-base font-bold text-slate-950 tabular-nums">{formatVnd(slip.netAmount)}</span>
          </button>
        ))}
      </Card>
      {open && <PayslipDetail slip={open} onClose={() => setOpen(null)} />}
      {simulating && <SimulateDialog backup={backup} onClose={() => setSimulating(false)} />}
    </div>
  )
}
