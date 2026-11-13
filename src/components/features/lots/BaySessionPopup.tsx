import { BayVehicleCard, BayVehicleNotice } from '@/components/customer/garage/BayVehicleCard'
import { formatStay, useStayMinutes, vndOrDash } from '@/components/customer/garage/bayVehicleFormat'
import type { Bay } from '@/components/customer/garage/garageModel'
import { getErrorMessage } from '@/api/apiError'
import { type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useBaySession } from '@/hooks/useGate'
import { formatDate, formatTime } from '@/lib/format'

const TITLE = 'Vehicle in bay'

const STATUS_TEXT: Record<string, string> = {
  PendingEntry: 'At the entry barrier',
  Active: 'Parked',
  LostTicketPending: 'Lost ticket, waiting for a decision',
  PendingPayment: 'Paying now',
  Paid: 'Paid, on the way out',
}

/**
 * Popup over the live 3D model for Staff, Managers and Admins: who parked in the bay (customer account or
 * guest), the plate, how long it has been there and the fee so far. The API checks the role and the lot.
 */
export function BaySessionPopup({ lotId, bay, onClose }: { lotId: string; bay: Bay; onClose: () => void }) {
  // A counted walk-in has no bay of its own (it is only drawn here): its session is opened by id instead
  const walkInSession = bay.countedWalkIn ? (bay.walkInSessionId ?? null) : null
  const query = useBaySession(lotId, bay.countedWalkIn ? null : bay.id, walkInSession)
  const data = query.data
  const stay = useStayMinutes(data?.session.entryTime)
  const navigate = useNavigate()
  const { user } = useAuth()

  if (bay.countedWalkIn && walkInSession == null)
    return (
      <BayVehicleNotice
        bayCode={bay.code}
        title={TITLE}
        message="The zone counter counts one more vehicle here than the lot has open sessions for, so there are no details to show. An inventory check corrects the counter."
        onClose={onClose}
      />
    )
  if (query.isPending) return <BayVehicleNotice bayCode={bay.code} title={TITLE} message="Loading the vehicle…" onClose={onClose} />
  if (query.isError)
    return (
      <BayVehicleNotice
        bayCode={bay.code}
        title={TITLE}
        // The API says why: an empty bay ("No vehicle is parked in this bay."), no access to the lot, or a failure
        message={getErrorMessage(query.error, 'Could not load the vehicle in this bay.')}
        onClose={onClose}
      />
    )
  if (!data) return null

  const { session } = data
  const member = data.customerType === 'Member'
  // Only Staff can force a check-out from here, for a vehicle that still has to pay (a lost ticket must be decided
  // first, a paid one already waits at the exit lane); Managers and Admins only look (user request, 2026-11-09)
  const canForceCheckOut = user?.role === 'STAFF' && ['Active', 'PendingPayment'].includes(session.status)
  // Nothing is charged here: the POS opens with this session loaded and takes the fee the normal way
  // (fee quote, deposit, payment method), then the vehicle leaves through the Check-out lane like any other
  const openPos = () => {
    onClose()
    navigate(`/staff/checkout?session=${session.id}`, { state: { plate: session.hasPlate ? session.plateNumber : '' } })
  }
  return (
    <BayVehicleCard
      bayCode={bay.code}
      title={TITLE}
      badge={{ text: member ? `Member${data.customerName ? ` · ${data.customerName}` : ''}` : 'Guest (walk-in)', tone: member ? 'member' : 'guest' }}
      rows={[
        { label: 'Plate', value: session.hasPlate ? session.plateNumber : 'No plate' },
        { label: 'Vehicle', value: session.vehicleTypeName ?? '—' },
        { label: 'Status', value: STATUS_TEXT[session.status] ?? session.status },
        { label: 'Entered', value: `${formatTime(session.entryTime)} · ${formatDate(session.entryTime)}` },
        { label: 'Parked for', value: formatStay(stay ?? data.elapsedMinutes) },
        { label: 'Fee so far', value: data.feeSoFar == null ? 'Not priced yet' : vndOrDash(data.feeSoFar), emphasis: data.feeSoFar != null },
        ...(data.depositApplied > 0 ? [{ label: 'Deposit', value: `− ${vndOrDash(data.depositApplied)}` }] : []),
        ...(data.alreadyPaid > 0 ? [{ label: 'Already paid', value: `− ${vndOrDash(data.alreadyPaid)}` }] : []),
        ...(data.amountDue != null ? [{ label: 'Due now', value: vndOrDash(data.amountDue) }] : []),
      ]}
      footer={
        <>
          {`Session ${session.code}${session.reservationCode ? ` · booking ${session.reservationCode}` : ''}.${
            walkInSession != null ? ' A walk-in without a bay of its own: the model draws it in a free bay of its zone.' : ''
          } The fee refreshes every 30 seconds.`}
          {canForceCheckOut && (
            <div style={styles.actions}>
              <button type="button" style={styles.primary} onClick={openPos}>
                Force check-out
              </button>
            </div>
          )}
        </>
      }
      onClose={onClose}
    />
  )
}

const button: CSSProperties = {
  padding: '0.45rem 0.6rem',
  borderRadius: '0.45rem',
  fontWeight: 700,
  fontSize: '0.78rem',
  cursor: 'pointer',
}

const styles = {
  actions: { marginTop: '0.6rem', display: 'grid', gap: '0.45rem' },
  primary: { ...button, width: '100%', border: 'none', background: 'var(--map-button-bg)', color: 'var(--map-button-text)' },
} satisfies Record<string, CSSProperties>
