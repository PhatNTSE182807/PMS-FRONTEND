import { useState } from 'react'
import { toast } from 'sonner'
import { AlarmClock, BellRing, CircleCheck, FileWarning, Gavel, IdCard, RefreshCw, ShieldCheck, TriangleAlert, Undo2 } from 'lucide-react'
import { CameraFrame, Panel } from '@/components/features/staff/StaffBits'
import { formatMinutes, vnd } from '@/components/features/manager/managerFormat'
import { DemoTag } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/form-controls'
import { EmptyState } from '@/components/ui/states'
import { useAuth } from '@/hooks/useAuth'
import { resolveIncident, useDemoIncidents, type IncidentResolution, type TrackedIncident } from '@/hooks/useDemoIncidents'
import { useNow } from '@/hooks/useNow'
import { cn } from '@/lib/utils'
import { RESOLUTION_REASONS, demoIncidentStats, demoStation, type IncidentSeverity } from '@/mocks/staffOps.mock'

const SEVERITY: Record<IncidentSeverity, { label: string; tone: string }> = {
  URGENT: { label: 'Urgent review', tone: 'bg-rose-100 text-rose-700' },
  HIGH_RISK: { label: 'High risk', tone: 'bg-rose-600 text-white' },
  REASSIGNMENT: { label: 'Reassignment', tone: 'bg-amber-500 text-(--color-on-gold)' },
}

const RESOLUTION_LABEL: Record<IncidentResolution, string> = {
  RESOLVED: 'Resolved • exit allowed',
  LOST_TICKET: 'Lost ticket protocol',
  ESCALATED: 'Escalated to Manager',
  BLACKLISTED: 'Incident logged • flagged',
}

const stamp = new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
const clockWithSeconds = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

function QueueCard({ incident, selected, onSelect }: { incident: TrackedIncident; selected: boolean; onSelect: () => void }) {
  const s = SEVERITY[incident.severity]
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'w-full rounded-2xl bg-white p-4 text-left ring-1 transition-colors',
        selected ? 'ring-2 ring-indigo-300' : 'ring-slate-200 hover:bg-slate-50',
        incident.resolution && 'opacity-60',
      )}
    >
      <div className="flex items-center justify-between gap-2 text-xs font-bold uppercase">
        <span className="text-amber-500">
          #{incident.id} • {incident.source}
        </span>
        <span className={cn('rounded px-1.5 py-0.5', incident.resolution ? 'bg-slate-100 text-slate-700' : s.tone)}>
          {incident.resolution ? RESOLUTION_LABEL[incident.resolution] : s.label}
        </span>
      </div>
      <p className="mt-2 font-display text-lg font-bold text-slate-950">{incident.title}</p>
      <p className="mt-1 text-sm text-slate-700">{incident.summary}</p>
      <div className="mt-3 flex justify-between gap-3 rounded-lg bg-[#060f16] px-3 py-2 text-sm">
        <div>
          <p className="text-xs text-slate-700">{incident.left.label}</p>
          <p className="font-mono font-bold text-rose-700">{incident.left.value}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-700">{incident.right.label}</p>
          <p className="font-mono font-bold text-indigo-700">{incident.right.value}</p>
        </div>
      </div>
    </button>
  )
}

