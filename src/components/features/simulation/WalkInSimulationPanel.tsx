import { useState } from 'react'
import { Car, Layers, LogOut, ParkingSquare, Send } from 'lucide-react'
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
  useDeployWalkIns,
  useOccupyBookedBay,
  useWalkInSimulation,
} from '@/hooks/useParkingSimulation'
import { LiveLotModel } from '@/components/features/lots/LiveLotModel'
import { SimulationBayPopup } from './SimulationBayPopup'
import { canSimulateInBay, simulationBayHint } from './simulationBays'
import { formatNumber } from '@/lib/format'
import type { ParkingLotSummaryDTO } from '@/types/parking.dto'
import { WALK_IN_MAX_STAY_HOURS, type SimulatedWalkInDTO } from '@/types/simulation.dto'
import { t, tMaybe, localDateFormat } from '@/i18n'

/** A lot simulated vehicles may enter: open and staffed (the API says so with status and isBookable). */
const isOpen = (lot: ParkingLotSummaryDTO) => (lot.status ?? 'Active') === 'Active' && lot.isBookable !== false

const time = localDateFormat({ hour: '2-digit', minute: '2-digit', second: '2-digit' })

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
}

const DEFAULT_DRAFT: Draft = { count: '20', carPercent: '40', car7Percent: '15', minStayHours: '2', maxStayHours: '4' }

/**
 * The form's numbers, or an error message in plain words. `maxCount` is the bays walk-ins may take; filling the lot
 * ignores the vehicle count (one vehicle per such bay).
 */
function check(draft: Draft, maxCount: number | undefined, fill = false) {
  const count = Number(draft.count)
  const car = Number(draft.carPercent)
  const car7 = Number(draft.car7Percent)
  const min = Number(draft.minStayHours)
  const max = Number(draft.maxStayHours)
  if (maxCount === 0) return { error: 'No free bay is left in this lot.' }
  if (!fill && (!Number.isInteger(count) || count < 1 || (maxCount !== undefined && count > maxCount)))
    return { error: maxCount === undefined ? 'Send at least 1 vehicle.' : `This lot has ${formatNumber(maxCount)} free bays: send between 1 and ${formatNumber(maxCount)} vehicles.` }
  if (![car, car7].every((p) => Number.isInteger(p) && p >= 0 && p <= 100)) return { error: 'Percentages are whole numbers from 0 to 100.' }
  if (car + car7 > 100) return { error: '4-seat and 7-seat cars together cannot be more than 100%.' }
  if (!(min > 0) || !(max >= min) || max > WALK_IN_MAX_STAY_HOURS)
    return { error: `The stay is more than 0 and at most ${WALK_IN_MAX_STAY_HOURS} hours; the shortest is not longer than the longest.` }
  return { value: { count: fill ? (maxCount ?? 0) : count, fillLot: fill, carPercent: car, car7Percent: car7, minStayHours: min, maxStayHours: max } }
}

function NumberField({ id, label, hint, value, onChange }: { id: string; label: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{tMaybe(label)}</Label>
      <Input id={id} inputMode="decimal" className="tabular-nums" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))} />
      <p className="text-xs text-slate-500">{tMaybe(hint)}</p>
    </div>
  )
}

