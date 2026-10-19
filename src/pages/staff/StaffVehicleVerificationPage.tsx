import { useState } from 'react'
import { toast } from 'sonner'
import { CircleCheck, CircleX, Clock, FileText, ImageOff, Inbox, ScanText, ShieldCheck, UserRound } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { vehicleVerificationService } from '@/api/vehicleVerification.service'
import { VerificationResult } from '@/components/customer/VehicleDocumentsPanel'
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
import type {
  VehicleDocumentFileDTO,
  VehicleVerificationReviewDTO,
  VerificationFieldDTO,
  VerificationStatus,
} from '@/types/vehicleDocument.dto'
import '@/styles/vehicle-documents.css'

/** Queue tabs: the work list first, then recent decisions for reference. */
const TABS: { status: VerificationStatus; label: string }[] = [
  { status: 'NeedsReview', label: 'Needs review' },
  { status: 'Approved', label: 'Approved' },
  { status: 'Rejected', label: 'Rejected' },
  { status: 'AutoVerified', label: 'Auto-verified' },
]

const PAPER_LABEL = { RegistrationCertificate: 'Cà vẹt', CitizenId: 'CCCD' } as const

const stamp = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

/** "12 min ago"-style age of a submission, so the oldest waiting checks stand out. */
function age(iso: string | null | undefined, now: number): string {
  if (!iso) return '—'
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000))
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  return hours < 24 ? `${hours} h ${minutes % 60} min ago` : stamp.format(new Date(iso))
}

/** Short summary of what needs a human look: the labels of the fields that did not match cleanly. */
function problems(fields: VerificationFieldDTO[]): string {
  const flagged = fields.filter((f) => f.result !== 'Match')
  return flagged.length ? flagged.map((f) => f.label).join(', ') : 'Low confidence'
}

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
  const mismatches = item.fields.filter((f) => f.result === 'Mismatch').length
  const unreadable = item.fields.filter((f) => f.result === 'Unreadable').length
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
          <Clock className="size-3.5" aria-hidden /> {age(item.submittedAt ?? item.createdAt, now)}
        </span>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-slate-950">
        <UserRound className="size-4 text-slate-700" aria-hidden /> {item.customerName ?? 'Unknown customer'}
      </p>
      <p className="mt-0.5 text-xs text-slate-700">
        {[item.vehicleType, item.brand, item.model].filter(Boolean).join(' · ') || 'Vehicle details unavailable'}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-bold uppercase">
        {mismatches > 0 && <span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-700">{mismatches} mismatch</span>}
        {unreadable > 0 && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">{unreadable} unreadable</span>}
        {item.status === 'NeedsReview' && mismatches + unreadable === 0 && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">Low confidence</span>
        )}
      </div>
    </button>
  )
}

