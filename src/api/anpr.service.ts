/**
 * Plate reader (ANPR) service: a separate Python service next to the gates (backend repo tools/anpr),
 * not the PMS API, so it is called with fetch and its own base URL.
 */

export interface AnprHealthDTO {
  /** Both trained models are there. */
  ready: boolean
  plateModel: boolean
  charsModel: boolean
}

export interface AnprPlateDTO {
  /** Printed form, e.g. "51K-889.24"; empty when no character could be read. */
  plate: string
  /** 0..1 */
  confidence: number
  /** x0, y0, x1, y1 in pixels of the frame sent. */
  box: [number, number, number, number]
  rows: string[]
}

export interface AnprReadDTO {
  plates: AnprPlateDTO[]
}

/** The service on Render (backend repo tools/anpr/Dockerfile, ONNX models), used by production builds. */
const DEPLOYED_ANPR_SERVICE_URL = 'https://pms-backend-1-5xlz.onrender.com'
/** The service started with `uvicorn service:app --port 8001` on this computer, used in development. */
const LOCAL_ANPR_SERVICE_URL = 'http://127.0.0.1:8001'

const configured = import.meta.env.VITE_ANPR_SERVICE_URL?.trim()
/**
 * Base URL of the service; null when the plate reader is turned off.
 * VITE_ANPR_SERVICE_URL wins; set it to "off" to turn the plate reader off.
 */
export const ANPR_SERVICE_URL: string | null =
  configured?.toLowerCase() === 'off'
    ? null
    : (configured || (import.meta.env.DEV ? LOCAL_ANPR_SERVICE_URL : DEPLOYED_ANPR_SERVICE_URL)).replace(/\/+$/, '') || null

async function failure(response: Response) {
  const body = (await response.json().catch(() => null)) as { detail?: string } | null
  return new Error(body?.detail ?? `The plate reader answered ${response.status}.`)
}

export const anprService = {
  async health(): Promise<AnprHealthDTO> {
    if (!ANPR_SERVICE_URL) throw new Error('The plate reader is turned off.')
    const response = await fetch(`${ANPR_SERVICE_URL}/health`)
    if (!response.ok) throw await failure(response)
    return (await response.json()) as AnprHealthDTO
  },

  /** Reads the plates in one camera frame. */
  async read(frame: Blob, signal?: AbortSignal): Promise<AnprReadDTO> {
    if (!ANPR_SERVICE_URL) throw new Error('The plate reader is turned off.')
    const response = await fetch(`${ANPR_SERVICE_URL}/read`, { method: 'POST', headers: { 'Content-Type': frame.type || 'image/jpeg' }, body: frame, signal })
    if (!response.ok) throw await failure(response)
    return (await response.json()) as AnprReadDTO
  },
}
