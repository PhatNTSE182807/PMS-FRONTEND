import { useState } from 'react'
import { toast } from 'sonner'
import { CircleCheck, CircleX, ClipboardCheck, Clock, FileText, ImageOff, Inbox, ScanText, ShieldCheck, TriangleAlert, UserRound } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { Panel, Plate, SectionTitle } from '@/components/features/staff/StaffBits'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState, Spinner } from '@/components/ui/states'
import { useNow } from '@/hooks/useNow'
import {
  useReviewVerification,
  useVerificationDetail,
  useVerificationPhoto,
  useVerificationQueue,
} from '@/hooks/useVehicleVerificationReview'
import { cn } from '@/lib/utils'
import {
  documentLabel,
  isApproved,
  isWaitingForStaff,
  type VehicleDocumentFileDTO,
  type VehicleVerificationReviewDTO,
  type VerificationStatus,
} from '@/types/vehicleDocument.dto'

/** Queue tabs: the work list first, then recent decisions for reference. */
const TABS: { status: VerificationStatus; label: string }[] = [
  { status: 'NeedsReview', label: 'Pending' },
  { status: 'Approved', label: 'Approved' },
  { status: 'Rejected', label: 'Rejected' },
]

const stamp = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

/** "12 min ago"-style age of a submission, so the oldest waiting registrations stand out. */
function age(iso: string | null | undefined, now: number): string {
  if (!iso) return '—'
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000))
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  return hours < 24 ? `${hours} h ${minutes % 60} min ago` : stamp.format(new Date(iso))
}

/** "1990-02-14" → "14/02/1990", the way it is printed on the Citizen ID card. */
const cardDate = (date: string | null | undefined) => (date ? date.split('-').reverse().join('/') : null)

/** The vehicle is registered to someone else than the account holder (a family car, a company car...). */
const ownedBySomeoneElse = (item: VehicleVerificationReviewDTO) =>
  Boolean(item.ownerCitizenId && item.customerCitizenId && item.ownerCitizenId !== item.customerCitizenId)

function QueueItem({
  item,
  selected,
  now,
  onSelect,
}: {
  item: VehicleVerificationReviewDTO
  selected: boolean
  now: number
  onSelect: () => void
}) {
  const waiting = isWaitingForStaff(item.status)
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'w-full rounded-2xl bg-white p-4 text-left ring-1 transition-colors',
        selected ? 'ring-2 ring-indigo-300' : 'ring-slate-200 hover:bg-slate-50',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Plate>{item.licensePlate ?? 'No plate'}</Plate>
        <span className="flex items-center gap-1 text-xs text-slate-700">
          <Clock className="size-3.5" aria-hidden /> {age(waiting ? (item.submittedAt ?? item.createdAt) : item.decidedAt, now)}
        </span>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-slate-950">
        <UserRound className="size-4 text-slate-700" aria-hidden /> {item.customerName ?? 'Unknown customer'}
      </p>
      <p className="mt-0.5 text-xs text-slate-700">
        {[item.vehicleType, item.brand, item.model].filter(Boolean).join(' · ') || 'Vehicle details unavailable'}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-bold uppercase">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">{item.documents.length} files</span>
        {ownedBySomeoneElse(item) && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">Other owner</span>}
      </div>
    </button>
  )
}

