import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getErrorMessage } from '@/api/apiError'
import { queryKeys } from '@/api/queryKeys'
import { vehicleDocumentService } from '@/api/vehicleDocument.service'
import { vehicleVerificationRealtime } from '@/api/vehicleVerificationRealtime'
import {
  DOCUMENT_MAX_BYTES,
  DOCUMENT_SLOTS,
  type VehicleDocumentSide,
  type VehicleDocumentType,
  type VehicleVerificationDTO,
} from '@/types/vehicleDocument.dto'

const RUNNING = new Set(['Pending', 'Processing'])

/**
 * The vehicle's latest paper check. While OCR runs it refreshes on every SignalR push and, as a
 * fallback (and in demo mode, which has no hub), every 1.5 s.
 */
export function useVehicleVerification(vehicleId: string | null) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.vehicleDocuments.latest(vehicleId ?? ''),
    queryFn: () => vehicleDocumentService.getLatest(vehicleId!),
    enabled: Boolean(vehicleId),
    refetchInterval: (q) => (RUNNING.has(q.state.data?.status ?? '') ? 1500 : false),
  })

  useEffect(() => {
    if (!vehicleId || !vehicleVerificationRealtime.isAvailable()) return
    return vehicleVerificationRealtime.subscribe((event) => {
      if (event.vehicleId.toLowerCase() === vehicleId.toLowerCase())
        void queryClient.invalidateQueries({ queryKey: queryKeys.vehicleDocuments.latest(vehicleId) })
    })
  }, [vehicleId, queryClient])

  return query
}

export type SlotKey = `${VehicleDocumentType}/${VehicleDocumentSide}`
export const slotKey = (type: VehicleDocumentType, side: VehicleDocumentSide): SlotKey => `${type}/${side}`

export interface DocumentSlotState {
  file: File | null
  /** Object URL for image previews (null for PDFs). */
  previewUrl: string | null
  /** 0..100 while uploading. */
  progress: number | null
  uploaded: boolean
  error: string | null
}

const EMPTY_SLOT: DocumentSlotState = { file: null, previewUrl: null, progress: null, uploaded: false, error: null }
const ACCEPTED = ['image/jpeg', 'image/png', 'application/pdf']

/** Frees the preview URLs of every slot (latest state, read through the ref). */
function revokeAll(ref: { current: Record<SlotKey, DocumentSlotState> }) {
  Object.values(ref.current).forEach((s) => s.previewUrl && URL.revokeObjectURL(s.previewUrl))
}

const emptySlots = () =>
  Object.fromEntries(DOCUMENT_SLOTS.map((s) => [slotKey(s.type, s.side), EMPTY_SLOT])) as Record<SlotKey, DocumentSlotState>

/**
 * The four photos chosen on the page (cà vẹt front/back, CCCD front/back), kept in the browser until
 * `uploadAndVerify` sends them to a vehicle, shows each upload's progress and submits the check.
 */
export function useVehicleDocumentDraft() {
  const queryClient = useQueryClient()
  const [slots, setSlots] = useState(emptySlots)
  const [busy, setBusy] = useState(false)
  const slotsRef = useRef(slots)
  slotsRef.current = slots

  // Object URLs are released when a photo is replaced and when the page closes
  useEffect(() => () => revokeAll(slotsRef), [])

  const patch = useCallback((key: SlotKey, change: Partial<DocumentSlotState>) => {
    setSlots((current) => ({ ...current, [key]: { ...current[key], ...change } }))
  }, [])

  /** Validates the type and size like the API, so a wrong file is refused before any upload. */
  const choose = useCallback((key: SlotKey, file: File | null) => {
    setSlots((current) => {
      const previous = current[key]
      if (previous.previewUrl) URL.revokeObjectURL(previous.previewUrl)
      if (!file) return { ...current, [key]: EMPTY_SLOT }
      if (!ACCEPTED.includes(file.type))
        return { ...current, [key]: { ...EMPTY_SLOT, error: 'Only JPEG, PNG or PDF files are accepted.' } }
      if (file.size > DOCUMENT_MAX_BYTES)
        return { ...current, [key]: { ...EMPTY_SLOT, error: 'The file is larger than 10 MB.' } }
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null
      return { ...current, [key]: { ...EMPTY_SLOT, file, previewUrl } }
    })
  }, [])

  const reset = useCallback(() => {
    revokeAll(slotsRef)
    setSlots(emptySlots())
  }, [])

  const chosen = Object.values(slots).filter((s) => s.file).length
  const complete = chosen === DOCUMENT_SLOTS.length
  /** Chosen photos not sent yet (e.g. one side replaced after a rejection). */
  const hasNew = Object.values(slots).some((s) => s.file && !s.uploaded)

  /**
   * Uploads the chosen photos, then submits the check. Photos already sent are skipped only while
   * the server still holds them in an open draft; after a decision every side starts a new check.
   * Returns the check, or throws with a readable message.
   */
  const uploadAndVerify = useCallback(
    async (vehicleId: string): Promise<VehicleVerificationDTO> => {
      setBusy(true)
      try {
        const draftOpen = (await vehicleDocumentService.getLatest(vehicleId))?.status === 'Draft'
        for (const { type, side } of DOCUMENT_SLOTS) {
          const key = slotKey(type, side)
          const slot = slotsRef.current[key]
          if (!slot.file || (slot.uploaded && draftOpen)) continue
          patch(key, { progress: 0, error: null })
          try {
            await vehicleDocumentService.upload(vehicleId, type, side, slot.file, (p) => patch(key, { progress: p }))
            patch(key, { progress: null, uploaded: true })
          } catch (error) {
            const message = getErrorMessage(error, 'Upload failed.')
            patch(key, { progress: null, error: message })
            throw new Error(message)
          }
        }

        const latest = await vehicleDocumentService.submit(vehicleId)
        queryClient.setQueryData(queryKeys.vehicleDocuments.latest(vehicleId), latest)
        return latest
      } finally {
        setBusy(false)
      }
    },
    [patch, queryClient],
  )

  return { slots, choose, reset, chosen, complete, hasNew, busy, uploadAndVerify }
}

export type VehicleDocumentDraft = ReturnType<typeof useVehicleDocumentDraft>
