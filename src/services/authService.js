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
   * @param {string} email
   * @param {string} password
   * @param {boolean} rememberMe
   * @returns {Promise<{success: boolean, data?: any, user?: any, message?: string, isNetworkError?: boolean}>}
   */
  async login(email, password, rememberMe = false) {
    const baseUrl = getApiBaseUrl();
    try {
      const payload = {
        email: email.trim(),
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
        username: resData?.username || email.trim().split('@')[0],
        fullName: resData?.fullName || resData?.username || email.trim(),
        email: resData?.email || email.trim(),
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
   * Helper to format error responses
   */
  _extractErrorMessage(data, fallback = 'Operation failed') {
    if (!data) return fallback;
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors.join('; ');
    }
    if (data.errors && typeof data.errors === 'object') {
      const msgs = Object.values(data.errors).flat();
      if (msgs.length > 0) return msgs.join('; ');
    }
    if (data.message) return data.message;
    return fallback;
  },

  /**
   * Fetch live user profile from backend
   * Endpoint: GET /api/Users/profile
   */
  async fetchProfile() {
    const baseUrl = getApiBaseUrl();
    const token = this.getToken();
    if (!token) return null;

    try {
      const response = await fetch(`${baseUrl}/Users/profile`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) return null;
      const data = await response.json();
      const profile = data?.result || data?.data || data;

      // Update cached user in storage
      if (profile) {
        const currentUser = this.getCurrentUser() || {};
        const updatedUser = {
          ...currentUser,
          userId: profile.userId || currentUser.userId,
          fullName: profile.fullName || currentUser.fullName,
          email: profile.email || currentUser.email,
          phoneNumber: profile.phoneNumber || currentUser.phoneNumber,
          role: profile.role || currentUser.role || 'User',
          avatarUrl: profile.avatarUrl || currentUser.avatarUrl,
        };
        const storage = localStorage.getItem('pms_token') ? localStorage : sessionStorage;
        storage.setItem('pms_user', JSON.stringify(updatedUser));
      }

      return profile;
    } catch (err) {
      console.warn('fetchProfile error:', err);
      return null;
    }
  },

  /**
   * Update User Profile
   * Endpoint: PUT /api/Users/profile
   */
  async updateProfile(profileData) {
    const baseUrl = getApiBaseUrl();
    const token = this.getToken();

    try {
      const response = await fetch(`${baseUrl}/Users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName: profileData.fullName?.trim(),
          email: profileData.email?.trim(),
          phoneNumber: profileData.phoneNumber?.trim(),
          avatarUrl: profileData.avatarUrl || '',
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        return {
          success: false,
          message: this._extractErrorMessage(data, `Failed to update profile (${response.status})`),
        };
      }

      const updated = data?.result || data?.data || data;
      // Update local storage
      const currentUser = this.getCurrentUser() || {};
      const updatedUser = {
        ...currentUser,
        fullName: updated.fullName || profileData.fullName,
        email: updated.email || profileData.email,
        phoneNumber: updated.phoneNumber || profileData.phoneNumber,
        avatarUrl: updated.avatarUrl || profileData.avatarUrl,
        role: updated.role || currentUser.role || 'User',
      };
      const storage = localStorage.getItem('pms_token') ? localStorage : sessionStorage;
      storage.setItem('pms_user', JSON.stringify(updatedUser));

      return { success: true, data: updated, user: updatedUser, message: 'Profile updated successfully!' };
    } catch (err) {
      console.warn('updateProfile error:', err);
      return { success: false, message: 'Network error updating profile. Please check backend connection.' };
    }
  },

  /**
   * Fetch registered vehicles from backend
   * Endpoint: GET /api/Users/profile/vehicles
   */
  async fetchVehicles() {
    const baseUrl = getApiBaseUrl();
    const token = this.getToken();
    if (!token) return null;

    try {
      const response = await fetch(`${baseUrl}/Users/profile/vehicles`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data?.result || data?.data || (Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('fetchVehicles error:', err);
      return null;
    }
  },

  /**
   * Fetch Vehicle Types catalog
   * Endpoint: GET /api/Users/profile/vehicle-types
   */
  async fetchVehicleTypes() {
    const baseUrl = getApiBaseUrl();
    const token = this.getToken();

    try {
      const response = await fetch(`${baseUrl}/Users/profile/vehicle-types`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) return [];
      const data = await response.json();
      return data?.result || data?.data || (Array.isArray(data) ? data : []);
    } catch {
      return [];
    }
  },

  /**
   * Add new vehicle
   * Endpoint: POST /api/Users/profile/vehicles
   */
  async addVehicle(vehicleData) {
    const baseUrl = getApiBaseUrl();
    const token = this.getToken();

    try {
      const response = await fetch(`${baseUrl}/Users/profile/vehicles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          licensePlate: vehicleData.licensePlate?.trim(),
          vehicleTypeId: Number(vehicleData.vehicleTypeId) || 1,
          brand: vehicleData.brand?.trim(),
          model: vehicleData.model?.trim(),
          color: vehicleData.color?.trim() || 'Black',
          isDefault: Boolean(vehicleData.isDefault),
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        return {
          success: false,
          message: this._extractErrorMessage(data, 'Failed to add vehicle'),
        };
      }
      return { success: true, data: data?.result || data, message: 'Vehicle added successfully!' };
    } catch (err) {
      console.warn('addVehicle error:', err);
      return { success: false, message: 'Network error adding vehicle.' };
    }
  },

  /**
   * Update an existing vehicle
   * Endpoint: PUT /api/Users/profile/vehicles/{vehicleId}
   */
  async updateVehicle(vehicleId, vehicleData) {
    const baseUrl = getApiBaseUrl();
    const token = this.getToken();

    try {
      const response = await fetch(`${baseUrl}/Users/profile/vehicles/${vehicleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          licensePlate: vehicleData.licensePlate?.trim(),
          vehicleTypeId: Number(vehicleData.vehicleTypeId) || 1,
          brand: vehicleData.brand?.trim(),
          model: vehicleData.model?.trim(),
          color: vehicleData.color?.trim() || 'Black',
          isDefault: Boolean(vehicleData.isDefault),
          isActive: vehicleData.isActive !== false,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        return {
          success: false,
          message: this._extractErrorMessage(data, 'Failed to update vehicle'),
        };
      }
      return { success: true, data: data?.result || data, message: 'Vehicle updated successfully!' };
    } catch (err) {
      console.warn('updateVehicle error:', err);
      return { success: false, message: 'Network error updating vehicle.' };
    }
  },

  /**
   * Delete vehicle
   * Endpoint: DELETE /api/Users/profile/vehicles/{vehicleId}
   */
  async deleteVehicle(vehicleId) {
    const baseUrl = getApiBaseUrl();
    const token = this.getToken();

    try {
      const response = await fetch(`${baseUrl}/Users/profile/vehicles/${vehicleId}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        return {
          success: false,
          message: this._extractErrorMessage(data, 'Failed to delete vehicle'),
        };
      }
      return { success: true, message: 'Vehicle deleted successfully!' };
    } catch (err) {
      console.warn('deleteVehicle error:', err);
      return { success: false, message: 'Network error deleting vehicle.' };
    }
  },

  /**
   * Set vehicle as default / primary
   * Endpoint: PATCH /api/Users/profile/vehicles/{vehicleId}/default
   */
  async setDefaultVehicle(vehicleId) {
    const baseUrl = getApiBaseUrl();
    const token = this.getToken();

    try {
      const response = await fetch(`${baseUrl}/Users/profile/vehicles/${vehicleId}/default`, {
        method: 'PATCH',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        return {
          success: false,
          message: this._extractErrorMessage(data, 'Failed to set default vehicle'),
        };
      }
      return { success: true, data: data?.result || data, message: 'Vehicle marked as primary default!' };
    } catch (err) {
      console.warn('setDefaultVehicle error:', err);
      return { success: false, message: 'Network error setting default vehicle.' };
    }
  },

  /**
   * Change Password
   * Endpoint: PUT /api/Users/profile/change-password
   */
  async changePassword({ currentPassword, newPassword, confirmPassword }) {
    const baseUrl = getApiBaseUrl();
    const token = this.getToken();

    try {
      const response = await fetch(`${baseUrl}/Users/profile/change-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        return {
          success: false,
          message: this._extractErrorMessage(data, 'Failed to change password. Please verify current password.'),
        };
      }
      return { success: true, message: 'Password changed successfully!' };
    } catch (err) {
      console.warn('changePassword error:', err);
      return { success: false, message: 'Network error changing password.' };
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
