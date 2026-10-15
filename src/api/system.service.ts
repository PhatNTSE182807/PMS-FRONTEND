import axios from 'axios'
import { getApiBaseUrl, SERVICE_PATHS } from '@/config/env'

export interface ApiHealth {
  online: boolean
  status?: number
  url: string
}

export const systemService = {
  /**
   * Reachability probe. Any HTTP response (even 401) means the API is up.
   * It hits an authenticated endpoint instead of the anonymous user list, and uses a bare
   * axios instance so a 401 here never signs the user out.
   * TODO: switch to a dedicated /health endpoint once the backend exposes one.
   */
  async ping(): Promise<ApiHealth> {
    const url = getApiBaseUrl()
    try {
      const response = await axios.get(`${url}${SERVICE_PATHS.profile}`, {
        timeout: 2_000,
        validateStatus: () => true,
      })
      return { online: true, status: response.status, url }
    } catch {
      return { online: false, url }
    }
  },
}
