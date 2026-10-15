import { z } from 'zod'

/** Same rule as the backend (PMS.Application UserValidatorConfiguration.VietnamPhoneNumberRegex). */
export const VN_PHONE_REGEX = /^(\+84|84|0)[35789][0-9]{8}$/

export type StaffFormMode = 'create' | 'edit'

export function createStaffFormSchema(mode: StaffFormMode) {
  return z
    .object({
      fullName: z.string().trim().min(3, 'Họ và tên tối thiểu 3 ký tự.').max(200, 'Họ và tên tối đa 200 ký tự.'),
      email: z.string().trim().min(1, 'Vui lòng nhập email.').pipe(z.email({ error: 'Email không đúng định dạng.' })),
      phoneNumber: z
        .string()
        .trim()
        .regex(VN_PHONE_REGEX, 'Số điện thoại Việt Nam gồm 10 số, ví dụ 0901234567.'),
      role: z.enum(['MANAGER', 'STAFF']),
      assignedParkingLotIds: z.array(z.string()),
      shift: z.enum(['MORNING', 'AFTERNOON', 'NIGHT']).optional(),
      passwordMode: z.enum(['auto', 'manual']),
      password: z.string(),
      sendWelcomeEmail: z.boolean(),
    })
    .superRefine((values, ctx) => {
      if (values.assignedParkingLotIds.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['assignedParkingLotIds'], message: 'Chọn ít nhất một bãi xe phụ trách.' })
      }
      if (values.role === 'STAFF' && values.assignedParkingLotIds.length > 1) {
        ctx.addIssue({ code: 'custom', path: ['assignedParkingLotIds'], message: 'Nhân viên chỉ được gán một bãi xe.' })
      }
      if (values.role === 'STAFF' && !values.shift) {
        ctx.addIssue({ code: 'custom', path: ['shift'], message: 'Chọn ca làm việc cho nhân viên.' })
      }
      if (mode === 'create' && values.passwordMode === 'manual') {
        const password = values.password
        if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
          ctx.addIssue({
            code: 'custom',
            path: ['password'],
            message: 'Mật khẩu tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và chữ số.',
          })
        }
      }
    })
}

export type StaffFormValues = z.infer<ReturnType<typeof createStaffFormSchema>>
