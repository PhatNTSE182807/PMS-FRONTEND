import { BayVehicleCard, BayVehicleNotice } from '@/components/customer/garage/BayVehicleCard'
import { formatStay, useStayMinutes, vndOrDash } from '@/components/customer/garage/bayVehicleFormat'
import type { Bay } from '@/components/customer/garage/garageModel'
import { getErrorMessage } from '@/api/apiError'
import { useState, type CSSProperties } from 'react'
import { toast } from 'sonner'
import { useBaySession } from '@/hooks/useGate'
import { useForceCheckOut } from '@/hooks/useGateRequests'
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
  const forceCheckOut = useForceCheckOut()
  const [confirming, setConfirming] = useState(false)

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
  // A walk-in still parked can be sent out from here; a lost ticket must be decided first
  const canForceCheckOut =
    session.sessionType === 'WalkIn' && !session.reservationCode && ['Active', 'PendingPayment', 'Paid'].includes(session.status)
  const owed = session.status === 'Paid' ? 0 : (data.amountDue ?? data.feeSoFar ?? 0)
  const sendOut = () =>
    forceCheckOut.mutate(session.id, {
      onSuccess: () => {
        toast.success(`${session.hasPlate ? session.plateNumber : 'The vehicle'} is waiting at the exit lane.`, {
          description: 'Open the barrier in the Check-out tab of the gate dashboard: the exit cameras show it leave.',
        })
        onClose()
      },
      onError: (e) => toast.error(getErrorMessage(e, 'Could not check this vehicle out.')),
    })
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
          {canForceCheckOut &&
            (confirming ? (
              <div style={styles.actions}>
                <p style={styles.confirm}>
                  {owed > 0 ? `Take ${vndOrDash(owed)} in cash` : 'Nothing is owed'} and send the vehicle to the exit lane?
                </p>
                <div style={styles.row}>
                  <button type="button" style={styles.secondary} disabled={forceCheckOut.isPending} onClick={() => setConfirming(false)}>
                    Back
                  </button>
                  <button type="button" style={styles.primary} disabled={forceCheckOut.isPending} onClick={sendOut}>
                    {forceCheckOut.isPending ? 'Checking out…' : 'Confirm'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={styles.actions}>
                <button type="button" style={styles.primary} onClick={() => setConfirming(true)}>
                  Force check-out
                </button>
              </div>
            ))}
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
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' },
  confirm: { margin: 0, color: 'var(--map-text)', fontSize: '0.78rem', lineHeight: 1.4 },
  primary: { ...button, width: '100%', border: 'none', background: 'var(--map-button-bg)', color: 'var(--map-button-text)' },
  secondary: { ...button, border: '1px solid var(--map-card-border)', background: 'transparent', color: 'var(--map-text)' },
} satisfies Record<string, CSSProperties>
