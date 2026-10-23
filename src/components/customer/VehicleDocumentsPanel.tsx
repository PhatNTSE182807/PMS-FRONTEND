import { useRef, useState, type DragEvent } from 'react'
import { toast } from 'sonner'
import {
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Clock,
  CloudUpload,
  Eye,
  FileText,
  RefreshCw,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { vehicleDocumentService } from '@/api/vehicleDocument.service'
import { slotKey, useVehicleVerification, type DocumentSlotState, type VehicleDocumentDraft } from '@/hooks/useVehicleDocuments'
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_SLOTS,
  documentLabel,
  isApproved,
  isWaitingForStaff,
  type VehicleDocumentSide,
  type VehicleDocumentType,
  type VehicleVerificationDTO,
} from '@/types/vehicleDocument.dto'
import '@/styles/vehicle-documents.css'

/** The papers asked for: one photo of each. */
const PAPERS: { type: VehicleDocumentType; title: string; hint: string }[] = [
  { type: 'RegistrationCertificate', title: 'Registration certificate (cà vẹt)', hint: 'One photo' },
  { type: 'CitizenId', title: 'Citizen ID card (CCCD)', hint: 'One photo' },
]

const sidesOf = (type: VehicleDocumentType) => DOCUMENT_SLOTS.filter((s) => s.type === type).map((s) => s.side)

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

const formatDate = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)) : '—'

/** One side of one paper: pick or drop a file, see its preview and upload progress. */
function DocumentSlot({
  type,
  side,
  state,
  disabled,
  onChoose,
}: {
  type: VehicleDocumentType
  side: VehicleDocumentSide
  state: DocumentSlotState
  disabled: boolean
  onChoose: (file: File | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const id = `doc-${type}-${side}`
  const label = documentLabel(type, side)

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (!disabled && e.dataTransfer.files[0]) onChoose(e.dataTransfer.files[0])
  }

  return (
    <div
      className={`vd-slot ${dragging ? 'is-dragging' : ''} ${state.file ? 'has-file' : ''} ${state.error ? 'has-error' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={DOCUMENT_ACCEPT}
        className="vd-slot__input"
        disabled={disabled}
        aria-label={`Upload ${label}`}
        onChange={(e) => {
          onChoose(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />

      {state.file ? (
        <>
          <div className="vd-slot__preview">
            {state.previewUrl ? <img src={state.previewUrl} alt={`${label} preview`} /> : <FileText aria-hidden />}
            {state.uploaded && <span className="vd-slot__badge" title="Uploaded"><CircleCheck aria-hidden /></span>}
          </div>
          <div className="vd-slot__meta">
            <span className="vd-slot__side">{side} side</span>
            <span className="vd-slot__name" title={state.file.name}>{state.file.name}</span>
            <span className="vd-slot__size">{formatSize(state.file.size)}</span>
          </div>
          {!disabled && !state.uploaded && (
            <button type="button" className="vd-slot__remove" aria-label={`Remove ${label}`} onClick={() => onChoose(null)}>
              <X aria-hidden />
            </button>
          )}
          {state.progress !== null && (
            <div className="vd-progress" role="progressbar" aria-valuenow={state.progress} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${state.progress}%` }} />
            </div>
          )}
        </>
      ) : (
        <label htmlFor={id} className="vd-slot__empty">
          <CloudUpload aria-hidden />
          <strong>{side} side</strong>
          <small>Drop or click · JPEG, PNG, PDF ≤ 10 MB</small>
        </label>
      )}
      {state.error && <p className="vd-slot__error" role="alert">{state.error}</p>}
    </div>
  )
}

type Tone = 'ok' | 'warn' | 'bad' | 'muted'

/** Banner of a registration's status, as the customer sees it. */
function statusView(status: VehicleVerificationDTO['status']): { title: string; tone: Tone; icon: typeof ShieldCheck } {
  if (isApproved(status)) return { title: 'Approved by Staff', tone: 'ok', icon: ShieldCheck }
  if (isWaitingForStaff(status)) return { title: 'Waiting for Staff review', tone: 'warn', icon: Clock }
  if (status === 'Rejected') return { title: 'Registration rejected', tone: 'bad', icon: CircleAlert }
  return { title: 'Papers not submitted yet', tone: 'muted', icon: CircleHelp }
}

