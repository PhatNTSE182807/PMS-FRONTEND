import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Building2,
  ChevronRight,
  Layers,
  Search,
  Pencil,
  Trash2,
  ArrowLeft,
  MapPin,
  Clock,
  Settings2,
  Download,
  CirclePlus,
} from 'lucide-react'
import { toast } from 'sonner'
import { lotManagementService as service } from '@/api/lot-management.service'
import { getErrorMessage } from '@/api/apiError'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/form-controls'
import { EmptyState, ErrorState } from '@/components/ui/states'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { LotForm, OperationForm } from '@/components/features/lots/LotForms'
import {
  LOT_STATES,
  SLOT_STATES,
  VEHICLE_TYPES,
  type ManagedLot,
} from '@/types/lot-management.dto'
import { LiveLotModel } from '@/components/features/lots/LiveLotModel'
import { findTemplate } from '@/components/customer/garage/garageModel'
import { ADMIN_TOAST, toastAdminError } from '@/lib/adminToasts'
import { toSearchable } from '@/lib/text'
import { formatPhone, initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { LotState } from '@/types/lot-management.dto'
import { t as tr, tMaybe, numberLocale } from '@/i18n'

const PAGE_SIZE = 8

/** Colours of each lifecycle state: the chip and the "P" tile. */
/** An open lot without an active Manager and Staff is shown (and treated) as under maintenance. */
const isUnstaffed = (lot: ManagedLot) => lot.status === 'Active' && lot.isStaffed === false
const shownState = (lot: ManagedLot): LotState => (isUnstaffed(lot) ? 'Maintenance' : lot.status)
const UNSTAFFED_HINT = 'Needs a Manager and at least one Staff member before customers can book it.'

const LIFECYCLE_STYLE: Record<LotState, { chip: string; icon: string }> = {
  Active: { chip: 'bg-emerald-100 text-emerald-700', icon: 'text-indigo-700' },
  Maintenance: { chip: 'bg-amber-100 text-amber-700', icon: 'text-amber-500' },
  TemporarilyClosed: { chip: 'bg-rose-100 text-rose-700', icon: 'text-rose-400' },
  Closed: { chip: 'bg-slate-800 text-white', icon: 'text-slate-700' },
  Inactive: { chip: 'bg-slate-100 text-slate-700', icon: 'text-slate-500' },
}

/** Vehicles parked in the lot right now (occupied bays). */
const vehiclesInside = (lot: ManagedLot) =>
  lot.zones.reduce((n, z) => n + z.slots.filter((s) => s.status === 'Occupied').length, 0)

/** Why a lot cannot be deleted yet; null when it can. It must be closed first and every vehicle must have left. */
function deleteBlocker(lot: ManagedLot): string | null {
  if (lot.status !== 'Closed') return 'Set the lot to Closed before deleting it.'
  const inside = vehiclesInside(lot)
  if (inside > 0) return `${inside} vehicle${inside === 1 ? ' is' : 's are'} still parked in this lot.`
  return null
}

/** Bays per vehicle class, summed over the lot's zones. */
function capacityMix(lot: ManagedLot) {
  const sum = (ids: string[]) =>
    lot.zones.reduce((s, z) => s + ids.reduce((t, id) => t + (z.vehicleCapacities[id] ?? 0), 0), 0)
  const cars = sum(['CAR_4', 'CAR_7'])
  const bikes = sum(['MOTORBIKE'])
  const total = cars + bikes || 1
  return { cars, bikes, carShare: (cars / total) * 100, bikeShare: (bikes / total) * 100 }
}

/** Downloads the visible lots as CSV (opens in Excel). */
function exportLots(rows: ManagedLot[], managerName: (id: string) => string) {
  const quote = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const header = ['Code', 'Name', 'Address', 'Status', 'Capacity', 'Zones', 'Cars', 'Motorbikes', 'Manager']
  const lines = rows.map((l) => {
    const mix = capacityMix(l)
    return [l.code, l.name, l.address, LOT_STATES[shownState(l)], l.capacity, l.zones.length, mix.cars, mix.bikes, managerName(l.managerUserId)]
      .map(quote)
      .join(',')
  })
  // BOM so Excel reads Vietnamese characters as UTF-8.
  const blob = new Blob(['﻿' + [header.join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `parking-facilities-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function LotLayoutCard({ lot, onEdit }: { lot: ManagedLot; onEdit?: () => void }) {
  const template = findTemplate(lot.layoutTemplate)
  return (
    <Card className="space-y-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Box className="size-5 text-amber-500" aria-hidden />
            {tr('3D building layout')}
          </h2>
          <p className="text-sm text-slate-500">
            {template
              ? tr('{name} · {summary}. Levels follow the zones by floor number.', { name: template.name, summary: template.summary })
              : tr('No 3D layout chosen for this lot yet.')}
          </p>
        </div>
        {onEdit && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil />
            {template ? tr('Change layout') : tr('Choose layout')}
          </Button>
        )}
      </div>
      {/* The lot's real bays (same model as the Staff and Manager screens), not counts spread over made-up bays */}
      {template && (
        <LiveLotModel
          key={`${lot.id}:${template.id}`}
          className="p-0 ring-0"
          lots={[{ id: lot.id, code: lot.code, name: lot.name, layoutTemplate: lot.layoutTemplate }]}
          lotId={lot.id}
        />
      )}
    </Card>
  )
}

// Zones and slots come from the lot's ready-made model: they are viewed here, never edited by hand
type Editing =
  | { kind: 'lot'; lot?: ManagedLot }
  | { kind: 'operation'; lot: ManagedLot }
  | null
export default function ParkingLotsPage() {
  const { user } = useAuth()
  const admin = user?.role === 'ADMIN'
  const lots = useQuery({
    queryKey: ['lot-management', user?.userId],
    queryFn: () => service.list(),
  })
  const managers = useQuery({
    queryKey: ['lot-management-managers'],
    queryFn: () => service.managers(),
    enabled: admin,
  })
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [lotId, setLotId] = useState<string | null>(null)
  const [zoneId, setZoneId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [removing, setRemoving] = useState<{
    name: string
    run: () => Promise<void>
  } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const selected = lots.data?.find((l) => l.id === lotId)
  const zone = selected?.zones.find((z) => z.id === zoneId)
  const filtered = (lots.data ?? []).filter(
    (l) =>
      (!status || shownState(l) === status) &&
      toSearchable(`${l.code} ${l.name} ${l.address}`).includes(
        toSearchable(search),
      ),
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const managerName = (id: string) =>
    managers.data?.find((m) => m.id === id)?.fullName ?? (id ? 'Assigned' : 'Unassigned')
  const currentPage = Math.min(page, pageCount)
  // `message` is the popup of a real save; demo data stays in this browser and says so
  const reload = async (message: string) => {
    await lots.refetch()
    toast.success(service.isDemo() ? 'Demo data saved in this browser' : message)
  }
  // The Admin and the lot's own Manager can open, close or put a lot into maintenance.
  const canSetStatus = (lot: ManagedLot) =>
    admin || (user?.role === 'MANAGER' && lot.managerUserId === user.userId)
  const title = zone ? zone.name : selected ? selected.name : 'Parking Lots'
  return (
    <div className="space-y-6">
      <PageHeader
        title={selected ? tMaybe(title) : admin ? tr('Parking Lot Management') : tr('Zones & Bays')}
       
        actions={
          !selected ? (
            <>
              <Button variant="outline" onClick={() => exportLots(filtered, managerName)} disabled={!filtered.length}>
                <Download />
                {tr('Export lots (CSV)')}
              </Button>
              {admin && (
                <Button variant="gold" size="lg" onClick={() => setEditing({ kind: 'lot' })}>
                  <CirclePlus />
                  {tr('Add parking lot')}
                </Button>
              )}
            </>
          ) : undefined
        }
      />
      {lots.isPending ? (
        <Card className="p-8 text-sm text-slate-500" aria-busy="true">
          {tr('Loading parking lots…')}
        </Card>
      ) : lots.isError ? (
        <ErrorState
          message={tMaybe(getErrorMessage(lots.error))}
          onRetry={() => lots.refetch()}
        />
      ) : (
        <>
          {!selected ? (
            <>
              <Card className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
                <div className="relative lg:w-72">
                  <Search className="absolute top-2.5 left-3 size-4 text-slate-400" />
                  <Input
                    aria-label={tr('Search parking lots')}
                    placeholder={tr('Search by name, code or address…')}
                    className="pl-9"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setPage(1)
                    }}
                  />
                </div>
                <div role="tablist" aria-label={tr('Filter by status')} className="flex flex-wrap gap-1">
                  {[['', 'All parking lots'] as const, ...Object.entries(LOT_STATES)].map(([key, label]) => {
                    const count = key ? lots.data.filter((l) => shownState(l) === key).length : lots.data.length
                    const active = status === key
                    return (
                      <button
                        key={key || 'all'}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => {
                          setStatus(key)
                          setPage(1)
                        }}
                        className={cn(
                          'rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
                          active ? 'bg-selected text-indigo-800' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950',
                        )}
                      >
                        {tMaybe(label)} ({count})
                      </button>
                    )
                  })}
                </div>
              </Card>

              <Card className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                  <h2 className="flex items-center gap-2.5 font-display text-xl font-semibold text-slate-950">
                    <Layers className="size-5 text-amber-500" aria-hidden />
                    {tr('Parking lots')}
                    <span className="rounded bg-indigo-100 px-2 py-0.5 font-sans text-xs font-semibold text-indigo-700">
                      {tr('{length} lots', { length: lots.data.length })}
                    </span>
                  </h2>
                  <p className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-800">
                    <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-600" />{tr('Active')}</span>
                    <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-500" />{tr('Maintenance')}</span>
                    <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-rose-500" />{tr('Temporarily closed')}</span>
                    <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-slate-800" />{tr('Closed')}</span>
                  </p>
                </div>

                {!filtered.length ? (
                  <EmptyState
                    icon={Building2}
                    title={tr('No matching parking lots')}
                    description={
                      admin
                        ? tr('Try clearing the filters or add a parking lot.')
                        : tr('You have no assigned lots or the filters returned nothing. Ask an Admin to check your assignments.')
                    }
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        {['Parking lot & code', 'Location', 'Capacity breakdown', 'Assigned manager', 'Status', 'Actions'].map((h) => (
                          <TableHead key={h} className={h === 'Actions' ? 'text-right' : undefined}>
                            {tMaybe(h)}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((l) => {
                        const mix = capacityMix(l)
                        const manager = managers.data?.find((m) => m.id === l.managerUserId)
                        const state = LIFECYCLE_STYLE[shownState(l)]
                        return (
                          <TableRow key={l.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <span className={cn('grid size-11 shrink-0 place-items-center rounded-lg bg-slate-100 font-display text-xl font-bold', state.icon)}>
                                  P
                                </span>
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-950">{tMaybe(l.name)}</p>
                                  <p className="font-mono text-xs font-bold text-indigo-700">#{l.code}</p>
                                  <p className="flex items-center gap-1 text-xs text-slate-600">
                                    <Clock className="size-3 text-amber-500" aria-hidden />
                                    {l.is24Hours ? tr('24/7 continuous') : tr('{openTime} – {closeTime} daily', { openTime: l.openTime, closeTime: l.closeTime })}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-56">
                              <p className="flex items-start gap-1.5 text-sm text-slate-800">
                                <MapPin className="mt-0.5 size-3.5 shrink-0 text-slate-500" aria-hidden />
                                {tMaybe(l.address)}
                              </p>
                            </TableCell>
                            <TableCell className="min-w-56">
                              <div className="flex items-center justify-between text-sm">
                                <strong className="text-slate-950">{tr('{v} bays total', { v: l.capacity.toLocaleString(numberLocale()) })}</strong>
                                <span className="font-mono text-xs font-bold text-amber-500">{tr('{length} zones', { length: l.zones.length })}</span>
                              </div>
                              <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-slate-200" aria-hidden>
                                <span className="bg-indigo-700" style={{ width: `${mix.carShare}%` }} />
                                <span className="bg-amber-500" style={{ width: `${mix.bikeShare}%` }} />
                              </div>
                              <p className="mt-1.5 flex gap-3 text-xs text-slate-700">
                                <span><strong className="text-slate-900">{mix.cars.toLocaleString(numberLocale())}</strong>{' '}{tr('Cars')}</span>
                                <span><strong className="text-slate-900">{mix.bikes.toLocaleString(numberLocale())}</strong>{' '}{tr('Motorbikes')}</span>
                              </p>
                            </TableCell>
                            <TableCell>
                              {manager ? (
                                <div className="flex items-center gap-2.5">
                                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                                    {initials(manager.fullName)}
                                  </span>
                                  <div>
                                    <p className="font-semibold text-slate-950">{manager.fullName}</p>
                                    <p className="font-mono text-xs text-slate-600">{formatPhone(manager.phoneNumber)}</p>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-sm text-slate-500">{l.managerUserId ? tr('Assigned') : tr('Unassigned')}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tracking-wide uppercase', state.chip)}>
                                <span className="size-1.5 rounded-full bg-current" aria-hidden />
                                {tMaybe(LOT_STATES[shownState(l)])}
                              </span>
                              {isUnstaffed(l) && <p className="mt-1 max-w-48 text-xs text-amber-700">{tMaybe(UNSTAFFED_HINT)}</p>}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setLotId(l.id)
                                    setZoneId(null)
                                  }}
                                >
                                  {tr('Details')}
                                  <ChevronRight />
                                </Button>
                                {admin && (
                                  <>
                                    <Button variant="ghost" size="icon" aria-label={tr('Edit {name}', { name: l.name })} onClick={() => setEditing({ kind: 'lot', lot: l })}>
                                      <Pencil />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      aria-label={tr('Change status of {name}', { name: l.name })}
                                      title={tr('Change status: Active, Maintenance or Temporarily closed')}
                                      onClick={() => setEditing({ kind: 'operation', lot: l })}
                                    >
                                      <Settings2 />
                                    </Button>
                                    {/* A disabled button gets no hover, so the reason sits on the wrapper. */}
                                    <span title={deleteBlocker(l) ?? tr('Delete {name}', { name: l.name })}>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={tr('Delete {name}', { name: l.name })}
                                        disabled={deleteBlocker(l) !== null}
                                        onClick={() => setRemoving({ name: l.name, run: () => service.deleteLot(l.id) })}
                                      >
                                        <Trash2 />
                                      </Button>
                                    </span>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-sm text-slate-700">
                  <span>
                    {tr('Displaying')}{' '}<strong className="text-slate-950">{Math.min(filtered.length, PAGE_SIZE)}</strong>{' '}{tr('of')}
                    <strong className="text-slate-950">{filtered.length}</strong>{' '}{tr('parking lots')}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                      {tr('Previous')}
                    </Button>
                    <span className="font-mono text-xs">
                      {tMaybe(currentPage)} / {tMaybe(pageCount)}
                    </span>
                    <Button variant="outline" size="sm" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>
                      {tr('Next')}
                    </Button>
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (zone) setZoneId(null)
                    else setLotId(null)
                  }}
                >
                  <ArrowLeft />
                  {tr('Back')}
                </Button>
                <span className="text-slate-400">/</span>
                <span>{selected.code}</span>
                {zone && (
                  <>
                    <ChevronRight className="size-4" />
                    <span>{zone.code}</span>
                  </>
                )}
              </div>
              {!zone ? (
                <>
                  <Card className="p-5">
                    <div className="flex flex-wrap justify-between gap-4">
                      <div className="space-y-2 text-sm text-slate-600">
                        <Badge
                          tone={
                            shownState(selected) === 'Active' ? 'emerald' : 'amber'
                          }
                        >
                          {tMaybe(LOT_STATES[shownState(selected)])}
                        </Badge>
                        {isUnstaffed(selected) && <p className="text-amber-700">{tMaybe(UNSTAFFED_HINT)}</p>}
                        <p>{tMaybe(selected.address)}</p>
                        <p>
                          {selected.is24Hours
                            ? '24 hours'
                            : `${selected.openTime} – ${selected.closeTime}`}{tr('· Capacity {capacity} slots', { capacity: selected.capacity })}
                        </p>
                        {selected.description && <p>{tMaybe(selected.description)}</p>}
                        {selected.imageUrl && (
                          <a
                            className="text-indigo-600 underline"
                            href={selected.imageUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {tr('View lot photo')}
                          </a>
                        )}
                        {selected.closureReason && (
                          <p>{tr('Reason: {closureReason}', { closureReason: selected.closureReason })}</p>
                        )}
                        {selected.closedFrom &&
                          selected.status === 'TemporarilyClosed' && (
                            <p>
                              {tr('Closed from')}{' '}{selected.closedFrom.replace('T', ' ')}{tr('to')}{' '}{selected.closedUntil.replace('T', ' ')}
                            </p>
                          )}
                        {selected.maintenanceNotice && (
                          <p>{tr('Notice: {maintenanceNotice}', { maintenanceNotice: selected.maintenanceNotice })}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {admin && (
                          <Button
                            variant="outline"
                            onClick={() =>
                              setEditing({ kind: 'lot', lot: selected })
                            }
                          >
                            <Pencil />
                            {tr('Edit details')}
                          </Button>
                        )}
                        {selected && canSetStatus(selected) && (
                          <Button
                            variant="outline"
                            onClick={() =>
                              setEditing({ kind: 'operation', lot: selected })
                            }
                          >
                            <Settings2 />
                            {tr('Lot status')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                  <LotLayoutCard lot={selected} onEdit={admin ? () => setEditing({ kind: 'lot', lot: selected }) : undefined} />
                  <h2 className="text-lg font-semibold text-slate-900">
                    {tr('Zones · {length}', { length: selected.zones.length })}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {selected.zones.reduce((n, z) => n + z.capacity, 0)}{' '}{tr('bays across {length} levels, built from the lot\'s model. Zones and bays are not added or removed by hand.', { length: selected.zones.length })}
                  </p>
                  {!selected.zones.length ? (
                    <Card>
                      <EmptyState
                        icon={Layers}
                        title={tr('No model applied yet')}
                        description={
                          admin
                            ? tr('Edit the lot and pick a parking lot model: its levels, zones and bays are created from it.')
                            : tr('An Admin picks the parking lot model; its levels, zones and bays are created from it.')
                        }
                      />
                    </Card>
                  ) : (
                    <Card>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{tr('Zone code / name')}</TableHead>
                            <TableHead>{tr('Type')}</TableHead>
                            <TableHead>{tr('Capacity')}</TableHead>
                            <TableHead>{tr('Reserved / Walk-in')}</TableHead>
                            <TableHead>{tr('Status')}</TableHead>
                            <TableHead>{tr('Actions')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selected.zones.map((z) => (
                            <TableRow key={z.id}>
                              <TableCell>
                                <button
                                  className="text-left font-medium text-indigo-600 hover:underline"
                                  onClick={() => setZoneId(z.id)}
                                >
                                  {z.code} · {tMaybe(z.name)}
                                </button>
                              </TableCell>
                              <TableCell>
                                {
                                  tMaybe({
                                    Floor: 'Floor',
                                    Row: 'Row',
                                    Area: 'Area',
                                  }[z.zoneType])
                                }
                                {z.floorNo !== null ? ` (${z.floorNo})` : ''}
                              </TableCell>
                              <TableCell>{tMaybe(z.capacity)}</TableCell>
                              <TableCell>
                                {tMaybe(z.reservationLimit)} /{' '}
                                {z.capacity - z.reservationLimit}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  tone={z.isActive ? 'emerald' : 'neutral'}
                                >
                                  {z.isActive ? tr('Active') : tr('Disabled')}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setZoneId(z.id)}
                                >
                                  {tr('View bays')}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Card>
                  )}
                </>
              ) : (
                <>
                  <Card className="p-5">
                    <p className="font-semibold text-slate-900">
                      {tr('{length} bays · {reservationLimit} reservable', { length: zone.slots.length, reservationLimit: zone.reservationLimit })}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {tr('Zone capacity: {capacity} · Walk-in share: {v} spaces', { capacity: zone.capacity, v: zone.capacity - zone.reservationLimit })}
                    </p>
                  </Card>
                  <p className="text-sm text-slate-500">
                    {tr('Bays come from the lot\'s model. Reserved / Occupied change through bookings and vehicle check-in/out.')}
                  </p>
                  {!zone.slots.length ? (
                    <Card>
                      <EmptyState
                        icon={Layers}
                        title={tr('No bays in this zone')}
                        description={tr('Bays are created from the lot\'s model.')}
                      />
                    </Card>
                  ) : (
                    <Card>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{tr('Slot code')}</TableHead>
                            <TableHead>{tr('Vehicle type')}</TableHead>
                            <TableHead>{tr('Status')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {zone.slots.map((s) => (
                            <TableRow key={s.id}>
                              <TableCell className="font-medium">
                                {s.code}
                              </TableCell>
                              <TableCell>
                                {tMaybe(VEHICLE_TYPES.find(
                                  (t) => t.id === s.vehicleTypeId,
                                )?.name) ?? tMaybe(s.vehicleTypeId)}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  tone={
                                    s.status === 'Available'
                                      ? 'emerald'
                                      : s.status === 'Maintenance'
                                        ? 'amber'
                                        : 'indigo'
                                  }
                                >
                                  {tMaybe(SLOT_STATES[s.status])}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Card>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
      {managers.isError && admin && (
        <p role="alert" className="text-sm text-rose-600">
          {tr('Could not load the manager list.')}
          <button className="underline" onClick={() => managers.refetch()}>
            {tr('Retry')}
          </button>
        </p>
      )}
      {editing?.kind === 'lot' && (
        <LotForm
          lot={editing.lot}
          managers={managers.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => reload(ADMIN_TOAST.lotSaved)}
        />
      )}
      {editing?.kind === 'operation' && (
        <OperationForm
          lot={editing.lot}
          onClose={() => setEditing(null)}
          onSaved={() => reload(ADMIN_TOAST.lotSaved)}
        />
      )}
      {removing && (
        <ConfirmDialog
          open
          title={tr('Delete this configuration?')}
          description={tr('Delete {name}? Only do this for data that has never been in operation. Deleted data cannot be restored from this screen.', { name: removing.name })}
          confirmLabel={tr('Delete')}
          tone="destructive"
          pending={deleting}
          onOpenChange={(o) => {
            if (!o && !deleting) setRemoving(null)
          }}
          onConfirm={async () => {
            setDeleting(true)
            try {
              await removing.run()
              // No spec popup for deleting a lot: keeps its own text
              await reload('Changes saved')
              setRemoving(null)
            } catch (e) {
              toastAdminError(e)
            } finally {
              setDeleting(false)
            }
          }}
        />
      )}
    </div>
  )
}
