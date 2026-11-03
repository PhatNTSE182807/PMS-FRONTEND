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
import type { ParkingSessionDTO } from '@/types/operations.dto'

const clock = new Intl.DateTimeFormat('en-GB', {
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
      <figcaption className="text-xs font-bold tracking-wider text-slate-700 uppercase">{label}</figcaption>
      <div className="grid h-64 place-items-center overflow-hidden rounded-xl bg-[#060f16] ring-1 ring-slate-200">
        {paper.isPending && <Skeleton className="size-full" />}
        {paper.isError && (
          <span className="flex flex-col items-center gap-1 text-sm text-slate-600">
            <ImageOff className="size-6" aria-hidden /> {getErrorMessage(paper.error, 'Could not load the photo.')}
          </span>
        )}
        {url && paper.data?.type === 'application/pdf' && <iframe src={url} title={label} className="size-full" />}
        {url && paper.data?.type !== 'application/pdf' && <img src={url} alt={label} className="size-full object-contain" />}
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
      void queryClient.invalidateQueries({ queryKey: ['lost-ticket-reviews'] })
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
    if (!note.trim()) return setError('Say why the papers do not match before refusing.')
    setError(null)
    decide.mutate(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-slate-50 p-4 text-sm">
        <Plate className="text-base">{session.plateNumber || 'NO PLATE'}</Plate>
        <span className="text-slate-950">{session.vehicleTypeName ?? 'Vehicle'}</span>
        <span className="text-slate-700">In since {clock.format(Date.parse(session.entryTime))}</span>
        <span className="font-mono text-slate-700">{session.slotCode ? `Bay ${session.slotCode}` : (session.zoneName ?? '')}</span>
        <span className="font-mono text-xs text-slate-600">{session.code}</span>
        {session.lostTicketReason && <span className="w-full text-slate-700">Reason: {session.lostTicketReason}</span>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <PaperImage sessionId={session.id} kind="citizen-id" label="Citizen ID (CCCD)" />
        <PaperImage sessionId={session.id} kind="registration" label="Vehicle registration certificate" />
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-bold tracking-wider text-slate-700 uppercase">Before approving, check that</legend>
        {CHECKS.map((text, i) => (
          <label key={text} className="flex items-start gap-2 text-sm text-slate-950">
            <Checkbox
              className="mt-0.5"
              checked={checked[i]}
              onChange={(e) => setChecked((c) => c.map((v, j) => (j === i ? e.target.checked : v)))}
            />
            {text}
          </label>
        ))}
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="lost-review-note">Note (required to refuse)</Label>
        <textarea
          id="lost-review-note"
          rows={2}
          maxLength={500}
          className="w-full rounded-lg bg-[#060f16] p-3 text-sm text-slate-950 ring-1 ring-slate-200 focus-visible:outline-none"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. the name on the Citizen ID differs from the registration owner"
        />
      </div>
      {error && <FieldError message={error} />}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="destructive" onClick={refuse} disabled={decide.isPending}>
          <Ban /> Disapprove
        </Button>
        <Button
          variant="success"
          onClick={() => decide.mutate(true)}
          disabled={!allChecked || decide.isPending}
          title={allChecked ? undefined : 'Tick every check first'}
        >
          <CircleCheck /> Approve: add the fine at checkout
        </Button>
      </div>
    </div>
  )
}

/**
 * Lost tickets whose papers were uploaded and wait for the Staff's check. Opened from the upload popup with
 * the vehicle selected; the list keeps the others so nothing is forgotten.
 */
export function LostTicketReviews({ lotId, selectedSessionId }: { lotId: string | undefined; selectedSessionId?: number }) {
  const waiting = useQuery({
    queryKey: ['lost-ticket-reviews', lotId],
    queryFn: async () => (await gateService.getSessions(lotId!, 'LostTicketPending')).filter((s) => s.lostTicketApprovalMode === 'Staff'),
    enabled: Boolean(lotId),
    refetchInterval: 10_000,
  })
  const [pickedId, setPickedId] = useState<number | undefined>(selectedSessionId)
  const sessions = waiting.data ?? []
  const selected = sessions.find((s) => s.id === pickedId) ?? sessions[0]

  if (!waiting.isPending && sessions.length === 0) return null

  return (
    <Panel id="lost-ticket-review" className={cn(selectedSessionId && 'ring-2 ring-amber-400')}>
      <SectionTitle
        icon={<FileSearch className="size-5 text-amber-500" aria-hidden />}
        aside={<span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-500">{sessions.length} to check</span>}
      >
        Lost tickets: check the papers
      </SectionTitle>
      {waiting.isPending && <Skeleton className="h-64 rounded-xl" />}
      {sessions.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Lost tickets waiting">
          {sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={s.id === selected?.id}
              onClick={() => setPickedId(s.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 font-mono text-sm font-bold ring-1',
                s.id === selected?.id ? 'bg-[#124e66] text-indigo-800 ring-indigo-300' : 'bg-white text-slate-950 ring-slate-200',
              )}
            >
              {s.plateNumber || 'NO PLATE'}
            </button>
          ))}
        </div>
      )}
      {selected && <Review key={selected.id} session={selected} />}
    </Panel>
  )
}
