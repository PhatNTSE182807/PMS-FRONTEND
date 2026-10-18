import type { SessionUser } from '@/lib/session'
import type {
  LoginCommand,
  LoginResponseDTO,
  RegisterCommand,
  RegisterResponseDTO,
  RequestLoginOtpCommand,
  VerifyLoginOtpCommand,
} from '@/types/identity.dto'
import { mockFail, mockId, mockResponse } from './mockApi'

/** Driver account used by "Instant Access Demo". */
export const DEMO_DRIVER: SessionUser = {
  userId: 'u-demo-vip',
  username: 'alex.rivers',
  fullName: 'Alex Rivers',
  email: 'alex.rivers@xxivparking.vn',
  phoneNumber: '+84 988 123 456',
  role: 'USER',
}

/** Administrator account used by "Admin Demo". */
export const DEMO_ADMIN: SessionUser = {
  userId: 'u-demo-admin',
  username: 'admin',
  fullName: 'Nguyễn Minh Quân',
  email: 'admin@xxivparking.vn',
  phoneNumber: '0903 456 789',
  role: 'ADMIN',
}

export const DEMO_MANAGER: SessionUser = {
  userId: 'usr-0001', username: 'manager.demo', fullName: 'Manager Demo',
  email: 'manager.demo@xxivparking.vn', phoneNumber: '0900000001', role: 'MANAGER',
}

/** Gate attendant account used by the Staff demo. */
export const DEMO_STAFF: SessionUser = {
  userId: 'usr-0418', username: 'staff.demo', fullName: 'Tran Hoang Nam',
  email: 'staff.demo@xxivparking.vn', phoneNumber: '0900000418', role: 'STAFF',
}

const MOCK_LOGIN_OTP = '123456'

export const authMock = {
  /** Accepts any credentials; e-mails starting with "admin" sign in as Admin. */
  login({ email, username, password }: LoginCommand): Promise<LoginResponseDTO> {
    return mockResponse(() => {
      const identifier = (email ?? username ?? '').trim()
      if (!identifier || !password) mockFail(400, 'Email and password are required.')
      const isAdmin = identifier.toLowerCase().startsWith('admin')
      const userId = isAdmin ? DEMO_ADMIN.userId : mockId('u')
      return {
        userId,
        username: identifier.split('@')[0],
        email: identifier.includes('@') ? identifier : `${identifier}@xxivparking.vn`,
        phoneNumber: isAdmin ? DEMO_ADMIN.phoneNumber : '0988123456',
        role: isAdmin ? 'Admin' : 'User',
        token: `demo.${userId}`,
      }
    })
  },

  requestLoginOtp({ email }: RequestLoginOtpCommand): Promise<string> {
    return mockResponse(() => {
      if (!email.trim()) mockFail(400, 'Email address is required')
      return 'Demo mode: no email is sent, use the code 123456.'
    })
  },

  /** Demo mode accepts the fixed code 123456. */
  verifyLoginOtp({ email, code }: VerifyLoginOtpCommand): Promise<LoginResponseDTO> {
    if (code.trim() !== MOCK_LOGIN_OTP) {
      return mockResponse(() => mockFail(400, 'Login code is invalid or has expired'))
    }
    return authMock.login({ email, password: code })
  },

  register(command: RegisterCommand): Promise<RegisterResponseDTO> {
    return mockResponse(() => {
      if (command.email.toLowerCase() === DEMO_ADMIN.email) mockFail(400, 'Email address is already taken.')
      return { id: mockId('u') }
    })
  },
}
