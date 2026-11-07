import { useMemo, useState } from 'react'
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
import { EyebrowTag, PageHeader } from '@/components/layout/PageHeader'
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
import { GaragePreview } from '@/components/customer/garage/GaragePreview'
import { findTemplate, type ZoneStats } from '@/components/customer/garage/garageModel'
import { ADMIN_TOAST, toastAdminError } from '@/lib/adminToasts'
import { toSearchable } from '@/lib/text'
import { formatPhone, initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { LotState } from '@/types/lot-management.dto'

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
  Inactive: { chip: 'bg-slate-100 text-slate-700', icon: 'text-slate-500' },
}

/** Vehicles parked in the lot right now (occupied bays). */
const vehiclesInside = (lot: ManagedLot) =>
  lot.zones.reduce((n, z) => n + z.slots.filter((s) => s.status === 'Occupied').length, 0)

/** Why a lot cannot be deleted yet; null when it can. It must be closed first and every vehicle must have left. */
function deleteBlocker(lot: ManagedLot): string | null {
  if (lot.status !== 'TemporarilyClosed') return 'Set the lot to Temporarily closed before deleting it.'
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

/** Each level of the 3D model mirrors the zones on that floor: their capacity and slot states. */
function layoutStats(lot: ManagedLot, levels: number): ZoneStats[] {
  return Array.from({ length: levels }, (_, i) => {
    const zones = lot.zones.filter((z) => z.floorNo === i + 1)
    const slots = zones.flatMap((z) => z.slots)
    return {
      label: zones.map((z) => z.name).join(' + '),
      total: zones.reduce((n, z) => n + z.capacity, 0),
      occupied: slots.filter((s) => s.status === 'Occupied').length,
      reserved: slots.filter((s) => s.status === 'Reserved').length,
    }
  })
}

function LotLayoutCard({ lot, onEdit }: { lot: ManagedLot; onEdit?: () => void }) {
  const template = findTemplate(lot.layoutTemplate)
  const stats = useMemo(() => (template ? layoutStats(lot, template.floors.length) : []), [lot, template])
  return (
    <Card className="space-y-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Box className="size-5 text-amber-500" aria-hidden />
            3D building layout
          </h2>
          <p className="text-sm text-slate-500">
            {template
              ? `${template.name} · ${template.summary}. Levels follow the zones by floor number.`
              : 'No 3D layout chosen for this lot yet.'}
          </p>
        </div>
        {onEdit && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil />
            {template ? 'Change layout' : 'Choose layout'}
          </Button>
        )}
      </div>
      {template && <GaragePreview key={`${lot.id}:${template.id}`} template={template} floorStats={stats} seed={lot.id} />}
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
  const canConfigure = Boolean(
    selected &&
      user?.role === 'MANAGER' &&
      selected.managerUserId === user.userId,
  )
  const title = zone ? zone.name : selected ? selected.name : 'Parking Lots'
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          selected ? undefined : (
            <>
              <EyebrowTag>Saigon metropolitan grid</EyebrowTag>
              <span aria-hidden>•</span>
              <span>Facility control layer</span>
            </>
          )
        }
        title={selected ? title : admin ? 'Parking Lots & Facilities Management' : 'Facility Zones & Bays'}
        description={
          selected
            ? 'Lot details, zones and reservable slots.'
            : 'Register new facilities from ready-made parking models, update the operating lifecycle and assign facility managers across Ho Chi Minh City.'
        }
        actions={
          !selected ? (
            <>
              <Button variant="outline" onClick={() => exportLots(filtered, managerName)} disabled={!filtered.length}>
                <Download />
                Export fleet metrics
              </Button>
              {admin && (
                <Button variant="gold" size="lg" onClick={() => setEditing({ kind: 'lot' })}>
                  <CirclePlus />
                  Register new facility
                </Button>
              )}
            </>
          ) : undefined
        }
      />
      {lots.isPending ? (
        <Card className="p-8 text-sm text-slate-500" aria-busy="true">
          Loading parking lots…
        </Card>
      ) : lots.isError ? (
        <ErrorState
          message={getErrorMessage(lots.error)}
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
                    aria-label="Search parking lots"
                    placeholder="Search by name, code or address…"
                    className="pl-9"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setPage(1)
                    }}
                  />
                </div>
                <div role="tablist" aria-label="Filter by lifecycle state" className="flex flex-wrap gap-1">
                  {[['', 'All facilities'] as const, ...Object.entries(LOT_STATES)].map(([key, label]) => {
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
                          active ? 'bg-[#124e66] text-indigo-800' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950',
                        )}
                      >
                        {label} ({count})
                      </button>
                    )
                  })}
                </div>
              </Card>

              <Card className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                  <h2 className="flex items-center gap-2.5 font-display text-xl font-semibold text-slate-950">
                    <Layers className="size-5 text-amber-500" aria-hidden />
                    Registered Facilities &amp; Hub Fleet
                    <span className="rounded bg-indigo-100 px-2 py-0.5 font-sans text-xs font-semibold text-indigo-700">
                      {lots.data.length} hubs
                    </span>
                  </h2>
                  <p className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-800">
                    <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-600" />Active</span>
                    <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-500" />Maintenance</span>
                    <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-rose-500" />Closed</span>
                  </p>
                </div>

                {!filtered.length ? (
                  <EmptyState
                    icon={Building2}
                    title="No matching parking lots"
                    description={
                      admin
                        ? 'Try clearing the filters or register a new facility.'
                        : 'You have no assigned lots or the filters returned nothing. Ask an Admin to check your assignments.'
                    }
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        {['Facility & identifier', 'Location', 'Capacity breakdown', 'Assigned manager', 'Lifecycle state', 'Actions'].map((h) => (
                          <TableHead key={h} className={h === 'Actions' ? 'text-right' : undefined}>
                            {h}
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
                                  <p className="font-semibold text-slate-950">{l.name}</p>
                                  <p className="font-mono text-xs font-bold text-indigo-700">#{l.code}</p>
                                  <p className="flex items-center gap-1 text-xs text-slate-600">
                                    <Clock className="size-3 text-amber-500" aria-hidden />
                                    {l.is24Hours ? '24/7 continuous' : `${l.openTime} – ${l.closeTime} daily`}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-56">
                              <p className="flex items-start gap-1.5 text-sm text-slate-800">
                                <MapPin className="mt-0.5 size-3.5 shrink-0 text-slate-500" aria-hidden />
                                {l.address}
                              </p>
                            </TableCell>
                            <TableCell className="min-w-56">
                              <div className="flex items-center justify-between text-sm">
                                <strong className="text-slate-950">{l.capacity.toLocaleString('en-US')} bays total</strong>
                                <span className="font-mono text-xs font-bold text-amber-500">{l.zones.length} zones</span>
                              </div>
                              <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-slate-200" aria-hidden>
                                <span className="bg-indigo-700" style={{ width: `${mix.carShare}%` }} />
                                <span className="bg-amber-500" style={{ width: `${mix.bikeShare}%` }} />
                              </div>
                              <p className="mt-1.5 flex gap-3 text-xs text-slate-700">
                                <span><strong className="text-slate-900">{mix.cars.toLocaleString('en-US')}</strong> Cars</span>
                                <span><strong className="text-slate-900">{mix.bikes.toLocaleString('en-US')}</strong> Motorbikes</span>
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
                                <span className="text-sm text-slate-500">{l.managerUserId ? 'Assigned' : 'Unassigned'}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tracking-wide uppercase', state.chip)}>
                                <span className="size-1.5 rounded-full bg-current" aria-hidden />
                                {LOT_STATES[shownState(l)]}
                              </span>
                              {isUnstaffed(l) && <p className="mt-1 max-w-48 text-xs text-amber-700">{UNSTAFFED_HINT}</p>}
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
                                  Details
                                  <ChevronRight />
                                </Button>
                                {admin && (
                                  <>
                                    <Button variant="ghost" size="icon" aria-label={`Edit ${l.name}`} onClick={() => setEditing({ kind: 'lot', lot: l })}>
                                      <Pencil />
                                    </Button>
                                    {/* A disabled button gets no hover, so the reason sits on the wrapper. */}
                                    <span title={deleteBlocker(l) ?? `Delete ${l.name}`}>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Delete ${l.name}`}
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
                    Displaying <strong className="text-slate-950">{Math.min(filtered.length, PAGE_SIZE)}</strong> of{' '}
                    <strong className="text-slate-950">{filtered.length}</strong> Saigon infrastructure hubs
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                      Previous
                    </Button>
                    <span className="font-mono text-xs">
                      {currentPage} / {pageCount}
                    </span>
                    <Button variant="outline" size="sm" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>
                      Next
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
                  Back
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
                          {LOT_STATES[shownState(selected)]}
                        </Badge>
                        {isUnstaffed(selected) && <p className="text-amber-700">{UNSTAFFED_HINT}</p>}
                        <p>{selected.address}</p>
                        <p>
                          {selected.is24Hours
                            ? '24 hours'
                            : `${selected.openTime} – ${selected.closeTime}`}{' '}
                          · Capacity {selected.capacity} slots
                        </p>
                        {selected.description && <p>{selected.description}</p>}
                        {selected.imageUrl && (
                          <a
                            className="text-indigo-600 underline"
                            href={selected.imageUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View lot photo
                          </a>
                        )}
                        {selected.closureReason && (
                          <p>Reason: {selected.closureReason}</p>
                        )}
                        {selected.closedFrom &&
                          selected.status === 'TemporarilyClosed' && (
                            <p>
                              Closed from {selected.closedFrom.replace('T', ' ')}{' '}
                              to {selected.closedUntil.replace('T', ' ')}
                            </p>
                          )}
                        {selected.maintenanceNotice && (
                          <p>Notice: {selected.maintenanceNotice}</p>
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
                            Edit details
                          </Button>
                        )}
                        {canConfigure && (
                          <Button
                            variant="outline"
                            onClick={() =>
                              setEditing({ kind: 'operation', lot: selected })
                            }
                          >
                            <Settings2 />
                            Lot status
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                  <LotLayoutCard lot={selected} onEdit={admin ? () => setEditing({ kind: 'lot', lot: selected }) : undefined} />
                  <h2 className="text-lg font-semibold text-slate-900">
                    Zones · {selected.zones.length}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {selected.zones.reduce((n, z) => n + z.capacity, 0)} bays across{' '}
                    {selected.zones.length} levels, built from the lot&apos;s model. Zones and bays are not added or
                    removed by hand.
                  </p>
                  {!selected.zones.length ? (
                    <Card>
                      <EmptyState
                        icon={Layers}
                        title="No model applied yet"
                        description={
                          admin
                            ? 'Edit the lot and pick a parking lot model: its levels, zones and bays are created from it.'
                            : 'An Admin picks the parking lot model; its levels, zones and bays are created from it.'
                        }
                      />
                    </Card>
                  ) : (
                    <Card>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Zone code / name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Capacity</TableHead>
                            <TableHead>Reserved / Walk-in</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
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
                                  {z.code} · {z.name}
                                </button>
                              </TableCell>
                              <TableCell>
                                {
                                  {
                                    Floor: 'Floor',
                                    Row: 'Row',
                                    Area: 'Area',
                                  }[z.zoneType]
                                }
                                {z.floorNo !== null ? ` (${z.floorNo})` : ''}
                              </TableCell>
                              <TableCell>{z.capacity}</TableCell>
                              <TableCell>
                                {z.reservationLimit} /{' '}
                                {z.capacity - z.reservationLimit}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  tone={z.isActive ? 'emerald' : 'neutral'}
                                >
                                  {z.isActive ? 'Active' : 'Disabled'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setZoneId(z.id)}
                                >
                                  View bays
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
                      {zone.slots.length} bays · {zone.reservationLimit} reservable
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Zone capacity: {zone.capacity} · Walk-in share:{' '}
                      {zone.capacity - zone.reservationLimit} spaces
                    </p>
                  </Card>
                  <p className="text-sm text-slate-500">
                    Bays come from the lot&apos;s model. Reserved / Occupied change through bookings and
                    vehicle check-in/out.
                  </p>
                  {!zone.slots.length ? (
                    <Card>
                      <EmptyState
                        icon={Layers}
                        title="No bays in this zone"
                        description="Bays are created from the lot's model."
                      />
                    </Card>
                  ) : (
                    <Card>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Slot code</TableHead>
                            <TableHead>Vehicle type</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {zone.slots.map((s) => (
                            <TableRow key={s.id}>
                              <TableCell className="font-medium">
                                {s.code}
                              </TableCell>
                              <TableCell>
                                {VEHICLE_TYPES.find(
                                  (t) => t.id === s.vehicleTypeId,
                                )?.name ?? s.vehicleTypeId}
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
                                  {SLOT_STATES[s.status]}
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
          Could not load the manager list.{' '}
          <button className="underline" onClick={() => managers.refetch()}>
            Retry
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
          title="Delete this configuration?"
          description={`Delete ${removing.name}? Only do this for data that has never been in operation. Deleted data cannot be restored from this screen.`}
          confirmLabel="Delete"
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
