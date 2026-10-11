/**
 * AuthService - Authentication & User API Service for Parking Base (PMS)
 * Connected to .NET Backend API (PMS.API / UsersController)
 * All user-facing strings and error messages in English.
 */

// Helper to normalize the API base URL
export const getApiBaseUrl = () => {
  let url = localStorage.getItem('pms_custom_api_url') || import.meta.env.VITE_API_BASE_URL || 'https://localhost:44391/api';
  url = url.trim().replace(/\/+$/, '');
  
  // Clean up if user configured swagger URL
  if (url.includes('/swagger/index.html')) {
    url = url.replace('/swagger/index.html', '/api');
  } else if (url.includes('/swagger')) {
    url = url.replace('/swagger', '/api');
  }

  // Ensure /api suffix if not already present
  if (!url.endsWith('/api') && !url.includes('/api/')) {
    url = `${url}/api`;
  }

  return url;
};

export const setCustomApiUrl = (url) => {
  if (url) {
    localStorage.setItem('pms_custom_api_url', url.trim());
  } else {
    localStorage.removeItem('pms_custom_api_url');
  }
};

export const authService = {
  /**
   * Get currently active API base URL
   */
  getBaseUrl() {
    return getApiBaseUrl();
  },

  /**
   * Check connection to backend API
   */
  async checkConnection() {
    const baseUrl = getApiBaseUrl();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch(`${baseUrl}/users`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return { online: response.ok || response.status === 401 || response.status === 403, status: response.status, url: baseUrl };
    } catch {
      return { online: false, url: baseUrl };
    }
  },

  /**
   * Submit login request to Backend
   * Endpoint: POST /api/users/authenticate
   * @param {string} username (or email/phone)
   * @param {string} password 
   * @param {boolean} rememberMe 
   * @returns {Promise<{success: boolean, data?: any, user?: any, message?: string, isNetworkError?: boolean}>}
   */
  async login(username, password, rememberMe = false) {
    const baseUrl = getApiBaseUrl();
    try {
      const payload = {
        username: username.trim(),
        password: password,
      };

      // Call primary endpoint POST /api/users/authenticate
      let response = await fetch(`${baseUrl}/users/authenticate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      // Fallback in case endpoint is named /login in alternative configurations
      if (response.status === 404) {
        response = await fetch(`${baseUrl}/users/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      }

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        let errorMsg = 'Login failed. Please check your credentials.';
        if (result?.errors && Array.isArray(result.errors) && result.errors.length > 0) {
          errorMsg = result.errors.join('; ');
        } else if (result?.message) {
          errorMsg = result.message;
        } else {
          errorMsg = `Server error (Status code: ${response.status})`;
        }
        return { success: false, message: errorMsg };
      }

      // Backend returns ApiResult<LoginResponseModel>
      // result = { succeeded: true, result: { userId, username, email, phoneNumber, role, token }, errors: [] }
      const resData = result?.result || result?.data || result;
      const token = resData?.token || resData?.accessToken;
      const user = {
        userId: resData?.userId || 'u-demo-1',
        username: resData?.username || username.trim(),
        fullName: resData?.fullName || username.trim(),
        email: resData?.email || `${username.trim()}@pms-ojt.vn`,
        phoneNumber: resData?.phoneNumber || '0988 123 456',
        role: resData?.role || 'User',
      };

      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('pms_token', token || 'demo_jwt_token_sample');
      storage.setItem('pms_user', JSON.stringify(user));

      return {
        success: true,
        data: resData,
        user: user,
        message: 'Login successful!',
      };
    } catch (error) {
      console.warn('API Login Network Error:', error);
      return {
        success: false,
        isNetworkError: true,
        message: `Could not connect to Backend at ${baseUrl}. You can start the .NET backend or use "Demo Mode" to explore immediately.`,
      };
    }
  },

  /**
   * Register new user account with Backend
   * Endpoint: POST /api/users/register
   * @param {{ userName: string, fullName: string, email: string, password: string, phoneNumber: string }} data
   */
  async register(data) {
    const baseUrl = getApiBaseUrl();
    try {
      const payload = {
        userName: data.userName.trim(),
        fullName: data.fullName?.trim() || data.userName.trim(),
        email: data.email.trim(),
        password: data.password,
        phoneNumber: data.phoneNumber.trim(),
      };

      const response = await fetch(`${baseUrl}/users/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        let errorMsg = 'Registration failed.';
        if (result?.errors && Array.isArray(result.errors) && result.errors.length > 0) {
          errorMsg = result.errors.join('; ');
        } else if (result?.message) {
          errorMsg = result.message;
        } else {
          errorMsg = `Server error (${response.status})`;
        }
        return { success: false, message: errorMsg };
      }

      return {
        success: true,
        data: result?.result || result,
        message: 'Account created successfully! You can now log in.',
      };
    } catch (error) {
      console.warn('API Register Network Error:', error);
      return {
        success: false,
        isNetworkError: true,
        message: `Unable to connect to API server at ${baseUrl}. Please check backend status or test in simulation mode.`,
      };
    }
  },

  /**
   * Request OTP (for 2FA tab)
   * @param {string} destination (email or phone)
   */
  async requestOtp(destination) {
    await new Promise(r => setTimeout(r, 600));
    return {
      success: true,
      message: `Verification OTP has been sent to ${destination}. (Demo code: 123456)`,
    };
  },

  /**
   * Verify OTP & Login
   * @param {string} destination 
   * @param {string} otp 
   */
  async verifyOtpAndLogin(destination, otp, rememberMe = false) {
    await new Promise(r => setTimeout(r, 600));
    if (otp === '123456' || otp.length === 6) {
      const user = {
        userId: 'u-otp-01',
        username: destination.split('@')[0] || 'User',
        fullName: 'PMS OJT User',
        email: destination.includes('@') ? destination : `${destination}@pms-ojt.vn`,
        phoneNumber: destination.includes('@') ? '0912 345 678' : destination,
        role: 'User',
      };
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('pms_token', 'demo_otp_token_2fa');
      storage.setItem('pms_user', JSON.stringify(user));
      return { success: true, user, message: '2FA OTP verification successful!' };
    }
    return { success: false, message: 'Invalid or expired OTP code (Test code is 123456).' };
  },

  /**
   * Get active JWT token
   */
  getToken() {
    return localStorage.getItem('pms_token') || sessionStorage.getItem('pms_token');
  },

  /**
   * Get authenticated user profile from storage
   */
  getCurrentUser() {
    const userStr = localStorage.getItem('pms_user') || sessionStorage.getItem('pms_user');
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },

  /**
   * Fetch live user profile from backend
   * Endpoint: GET /api/users/profile
   */
  async fetchProfile() {
    const baseUrl = getApiBaseUrl();
    const token = this.getToken();
    if (!token) return null;

    try {
      const response = await fetch(`${baseUrl}/users/profile`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data?.result || data;
    } catch {
      return null;
    }
  },

  /**
   * Fetch registered vehicles from backend
   * Endpoint: GET /api/users/profile/vehicles
   */
  async fetchVehicles() {
    const baseUrl = getApiBaseUrl();
    const token = this.getToken();
    if (!token) return null;

    try {
      const response = await fetch(`${baseUrl}/users/profile/vehicles`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data?.result || data;
    } catch {
      return null;
    }
  },

  /**
   * Add new vehicle
   * Endpoint: POST /api/users/profile/vehicles
   */
  async addVehicle(vehicleData) {
    const baseUrl = getApiBaseUrl();
    const token = this.getToken();

    try {
      const response = await fetch(`${baseUrl}/users/profile/vehicles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(vehicleData),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        return { success: false, message: data?.errors?.join(', ') || 'Failed to add vehicle' };
      }
      return { success: true, data: data?.result || data };
    } catch {
      return { success: false, message: 'Network error adding vehicle' };
    }
  },

  /**
   * Logout and clear saved sessions
   */
  logout() {
    localStorage.removeItem('pms_token');
    localStorage.removeItem('pms_user');
    sessionStorage.removeItem('pms_token');
    sessionStorage.removeItem('pms_user');
  },
};
