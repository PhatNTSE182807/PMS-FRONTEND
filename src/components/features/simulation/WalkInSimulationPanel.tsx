import { useState } from 'react'
import { Car, LogOut, ParkingSquare, Send, TicketX } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldError, Input, Label, NativeSelect } from '@/components/ui/form-controls'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useParkingLots } from '@/hooks/useParking'
import {
  useCheckOutAllWalkIns,
  useCheckOutWalkIn,
  useDeployWalkIns,
  useOccupyBookedBay,
  useSimulateLostTicket,
  useWalkInSimulation,
} from '@/hooks/useParkingSimulation'
import { LiveLotModel } from '@/components/features/lots/LiveLotModel'
import { formatNumber } from '@/lib/format'
import type { ParkingLotSummaryDTO } from '@/types/parking.dto'
import { WALK_IN_MAX_STAY_HOURS, type SimulatedWalkInDTO } from '@/types/simulation.dto'

/** A lot simulated vehicles may enter: open and staffed (the API says so with status and isBookable). */
const isOpen = (lot: ParkingLotSummaryDTO) => (lot.status ?? 'Active') === 'Active' && lot.isBookable !== false

const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

const STATUS_TONE: Record<string, 'emerald' | 'amber' | 'sky' | 'rose' | 'neutral'> = {
  Active: 'emerald',
  PendingEntry: 'sky',
  PendingPayment: 'amber',
  Paid: 'sky',
  LostTicketPending: 'rose',
}

const STATUS_LABEL: Record<string, string> = {
  Active: 'Parked',
  PendingEntry: 'Entering',
  PendingPayment: 'Paying',
  Paid: 'Paid, leaving',
  LostTicketPending: 'Lost ticket: waiting for the Staff',
}

interface Draft {
  count: string
  carPercent: string
  car7Percent: string
  minStayHours: string
  maxStayHours: string
  noPlatePercent: string
}

const DEFAULT_DRAFT: Draft = { count: '20', carPercent: '40', car7Percent: '15', minStayHours: '2', maxStayHours: '4', noPlatePercent: '5' }

/** The form's numbers, or an error message in plain words. `maxCount` is the lot's free bays. */
function check(draft: Draft, maxCount: number | undefined) {
  const count = Number(draft.count)
  const car = Number(draft.carPercent)
  const car7 = Number(draft.car7Percent)
  const noPlate = Number(draft.noPlatePercent)
  const min = Number(draft.minStayHours)
  const max = Number(draft.maxStayHours)
  if (maxCount === 0) return { error: 'No free bay is left in this lot.' }
  if (!Number.isInteger(count) || count < 1 || (maxCount !== undefined && count > maxCount))
    return { error: maxCount === undefined ? 'Send at least 1 vehicle.' : `This lot has ${formatNumber(maxCount)} free bays: send between 1 and ${formatNumber(maxCount)} vehicles.` }
  if (![car, car7, noPlate].every((p) => Number.isInteger(p) && p >= 0 && p <= 100)) return { error: 'Percentages are whole numbers from 0 to 100.' }
  if (car + car7 > 100) return { error: '4-seat and 7-seat cars together cannot be more than 100%.' }
  if (!(min > 0) || !(max >= min) || max > WALK_IN_MAX_STAY_HOURS)
    return { error: `The stay is more than 0 and at most ${WALK_IN_MAX_STAY_HOURS} hours; the shortest is not longer than the longest.` }
  return { value: { count, carPercent: car, car7Percent: car7, noPlatePercent: noPlate, minStayHours: min, maxStayHours: max } }
}

function NumberField({ id, label, hint, value, onChange }: { id: string; label: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} inputMode="decimal" className="tabular-nums" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))} />
      <p className="text-xs text-slate-500">{hint}</p>
    </div>
  )
}