/** One simulated walk-in (read only: they leave by themselves, or all at once with Check out all). */
function WalkInRow({ vehicle }: { vehicle: SimulatedWalkInDTO }) {
  return (
    <TableRow>
      <TableCell className="font-mono">{vehicle.hasPlate ? vehicle.plate : <span className="text-slate-400">{t('No plate')}</span>}</TableCell>
      <TableCell>
        <div>{tMaybe(vehicle.vehicleTypeName) ?? '—'}</div>
        <div className="text-xs text-slate-500">{[vehicle.lotName, vehicle.zoneName].filter(Boolean).join(' • ')}</div>
      </TableCell>
      <TableCell className="tabular-nums">{time.format(Date.parse(vehicle.entryTime))}</TableCell>
      <TableCell className="tabular-nums">{vehicle.plannedExitAt ? time.format(Date.parse(vehicle.plannedExitAt)) : '—'}</TableCell>
      <TableCell>
        <Badge tone={STATUS_TONE[vehicle.status] ?? 'neutral'}>{tMaybe(STATUS_LABEL[vehicle.status]) ?? tMaybe(vehicle.status)}</Badge>
        {vehicle.lostTicket && vehicle.status !== 'LostTicketPending' && <Badge tone="rose" className="ml-1">{t('Lost ticket')}</Badge>}
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
  const fillChecked = check(draft, freeBays, true)
  const set = (key: keyof Draft) => (value: string) => setDraft((d) => ({ ...d, [key]: value }))
  const motorbikePercent = Math.max(0, 100 - (Number(draft.carPercent) || 0) - (Number(draft.car7Percent) || 0))

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Car className="size-4" aria-hidden />{' '}{t('Walk-in traffic')}
            </CardTitle>
            <CardDescription>
              {t('Vehicles with random plates go through the lot\'s real entry lane, stay a random time, then pay cash at the exit lane and leave. Zone counters, the 3D map and the lot\'s revenue move as for real vehicles.')}
            </CardDescription>
          </div>
          <Badge tone={simulating ? 'amber' : 'neutral'}>{simulating ? t('1 hour = 1 pricing block') : t('Real hours')}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="walkin-lot">{t('Parking lot')}</Label>
            <NativeSelect id="walkin-lot" value={chosenLot} onChange={(e) => setLotId(e.target.value)} disabled={lots.isPending}>
              {lotList.map((l) => (
                <option key={l.id} value={l.id}>
                  {tMaybe(l.name)} ({l.code}){isOpen(l) ? '' : ` — ${l.status === 'Maintenance' ? 'maintenance' : 'closed'}`}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <NumberField
              id="walkin-count"
              label={t('Vehicles')}
              hint={
                freeBays === undefined
                  ? t('Loading the free bays…')
                  : t('1 to {v} (bays free for walk-ins{v2})', { v: formatNumber(freeBays), v2: totalBays !== undefined ? ` of ${formatNumber(totalBays)}` : '' })
              }
              value={draft.count}
              onChange={set('count')}
            />
            <NumberField id="walkin-cars" label={t('4-seat cars (%)')} hint="e.g. 40" value={draft.carPercent} onChange={set('carPercent')} />
            <NumberField
              id="walkin-cars7"
              label={t('7-seat cars (%)')}
              hint={t('The rest ({motorbikePercent}%) are motorbikes', { motorbikePercent })}
              value={draft.car7Percent}
              onChange={set('car7Percent')}
            />
            <NumberField id="walkin-min" label={t('Shortest stay (h)')} hint="e.g. 2" value={draft.minStayHours} onChange={set('minStayHours')} />
            <NumberField id="walkin-max" label={t('Longest stay (h)')} hint="e.g. 4" value={draft.maxStayHours} onChange={set('maxStayHours')} />
          </div>
          <p className="text-sm text-slate-600">
            {t('Simulated vehicles only take free bays: never a bay with a vehicle in it (a customer\'s, a seeded or an earlier simulated walk-in), a held bay (yellow on the map) or a bay booked for later.')}
          </p>
          {!simulating && (
            <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              {t('The parking simulation is off, so a 2–4 hour stay lasts 2–4 real hours. Turn it on above to make each hour one pricing block.')}
            </p>
          )}
          {closed && lot && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800" role="status">
              {t('{name} is', { name: lot.name })}{' '}{lot.status === 'Maintenance' ? t('under maintenance (or has no Manager and Staff on duty)') : 'not open'}{t(', so simulated vehicles cannot enter it. Pick an open lot.')}
            </p>
          )}
          {checked.error && <FieldError message={tMaybe(checked.error)} />}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="gold"
              disabled={!numericLot || closed || !checked.value || deploy.isPending}
              onClick={() => numericLot && checked.value && deploy.mutate({ lotId: numericLot, ...checked.value })}
            >
              <Send aria-hidden /> {deploy.isPending ? t('Sending vehicles…') : t('Send vehicles in')}
            </Button>
            <Button
              variant="outline"
              disabled={!numericLot || closed || !fillChecked.value || !freeBays || deploy.isPending}
              title={t('Send one vehicle into every bay a walk-in may take: car bays get 4- or 7-seat cars, motorbike bays motorbikes')}
              onClick={() => numericLot && fillChecked.value && deploy.mutate({ lotId: numericLot, ...fillChecked.value })}
            >
              <Layers aria-hidden />{' '}{t('Fill the lot')}{freeBays ? ` (${formatNumber(freeBays)})` : ''}
            </Button>
            <Button
              variant="outline"
              disabled={!numericLot || closed || occupy.isPending}
              title={t('A walk-in parks in the bay of this lot\'s next confirmed booking; check that booking in at the entry lane to see the exception')}
              onClick={() => numericLot && occupy.mutate(numericLot)}
            >
              <ParkingSquare aria-hidden />{' '}{t('Park a walk-in in a booked bay')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {lot && (
        // Every vehicle in the chosen lot: booked bays, walk-ins (drawn from the zone counters) and simulated traffic
        <LiveLotModel
          lots={[{ id: lot.id, code: lot.code, name: lot.name, layoutTemplate: lot.layoutTemplate }]}
          lotId={lot.id}
          // Any bay can be acted on: a parked vehicle shows its details, a free bay takes one walk-in, a booked bay a mistake
          bayActions={{
            canSelect: canSimulateInBay,
            hint: simulationBayHint,
            render: (bay, id, close) => <SimulationBayPopup key={bay.id} lotId={id} bay={bay} onClose={close} />,
          }}
        />
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t('Simulated vehicles inside')}</CardTitle>
            <CardDescription>
              {overview.data
                ? t('{length} inside • {v} paid and left • {v2} VND collected', { length: inside.length, v: formatNumber(overview.data.completedCount), v2: formatNumber(overview.data.revenue) })
                : t('Loading…')}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={inside.length === 0 || checkOutAll.isPending}
            onClick={() => window.confirm('Every simulated vehicle in this lot pays and leaves now. Continue?') && checkOutAll.mutate(numericLot)}
          >
            <LogOut aria-hidden />{' '}{t('Check out all')}
          </Button>
        </CardHeader>
        <CardContent>
          {overview.isPending ? (
            <Skeleton className="h-40 rounded-lg" />
          ) : overview.isError ? (
            <ErrorState message={tMaybe(getErrorMessage(overview.error, 'Could not load the simulated vehicles.'))} onRetry={() => void overview.refetch()} />
          ) : inside.length === 0 ? (
            <EmptyState icon={Car} title={t('No simulated vehicle inside')} description={t('Send a batch in to fill the lot.')} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('Plate')}</TableHead>
                    <TableHead>{t('Vehicle')}</TableHead>
                    <TableHead>{t('Entered')}</TableHead>
                    <TableHead>{t('Leaves at')}</TableHead>
                    <TableHead>{t('Status')}</TableHead>
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
