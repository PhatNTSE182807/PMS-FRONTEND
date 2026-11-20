import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Ban, CircleCheck, FileSearch, ImageOff } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { gateService } from '@/api/gate.service'
import { queryKeys } from '@/api/queryKeys'
import { Panel, Plate, SectionTitle } from '@/components/features/staff/StaffBits'
import { Button } from '@/components/ui/button'
import { Checkbox, FieldError, Label } from '@/components/ui/form-controls'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useLostTicketSessions } from '@/hooks/useGate'
import type { ParkingSessionDTO } from '@/types/operations.dto'
import { t, tMaybe, localDateFormat } from '@/i18n'

const clock = localDateFormat({
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

/** What the Staff must check before approving (BR-13). */
const CHECKS = [
  'The name on the Citizen ID matches the owner on the registration certificate (or the driver explains the link).',
  'The plate and vehicle type on the registration certificate match this vehicle.',
  'The person at the counter is the one on the Citizen ID photo.',
] as const

/** One uploaded paper, fetched with the token (it is not a public link). */
function PaperImage({ sessionId, kind, label }: { sessionId: number; kind: 'citizen-id' | 'registration'; label: string }) {
  const paper = useQuery({
    queryKey: ['lost-ticket-paper', sessionId, kind],
    queryFn: () => gateService.getLostTicketPaper(sessionId, kind),
    staleTime: Infinity,
  })
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!paper.data) return
    const objectUrl = URL.createObjectURL(paper.data)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [paper.data])

  return (
    <figure className="space-y-1.5">
      <figcaption className="text-xs font-bold tracking-wider text-slate-700 uppercase">{tMaybe(label)}</figcaption>
      <div className="grid h-64 place-items-center overflow-hidden rounded-xl bg-well ring-1 ring-slate-200">
        {paper.isPending && <Skeleton className="size-full" />}
        {paper.isError && (
          <span className="flex flex-col items-center gap-1 text-sm text-slate-600">
            <ImageOff className="size-6" aria-hidden /> {tMaybe(getErrorMessage(paper.error, 'Could not load the photo.'))}
          </span>
        )}
        {url && paper.data?.type === 'application/pdf' && <iframe src={url} title={tMaybe(label)} className="size-full" />}
        {url && paper.data?.type !== 'application/pdf' && <img src={url} alt={tMaybe(label)} className="size-full object-contain" />}
      </div>
    </figure>
  )
}