function Dossier({ incident }: { incident: TrackedIncident }) {
  const [plate, setPlate] = useState(incident.suggestedPlate)
  const [reason, setReason] = useState(RESOLUTION_REASONS[0])
  // Dwell from the entry capture to the exit capture that raised the incident.
  const dwell = (incident.exit.at - incident.entry.at) / 60_000
  const lostTotal = incident.lostTicketFine + incident.tariff
  const plateMatches = plate.replace(/[^A-Z0-9]/gi, '').toUpperCase() === incident.entry.ocr.replace(/[^A-Z0-9]/gi, '').toUpperCase()
  const closed = Boolean(incident.resolution)

  const resolve = (resolution: IncidentResolution, note: string, message: string) => {
    resolveIncident(incident.id, resolution, note)
    toast.success(`#${incident.id}: ${message}`, { description: 'Demo only: nothing is sent to the gate or the Manager until the incident API exists.' })
  }

  return (
    <div className="space-y-6">
      <Panel className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-3 font-display text-2xl font-bold text-slate-950 sm:text-3xl">
            Incident dossier: #{incident.id}
            <span className="rounded bg-indigo-100 px-2 py-0.5 font-sans text-xs font-bold tracking-wider text-indigo-700 uppercase">Live optical feed</span>
            <DemoTag />
          </h1>
          <p className="mt-2 text-sm text-slate-700">
            Vehicle: {incident.vehicle} • Driver claim: {incident.driverClaim} • Ticket token: {incident.ticket}
          </p>
          {incident.resolution && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-800">
              <CircleCheck className="size-4" aria-hidden /> {RESOLUTION_LABEL[incident.resolution]} — {incident.reason}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2">
          <AlarmClock className="size-5 text-amber-500" aria-hidden />
          <div className="leading-tight">
            <p className="text-xs font-semibold text-slate-700">Dwell duration</p>
            <p className="font-mono font-bold text-slate-950">{formatMinutes(dwell)}</p>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(
          [
            ['Entry optical capture', incident.entry, 'text-indigo-700', false],
            ['Exit optical capture', incident.exit, 'text-rose-700', incident.exit.score < 90],
          ] as const
        ).map(([title, cap, tone, low]) => (
          <Panel key={title} className="p-0 sm:p-0">
            <p className={cn('flex justify-between px-4 pt-3 pb-2 text-xs font-bold tracking-wider uppercase', tone)}>
              ● {title}
              <span className="font-mono text-slate-950">{clockWithSeconds.format(cap.at)}</span>
            </p>
            <CameraFrame
              image={cap.image}
              alt={`${title} of ${incident.vehicle}`}
              className="rounded-none"
              overlay={
                <div className="absolute inset-x-3 bottom-3 rounded-lg bg-black/75 px-3 py-2">
                  <div className="flex justify-between text-[11px] font-bold tracking-wider text-slate-800 uppercase">
                    <span className={low ? 'text-amber-500' : undefined}>{low ? 'Uncertain character' : 'OCR plate string'}</span>
                    <span>{low ? 'Confidence index' : 'Read score'}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between">
                    <span className="font-mono text-base font-bold tracking-wider text-slate-950">{cap.ocr}</span>
                    <span className={cn('rounded px-1.5 py-0.5 font-mono text-xs font-bold', low ? 'bg-rose-600 text-white' : 'bg-indigo-200 text-indigo-800')}>
                      {cap.score}% {low ? 'Low' : 'Match'}
                    </span>
                  </div>
                </div>
              }
            />
            <p className="flex justify-between gap-3 px-4 py-3 text-xs text-slate-700">
              <span>Hardware node: {cap.node}</span>
              <span className="font-mono font-bold text-slate-950 uppercase">{cap.mode}</span>
            </p>
          </Panel>
        ))}
      </div>

      <Panel className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <label htmlFor="rectified-plate" className="text-xs font-bold tracking-wider text-slate-700 uppercase">
            Correct licence plate (interactive OCR rectification)
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              id="rectified-plate"
              value={plate}
              disabled={closed}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              className="min-w-0 flex-1 rounded-lg bg-[#060f16] px-4 py-3 font-mono text-xl font-bold tracking-[0.15em] text-slate-950 ring-1 ring-slate-200 focus-visible:ring-indigo-400 disabled:opacity-60"
            />
            <Button variant="default" className="h-auto px-5" disabled={closed} onClick={() => setPlate(incident.suggestedPlate)}>
              <RefreshCw /> Re-sync OCR
            </Button>
          </div>
          <p className={cn('mt-2 text-sm font-medium', plateMatches ? 'text-indigo-700' : 'text-amber-500')}>
            {plateMatches ? 'System auto-verified: string matches the entry snapshot.' : `Does not match the entry record ${incident.entry.ocr}. Check the plate before lifting the barrier.`}
          </p>
        </div>
        <div className="rounded-xl bg-[#060f16] p-4 text-center ring-1 ring-slate-200">
          <p className="text-xs font-bold tracking-wider text-slate-700 uppercase">Standard dwell tariff</p>
          <p className="mt-1 font-mono text-3xl font-bold text-amber-500">{vnd(incident.tariff)}</p>
          <p className="text-xs text-slate-700">Base rate tier: standard executive</p>
        </div>
      </Panel>

      <Panel>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl font-bold text-slate-950">Resolution decision protocol</h2>
          <span className="text-xs font-bold tracking-wider text-slate-700 uppercase">Gate safety interlock #01</span>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex flex-col rounded-xl bg-slate-50 p-5 ring-1 ring-slate-200">
            <p className="flex items-center justify-between font-display text-lg font-bold text-slate-950">
              Resolve &amp; allow exit <CircleCheck className="size-5 text-indigo-700" aria-hidden />
            </p>
            <p className="mt-1 text-sm text-slate-700">Validate the discrepancy as an optical reading anomaly. Rectify the session and trigger the gate lift.</p>
            <label htmlFor="resolution-reason" className="mt-auto pt-5 text-xs font-bold tracking-wider text-slate-700 uppercase">
              Mandatory operational reason
            </label>
            <NativeSelect id="resolution-reason" value={reason} onChange={(e) => setReason(e.target.value)} disabled={closed} className="mt-2">
              {RESOLUTION_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </NativeSelect>
            <Button className="mt-3 h-11 bg-indigo-400 text-[#003548] hover:bg-indigo-800" disabled={closed || !plateMatches} onClick={() => resolve('RESOLVED', `${reason} (${plate})`, 'rectified and barrier lifted')}>
              <ShieldCheck /> Confirm rectification &amp; lift barrier
            </Button>
          </div>
          <div className="flex flex-col rounded-xl bg-amber-50 p-5 ring-1 ring-amber-200">
            <p className="flex items-center justify-between font-display text-lg font-bold text-amber-500">
              Transfer to lost ticket protocol <FileWarning className="size-5" aria-hidden />
            </p>
            <p className="mt-1 text-sm text-slate-700">Card token cannot be correlated with the vehicle. Apply the administrative penalty and verify the driver&apos;s identity.</p>
            <dl className="mt-auto space-y-1 rounded-lg bg-[#060f16] p-3 pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-700">Lost ticket fine</dt>
                <dd className="font-mono font-bold text-slate-950">{vnd(incident.lostTicketFine)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-700">Accumulated dwell ({formatMinutes(dwell)})</dt>
                <dd className="font-mono font-bold text-slate-950">{vnd(incident.tariff)}</dd>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
                <dt className="font-display font-bold text-amber-500">Total amount due</dt>
                <dd className="font-mono text-lg font-bold text-amber-500">{vnd(lostTotal)}</dd>
              </div>
            </dl>
            <Button variant="gold" className="mt-3 h-11" disabled={closed} onClick={() => resolve('LOST_TICKET', `Lost ticket surcharge ${vnd(lostTotal)}`, 'moved to lost ticket protocol')}>
              <IdCard /> Open identity verification &amp; surcharge
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap justify-between gap-3">
          <Button variant="secondary" disabled={closed} onClick={() => resolve('ESCALATED', `Escalated to ${demoStation.manager}`, `escalated to ${demoStation.manager}`)}>
            <BellRing /> Escalate to facility manager {demoStation.manager}
          </Button>
          <Button variant="outline" className="text-rose-700" disabled={closed} onClick={() => resolve('BLACKLISTED', 'Hard incident log, plate flagged', 'incident logged and plate flagged')}>
            <TriangleAlert /> Create hard incident log &amp; flag blacklist
          </Button>
        </div>
      </Panel>
    </div>
  )
}

export default function StaffExceptionsPage() {
  const { user } = useAuth()
  const { all, open } = useDemoIncidents()
  const now = useNow(1000)
  const [selectedId, setSelectedId] = useState(() => open[0]?.id ?? all[0]?.id)
  const selected = all.find((i) => i.id === selectedId)
  const queue = [...open, ...all.filter((i) => i.resolution)]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-slate-50 px-4 py-3 text-xs font-semibold tracking-wider text-slate-700 uppercase">
        <span className="flex items-center gap-1.5 text-slate-950">
          <TriangleAlert className="size-4 text-amber-500" aria-hidden /> {open.length} incidents pending manual intervention
        </span>
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="size-4 text-indigo-700" aria-hidden /> Hardware interlock active • Barrier gate #01 locked
        </span>
        <span>
          Operator: <span className="text-indigo-700 normal-case">{user?.fullName} ({demoStation.employeeCode})</span>
        </span>
        <span className="font-mono normal-case">Audit stamp: {stamp.format(now)}</span>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl bg-white px-5 py-4 ring-1 ring-slate-200">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-950">
              <Gavel className="size-5 text-amber-500" aria-hidden /> Queue dispatch
            </h2>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-amber-500">{open.length ? 'Priority high' : 'Queue clear'}</span>
          </div>
          {queue.map((incident) => (
            <QueueCard key={incident.id} incident={incident} selected={incident.id === selectedId} onSelect={() => setSelectedId(incident.id)} />
          ))}
          <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
            <p className="text-xs font-bold tracking-wider text-slate-700 uppercase">Gate station 01 incident stats (24h)</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-700">Discrepancies cleared</p>
                <p className="font-display text-3xl font-bold text-indigo-700">{demoIncidentStats.cleared + (all.length - open.length)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-700">Average triage time</p>
                <p className="font-display text-3xl font-bold text-amber-500">{demoIncidentStats.avgTriageSeconds}s</p>
              </div>
            </div>
          </div>
        </aside>

        {selected ? (
          <Dossier key={selected.id} incident={selected} />
        ) : (
          <Card>
            <EmptyState icon={Undo2} title="No incident selected" description="Pick an incident from the queue to review its evidence." />
          </Card>
        )}
      </div>
    </div>
  )
}
