import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getErrorMessage } from '@/api/apiError'
import { queryKeys } from '@/api/queryKeys'
import { vehicleDocumentService } from '@/api/vehicleDocument.service'
import { vehicleVerificationRealtime } from '@/api/vehicleVerificationRealtime'
import {
  DOCUMENT_MAX_BYTES,
  DOCUMENT_SLOTS,
  isWaitingForStaff,
  type VehicleDocumentSide,
  type VehicleDocumentType,
  type VehicleVerificationDTO,
} from '@/types/vehicleDocument.dto'

/**
 * The vehicle's latest paper check. While it waits for Staff it refreshes on every SignalR push
 * (the vehicle list too, since it shows the registration status) and, without a hub (demo mode),
 * every 10 s.
 */
export function useVehicleVerification(vehicleId: string | null) {
  const queryClient = useQueryClient()
  const live = vehicleVerificationRealtime.isAvailable()
  const query = useQuery({
    queryKey: queryKeys.vehicleDocuments.latest(vehicleId ?? ''),
    queryFn: () => vehicleDocumentService.getLatest(vehicleId!),
    enabled: Boolean(vehicleId),
    refetchInterval: (q) => (!live && isWaitingForStaff(q.state.data?.status) ? 10_000 : false),
  })

  useEffect(() => {
    if (!vehicleId || !live) return
    return vehicleVerificationRealtime.subscribe((event) => {
      if (event.vehicleId.toLowerCase() !== vehicleId.toLowerCase()) return
      void queryClient.invalidateQueries({ queryKey: queryKeys.vehicleDocuments.latest(vehicleId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.vehicles() })
    })
  }, [vehicleId, live, queryClient])

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
 * The three photos chosen on the page (registration certificate front, Citizen ID front and back),
 * kept in the browser until `uploadAndSubmit` sends them to a vehicle, shows each upload's progress
 * and submits them to the Staff review queue.
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
   * Uploads the chosen photos, then submits them for Staff review. Photos already sent are skipped
   * only while the server still holds them in an open draft; after a rejection every photo starts a
   * new check. Returns the check, or throws with a readable message.
   */
  const uploadAndSubmit = useCallback(
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
        // The vehicle list shows the new "waiting for Staff" status
        void queryClient.invalidateQueries({ queryKey: queryKeys.profile.vehicles() })
        return latest
      } finally {
        setBusy(false)
      }
    },
    [patch, queryClient],
  )

  return { slots, choose, reset, chosen, complete, hasNew, busy, uploadAndSubmit }
}

export type VehicleDocumentDraft = ReturnType<typeof useVehicleDocumentDraft>