/** Step 2 of a lost ticket: compare the papers with the vehicle, then approve (fine on the bill) or refuse. */
function Review({ session }: { session: ParkingSessionDTO }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [checked, setChecked] = useState<boolean[]>(CHECKS.map(() => false))
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const allChecked = checked.every(Boolean)

  const decide = useMutation({
    mutationFn: (approve: boolean) => gateService.reviewLostTicket(session.id, approve, note.trim()),
    onSuccess: (_, approve) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gate.all })
      toast.success(
        approve
          ? `${session.plateNumber || 'The vehicle'} stays parked: the lost ticket fine is added when it checks out.`
          : `${session.plateNumber || 'The vehicle'} stays in the lot: it cannot leave until new papers are approved.`,
      )
      navigate('/staff/gate')
    },
    onError: (e) => setError(getErrorMessage(e, 'Could not save the decision.')),
  })

  const refuse = () => {
    if (!note.trim()) return setError('Say why you refuse the lost ticket (for example, the papers do not match).')
    setError(null)
    decide.mutate(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-slate-50 p-4 text-sm">
        <Plate className="text-base">{tMaybe(session.plateNumber) || t('NO PLATE')}</Plate>
        <span className="text-slate-950">{tMaybe(session.vehicleTypeName) ?? t('Vehicle')}</span>
        <span className="text-slate-700">{t('In since {v}', { v: clock.format(Date.parse(session.entryTime)) })}</span>
        <span className="font-mono text-slate-700">{session.slotCode ? t('Bay {slotCode}', { slotCode: session.slotCode }) : (tMaybe(session.zoneName) ?? '')}</span>
        <span className="font-mono text-xs text-slate-600">{session.code}</span>
        {session.lostTicketReason && <span className="w-full text-slate-700">{t('Reason: {lostTicketReason}', { lostTicketReason: session.lostTicketReason })}</span>}
      </div>

      {session.lostTicketHasPapers ? (
        <div className="grid gap-4 md:grid-cols-2">
          <PaperImage sessionId={session.id} kind="citizen-id" label={t('Citizen ID (CCCD)')} />
          <PaperImage sessionId={session.id} kind="registration" label={t('Vehicle registration certificate')} />
        </div>
      ) : (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
          <ImageOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t('No photos were uploaded for this case: ask the driver for the Citizen ID and the vehicle registration certificate at the counter.')}
        </p>
      )}

      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-bold tracking-wider text-slate-700 uppercase">{t('Before approving, check that')}</legend>
        {CHECKS.map((text, i) => (
          <label key={text} className="flex items-start gap-2 text-sm text-slate-950">
            <Checkbox
              className="mt-0.5"
              checked={checked[i]}
              onChange={(e) => setChecked((c) => c.map((v, j) => (j === i ? e.target.checked : v)))}
            />
            {tMaybe(text)}
          </label>
        ))}
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="lost-review-note">{t('Note (required to refuse)')}</Label>
        <textarea
          id="lost-review-note"
          rows={2}
          maxLength={500}
          className="w-full rounded-lg bg-well p-3 text-sm text-slate-950 ring-1 ring-slate-200 focus-visible:outline-none"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('e.g. the name on the Citizen ID differs from the registration owner')}
        />
      </div>
      {error && <FieldError message={tMaybe(error)} />}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="destructive" onClick={refuse} disabled={decide.isPending}>
          <Ban />{' '}{t('Disapprove')}
        </Button>
        <Button
          variant="success"
          onClick={() => decide.mutate(true)}
          disabled={!allChecked || decide.isPending}
          title={allChecked ? undefined : t('Tick every check first')}
        >
          <CircleCheck />{' '}{t('Approve: add the fine at checkout')}
        </Button>
      </div>
    </div>
  )
}

/**
 * Lost tickets waiting for the Staff's decision: the Staff decides every case, the Manager no longer does (team
 * decision 2026-11-04). Opened from the upload popup with the vehicle selected; the list keeps the others so
 * nothing is forgotten.
 */
export function LostTicketReviews({ lotId, selectedSessionId }: { lotId: string | undefined; selectedSessionId?: number }) {
  // Every waiting case is the Staff's to decide (the Manager no longer does), with or without uploaded papers.
  // Session pushes keep the list current.
  const waiting = useLostTicketSessions(lotId)
  const [pickedId, setPickedId] = useState<number | undefined>(selectedSessionId)
  const sessions = waiting.data ?? []
  const selected = sessions.find((s) => s.id === pickedId) ?? sessions[0]

  if (!waiting.isPending && sessions.length === 0) return null

  return (
    <Panel id="lost-ticket-review" className={cn(selectedSessionId && 'ring-2 ring-amber-400')}>
      <SectionTitle
        icon={<FileSearch className="size-5 text-amber-500" aria-hidden />}
        aside={<span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-500">{t('{length} to check', { length: sessions.length })}</span>}
      >
        {t('Lost tickets: check the papers and decide')}
      </SectionTitle>
      {waiting.isPending && <Skeleton className="h-64 rounded-xl" />}
      {sessions.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label={t('Lost tickets waiting')}>
          {sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={s.id === selected?.id}
              onClick={() => setPickedId(s.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 font-mono text-sm font-bold ring-1',
                s.id === selected?.id ? 'bg-selected text-indigo-800 ring-indigo-300' : 'bg-white text-slate-950 ring-slate-200',
              )}
            >
              {tMaybe(s.plateNumber) || t('NO PLATE')}
            </button>
          ))}
        </div>
      )}
      {selected && <Review key={selected.id} session={selected} />}
    </Panel>
  )
}
