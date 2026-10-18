import { useState, type ReactNode } from 'react'
import { lotManagementService as service } from '@/api/lot-management.service'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from '@/components/ui/dialog'
import { Input, NativeSelect, Checkbox } from '@/components/ui/form-controls'
import type {
  LotInput,
  ManagedLot,
  ManagedZone,
  ManagedSlot,
  ZoneInput,
  SlotInput,
} from '@/types/lot-management.dto'
import { LOT_STATES, VEHICLE_TYPES } from '@/types/lot-management.dto'
import type { UserDTO } from '@/types/identity.dto'
import { GaragePreview } from '@/components/customer/garage/GaragePreview'
import { findTemplate, GARAGE_TEMPLATES, templateCapacity } from '@/components/customer/garage/garageModel'
import { cn } from '@/lib/utils'

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      {label}
      {children}
    </label>
  )
}
export function Editor({
  title,
  description,
  children,
  onClose,
  onSave,
  wide = false,
}: {
  title: string
  description: string
  children: ReactNode
  onClose: () => void
  onSave: () => Promise<void>
  wide?: boolean
}) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent className={wide ? 'max-w-4xl' : 'max-w-2xl'}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            setError('')
            setBusy(true)
            try {
              await onSave()
              onClose()
            } catch (e) {
              setError(
                e instanceof Error ? e.message : 'Could not save the data.',
              )
            } finally {
              setBusy(false)
            }
          }}
          className="space-y-5"
        >
          <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
            {children}
          </fieldset>
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700"
            >
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
const emptyLot: LotInput = {
  code: '',
  name: '',
  address: '',
  latitude: null,
  longitude: null,
  is24Hours: true,
  openTime: '07:00',
  closeTime: '22:00',
  capacity: 60,
  layoutTemplate: 'L3S20',
  imageUrl: '',
  description: '',
  managerUserId: '',
  status: 'Inactive',
  closedFrom: '',
  closedUntil: '',
  closureReason: '',
  maintenanceNotice: '',
}
export function LotForm({
  lot,
  managers,
  onClose,
  onSaved,
}: {
  lot?: ManagedLot
  managers: UserDTO[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [v, set] = useState<LotInput>(lot ? { ...lot, layoutTemplate: lot.layoutTemplate ?? '' } : emptyLot)
  const patch = (p: Partial<LotInput>) => set({ ...v, ...p })
  const template = findTemplate(v.layoutTemplate)
  return (
    <Editor
      title={lot ? 'Edit parking lot' : 'Create parking lot'}
      description="Admins set up the lot and assign its Manager. New lots start inactive until their configuration is complete."
      wide
      onClose={onClose}
      onSave={async () => {
        await service.saveLot(v, lot?.id)
        await onSaved()
      }}
    >
      <Field label="Lot code *">
        <Input
          required
          maxLength={30}
          value={v.code}
          onChange={(e) => patch({ code: e.target.value })}
        />
      </Field>
      <Field label="Lot name *">
        <Input
          required
          maxLength={200}
          value={v.name}
          onChange={(e) => patch({ name: e.target.value })}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Address *">
          <Input
            required
            maxLength={500}
            value={v.address}
            onChange={(e) => patch({ address: e.target.value })}
          />
        </Field>
      </div>
      <fieldset className="grid gap-2 sm:col-span-2">
        <legend className="mb-1.5 text-sm font-medium text-slate-700">3D building layout</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {GARAGE_TEMPLATES.map((t) => {
            const active = v.layoutTemplate === t.id
            const mix = templateCapacity(t)
            return (
              <label
                key={t.id}
                className={cn(
                  'flex cursor-pointer flex-col gap-1 rounded-xl border p-3 text-sm transition-colors',
                  active ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-slate-200 hover:bg-slate-50',
                )}
              >
                <span className="flex items-center gap-2 font-semibold text-slate-900">
                  <input
                    type="radio"
                    name="layoutTemplate"
                    className="accent-indigo-600"
                    checked={active}
                    onChange={() => patch({ layoutTemplate: t.id, capacity: mix.total })}
                  />
                  {t.name}
                </span>
                <span className="text-xs text-slate-600">{t.summary}</span>
                <span className="text-xs font-semibold text-slate-700">
                  {mix.car} car + {mix.motorbike} motorbike = {mix.total} bays
                </span>
              </label>
            )
          })}
        </div>
        {template && <GaragePreview key={template.id} template={template} seed="lot-form" className="h-[18rem] sm:h-[22rem]" />}
      </fieldset>
      <Field label="Maximum capacity *">
        <Input
          required
          type="number"
          min={1}
          step={1}
          value={v.capacity}
          onChange={(e) => patch({ capacity: Number(e.target.value) })}
        />
      </Field>
      <Field label="Assigned Manager">
        <NativeSelect
          value={v.managerUserId}
          onChange={(e) => patch({ managerUserId: e.target.value })}
        >
          <option value="">Unassigned</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.fullName}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Latitude">
        <Input
          type="number"
          step="any"
          min={-90}
          max={90}
          value={v.latitude ?? ''}
          onChange={(e) =>
            patch({
              latitude: e.target.value === '' ? null : Number(e.target.value),
            })
          }
        />
      </Field>
      <Field label="Longitude">
        <Input
          type="number"
          step="any"
          min={-180}
          max={180}
          value={v.longitude ?? ''}
          onChange={(e) =>
            patch({
              longitude: e.target.value === '' ? null : Number(e.target.value),
            })
          }
        />
      </Field>
      <label className="flex items-center gap-2 sm:col-span-2">
        <Checkbox
          checked={v.is24Hours}
          onChange={(e) => patch({ is24Hours: e.target.checked })}
        />
        Open 24 hours
      </label>
      {!v.is24Hours && (
        <>
          <Field label="Opening time">
            <Input
              type="time"
              required
              value={v.openTime}
              onChange={(e) => patch({ openTime: e.target.value })}
            />
          </Field>
          <Field label="Closing time">
            <Input
              type="time"
              required
              value={v.closeTime}
              onChange={(e) => patch({ closeTime: e.target.value })}
            />
          </Field>
          <p className="text-xs text-slate-500 sm:col-span-2">
            A closing time before the opening time means the lot is open overnight.
          </p>
        </>
      )}
      <div className="sm:col-span-2">
        <Field label="Image URL">
          <Input
            type="url"
            maxLength={500}
            value={v.imageUrl}
            onChange={(e) => patch({ imageUrl: e.target.value })}
          />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Description">
          <Input
            maxLength={1000}
            value={v.description}
            onChange={(e) => patch({ description: e.target.value })}
          />
        </Field>
      </div>
    </Editor>
  )
}
export function ZoneForm({
  lot,
  zone,
  onClose,
  onSaved,
}: {
  lot: ManagedLot
  zone?: ManagedZone
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [v, set] = useState<ZoneInput>(
    zone ?? {
      code: '',
      name: '',
      zoneType: 'Area',
      floorNo: null,
      capacity: 10,
      vehicleCapacities: { CAR_4: 10, CAR_7: 0, MOTORBIKE: 0, BICYCLE: 0 },
      reservationLimit: 0,
      isActive: true,
    },
  )
  const patch = (p: Partial<ZoneInput>) => set({ ...v, ...p })
  return (
    <Editor
      title={zone ? 'Edit zone' : 'Add zone'}
      description="Capacity covers reservable and walk-in spaces. Only create individual slots for the reservable part."
      onClose={onClose}
      onSave={async () => {
        await service.saveZone(lot.id, v, zone?.id)
        await onSaved()
      }}
    >
      <Field label="Zone code *">
        <Input
          required
          maxLength={30}
          value={v.code}
          onChange={(e) => patch({ code: e.target.value })}
        />
      </Field>
      <Field label="Zone name *">
        <Input
          required
          maxLength={200}
          value={v.name}
          onChange={(e) => patch({ name: e.target.value })}
        />
      </Field>
      <Field label="Zone type">
        <NativeSelect
          value={v.zoneType}
          onChange={(e) =>
            patch({ zoneType: e.target.value as ZoneInput['zoneType'] })
          }
        >
          <option value="Area">Area</option>
          <option value="Floor">Floor</option>
          <option value="Row">Row</option>
        </NativeSelect>
      </Field>
      <Field label="Floor number">
        <Input
          type="number"
          step={1}
          required={v.zoneType === 'Floor'}
          value={v.floorNo ?? ''}
          onChange={(e) =>
            patch({
              floorNo: e.target.value === '' ? null : Number(e.target.value),
            })
          }
        />
      </Field>
      <Field label="Zone capacity *">
        <Input
          type="number"
          required
          min={1}
          step={1}
          value={v.capacity}
          onChange={(e) => patch({ capacity: Number(e.target.value) })}
        />
      </Field>
      <Field label="Reservation limit *">
        <Input
          type="number"
          required
          min={0}
          max={v.capacity}
          step={1}
          value={v.reservationLimit}
          onChange={(e) => patch({ reservationLimit: Number(e.target.value) })}
        />
      </Field>
      <div className="sm:col-span-2">
        <p className="mb-2 text-sm font-medium text-slate-700">
          Capacity per vehicle type (must add up to the zone capacity)
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {VEHICLE_TYPES.map((t) => (
            <Field key={t.id} label={t.name}>
              <Input
                required
                type="number"
                min={0}
                step={1}
                value={v.vehicleCapacities[t.id] ?? 0}
                onChange={(e) =>
                  patch({
                    vehicleCapacities: {
                      ...v.vehicleCapacities,
                      [t.id]: Number(e.target.value),
                    },
                  })
                }
              />
            </Field>
          ))}
        </div>
      </div>
      <p className="rounded-lg bg-slate-50 p-3 text-sm sm:col-span-2">
        Reserved for walk-in vehicles:{' '}
        <strong>{Math.max(0, v.capacity - v.reservationLimit)} spaces</strong>. Walk-in
        vehicles are not assigned their own slot.
      </p>
      <label className="flex items-center gap-2">
        <Checkbox
          checked={v.isActive}
          onChange={(e) => patch({ isActive: e.target.checked })}
        />
        Zone active
      </label>
    </Editor>
  )
}
export function SlotForm({
  lot,
  zone,
  slot,
  onClose,
  onSaved,
}: {
  lot: ManagedLot
  zone: ManagedZone
  slot?: ManagedSlot
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [v, set] = useState<SlotInput>(
    slot ?? { code: '', vehicleTypeId: 'CAR_4', status: 'Available' },
  )
  return (
    <Editor
      title={slot ? 'Edit slot' : 'Add reservable slot'}
      description="Reserved and Occupied are set by the booking and check-in flow, not manually here."
      onClose={onClose}
      onSave={async () => {
        await service.saveSlot(lot.id, zone.id, v, slot?.id)
        await onSaved()
      }}
    >
      <Field label="Slot code *">
        <Input
          required
          maxLength={30}
          value={v.code}
          onChange={(e) => set({ ...v, code: e.target.value })}
        />
      </Field>
      <Field label="Vehicle type">
        <NativeSelect
          value={v.vehicleTypeId}
          onChange={(e) => set({ ...v, vehicleTypeId: e.target.value })}
        >
          {VEHICLE_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Configured status">
        <NativeSelect
          value={v.status}
          onChange={(e) =>
            set({ ...v, status: e.target.value as SlotInput['status'] })
          }
        >
          <option value="Available">Available</option>
          <option value="Maintenance">Maintenance</option>
        </NativeSelect>
      </Field>
    </Editor>
  )
}
export function OperationForm({
  lot,
  onClose,
  onSaved,
}: {
  lot: ManagedLot
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [v, set] = useState({
    status: lot.status,
    closedFrom: lot.closedFrom,
    closedUntil: lot.closedUntil,
    closureReason: lot.closureReason,
    maintenanceNotice: lot.maintenanceNotice,
  })
  return (
    <Editor
      title="Operating status"
      description="Managers run their assigned lots. A lot cannot close while any of its slots is reserved or occupied."
      onClose={onClose}
      onSave={async () => {
        await service.setOperation(lot.id, v)
        await onSaved()
      }}
    >
      <Field label="Status">
        <NativeSelect
          value={v.status}
          onChange={(e) =>
            set({ ...v, status: e.target.value as ManagedLot['status'] })
          }
        >
          {Object.entries(LOT_STATES).map(([k, s]) => (
            <option key={k} value={k}>
              {s}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Closure or maintenance reason">
        <Input
          maxLength={500}
          required={['TemporarilyClosed', 'Maintenance'].includes(v.status)}
          value={v.closureReason}
          onChange={(e) => set({ ...v, closureReason: e.target.value })}
        />
      </Field>
      {v.status === 'TemporarilyClosed' && (
        <>
          <Field label="Closed from">
            <Input
              required
              type="datetime-local"
              value={v.closedFrom}
              onChange={(e) => set({ ...v, closedFrom: e.target.value })}
            />
          </Field>
          <Field label="Reopens at">
            <Input
              required
              type="datetime-local"
              value={v.closedUntil}
              onChange={(e) => set({ ...v, closedUntil: e.target.value })}
            />
          </Field>
        </>
      )}
      <div className="sm:col-span-2">
        <Field label="Maintenance notice">
          <Input
            maxLength={1000}
            value={v.maintenanceNotice}
            onChange={(e) => set({ ...v, maintenanceNotice: e.target.value })}
          />
        </Field>
      </div>
    </Editor>
  )
}
