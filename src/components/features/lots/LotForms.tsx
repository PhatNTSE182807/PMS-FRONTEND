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
import type { LotInput, ManagedLot } from '@/types/lot-management.dto'
import { LOT_STATES } from '@/types/lot-management.dto'
import type { UserDTO } from '@/types/identity.dto'
import { GaragePreview } from '@/components/customer/garage/GaragePreview'
import { findTemplate, GARAGE_TEMPLATES, templateCapacity } from '@/components/customer/garage/garageModel'
import { cn } from '@/lib/utils'
import { coordinateError } from '@/lib/lotCoordinates'
import { LotLocationPicker } from './LotLocationPicker'

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
  // Lots saved in demo storage before positions existed have no latitude / longitude
  const [v, set] = useState<LotInput>(
    lot ? { ...lot, layoutTemplate: lot.layoutTemplate ?? '', latitude: lot.latitude ?? null, longitude: lot.longitude ?? null } : emptyLot,
  )
  const patch = (p: Partial<LotInput>) => set({ ...v, ...p })
  const template = findTemplate(v.layoutTemplate)
  // Zones and slots are built from the model, so it is fixed once a lot has them
  const modelLocked = Boolean(lot?.zones.length)
  return (
    <Editor
      title={lot ? 'Edit parking lot' : 'Create parking lot'}
      description="Pick one of the ready-made parking models: its levels, zones, bays and 3D layout are created for you. Assign the lot's Manager here."
      wide
      onClose={onClose}
      onSave={async () => {
        const positionError = coordinateError(v.latitude, v.longitude)
        if (positionError) throw new Error(positionError)
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
      <LotLocationPicker
        latitude={v.latitude}
        longitude={v.longitude}
        address={v.address}
        onChange={(latitude, longitude) => set((current) => ({ ...current, latitude, longitude }))}
      />
      <fieldset className="grid gap-2 sm:col-span-2" disabled={modelLocked}>
        <legend className="mb-1.5 text-sm font-medium text-slate-700">Parking lot model *</legend>
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Parking lot model">
          {GARAGE_TEMPLATES.map((t) => {
            const active = v.layoutTemplate === t.id
            const mix = templateCapacity(t)
            return (
              <label
                key={t.id}
                className={cn(
                  'flex flex-col gap-1 rounded-xl border p-3 text-sm transition-colors',
                  modelLocked ? 'cursor-not-allowed' : 'cursor-pointer',
                  active ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-slate-200 hover:bg-slate-50',
                  modelLocked && !active && 'opacity-50',
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
        <p className="text-xs text-slate-500">
          {modelLocked
            ? 'This lot is built from its model; the model cannot be changed once zones and bays exist.'
            : `Capacity ${template ? templateCapacity(template).total : 0} bays, set by the model. Zones and bays cannot be added by hand.`}
        </p>
        {template && <GaragePreview key={template.id} template={template} seed="lot-form" className="h-[18rem] sm:h-[22rem]" />}
      </fieldset>
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
