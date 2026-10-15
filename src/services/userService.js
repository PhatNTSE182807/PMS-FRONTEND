/**
 * UserService - Account management API for the Web Admin (F1.3).
 * - getUsers():   real API   GET /api/users (API_DOCUMENT 3.3)
 * - createUser(): MOCK only  (internal account creation API is not documented yet)
 *
 * All methods resolve to { success, data?, message? } and never throw,
 * matching the convention used in authService.
 */
import axios from 'axios';
import { getApiBaseUrl } from './authService';

const MOCK_DELAY_MS = 1000;

// Returned by getUsers() when the Backend is unreachable, so the UI can still be tested.
const MOCK_USERS = [
  {
    id: 'mock-0001',
    userName: 'admin',
    fullName: 'System Admin',
    email: 'admin@parkingbase.com',
    phoneNumber: '0901234567',
    role: 'Admin',
  },
  {
    id: 'mock-0002',
    userName: 'manager01',
    fullName: 'Nguyen Van Manager',
    email: 'manager01@parkingbase.com',
    phoneNumber: '0912345678',
    role: 'Manager',
  },
  {
    id: 'mock-0003',
    userName: 'staff01',
    fullName: 'Tran Thi Staff',
    email: 'staff01@parkingbase.com',
    phoneNumber: '0923456789',
    role: 'Staff',
  },
];

// Token saved at login (authService stores it as `pms_token`); falls back to a mock token.
const getAuthToken = () =>
  localStorage.getItem('pms_token') || sessionStorage.getItem('pms_token') || 'mock_token';

// Roles that can be assigned to internal accounts (Guest is not a DB role).
export const INTERNAL_ROLES = ['Admin', 'Manager', 'Staff'];

// FR-AUTH-07: Admin creates Manager/Staff; Manager creates Staff only.
// UI hint only - the Backend must re-check role and parking-lot scope.
export const CREATABLE_ROLES_BY_ACTOR = {
  Admin: ['Manager', 'Staff'],
  Manager: ['Staff'],
};

/**
 * Build a readable message from an ApiResult<T> error payload.
 * Falls back to HTTP status when the body has no `errors`.
 */
const extractErrors = (body, status, fallback) => {
  if (Array.isArray(body?.errors) && body.errors.length > 0) {
    return body.errors.join('; ');
  }
  if (body?.message) return body.message;
  return status ? `${fallback} (HTTP ${status})` : fallback;
};

export const userService = {
  /**
   * Get all accounts.
   * Endpoint: GET http://localhost:5000/api/users
   * Response: ApiResult<Array<{ id, userName, email, phoneNumber, role }>>
   * On Network Error (Backend not running) resolves with MOCK_USERS and `isMock: true`.
   * @returns {Promise<{success: boolean, data?: Array, message?: string, status?: number, isMock?: boolean}>}
   */
  async getUsers() {
    try {
      const response = await axios.get(`${getApiBaseUrl()}/users`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
      });

      const body = response.data;

      // Check the `succeeded` flag as well as the HTTP status (API_DOCUMENT 5.2).
      if (body?.succeeded === false) {
        return {
          success: false,
          status: response.status,
          message: extractErrors(body, response.status, 'Failed to load accounts'),
        };
      }

      return { success: true, data: Array.isArray(body?.result) ? body.result : [] };
    } catch (err) {
      // No `response` => request never reached the server (Network Error): use mock data.
      if (!err.response) {
        console.warn('getUsers: Backend unreachable, returning MOCK data.', err.message);
        return { success: true, data: MOCK_USERS, isMock: true };
      }

      // Server answered with an HTTP error (401, 403, 500...): surface it.
      return {
        success: false,
        status: err.response.status,
        message: extractErrors(err.response.data, err.response.status, 'Failed to load accounts'),
      };
    }
  },

  /**
   * Create an internal account (Manager / Staff / Admin).
   * MOCK: no real endpoint yet. Resolves after 1s.
   *
   * Business rules (SRS FR-AUTH-04, 07, 08) are enforced by the real Backend;
   * the checks below only make the mock fail like a real call would.
   *
   * @param {{
   *   userName: string,
   *   fullName: string,
   *   email: string,
   *   phoneNumber: string,
   *   role: 'Admin'|'Manager'|'Staff',
   *   assignedParkingLot?: string
   * }} data
   * @returns {Promise<{success: boolean, data?: object, message?: string}>}
   */
  createUser(data) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const required = ['userName', 'fullName', 'email', 'phoneNumber', 'role'];
        const missing = required.filter((key) => !String(data?.[key] ?? '').trim());
        if (missing.length > 0) {
          resolve({ success: false, message: `Missing required fields: ${missing.join(', ')}` });
          return;
        }

        if (!INTERNAL_ROLES.includes(data.role)) {
          resolve({ success: false, message: `Invalid role "${data.role}".` });
          return;
        }

        // Manager/Staff are scoped to a parking lot (UserParkingLot, SRS section 7).
        if (data.role !== 'Admin' && !String(data.assignedParkingLot ?? '').trim()) {
          resolve({ success: false, message: 'Manager and Staff must be assigned to a parking lot.' });
          return;
        }

        const newUser = {
          id: crypto.randomUUID(),
          userName: data.userName.trim(),
          fullName: data.fullName.trim(),
          email: data.email.trim(),
          phoneNumber: data.phoneNumber.trim(),
          role: data.role,
          assignedParkingLot: data.role === 'Admin' ? null : data.assignedParkingLot.trim(),
          // FR-AUTH-08: new internal accounts must activate via link and set a password.
          status: 'PendingActivation',
          isActive: false,
          createdAt: new Date().toISOString(),
        };

        resolve({
          success: true,
          data: newUser,
          message: 'Account created. An activation link has been sent to the user (mock).',
        });
      }, MOCK_DELAY_MS);
    });
  },
};
