import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { getErrorMessage } from '@/api/apiError'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogDescription, DialogTitle, SheetContent } from '@/components/ui/dialog'
import { FieldError, Input, Label, NativeSelect } from '@/components/ui/form-controls'
import { Spinner } from '@/components/ui/states'
import { useCreateManagedStaff, useUpdateManagedStaff } from '@/hooks/useManagedStaff'
import { generatePassword, isValidPassword, PASSWORD_RULE_MESSAGE } from '@/lib/password'
import type { UserDTO } from '@/types/identity.dto'
import type { ManagedLot } from '@/types/lot-management.dto'

/** BR-28, same rules as the backend's CreateStaffAccountModelValidator. */
const PHONE_REGEX = /^0\d{9}$/

function createSchema(mode: 'create' | 'edit') {
  return z
    .object({
      fullName: z.string().trim().min(2, 'Full name must be 2–100 characters.').max(100, 'Full name must be 2–100 characters.'),
      email: z.string().trim().min(1, 'Please enter an email.').pipe(z.email({ error: 'Email is not valid.' })),
      phoneNumber: z.string().trim().regex(PHONE_REGEX, 'Phone number must have 10 digits and start with 0.'),
      parkingLotId: z.string().min(1, 'Select a parking lot.'),
      password: z.string(),
      confirmPassword: z.string(),
    })
    .superRefine((values, ctx) => {
      if (mode === 'edit') return
      const { password } = values
      if (!isValidPassword(password)) {
        ctx.addIssue({ code: 'custom', path: ['password'], message: PASSWORD_RULE_MESSAGE })
      }
      if (values.confirmPassword !== password) {
        ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match.' })
      }
    })
}

type FormValues = z.infer<ReturnType<typeof createSchema>>

interface ManagerStaffFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The Staff member to edit; omitted to add a new one. */
  user?: UserDTO
  /** The lots this Manager manages; a Staff member works at exactly one of them. */
  lots: ManagedLot[]
  /** Lot preselected for a new Staff member. */
  defaultLotId?: string
}

/** Drawer for a Manager to add a Staff account in one of their lots, or edit one. */
export function ManagerStaffFormSheet({ open, onOpenChange, user, lots, defaultLotId }: ManagerStaffFormSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        {/* Mounted only while open, so every opening starts from fresh values. */}
        <StaffForm user={user} lots={lots} defaultLotId={defaultLotId} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Dialog>
  )
}

function Field({ label, htmlFor, error, hint, children }: { label: string; htmlFor: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      <FieldError message={error} />
    </div>
  )
}

function StaffForm({ user, lots, defaultLotId, onDone }: { user?: UserDTO; lots: ManagedLot[]; defaultLotId?: string; onDone: () => void }) {
  const mode = user ? 'edit' : 'create'
  const createStaff = useCreateManagedStaff()
  const updateStaff = useUpdateManagedStaff()
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const currentLotId = user?.assignedParkingLots.find((l) => lots.some((lot) => lot.id === l.id))?.id

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(createSchema(mode)),
    defaultValues: {
      fullName: user?.fullName ?? '',
      email: user?.email ?? '',
      phoneNumber: user?.phoneNumber ?? '',
      parkingLotId: currentLotId ?? defaultLotId ?? lots[0]?.id ?? '',
      password: '',
      confirmPassword: '',
    },
  })

  const fillPassword = () => {
    const password = generatePassword()
    setValue('password', password, { shouldValidate: true })
    setValue('confirmPassword', password, { shouldValidate: true })
    setShowPassword(true)
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const details = { fullName: values.fullName, email: values.email, phoneNumber: values.phoneNumber }
    try {
      if (user) {
        const updated = await updateStaff.mutateAsync({
          id: user.id,
          command: details,
          parkingLotId: values.parkingLotId !== currentLotId ? values.parkingLotId : undefined,
        })
        toast.success('Staff updated', { description: `${updated.fullName} (${updated.employeeCode})` })
      } else {
        const created = await createStaff.mutateAsync({
          ...details,
          password: values.password,
          confirmPassword: values.confirmPassword,
          parkingLotId: values.parkingLotId,
        })
        toast.success(`Staff account created for ${created.fullName}`, {
          description: `Employee code ${created.employeeCode}. They can sign in now with ${created.email}; send them the password through a secure channel.`,
        })
      }
      onDone()
    } catch (error) {
      setFormError(getErrorMessage(error, 'Could not save the staff account.'))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-6 py-5 pr-12">
        <DialogTitle className="text-lg font-semibold text-slate-900">{user ? 'Edit staff' : 'Add staff'}</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-slate-500">
          {user ? `${user.employeeCode} · ${user.email}` : 'Create a gate Staff account in one of the lots you manage.'}
        </DialogDescription>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <Field label="Full name" htmlFor="team-fullName" error={errors.fullName?.message}>
          <Input id="team-fullName" autoComplete="off" placeholder="e.g. Nguyen Van An" aria-invalid={!!errors.fullName} {...register('fullName')} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Email" htmlFor="team-email" error={errors.email?.message} hint="Used to sign in.">
            <Input id="team-email" type="email" autoComplete="off" placeholder="ten.ho@xxivparking.vn" aria-invalid={!!errors.email} {...register('email')} />
          </Field>
          <Field label="Phone number" htmlFor="team-phone" error={errors.phoneNumber?.message}>
            <Input id="team-phone" type="tel" inputMode="tel" placeholder="0901234567" aria-invalid={!!errors.phoneNumber} {...register('phoneNumber')} />
          </Field>
        </div>

        <Field
          label="Parking lot"
          htmlFor="team-lot"
          error={errors.parkingLotId?.message}
          hint="A Staff member works at one lot. You can only pick lots you manage."
        >
          <NativeSelect id="team-lot" aria-invalid={!!errors.parkingLotId} {...register('parkingLotId')}>
            <option value="">Select a lot…</option>
            {lots.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {lot.name}
              </option>
            ))}
          </NativeSelect>
        </Field>

        {mode === 'create' && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Password" htmlFor="team-password" error={errors.password?.message}>
              <div className="relative">
                <Input
                  id="team-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="pr-10"
                  aria-invalid={!!errors.password}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-800"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
            <Field label="Confirm password" htmlFor="team-confirm" error={errors.confirmPassword?.message}>
              <Input
                id="team-confirm"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                aria-invalid={!!errors.confirmPassword}
                {...register('confirmPassword')}
              />
            </Field>
            <Button type="button" variant="outline" size="sm" className="sm:col-span-2 sm:justify-self-start" onClick={fillPassword}>
              <RefreshCw className="size-4" aria-hidden /> Generate a strong password
            </Button>
          </div>
        )}

        {formError && (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {formError}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Spinner className="size-4" />}
          {user ? 'Save changes' : 'Create account'}
        </Button>
      </div>
    </form>
  )
}