function WalkInRow({ vehicle }: { vehicle: SimulatedWalkInDTO }) {
  const checkOut = useCheckOutWalkIn()
  const lostTicket = useSimulateLostTicket()
  const busy = checkOut.isPending || lostTicket.isPending
  const canAct = vehicle.status === 'Active' || vehicle.status === 'PendingPayment' || vehicle.status === 'Paid'

  return (
    <TableRow>
      <TableCell className="font-mono">{vehicle.hasPlate ? vehicle.plate : <span className="text-slate-400">No plate</span>}</TableCell>
      <TableCell>
        <div>{vehicle.vehicleTypeName ?? '—'}</div>
        <div className="text-xs text-slate-500">{[vehicle.lotName, vehicle.zoneName].filter(Boolean).join(' • ')}</div>
      </TableCell>
      <TableCell className="tabular-nums">{time.format(Date.parse(vehicle.entryTime))}</TableCell>
      <TableCell className="tabular-nums">{vehicle.plannedExitAt ? time.format(Date.parse(vehicle.plannedExitAt)) : '—'}</TableCell>
      <TableCell>
        <Badge tone={STATUS_TONE[vehicle.status] ?? 'neutral'}>{STATUS_LABEL[vehicle.status] ?? vehicle.status}</Badge>
        {vehicle.lostTicket && vehicle.status !== 'LostTicketPending' && <Badge tone="rose" className="ml-1">Lost ticket</Badge>}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1.5">
          <Button
            size="sm"
            variant="outline"
            disabled={busy || vehicle.status !== 'Active' || vehicle.lostTicket}
            title="The driver says the paper ticket is lost: the Staff checks the papers and decides"
            onClick={() => {
              const conditionsMet = window.confirm(
                'Do the photos and papers match (Staff approves on the spot)?\nOK = approve at the lane, Cancel = send to the lot\'s Manager.',
              )
              lostTicket.mutate({ sessionId: vehicle.sessionId, conditionsMet })
            }}
          >
            <TicketX aria-hidden /> Lost ticket
          </Button>
          <Button size="sm" variant="secondary" disabled={busy || !canAct} onClick={() => checkOut.mutate(vehicle.sessionId)}>
            <LogOut aria-hidden /> Check out now
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

/**
 * Admin demo traffic: send walk-ins with random plates through a lot's real entry lane. They stay a random
 * time, then pay cash at the exit lane and leave by themselves, so counters, the 3D map and revenue move.
 */
export function WalkInSimulationPanel({ simulating }: { simulating: boolean }) {
  const lots = useParkingLots()
  const [lotId, setLotId] = useState('')
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT)
  // Open lots first, so the default pick can take vehicles
  const lotList = [...(lots.data ?? [])].sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)) || a.name.localeCompare(b.name))
  const chosenLot = lotId || lotList[0]?.id || ''
  const lot = lotList.find((l) => l.id === chosenLot)
  const closed = lot ? !isOpen(lot) : false
  const numericLot = chosenLot ? Number(chosenLot) : undefined
  const overview = useWalkInSimulation(numericLot)
  const deploy = useDeployWalkIns()
  const checkOutAll = useCheckOutAllWalkIns()
  const occupy = useOccupyBookedBay()

  const inside = overview.data?.inside ?? []
  // The batch is capped by the chosen lot's free bays, not a fixed number
  const freeBays = overview.data?.freeBays ?? undefined
  const totalBays = overview.data?.totalBays ?? undefined
  const checked = check(draft, freeBays)
  const set = (key: keyof Draft) => (value: string) => setDraft((d) => ({ ...d, [key]: value }))
  const motorbikePercent = Math.max(0, 100 - (Number(draft.carPercent) || 0) - (Number(draft.car7Percent) || 0))

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Car className="size-4" aria-hidden /> Walk-in traffic
            </CardTitle>
            <CardDescription>
              Vehicles with random plates go through the lot&apos;s real entry lane, stay a random time, then pay cash at the exit lane
              and leave. Zone counters, the 3D map and the lot&apos;s revenue move as for real vehicles.
            </CardDescription>
          </div>
          <Badge tone={simulating ? 'amber' : 'neutral'}>{simulating ? '1 hour = 1 pricing block' : 'Real hours'}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="walkin-lot">Parking lot</Label>
            <NativeSelect id="walkin-lot" value={chosenLot} onChange={(e) => setLotId(e.target.value)} disabled={lots.isPending}>
              {lotList.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.code}){isOpen(l) ? '' : ` — ${l.status === 'Maintenance' ? 'maintenance' : 'closed'}`}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <NumberField
              id="walkin-count"
              label="Vehicles"
              hint={
                freeBays === undefined
                  ? 'Loading the free bays…'
                  : `1 to ${formatNumber(freeBays)} (free bays${totalBays !== undefined ? ` of ${formatNumber(totalBays)}` : ''})`
              }
              value={draft.count}
              onChange={set('count')}
            />
            <NumberField id="walkin-cars" label="4-seat cars (%)" hint="e.g. 40" value={draft.carPercent} onChange={set('carPercent')} />
            <NumberField
              id="walkin-cars7"
              label="7-seat cars (%)"
              hint={`The rest (${motorbikePercent}%) are motorbikes`}
              value={draft.car7Percent}
              onChange={set('car7Percent')}
            />
            <NumberField id="walkin-min" label="Shortest stay (h)" hint="e.g. 2" value={draft.minStayHours} onChange={set('minStayHours')} />
            <NumberField id="walkin-max" label="Longest stay (h)" hint="e.g. 4" value={draft.maxStayHours} onChange={set('maxStayHours')} />
            <NumberField id="walkin-noplate" label="No readable plate (%)" hint="Paper ticket only" value={draft.noPlatePercent} onChange={set('noPlatePercent')} />
          </div>
          {!simulating && (
            <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              The parking simulation is off, so a 2–4 hour stay lasts 2–4 real hours. Turn it on above to make each hour one pricing block.
            </p>
          )}
          {closed && lot && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800" role="status">
              {lot.name} is {lot.status === 'Maintenance' ? 'under maintenance (or has no Manager and Staff on duty)' : 'not open'}, so
              simulated vehicles cannot enter it. Pick an open lot.
            </p>
          )}
          {checked.error && <FieldError message={checked.error} />}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="gold"
              disabled={!numericLot || closed || !checked.value || deploy.isPending}
              onClick={() => numericLot && checked.value && deploy.mutate({ lotId: numericLot, ...checked.value })}
            >
              <Send aria-hidden /> {deploy.isPending ? 'Sending vehicles…' : 'Send vehicles in'}
            </Button>
            <Button
              variant="outline"
              disabled={!numericLot || closed || occupy.isPending}
              title="A walk-in parks in the bay of this lot's next confirmed booking; check that booking in at the entry lane to see the exception"
              onClick={() => numericLot && occupy.mutate(numericLot)}
            >
              <ParkingSquare aria-hidden /> Park a walk-in in a booked bay
            </Button>
          </div>
        </CardContent>
      </Card>

      {lot && (
        // Every vehicle in the chosen lot: booked bays, walk-ins (drawn from the zone counters) and simulated traffic
        <LiveLotModel lots={[{ id: lot.id, code: lot.code, name: lot.name, layoutTemplate: lot.layoutTemplate }]} lotId={lot.id} />
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Simulated vehicles inside</CardTitle>
            <CardDescription>
              {overview.data
                ? `${inside.length} inside • ${formatNumber(overview.data.completedCount)} paid and left • ${formatNumber(overview.data.revenue)} VND collected`
                : 'Loading…'}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={inside.length === 0 || checkOutAll.isPending}
            onClick={() => window.confirm('Every simulated vehicle in this lot pays and leaves now. Continue?') && checkOutAll.mutate(numericLot)}
          >
            <LogOut aria-hidden /> Check out all
          </Button>
        </CardHeader>
        <CardContent>
          {overview.isPending ? (
            <Skeleton className="h-40 rounded-lg" />
          ) : overview.isError ? (
            <ErrorState message={getErrorMessage(overview.error, 'Could not load the simulated vehicles.')} onRetry={() => void overview.refetch()} />
          ) : inside.length === 0 ? (
            <EmptyState icon={Car} title="No simulated vehicle inside" description="Send a batch in to fill the lot." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plate</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Entered</TableHead>
                    <TableHead>Leaves at</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inside.map((vehicle) => (
                    <WalkInRow key={vehicle.sessionId} vehicle={vehicle} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
