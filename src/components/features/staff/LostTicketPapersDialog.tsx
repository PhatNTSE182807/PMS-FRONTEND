import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { FileImage, IdCard, Upload } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { gateService } from '@/api/gate.service'
import { queryKeys } from '@/api/queryKeys'
import { Plate } from '@/components/features/staff/StaffBits'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FieldError, Input, Label } from '@/components/ui/form-controls'
import { cn } from '@/lib/utils'

/** Same limit as the API. */
const MAX_BYTES = 8 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,application/pdf'

/** The vehicle the driver lost the ticket of. */
export interface LostTicketVehicle {
  sessionId: number
  plate: string
  vehicleTypeName?: string | null
  code?: string
}

/** One photo picker with a preview (images) or the file name (PDF). */
function PaperPicker({
  id,
  label,
  hint,
  file,
  onChange,
  onPicked,
}: {
  id: string
  label: string
  hint: string
  file: File | null
  onChange: (file: File | null) => void
  /** Clears the form error once a file is picked. */
  onPicked: () => void
}) {
  const [preview, setPreview] = useState<string | null>(null)
  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <label
        htmlFor={id}
        className={cn(
          'flex h-40 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed text-center text-sm transition-colors',
          file ? 'border-indigo-300 bg-slate-50' : 'border-slate-300 bg-white hover:bg-slate-50',
        )}
      >
        {preview ? (
          <img src={preview} alt={label} className="size-full object-contain" />
        ) : file ? (
          <span className="flex flex-col items-center gap-1 px-3 text-slate-950">
            <FileImage className="size-6 text-indigo-700" aria-hidden /> {file.name}
          </span>
        ) : (
          <span className="flex flex-col items-center gap-1 px-3 text-slate-600">
            <Upload className="size-6" aria-hidden /> {hint}
          </span>
        )}
      </label>
      <input
        id={id}
        type="file"
        accept={ACCEPT}
        // Phones open the camera straight away
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          onChange(e.target.files?.[0] ?? null)
          onPicked()
        }}
      />
    </div>
  )
}

/**
 * Lost ticket, step 1: photograph the driver's Citizen ID and the vehicle registration certificate. Once both are
 * uploaded the case waits for the Staff's check on the Exceptions screen (step 2: approve or refuse).
 */
export function LostTicketPapersDialog({ vehicle, onClose }: { vehicle: LostTicketVehicle | null; onClose: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [citizenId, setCitizenId] = useState<File | null>(null)
  const [registration, setRegistration] = useState<File | null>(null)
  const [reason, setReason] = useState('Driver lost the paper ticket')
  const [error, setError] = useState<string | null>(null)

  // A new vehicle starts with an empty form
  useEffect(() => {
    setCitizenId(null)
    setRegistration(null)
    setReason('Driver lost the paper ticket')
    setError(null)
  }, [vehicle?.sessionId])

  const upload = useMutation({
    mutationFn: () => gateService.reportLostTicketWithPapers(vehicle!.sessionId, reason.trim(), citizenId!, registration!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gate.all })
      void queryClient.invalidateQueries({ queryKey: ['lost-ticket-reviews'] })
      toast.success('Papers uploaded: compare them with the vehicle and decide.')
      navigate('/staff/exceptions', {
        state: { lostTicketReview: vehicle!.sessionId },
      })
      onClose()
    },
    onError: (e) => setError(getErrorMessage(e, 'Could not upload the papers.')),
  })

  const submit = () => {
    if (!citizenId || !registration) return setError('Upload both the Citizen ID and the vehicle registration certificate.')
    if ([citizenId, registration].some((f) => f.size > MAX_BYTES)) return setError('Each file must be 8 MB or smaller.')
    if (!reason.trim()) return setError('Say why the ticket is reported as lost.')
    setError(null)
    upload.mutate()
  }

  return (
    <Dialog open={vehicle !== null} onOpenChange={(open) => !open && !upload.isPending && onClose()}>
      <DialogContent className="max-w-2xl">
        {vehicle && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <IdCard className="size-5 text-amber-500" aria-hidden /> Lost ticket: driver&apos;s papers
              </DialogTitle>
              <DialogDescription>
                <span className="mr-2 align-middle">
                  <Plate>{vehicle.plate || 'NO PLATE'}</Plate>
                </span>
                {[vehicle.vehicleTypeName, vehicle.code].filter(Boolean).join(' • ')}. Photograph both papers; you compare them with the
                vehicle on the next screen.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <PaperPicker
                id="lost-citizen-id"
                label="Citizen ID (CCCD)"
                hint="Front of the driver's Citizen ID"
                file={citizenId}
                onChange={setCitizenId}
                onPicked={() => setError(null)}
              />
              <PaperPicker
                id="lost-registration"
                label="Vehicle registration certificate"
                hint="The certificate of this vehicle"
                file={registration}
                onChange={setRegistration}
                onPicked={() => setError(null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lost-papers-reason">Reason</Label>
              <Input id="lost-papers-reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
            </div>
            {error && <FieldError message={error} />}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={onClose} disabled={upload.isPending}>
                Cancel
              </Button>
              <Button variant="gold" onClick={submit} disabled={upload.isPending}>
                <Upload /> {upload.isPending ? 'Uploading…' : 'Upload and check the papers'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