/** The registration status of a vehicle: the decision, the Staff note and the uploaded files. */
export function RegistrationStatus({ verification }: { verification: VehicleVerificationDTO }) {
  const view = statusView(verification.status)
  const Icon = view.icon

  const openFile = async (documentId: string) => {
    try {
      const blob = await vehicleDocumentService.getFile(verification.vehicleId, documentId)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not open the file.'))
    }
  }

  return (
    <div className={`vd-result vd-result--${view.tone}`} aria-live="polite">
      <div className="vd-result__head">
        <Icon aria-hidden />
        <div>
          <strong>{view.title}</strong>
          {verification.statusReason && <p>{verification.statusReason}</p>}
          {verification.reviewNote && <p>Staff note: {verification.reviewNote}</p>}
        </div>
      </div>

      {verification.documents.length > 0 && (
        <div className="vd-files">
          {verification.documents.map((d) => (
            <button
              key={d.documentId}
              type="button"
              className="vd-file"
              disabled={!d.isAvailable}
              onClick={() => void openFile(d.documentId)}
              title={d.isAvailable ? 'Open the uploaded file' : 'Deleted 30 days after the decision'}
            >
              <Eye aria-hidden /> {documentLabel(d.documentType, d.side)}
            </button>
          ))}
        </div>
      )}

      {verification.filesDeleteAt && (
        <p className="vd-fine">
          {verification.filesDeletedAt
            ? `Photos deleted on ${formatDate(verification.filesDeletedAt)}; the decision is kept.`
            : `Photos are deleted on ${formatDate(verification.filesDeleteAt)}, 30 days after the decision.`}
        </p>
      )}
    </div>
  )
}

/**
 * Upload of the papers a vehicle registration needs: the front of the registration certificate and
 * both sides of the Citizen ID card, with previews and progress, then the Staff decision on `vehicleId`.
 * Without a vehicle (a new registration) the photos wait in the browser until the page submits.
 */
export function VehicleDocumentsPanel({
  draft,
  vehicleId,
  vehicleLabel,
  onClearVehicle,
}: {
  draft: VehicleDocumentDraft
  vehicleId: string | null
  vehicleLabel?: string
  onClearVehicle?: () => void
}) {
  const { data: verification } = useVehicleVerification(vehicleId)
  // Waiting or approved papers cannot be replaced; a rejection asks for new photos
  const settled = isWaitingForStaff(verification?.status) || isApproved(verification?.status)
  const locked = draft.busy || settled

  const submitNow = async () => {
    if (!vehicleId) return
    try {
      await draft.uploadAndSubmit(vehicleId)
      toast.success('Papers sent. Staff will review your vehicle shortly.')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not upload the papers.'))
    }
  }

  return (
    <div className="vd-panel">
      {vehicleId && vehicleLabel && (
        <div className="vd-target">
          <span>Papers for <strong className="vd-mono">{vehicleLabel}</strong></span>
          {onClearVehicle && (
            <button type="button" className="vd-link" onClick={onClearVehicle} disabled={draft.busy}>
              <RefreshCw aria-hidden /> New vehicle
            </button>
          )}
        </div>
      )}

      {verification && verification.status !== 'Draft' && <RegistrationStatus verification={verification} />}

      {!settled &&
        PAPERS.map((paper) => {
          const sides = sidesOf(paper.type)
          return (
            <div key={paper.type} className="vd-paper">
              <div className="cx-doc-head">
                <span>{paper.title}</span>
                <span>
                  {paper.hint} · {sides.filter((side) => draft.slots[slotKey(paper.type, side)].file).length}/{sides.length}
                </span>
              </div>
              <div className="vd-slots">
                {sides.map((side) => (
                  <DocumentSlot
                    key={side}
                    type={paper.type}
                    side={side}
                    state={draft.slots[slotKey(paper.type, side)]}
                    disabled={locked}
                    onChoose={(file) => draft.choose(slotKey(paper.type, side), file)}
                  />
                ))}
              </div>
            </div>
          )
        })}

      {vehicleId && !settled && (
        <button type="button" className="cx-btn cx-btn--light vd-verify" disabled={!draft.complete || locked} onClick={() => void submitNow()}>
          <Send aria-hidden />{' '}
          {draft.busy ? 'Uploading…' : draft.complete ? 'Send papers for review' : `Add all papers (${draft.chosen}/${DOCUMENT_SLOTS.length})`}
        </button>
      )}
    </div>
  )
}