/** One uploaded side, previewed inline; click opens the full-size file in a new tab. */
function PhotoTile({ verificationId, document }: { verificationId: string; document: VehicleDocumentFileDTO }) {
  const photo = useVerificationPhoto(verificationId, document)
  const isImage = document.contentType.startsWith('image/')
  const label = `${PAPER_LABEL[document.documentType]} · ${document.side === 'Front' ? 'Front' : 'Back'}`

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
            <ImageOff className="size-6" aria-hidden /> Deleted after the decision
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

/** The account and vehicle form data the papers were compared with. */
function Record({ item }: { item: VehicleVerificationReviewDTO }) {
  const ownerDiffers = Boolean(item.ownerCitizenId && item.customerCitizenId && item.ownerCitizenId !== item.customerCitizenId)
  const rows: [string, string | null | undefined, boolean?][] = [
    ['Customer', item.customerName],
    ['Customer CCCD', item.customerCitizenId],
    ['Owner CCCD (vehicle form)', item.ownerCitizenId, ownerDiffers],
    ['Vehicle type', item.vehicleType],
    ['Brand / model', [item.brand, item.model].filter(Boolean).join(' ')],
    ['Colour', item.color],
  ]
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {rows.map(([label, value, flag]) => (
        <div key={label} className="flex justify-between gap-3 border-b border-slate-200 py-1.5">
          <dt className="text-slate-700">{label}</dt>
          <dd className={cn('text-right font-semibold text-slate-950', flag && 'text-amber-500')} title={flag ? 'The vehicle is registered to another person' : undefined}>
            {value || '—'}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** Approve / reject with the note shown to the customer (required to reject, FR-VER-04). */
function Decision({ item }: { item: VehicleVerificationReviewDTO }) {
  const [note, setNote] = useState('')
  const review = useReviewVerification()
  const open = item.status === 'NeedsReview'

  const decide = (approve: boolean) => {
    review.mutate(
      { verificationId: item.verificationId, request: { approve, note: note.trim() || null } },
      {
        onSuccess: () => {
          toast.success(`${item.licensePlate ?? 'Vehicle'}: papers ${approve ? 'approved' : 'rejected'}.`)
          setNote('')
        },
        onError: (error) => toast.error(getErrorMessage(error, 'Could not save the decision.')),
      },
    )
  }

  if (!open) {
    return (
      <p className="flex items-start gap-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-800">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-indigo-700" aria-hidden />
        <span>
          Decided {item.decidedAt ? stamp.format(new Date(item.decidedAt)) : ''}: <strong>{item.status}</strong>
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
        placeholder="e.g. The plate on the registration certificate is 51H-123.45; please correct the vehicle form."
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
          <CircleX /> Reject papers
        </Button>
        <Button variant="success" disabled={review.isPending} onClick={() => decide(true)}>
          <CircleCheck /> Approve papers
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
        <ErrorState message={getErrorMessage(error, 'Could not load this check.')} onRetry={() => void refetch()} />
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
            Submitted {item.submittedAt ? stamp.format(new Date(item.submittedAt)) : '—'} • Read{' '}
            {item.processedAt ? stamp.format(new Date(item.processedAt)) : '—'} • Check {item.verificationId.slice(0, 8)}
          </p>
        </div>
      </Panel>

      <Panel>
        <SectionTitle icon={<FileText />}>Uploaded papers</SectionTitle>
        {item.documents.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            {item.documents.map((d) => (
              <PhotoTile key={d.documentId} verificationId={item.verificationId} document={d} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-700">No files on this check.</p>
        )}
      </Panel>

      <Panel>
        <SectionTitle icon={<ScanText />}>OCR comparison</SectionTitle>
        <div className="vd-scope">
          <VerificationResult
            verification={item}
            loadFile={(documentId) => vehicleVerificationService.getFile(item.verificationId, documentId)}
          />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
        <Panel>
          <SectionTitle icon={<UserRound />}>Compared against</SectionTitle>
          <Record item={item} />
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
 * Staff "Xác minh phương tiện" (vehicle verification): paper checks OCR could not verify on its own
 * (SRS FR-VER-03/04), oldest first, each with the uploaded photos, the per-field OCR result and an
 * Approve / Reject decision. The queue refreshes through SignalR (or polling in demo mode).
 */
export default function StaffVehicleVerificationPage() {
  const [status, setStatus] = useState<VerificationStatus>('NeedsReview')
  const [picked, setPicked] = useState<string | null>(null)
  const queue = useVerificationQueue(status)
  const now = useNow(30_000)
  const items = queue.data ?? []
  // Keep the picked check while it is in this tab; otherwise open the oldest one
  const selectedId = items.some((i) => i.verificationId === picked) ? picked : (items[0]?.verificationId ?? null)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-slate-50 px-4 py-3 text-xs font-semibold tracking-wider text-slate-700 uppercase">
        <span className="flex items-center gap-1.5 text-slate-950">
          <ScanText className="size-4 text-amber-500" aria-hidden /> Vehicle verification · Xác minh phương tiện
        </span>
        <span className="normal-case">Registration certificate (cà vẹt) and Citizen ID (CCCD) checks that OCR could not verify</span>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div role="tablist" aria-label="Check status" className="grid grid-cols-2 gap-1 rounded-2xl bg-white p-1.5 ring-1 ring-slate-200">
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
              <ErrorState message={getErrorMessage(queue.error, 'Could not load the queue.')} onRetry={() => void queue.refetch()} />
            </Panel>
          ) : items.length === 0 ? (
            <Panel>
              <EmptyState
                icon={Inbox}
                title={status === 'NeedsReview' ? 'Queue clear' : 'Nothing here yet'}
                description={status === 'NeedsReview' ? 'No paper check is waiting for a Staff decision.' : 'No checks with this status.'}
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

          {status === 'NeedsReview' && items.length > 0 && (
            <p className="px-1 text-xs text-slate-700">
              Oldest first. Flags on the top check: {problems(items[0].fields)}.
            </p>
          )}
        </aside>

        {selectedId ? (
          <Detail key={selectedId} verificationId={selectedId} />
        ) : (
          <Panel>
            <EmptyState icon={ShieldCheck} title="No check selected" description="Pick a check from the queue to review its papers." />
          </Panel>
        )}
      </div>
    </div>
  )
}
