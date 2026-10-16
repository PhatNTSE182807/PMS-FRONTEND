import { useState, type ReactNode } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { ApiError, getErrorMessage } from '@/api/apiError'
import { Button } from '@/components/ui/button'
import { CopyField } from '@/components/ui/copy-field'
import { Dialog, DialogClose, DialogDescription, DialogTitle, SheetContent } from '@/components/ui/dialog'
import { Checkbox, FieldError, Input, Label, NativeSelect } from '@/components/ui/form-controls'
import { Spinner } from '@/components/ui/states'
import { isMockService } from '@/config/env'
import { useCreateStaff, useUpdateStaff } from '@/hooks/useStaff'
import { generatePassword } from '@/lib/password'
import { cn } from '@/lib/utils'
import type { UserDTO, UserRole } from '@/types/identity.dto'
import type { ParkingLotSummaryDTO } from '@/types/parking.dto'
import { ROLE_OPTIONS, SHIFT_OPTIONS } from './staffLabels'
import { createStaffFormSchema, type StaffFormValues } from './staffForm.schema'

interface StaffFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The account to edit; omitted to create a new one. */
  user?: UserDTO
  parkingLots: ParkingLotSummaryDTO[]
}

/** Drawer to create a Manager/Staff account or edit an existing one. */
export function StaffFormSheet({ open, onOpenChange, user, parkingLots }: StaffFormSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        {/* Mounted only while open, so every opening starts from fresh default values. */}
        <StaffForm user={user} parkingLots={parkingLots} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Dialog>
  )
}

function Field({ label, htmlFor, error, hint, children }: {
  label: string
  htmlFor?: string
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      <FieldError message={error} />
    </div>
  )
}