/** One uploaded paper, previewed inline; click opens the full-size file in a new tab. */
function PhotoTile({ verificationId, document }: { verificationId: string; document: VehicleDocumentFileDTO }) {
  const photo = useVerificationPhoto(verificationId, document)
  const isImage = document.contentType.startsWith('image/')
  const label = documentLabel(document.documentType, document.side)

  return (
    <figure className="overflow-hidden rounded-xl bg-[#060f16] ring-1 ring-slate-200">
      <a
        href={photo.url ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open ${label} full size`}
        className={cn('flex aspect-[3/2] items-center justify-center', !photo.url && 'pointer-events-none')}
      >
        {!document.isAvailable ? (
          <span className="flex flex-col items-center gap-1 text-xs text-slate-700">
            <ImageOff className="size-6" aria-hidden /> Deleted 30 days after the decision
          </span>
        ) : photo.isError ? (
          <span className="flex flex-col items-center gap-1 text-xs text-rose-700">
            <ImageOff className="size-6" aria-hidden /> Could not load
          </span>
        ) : !photo.url ? (
          <Spinner />
        ) : isImage ? (
          <img src={photo.url} alt={label} className="size-full object-contain" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs text-slate-800">
            <FileText className="size-8" aria-hidden /> PDF · open
          </span>
        )}
      </a>
      <figcaption className="flex justify-between gap-2 px-3 py-2 text-xs font-semibold text-slate-800">
        <span>{label}</span>
        <span className="truncate text-slate-700" title={document.fileName ?? undefined}>
          {document.fileName}
        </span>
      </figcaption>
    </figure>
  )
}

/** What the customer typed and what the account holds: Staff compare each line with the papers. */
function CompareList({ item }: { item: VehicleVerificationReviewDTO }) {
  const otherOwner = ownedBySomeoneElse(item)
  const groups: { title: string; rows: [string, string | null | undefined, boolean?][] }[] = [
    {
      title: 'Registration certificate',
      rows: [
        ['Plate number', item.licensePlate],
        ['Brand / model', [item.brand, item.model].filter(Boolean).join(' ')],
        ['Colour', item.color],
        ['Vehicle type', item.vehicleType],
        ['Owner Citizen ID', item.ownerCitizenId, otherOwner],
      ],
    },
    {
      title: 'Citizen ID card',
      rows: [
        ['Full name', item.customerName],
        ['Citizen ID number', item.customerCitizenId],
        ['Date of birth', cardDate(item.customerDateOfBirth)],
      ],
    },
  ]

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="mb-1 text-xs font-bold tracking-wider text-slate-700 uppercase">{group.title}</p>
          <dl className="text-sm">
            {group.rows.map(([label, value, flag]) => (
              <div key={label} className="flex justify-between gap-3 border-b border-slate-200 py-1.5">
                <dt className="text-slate-700">{label}</dt>
                <dd className={cn('text-right font-semibold text-slate-950', flag && 'text-amber-500')}>{value || '—'}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
      {otherOwner && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          The vehicle is registered to another person. Check that the owner on the certificate matches the owner Citizen ID above.
        </p>
      )}
    </div>
  )
}

/** Approve / reject the registration, with the note shown to the customer (required to reject, FR-VER-04). */
function Decision({ item }: { item: VehicleVerificationReviewDTO }) {
  const [note, setNote] = useState('')
  const review = useReviewVerification()

  const decide = (approve: boolean) => {
    review.mutate(
      { verificationId: item.verificationId, request: { approve, note: note.trim() || null } },
      {
        onSuccess: () => {
          toast.success(`${item.licensePlate ?? 'Vehicle'} ${approve ? 'approved' : 'rejected'}.`)
          setNote('')
        },
        onError: (error) => toast.error(getErrorMessage(error, 'Could not save the decision.')),
      },
    )
  }

  if (!isWaitingForStaff(item.status)) {
    return (
      <p className="flex items-start gap-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-800">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-indigo-700" aria-hidden />
        <span>
          {isApproved(item.status) ? 'Approved' : 'Rejected'} {item.decidedAt ? stamp.format(new Date(item.decidedAt)) : ''}
          {item.reviewNote ? ` — “${item.reviewNote}”` : ''}
        </span>
      </p>
    )
  }

  const noteMissing = note.trim().length === 0
  return (
    <div className="space-y-3">
      <label htmlFor="review-note" className="text-xs font-bold tracking-wider text-slate-700 uppercase">
        Note to the customer <span className="normal-case">(required to reject)</span>
      </label>
      <textarea
        id="review-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        rows={3}
        placeholder="e.g. The plate on the registration certificate is 51H-123.45; please register the vehicle again with that plate."
        className="w-full rounded-lg bg-[#060f16] px-3 py-2 text-sm text-slate-950 ring-1 ring-slate-200 placeholder:text-slate-600 focus-visible:ring-indigo-400 focus-visible:outline-none"
        disabled={review.isPending}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="destructive"
          disabled={review.isPending || noteMissing}
          title={noteMissing ? 'Write a note for the customer before rejecting' : undefined}
          onClick={() => decide(false)}
        >
          <CircleX /> Reject
        </Button>
        <Button variant="success" disabled={review.isPending} onClick={() => decide(true)}>
          <CircleCheck /> Approve vehicle
        </Button>
      </div>
    </div>
  )
}

function Detail({ verificationId }: { verificationId: string }) {
  const { data: item, isLoading, isError, error, refetch } = useVerificationDetail(verificationId)

  if (isLoading) return <Skeleton className="h-[640px] rounded-2xl" />
  if (isError || !item)
    return (
      <Panel>
        <ErrorState message={getErrorMessage(error, 'Could not load this registration.')} onRetry={() => void refetch()} />
      </Panel>
    )

  return (
    <div className="space-y-6">
      <Panel className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-3 font-display text-2xl font-bold text-slate-950">
            <Plate className="text-lg">{item.licensePlate ?? 'No plate'}</Plate>
            {item.customerName}
          </h1>
          <p className="mt-2 text-sm text-slate-700">
            Submitted {item.submittedAt ? stamp.format(new Date(item.submittedAt)) : '—'} • Registration {item.verificationId.slice(0, 8)}
          </p>
        </div>
      </Panel>

      <Panel>
        <SectionTitle icon={<FileText />}>Uploaded papers</SectionTitle>
        {item.documents.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {item.documents.map((d) => (
              <PhotoTile key={d.documentId} verificationId={item.verificationId} document={d} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-700">No files on this registration.</p>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
        <Panel>
          <SectionTitle icon={<ClipboardCheck />}>Compare with the papers</SectionTitle>
          <CompareList item={item} />
        </Panel>
        <Panel>
          <SectionTitle icon={<ShieldCheck />}>Decision</SectionTitle>
          <Decision key={item.verificationId} item={item} />
        </Panel>
      </div>
    </div>
  )
}

/**
 * Staff "Vehicle registrations": vehicles customers registered, waiting for a person to compare
 * the registration certificate and Citizen ID card with the form and the account (SRS FR-VER-03/04),
 * oldest first, then approve or reject. The queue refreshes through SignalR (or polling in demo mode).
 */
export default function StaffVehicleVerificationPage() {
  const [status, setStatus] = useState<VerificationStatus>('NeedsReview')
  const [picked, setPicked] = useState<string | null>(null)
  const queue = useVerificationQueue(status)
  const now = useNow(30_000)
  const items = queue.data ?? []
  // Keep the picked registration while it is in this tab; otherwise open the first one
  const selectedId = items.some((i) => i.verificationId === picked) ? picked : (items[0]?.verificationId ?? null)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-slate-50 px-4 py-3 text-xs font-semibold tracking-wider text-slate-700 uppercase">
        <span className="flex items-center gap-1.5 text-slate-950">
          <ScanText className="size-4 text-amber-500" aria-hidden /> Vehicle registrations
        </span>
        <span className="normal-case">Compare the registration certificate and Citizen ID card, then approve or reject the vehicle</span>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div role="tablist" aria-label="Registration status" className="grid grid-cols-3 gap-1 rounded-2xl bg-white p-1.5 ring-1 ring-slate-200">
            {TABS.map((tab) => (
              <button
                key={tab.status}
                type="button"
                role="tab"
                aria-selected={tab.status === status}
                onClick={() => {
                  setStatus(tab.status)
                  setPicked(null)
                }}
                className={cn(
                  'rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
                  tab.status === status ? 'bg-[#124e66] text-indigo-800' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950',
                )}
              >
                {tab.label}
                {tab.status === status && queue.data && <span className="ml-1.5 tabular-nums">({queue.data.length})</span>}
              </button>
            ))}
          </div>

          {queue.isLoading ? (
            Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
          ) : queue.isError ? (
            <Panel>
              <ErrorState message={getErrorMessage(queue.error, 'Could not load the registrations.')} onRetry={() => void queue.refetch()} />
            </Panel>
          ) : items.length === 0 ? (
            <Panel>
              <EmptyState
                icon={Inbox}
                title={status === 'NeedsReview' ? 'Queue clear' : 'Nothing here yet'}
                description={status === 'NeedsReview' ? 'No vehicle is waiting for review.' : 'No registrations with this status.'}
              />
            </Panel>
          ) : (
            items.map((item) => (
              <QueueItem
                key={item.verificationId}
                item={item}
                now={now}
                selected={item.verificationId === selectedId}
                onSelect={() => setPicked(item.verificationId)}
              />
            ))
          )}

          {status === 'NeedsReview' && items.length > 0 && <p className="px-1 text-xs text-slate-700">Oldest first.</p>}
        </aside>

        {selectedId ? (
          <Detail key={selectedId} verificationId={selectedId} />
        ) : (
          <Panel>
            <EmptyState icon={ShieldCheck} title="No registration selected" description="Pick a vehicle from the list to review its papers." />
          </Panel>
        )}
      </div>
    </div>
  )
}
