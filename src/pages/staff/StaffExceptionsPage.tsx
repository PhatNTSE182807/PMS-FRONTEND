import { useEffect, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { FileWarning, IdCard } from 'lucide-react'
import { ApiError, getErrorMessage } from '@/api/apiError'
import { Panel, SectionTitle } from '@/components/features/staff/StaffBits'
import { STAFF_TOAST } from '@/components/features/staff/staffToasts'
import { Button } from '@/components/ui/button'
import { FieldError, Input, Label } from '@/components/ui/form-controls'
import { BookedVehicleError } from '@/hooks/useGate'
import { gateService } from '@/api/gate.service'
import { LostTicketPapersDialog, type LostTicketVehicle } from '@/components/features/staff/LostTicketPapersDialog'
import { LostTicketReviews } from '@/components/features/staff/LostTicketReviews'
import { BookedBayCases } from '@/components/features/staff/BookedBayCases'
import { useMyStaffLots } from '@/hooks/useParking'

/**
 * Lost ticket desk: find a walk-in still inside by its plate, then upload the driver's papers (the same popup as
 * Lost ticket on the gate dashboard). Booked vehicles are refused: they have no paper ticket.
 */
function LostTicketDesk() {
  const myLots = useMyStaffLots()
  const lotId = myLots.data?.[0]?.id
  const [plate, setPlate] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [searching, setSearching] = useState(false)
  const [vehicle, setVehicle] = useState<LostTicketVehicle | null>(null)
  const noLot = myLots.isSuccess && !lotId

  const find = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!plate.trim()) return setError('Enter the licence plate of the vehicle.')
    if (!lotId) return
    setError(undefined)
    setSearching(true)
    try {
      const session = await gateService.lookup(lotId, { plate: plate.trim() })
      if (session.sessionType === 'Reservation') return setError(new BookedVehicleError().message)
      if (session.status === 'LostTicketPending') return setError('This vehicle already has a lost ticket waiting for a decision.')
      setVehicle({ sessionId: session.id, plate: session.plateNumber, vehicleTypeName: session.vehicleTypeName, code: session.code })
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setError(STAFF_TOAST.vehicleNotFound)
      else toast.error(getErrorMessage(e))
    } finally {
      setSearching(false)
    }
  }

  return (
    <Panel>
      <SectionTitle icon={<FileWarning className="size-5 text-amber-500" aria-hidden />}>Lost ticket desk</SectionTitle>
      <p className="mt-1 text-sm text-slate-700">
        Walk-in vehicles only: find the vehicle still inside by its plate, photograph the driver&apos;s Citizen ID and registration certificate,
        then check them. A booked vehicle has no paper ticket and is refused.
      </p>
      <form noValidate onSubmit={find} className="mt-4 flex flex-wrap items-start gap-3">
        <div className="w-60 space-y-1.5">
          <Label htmlFor="lost-plate">Licence plate</Label>
          <Input
            id="lost-plate"
            value={plate}
            placeholder="51K-889.24"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'lost-plate-error' : undefined}
            onChange={(e) => {
              setPlate(e.target.value.toUpperCase())
              setError(undefined)
            }}
            className="font-mono font-bold tracking-wider"
          />
        </div>
        <Button type="submit" variant="gold" className="h-9 sm:mt-6" disabled={searching || !lotId}>
          <IdCard /> {searching ? 'Finding…' : 'Find vehicle and upload papers'}
        </Button>
        <div id="lost-plate-error" className="basis-full">
          <FieldError message={error} />
        </div>
      </form>
      {noLot && <p className="mt-3 text-sm font-medium text-rose-600">You are not assigned to a parking lot yet.</p>}
      <LostTicketPapersDialog vehicle={vehicle} onClose={() => setVehicle(null)} />
    </Panel>
  )
}

/** Booked bays a walk-in took in the Staff's lot. */
function BookedBayCaseArea() {
  const myLots = useMyStaffLots()
  return <BookedBayCases lotId={myLots.data?.[0]?.id} />
}

/** The papers check, opened on the vehicle that was just uploaded (router state, never the URL). */
function LostTicketReviewArea() {
  const myLots = useMyStaffLots()
  const selected = (useLocation().state as { lostTicketReview?: number } | null)?.lostTicketReview
  useEffect(() => {
    if (selected) document.getElementById('lost-ticket-review')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selected])
  return <LostTicketReviews lotId={myLots.data?.[0]?.id} selectedSessionId={selected} />
}

export default function StaffExceptionsPage() {
  return (
    <div className="space-y-6">
      <BookedBayCaseArea />
      <LostTicketReviewArea />
      <LostTicketDesk />
    </div>
  )
}
