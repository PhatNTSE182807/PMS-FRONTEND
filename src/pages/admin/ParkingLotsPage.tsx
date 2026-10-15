import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Building2,
  ChevronRight,
  Layers,
  Plus,
  Search,
  Pencil,
  Trash2,
  ArrowLeft,
  MapPin,
  Clock,
  Settings2,
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
import { Input, NativeSelect } from '@/components/ui/form-controls'
import { EmptyState, ErrorState } from '@/components/ui/states'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import {
  LotForm,
  ZoneForm,
  SlotForm,
  OperationForm,
} from '@/components/features/lots/LotForms'
import {
  LOT_STATES,
  SLOT_STATES,
  VEHICLE_TYPES,
  type ManagedLot,
  type ManagedZone,
  type ManagedSlot,
} from '@/types/lot-management.dto'
import { toSearchable } from '@/lib/text'

type Editing =
  | { kind: 'lot'; lot?: ManagedLot }
  | { kind: 'zone'; lot: ManagedLot; zone?: ManagedZone }
  | { kind: 'slot'; lot: ManagedLot; zone: ManagedZone; slot?: ManagedSlot }
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
      (!status || l.status === status) &&
      toSearchable(`${l.code} ${l.name} ${l.address}`).includes(
        toSearchable(search),
      ),
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / 6))
  const currentPage = Math.min(page, pageCount)
  const reload = async () => {
    await lots.refetch()
    toast.success('Demo data saved in this browser')
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
        title={title}
        description={
          selected
            ? 'Lot details, zones and reservable slots.'
            : 'Set up parking lots and assign their managers.'
        }
        actions={
          admin && !selected ? (
            <Button onClick={() => setEditing({ kind: 'lot' })}>
              <Plus />
              Create parking lot
            </Button>
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
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  ['Total lots', lots.data.length],
                  [
                    'Active',
                    lots.data.filter((l) => l.status === 'Active').length,
                  ],
                  [
                    'No manager assigned',
                    lots.data.filter((l) => !l.managerUserId).length,
                  ],
                ].map(([label, value]) => (
                  <Card key={label} className="p-5">
                    <p className="text-sm text-slate-500">{label}</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {value}
                    </p>
                  </Card>
                ))}
              </div>
              <Card className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
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
                  <NativeSelect
                    aria-label="Filter by lot status"
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value)
                      setPage(1)
                    }}
                  >
                    <option value="">All statuses</option>
                    {Object.entries(LOT_STATES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </Card>
              {!filtered.length ? (
                <Card>
                  <EmptyState
                    icon={Building2}
                    title="No matching parking lots"
                    description={
                      admin
                        ? 'Try clearing the filters or create a new lot.'
                        : 'You have no assigned lots or the filters returned nothing. Ask an Admin to check your assignments.'
                    }
                  />
                </Card>
              ) : (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {filtered
                    .slice((currentPage - 1) * 6, currentPage * 6)
                    .map((l) => (
                      <Card
                        key={l.id}
                        className="flex flex-col overflow-hidden"
                      >
                        <div className="flex items-start gap-3 border-b border-slate-100 p-5">
                          <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                            <Building2 className="size-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-slate-400">
                              {l.code}
                            </p>
                            <h2 className="mt-1 font-semibold text-slate-900">
                              {l.name}
                            </h2>
                          </div>
                        </div>
                        <div className="flex-1 space-y-3 p-5 text-sm text-slate-600">
                          <Badge
                            tone={
                              l.status === 'Active'
                                ? 'emerald'
                                : l.status === 'Maintenance'
                                  ? 'amber'
                                  : 'neutral'
                            }
                          >
                            {LOT_STATES[l.status]}
                          </Badge>
                          <p className="flex items-start gap-2">
                            <MapPin className="mt-0.5 size-4 shrink-0" />
                            {l.address}
                          </p>
                          <p className="flex items-center gap-2">
                            <Clock className="size-4" />
                            {l.is24Hours
                              ? 'Open 24 hours'
                              : `${l.openTime} – ${l.closeTime}`}
                          </p>
                          <div className="grid grid-cols-2 rounded-lg bg-slate-50 p-3">
                            <span>
                              Capacity{' '}
                              <strong className="block text-lg text-slate-900">
                                {l.capacity.toLocaleString('en-US')}
                              </strong>
                            </span>
                            <span>
                              Zones{' '}
                              <strong className="block text-lg text-slate-900">
                                {l.zones.length}
                              </strong>
                            </span>
                          </div>
                          <p>
                            Manager:{' '}
                            <strong>
                              {managers.data?.find(
                                (m) => m.id === l.managerUserId,
                              )?.fullName ??
                                (l.managerUserId
                                  ? 'Assigned'
                                  : 'Unassigned')}
                            </strong>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 border-t border-slate-100 p-4">
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                              setLotId(l.id)
                              setZoneId(null)
                            }}
                          >
                            View details
                            <ChevronRight />
                          </Button>
                          {admin && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Edit ${l.name}`}
                                onClick={() =>
                                  setEditing({ kind: 'lot', lot: l })
                                }
                              >
                                <Pencil />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Delete ${l.name}`}
                                disabled={
                                  l.status === 'Active' || l.zones.length > 0
                                }
                                title="Only inactive lots without zones can be deleted"
                                onClick={() =>
                                  setRemoving({
                                    name: l.name,
                                    run: () => service.deleteLot(l.id),
                                  })
                                }
                              >
                                <Trash2 />
                              </Button>
                            </>
                          )}
                        </div>
                      </Card>
                    ))}
                </div>
              )}
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>
                  {filtered.length} lots · Page {currentPage}/{pageCount}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    disabled={currentPage === pageCount}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
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
                            selected.status === 'Active' ? 'emerald' : 'amber'
                          }
                        >
                          {LOT_STATES[selected.status]}
                        </Badge>
                        <p>{selected.address}</p>
                        <p>
                          {selected.is24Hours
                            ? '24 hours'
                            : `${selected.openTime} – ${selected.closeTime}`}{' '}
                          · Capacity {selected.capacity} slots
                        </p>
                        <p>
                          GPS: {selected.latitude ?? '—'},{' '}
                          {selected.longitude ?? '—'}
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
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">
                      Zones · {selected.zones.length}
                    </h2>
                    {canConfigure && (
                      <Button
                        onClick={() =>
                          setEditing({ kind: 'zone', lot: selected })
                        }
                      >
                        <Plus />
                        Add zone
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">
                    Allocated{' '}
                    {selected.zones.reduce((n, z) => n + z.capacity, 0)}/
                    {selected.capacity} slots.{' '}
                    {admin
                      ? 'The assigned Manager configures zones and slots; Admins can review the structure here.'
                      : 'Walk-in vehicles use the zone counter and are not assigned a specific slot.'}
                  </p>
                  {!selected.zones.length ? (
                    <Card>
                      <EmptyState
                        icon={Layers}
                        title="No zones configured yet"
                        description="The assigned Manager will create floors, areas or rows and their reservation limits."
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
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setZoneId(z.id)}
                                  >
                                    Slot
                                  </Button>
                                  {canConfigure && (
                                    <>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        aria-label={`Edit zone ${z.code}`}
                                        onClick={() =>
                                          setEditing({
                                            kind: 'zone',
                                            lot: selected,
                                            zone: z,
                                          })
                                        }
                                      >
                                        <Pencil />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        aria-label={`Delete zone ${z.code}`}
                                        disabled={z.slots.length > 0}
                                        onClick={() =>
                                          setRemoving({
                                            name: z.name,
                                            run: () =>
                                              service.deleteZone(
                                                selected.id,
                                                z.id,
                                              ),
                                          })
                                        }
                                      >
                                        <Trash2 />
                                      </Button>
                                    </>
                                  )}
                                </div>
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
                  <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {zone.slots.length}/{zone.reservationLimit} reservable slots
                        created
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Zone capacity: {zone.capacity} · Walk-in share:{' '}
                        {zone.capacity - zone.reservationLimit} spaces
                      </p>
                    </div>
                    {canConfigure && (
                      <Button
                        disabled={
                          !zone.isActive ||
                          zone.slots.length >= zone.reservationLimit
                        }
                        onClick={() =>
                          setEditing({ kind: 'slot', lot: selected, zone })
                        }
                      >
                        <Plus />
                        Add slot
                      </Button>
                    )}
                  </Card>
                  <p className="text-sm text-slate-500">
                    Available / Maintenance can be configured here. Reserved / Occupied only
                    change through bookings and vehicle check-in/out.
                  </p>
                  {!zone.slots.length ? (
                    <Card>
                      <EmptyState
                        icon={Layers}
                        title="No reservable slots yet"
                        description="Raise the limit in the zone settings if needed, then add slots. Walk-in vehicles do not need individual slots."
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
                            <TableHead>Actions</TableHead>
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
                              <TableCell>
                                {canConfigure && (
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      aria-label={`Edit slot ${s.code}`}
                                      disabled={[
                                        'Occupied',
                                        'Reserved',
                                      ].includes(s.status)}
                                      onClick={() =>
                                        setEditing({
                                          kind: 'slot',
                                          lot: selected,
                                          zone,
                                          slot: s,
                                        })
                                      }
                                    >
                                      <Pencil />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      aria-label={`Delete slot ${s.code}`}
                                      disabled={[
                                        'Occupied',
                                        'Reserved',
                                      ].includes(s.status)}
                                      onClick={() =>
                                        setRemoving({
                                          name: s.code,
                                          run: () =>
                                            service.deleteSlot(
                                              selected.id,
                                              zone.id,
                                              s.id,
                                            ),
                                        })
                                      }
                                    >
                                      <Trash2 />
                                    </Button>
                                  </div>
                                )}
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
          onSaved={reload}
        />
      )}
      {editing?.kind === 'zone' && (
        <ZoneForm
          lot={editing.lot}
          zone={editing.zone}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
      {editing?.kind === 'slot' && (
        <SlotForm
          lot={editing.lot}
          zone={editing.zone}
          slot={editing.slot}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
      {editing?.kind === 'operation' && (
        <OperationForm
          lot={editing.lot}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
      {removing && (
        <ConfirmDialog
          open
          title="Delete this configuration?"
          description={`Delete ${removing.name}? Only do this for data that has never been in operation. Deleted demo data cannot be restored from this screen.`}
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
              await reload()
              setRemoving(null)
            } catch (e) {
              toast.error(getErrorMessage(e))
            } finally {
              setDeleting(false)
            }
          }}
        />
      )}
    </div>
  )
}