function StaffForm({ user, parkingLots, onDone }: { user?: UserDTO; parkingLots: ParkingLotSummaryDTO[]; onDone: () => void }) {
  const mode = user ? 'edit' : 'create'
  const createStaff = useCreateStaff()
  const updateStaff = useUpdateStaff()
  const [generatedPassword, setGeneratedPassword] = useState(() => generatePassword())
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<StaffFormValues>({
    resolver: zodResolver(createStaffFormSchema(mode)),
    defaultValues: {
      fullName: user?.fullName ?? '',
      email: user?.email ?? '',
      phoneNumber: user?.phoneNumber ?? '',
      role: user?.role ?? 'STAFF',
      assignedParkingLotIds: user?.assignedParkingLots.map((lot) => lot.id) ?? [],
      shift: user?.shift,
      passwordMode: 'auto',
      password: '',
      sendWelcomeEmail: true,
    },
  })

  const role = useWatch({ control, name: 'role' })
  const passwordMode = useWatch({ control, name: 'passwordMode' })

  const handleRoleChange = (next: UserRole, current: string[]) => {
    // Staff work at exactly one lot and need a shift; managers have no shift.
    if (next === 'STAFF' && current.length > 1) setValue('assignedParkingLotIds', current.slice(0, 1))
    if (next === 'MANAGER') setValue('shift', undefined)
  }

  // The live backend sends no email when it creates an account; only the demo data pretends to
  const sendsWelcomeEmail = isMockService('staff')

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const assignment = {
      fullName: values.fullName,
      phoneNumber: values.phoneNumber,
      role: values.role,
      assignedParkingLotIds: values.assignedParkingLotIds,
      shift: values.role === 'STAFF' ? values.shift : undefined,
    }

    try {
      if (user) {
        const updated = await updateStaff.mutateAsync({ id: user.id, command: assignment })
        toast.success('Account updated', { description: `${updated.fullName} (${updated.employeeCode})` })
      } else {
        const created = await createStaff.mutateAsync({
          ...assignment,
          email: values.email,
          password: values.passwordMode === 'auto' ? generatedPassword : values.password,
          sendWelcomeEmail: values.sendWelcomeEmail,
        })
        toast.success(`Account created for ${created.fullName}`, {
          description:
            sendsWelcomeEmail && values.sendWelcomeEmail
              ? `Employee code ${created.employeeCode}. A welcome email was sent to ${created.email}.`
              : `Employee code ${created.employeeCode}. They can sign in now with ${created.email}; send them the password through a secure channel.`,
        })
      }
      onDone()
    } catch (error) {
      const message = getErrorMessage(error, 'Could not save the account.')
      if (error instanceof ApiError && error.status === 409) {
        setError('email', { message })
      } else {
        setFormError(message)
      }
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-6 py-5 pr-12">
        <DialogTitle className="text-lg font-semibold text-slate-900">
          {user ? 'Edit account' : 'New staff account'}
        </DialogTitle>
        <DialogDescription className="mt-1 text-sm text-slate-500">
          {user
            ? `${user.employeeCode} · ${user.email}`
            : 'Create an account for a parking lot Manager or gate Staff.'}
        </DialogDescription>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <Field label="Full name" htmlFor="staff-fullName" error={errors.fullName?.message}>
          <Input id="staff-fullName" autoComplete="off" placeholder="e.g. Nguyen Van An" aria-invalid={!!errors.fullName} {...register('fullName')} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Email" htmlFor="staff-email" error={errors.email?.message}>
            <Input
              id="staff-email"
              type="email"
              autoComplete="off"
              placeholder="ten.ho@xxivparking.vn"
              // readOnly, not disabled: react-hook-form drops the values of disabled inputs.
              readOnly={mode === 'edit'}
              className={mode === 'edit' ? 'bg-slate-50 text-slate-500' : undefined}
              aria-invalid={!!errors.email}
              {...register('email')}
            />
          </Field>
          <Field label="Phone number" htmlFor="staff-phone" error={errors.phoneNumber?.message}>
            <Input id="staff-phone" type="tel" inputMode="tel" placeholder="0901234567" aria-invalid={!!errors.phoneNumber} {...register('phoneNumber')} />
          </Field>
        </div>

        <Controller
          control={control}
          name="assignedParkingLotIds"
          render={({ field: lotsField }) => (
            <>
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium text-slate-700">Role</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {ROLE_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 p-3 transition-colors hover:border-slate-300 has-[input:checked]:border-indigo-500 has-[input:checked]:bg-indigo-50/60 has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-indigo-500/20"
                    >
                      <input
                        type="radio"
                        value={option.value}
                        className="mt-0.5 accent-indigo-600"
                        {...register('role', { onChange: (e) => handleRoleChange(e.target.value, lotsField.value) })}
                      />
                      <span>
                        <span className="block text-sm font-medium text-slate-900">{option.label}</span>
                        <span className="block text-xs text-slate-500">{option.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {role === 'MANAGER' ? (
                <fieldset className="space-y-1.5">
                  <legend className="text-sm font-medium text-slate-700">Assigned parking lots</legend>
                  <div
                    className={cn(
                      'max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border',
                      errors.assignedParkingLotIds ? 'border-rose-400' : 'border-slate-200',
                    )}
                  >
                    {parkingLots.map((lot) => {
                      const checked = lotsField.value.includes(lot.id)
                      return (
                        <label key={lot.id} className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-slate-50">
                          <Checkbox
                            className="mt-0.5"
                            checked={checked}
                            onChange={() =>
                              lotsField.onChange(checked ? lotsField.value.filter((id) => id !== lot.id) : [...lotsField.value, lot.id])
                            }
                          />
                          <span className="min-w-0">
                            <span className="block text-sm text-slate-900">{lot.name}</span>
                            <span className="block truncate text-xs text-slate-500">{lot.address}</span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                  <p className="text-xs text-slate-500">A Manager can be assigned to several lots.</p>
                  <FieldError message={errors.assignedParkingLotIds?.message} />
                </fieldset>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Assigned parking lot" htmlFor="staff-lot" error={errors.assignedParkingLotIds?.message}>
                    <NativeSelect
                      id="staff-lot"
                      value={lotsField.value[0] ?? ''}
                      aria-invalid={!!errors.assignedParkingLotIds}
                      onChange={(e) => lotsField.onChange(e.target.value ? [e.target.value] : [])}
                    >
                      <option value="">Select a lot…</option>
                      {parkingLots.map((lot) => (
                        <option key={lot.id} value={lot.id}>
                          {lot.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="Shift" htmlFor="staff-shift" error={errors.shift?.message}>
                    <NativeSelect
                      id="staff-shift"
                      aria-invalid={!!errors.shift}
                      {...register('shift', { setValueAs: (v) => v || undefined })}
                    >
                      <option value="">Select a shift…</option>
                      {SHIFT_OPTIONS.map((shift) => (
                        <option key={shift.value} value={shift.value}>
                          {shift.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                </div>
              )}
            </>
          )}
        />

        {mode === 'create' && (
          <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
            <legend className="px-1 text-sm font-medium text-slate-700">Sign-in password</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input type="radio" value="auto" className="accent-indigo-600" {...register('passwordMode')} />
                Generate automatically
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input type="radio" value="manual" className="accent-indigo-600" {...register('passwordMode')} />
                Enter manually
              </label>
            </div>

            {passwordMode === 'auto' ? (
              <CopyField
                value={generatedPassword}
                label="password"
                actions={
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Generate another password"
                    aria-label="Generate another password"
                    onClick={() => setGeneratedPassword(generatePassword())}
                  >
                    <RefreshCw />
                  </Button>
                }
              />
            ) : (
              <div className="space-y-1.5">
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    aria-label="Password"
                    aria-invalid={!!errors.password}
                    className="pr-10"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <FieldError message={errors.password?.message} />
              </div>
            )}

            {sendsWelcomeEmail && (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <Checkbox {...register('sendWelcomeEmail')} />
                Send a welcome email with the sign-in details
              </label>
            )}
          </fieldset>
        )}
      </div>

      <div className="space-y-3 border-t border-slate-200 bg-slate-50/60 px-6 py-4">
        {formError && (
          <div role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {formError}
          </div>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Spinner className="size-3.5" />}
            {user ? 'Save changes' : 'Create account'}
          </Button>
        </div>
      </div>
    </form>
  )
}
