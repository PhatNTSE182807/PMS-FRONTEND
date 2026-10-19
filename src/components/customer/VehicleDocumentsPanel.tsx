import { useRef, useState, type DragEvent } from 'react'
import { toast } from 'sonner'
import {
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CloudUpload,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  ScanText,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { vehicleDocumentService } from '@/api/vehicleDocument.service'
import { slotKey, useVehicleVerification, type DocumentSlotState, type VehicleDocumentDraft } from '@/hooks/useVehicleDocuments'
import {
  DOCUMENT_ACCEPT,
  type FieldResult,
  type VehicleDocumentSide,
  type VehicleDocumentType,
  type VehicleVerificationDTO,
  type VerificationStatus,
} from '@/types/vehicleDocument.dto'
import '@/styles/vehicle-documents.css'

const PAPERS: { type: VehicleDocumentType; title: string; local: string }[] = [
  { type: 'RegistrationCertificate', title: 'Registration certificate', local: 'Cà vẹt xe' },
  { type: 'CitizenId', title: 'Citizen ID card', local: 'CCCD' },
]

const SIDE_LABEL: Record<VehicleDocumentSide, string> = { Front: 'Front · Mặt trước', Back: 'Back · Mặt sau' }

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
        onChange={(e) => {
          onChoose(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />

      {state.file ? (
        <>
          <div className="vd-slot__preview">
            {state.previewUrl ? <img src={state.previewUrl} alt={`${type} ${side} preview`} /> : <FileText aria-hidden />}
            {state.uploaded && <span className="vd-slot__badge" title="Uploaded"><CircleCheck aria-hidden /></span>}
          </div>
          <div className="vd-slot__meta">
            <span className="vd-slot__side">{SIDE_LABEL[side]}</span>
            <span className="vd-slot__name" title={state.file.name}>{state.file.name}</span>
            <span className="vd-slot__size">{formatSize(state.file.size)}</span>
          </div>
          {!disabled && !state.uploaded && (
            <button type="button" className="vd-slot__remove" aria-label={`Remove ${side.toLowerCase()} side`} onClick={() => onChoose(null)}>
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
          <strong>{SIDE_LABEL[side]}</strong>
          <small>Drop or click · JPEG, PNG, PDF ≤ 10 MB</small>
        </label>
      )}
      {state.error && <p className="vd-slot__error" role="alert">{state.error}</p>}
    </div>
  )
}

const STATUS_VIEW: Record<VerificationStatus, { title: string; tone: 'ok' | 'warn' | 'bad' | 'busy' | 'muted'; icon: typeof ShieldCheck }> = {
  Draft: { title: 'Papers not submitted yet', tone: 'muted', icon: CircleHelp },
  Pending: { title: 'Queued for reading…', tone: 'busy', icon: Loader2 },
  Processing: { title: 'Reading your papers (OCR)…', tone: 'busy', icon: Loader2 },
  AutoVerified: { title: 'Verified automatically', tone: 'ok', icon: ShieldCheck },
  NeedsReview: { title: 'Waiting for Staff review', tone: 'warn', icon: ShieldAlert },
  Approved: { title: 'Approved by Staff', tone: 'ok', icon: ShieldCheck },
  Rejected: { title: 'Rejected', tone: 'bad', icon: CircleAlert },
}

const RESULT_VIEW: Record<FieldResult, { label: string; className: string }> = {
  Match: { label: 'Matched', className: 'vd-chip--ok' },
  Mismatch: { label: 'Mismatch', className: 'vd-chip--bad' },
  Unreadable: { label: 'Unreadable', className: 'vd-chip--warn' },
}

/**
 * The OCR outcome: overall status, then every compared field per paper.
 * `loadFile` fetches an uploaded file; it defaults to the customer's own endpoint, and the Staff
 * review screen passes the reviewer endpoint instead.
 */
export function VerificationResult({
  verification,
  loadFile,
}: {
  verification: VehicleVerificationDTO
  loadFile?: (documentId: string) => Promise<Blob>
}) {
  const view = STATUS_VIEW[verification.status]
  const Icon = view.icon
  const running = view.tone === 'busy'

  const openFile = async (documentId: string) => {
    try {
      const blob = loadFile ? await loadFile(documentId) : await vehicleDocumentService.getFile(verification.vehicleId, documentId)
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
        <Icon className={running ? 'vd-spin' : undefined} aria-hidden />
        <div>
          <strong>{view.title}</strong>
          {verification.statusReason && <p>{verification.statusReason}</p>}
          {verification.reviewNote && <p>Staff note: {verification.reviewNote}</p>}
        </div>
        {verification.confidence != null && !running && (
          <span className="vd-result__confidence" title="Lowest confidence among the compared fields">
            {Math.round(verification.confidence * 100)}%
          </span>
        )}
      </div>

      {verification.fields.length > 0 &&
        PAPERS.map((paper) => {
          const fields = verification.fields.filter((f) => f.document === paper.type)
          if (fields.length === 0) return null
          return (
            <div key={paper.type} className="vd-fields">
              <span className="vd-fields__title">{paper.title} · {paper.local}</span>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Field</th>
                    <th scope="col">{paper.type === 'CitizenId' ? 'Profile' : 'Entered'}</th>
                    <th scope="col">Read on paper</th>
                    <th scope="col">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((f) => (
                    <tr key={f.field} title={f.note ?? undefined}>
                      <th scope="row">{f.label}</th>
                      <td>{f.expected || '—'}</td>
                      <td className="vd-mono">{f.read || '—'}</td>
                      <td>
                        <span className={`vd-chip ${RESULT_VIEW[f.result].className}`}>{RESULT_VIEW[f.result].label}</span>
                        {f.result !== 'Unreadable' && <span className="vd-confidence">{Math.round(f.confidence * 100)}%</span>}
                        {f.note && <small className="vd-note">{f.note}</small>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}

      {verification.documents.length > 0 && (
        <div className="vd-files">
          {verification.documents.map((d) => (
            <button
              key={d.documentId}
              type="button"
              className="vd-file"
              disabled={!d.isAvailable}
              onClick={() => void openFile(d.documentId)}
              title={d.isAvailable ? 'Open the uploaded file' : 'Deleted after the decision (BR-26)'}
            >
              <Eye aria-hidden /> {d.documentType === 'CitizenId' ? 'CCCD' : 'Cà vẹt'} · {d.side}
            </button>
          ))}
        </div>
      )}

      {verification.filesDeleteAt && (
        <p className="vd-fine">
          {verification.filesDeletedAt
            ? `Photos deleted on ${formatDate(verification.filesDeletedAt)}; the result is kept.`
            : `Photos are deleted on ${formatDate(verification.filesDeleteAt)}, 30 days after the decision.`}
        </p>
      )}
    </div>
  )
}

/**
 * Upload of the registration certificate (cà vẹt) and Citizen ID card (CCCD), front and back, with
 * previews and progress, and the OCR verification result of `vehicleId` once it has one.
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
  const running = verification?.status === 'Pending' || verification?.status === 'Processing'
  const locked = draft.busy || running

  const verifyNow = async () => {
    if (!vehicleId) return
    try {
      await draft.uploadAndVerify(vehicleId)
      toast.success('Papers uploaded. Reading them now…')
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

      {PAPERS.map((paper) => (
        <div key={paper.type} className="vd-paper">
          <div className="cx-doc-head">
            <span>{paper.title} ({paper.local})</span>
            <span>
              {(['Front', 'Back'] as const).filter((side) => draft.slots[slotKey(paper.type, side)].file).length}/2 sides
            </span>
          </div>
          <div className="vd-slots">
            {(['Front', 'Back'] as const).map((side) => (
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
      ))}

      {vehicleId && draft.hasNew && (
        <button type="button" className="cx-btn cx-btn--light vd-verify" disabled={!draft.complete || locked} onClick={() => void verifyNow()}>
          <ScanText aria-hidden /> {draft.busy ? 'Uploading…' : draft.complete ? 'Upload & verify papers' : `Add all 4 sides (${draft.chosen}/4)`}
        </button>
      )}

      {verification && verification.status !== 'Draft' && <VerificationResult verification={verification} />}
    </div>
  )
}
