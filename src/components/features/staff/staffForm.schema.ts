import { z } from 'zod'

/** Same rule as the backend (PMS.Application UserValidatorConfiguration.VietnamPhoneNumberRegex). */
export const VN_PHONE_REGEX = /^(\+84|84|0)[35789][0-9]{8}$/

export type StaffFormMode = 'create' | 'edit'

export function createStaffFormSchema(mode: StaffFormMode) {
  return z
    .object({
      fullName: z.string().trim().min(3, 'Full name must be at least 3 characters.').max(200, 'Full name must be at most 200 characters.'),
      email: z.string().trim().min(1, 'Please enter an email.').pipe(z.email({ error: 'Email is not valid.' })),
      phoneNumber: z
        .string()
        .trim()
        .regex(VN_PHONE_REGEX, 'A Vietnamese phone number has 10 digits, e.g. 0901234567.'),
      role: z.enum(['MANAGER', 'STAFF']),
      assignedParkingLotIds: z.array(z.string()),
      shift: z.enum(['MORNING', 'AFTERNOON', 'NIGHT']).optional(),
      passwordMode: z.enum(['auto', 'manual']),
      password: z.string(),
      sendWelcomeEmail: z.boolean(),
    })
    .superRefine((values, ctx) => {
      if (values.assignedParkingLotIds.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['assignedParkingLotIds'], message: 'Select at least one parking lot.' })
      }
      if (values.role === 'STAFF' && values.assignedParkingLotIds.length > 1) {
        ctx.addIssue({ code: 'custom', path: ['assignedParkingLotIds'], message: 'Staff can only be assigned to one parking lot.' })
      }
      if (values.role === 'STAFF' && !values.shift) {
        ctx.addIssue({ code: 'custom', path: ['shift'], message: 'Select a shift for this staff member.' })
      }
      if (mode === 'create' && values.passwordMode === 'manual') {
        const password = values.password
        if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
          ctx.addIssue({
            code: 'custom',
            path: ['password'],
            message: 'Password must be at least 8 characters with an upper-case letter, a lower-case letter and a digit.',
          })
        }
      }
    })
}

export type StaffFormValues = z.infer<ReturnType<typeof createStaffFormSchema>>
