import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/api/queryKeys'
import { vehicleVerificationService } from '@/api/vehicleVerification.service'
import { vehicleVerificationRealtime } from '@/api/vehicleVerificationRealtime'
import type { ReviewVehicleVerificationRequest, VehicleDocumentFileDTO, VerificationStatus } from '@/types/vehicleDocument.dto'

/**
 * Refreshes the review queue and the open check whenever the hub reports a change. Reviewers join
 * the hub's reviewer group on connect, so they receive every check's "VerificationChanged".
 * Returns whether pushes are available (mock and demo sessions have no hub and poll instead).
 */
function useReviewRealtime() {
  const queryClient = useQueryClient()
  const live = vehicleVerificationRealtime.isAvailable()

  useEffect(() => {
    if (!live) return
    return vehicleVerificationRealtime.subscribe((event) => {
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.vehicleVerifications.all, 'queue'] })
      void queryClient.invalidateQueries({ queryKey: queryKeys.vehicleVerifications.detail(event.verificationId) })
    })
  }, [live, queryClient])

  return live
}

/** Checks with `status`, oldest first. Live through SignalR; polled every 10 s without a hub. */
export function useVerificationQueue(status: VerificationStatus) {
  const live = useReviewRealtime()
  return useQuery({
    queryKey: queryKeys.vehicleVerifications.queue(status),
    queryFn: () => vehicleVerificationService.getQueue(status),
    refetchInterval: live ? false : 10_000,
  })
}

/** One check with its OCR fields, photos and the account and vehicle data it was compared against. */
export function useVerificationDetail(verificationId: string | null) {
  return useQuery({
    queryKey: queryKeys.vehicleVerifications.detail(verificationId ?? ''),
    queryFn: () => vehicleVerificationService.get(verificationId!),
    enabled: Boolean(verificationId),
  })
}

/** Approves or rejects a check, then refreshes every queue tab and the check itself. */
export function useReviewVerification() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ verificationId, request }: { verificationId: string; request: ReviewVehicleVerificationRequest }) =>
      vehicleVerificationService.review(verificationId, request),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.vehicleVerifications.detail(updated.verificationId), updated)
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.vehicleVerifications.all, 'queue'] })
    },
  })
}

/**
 * Object URL of one uploaded photo, fetched with the bearer token. The URL is released when the
 * photo changes or the component unmounts. Null while loading, for deleted files and on errors.
 */
export function useVerificationPhoto(verificationId: string, document: VehicleDocumentFileDTO) {
  const query = useQuery({
    queryKey: queryKeys.vehicleVerifications.file(verificationId, document.documentId),
    queryFn: () => vehicleVerificationService.getFile(verificationId, document.documentId),
    enabled: document.isAvailable,
    // An uploaded file never changes; a replaced side gets a new document id
    staleTime: Infinity,
    gcTime: 5 * 60_000,
  })
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!query.data) return
    const objectUrl = URL.createObjectURL(query.data)
    setUrl(objectUrl)
    return () => {
      URL.revokeObjectURL(objectUrl)
      setUrl(null)
    }
  }, [query.data])

  return { url, blob: query.data ?? null, isLoading: query.isLoading, isError: query.isError }
}
