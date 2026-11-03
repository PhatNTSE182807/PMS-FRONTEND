import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MoonStar } from 'lucide-react'
import { endBusinessDay } from '@/api/simulation.service'
import { queryKeys } from '@/api/queryKeys'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldError, Input, Label, NativeSelect } from '@/components/ui/form-controls'
import { useParkingLots } from '@/hooks/useParking'
import { toastAdminError } from '@/lib/adminToasts'

const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/**
 * Admin demo: end the business day now instead of waiting for 23:00. Every open cash drawer of the lot (or of
 * every lot) must be closed within the grace period: the Staff see a countdown at once, and the lot's Manager is
 * told about each drawer still open when it runs out.
 */
export function EndOfDayPanel() {
  const lots = useParkingLots()
  const queryClient = useQueryClient()
  const [lotId, setLotId] = useState('')
  const [grace, setGrace] = useState('30')
  const seconds = Number(grace)
  const valid = Number.isInteger(seconds) && seconds >= 5 && seconds <= 3600

  const end = useMutation({
    mutationFn: () => endBusinessDay(lotId ? Number(lotId) : undefined, seconds),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cashDrawer.all })
      if (r.drawersToClose === 0) toast.info('The day ended, but no cash drawer was open.')
      else toast.success(`${r.drawersToClose} open cash drawer${r.drawersToClose === 1 ? '' : 's'} must close by ${time.format(Date.parse(r.closeDueAt))}.`)
    },
    onError: (error) => toastAdminError(error, { fallback: 'Could not end the business day.' }),
  })

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <MoonStar className="size-4" aria-hidden /> End of the business day
          </CardTitle>
          <CardDescription>
            Cash drawers normally have to be closed by 23:00. End the day now to show the close: Staff with an open drawer get a
            countdown, and when it runs out the lot&apos;s Manager is told about every drawer still open.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <div className="space-y-1">
            <Label htmlFor="eod-lot">Parking lot</Label>
            <NativeSelect id="eod-lot" value={lotId} onChange={(e) => setLotId(e.target.value)} disabled={lots.isPending}>
              <option value="">Every lot</option>
              {(lots.data ?? []).map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.name} ({lot.code})
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label htmlFor="eod-grace">Time to close (seconds)</Label>
            <Input id="eod-grace" inputMode="numeric" value={grace} onChange={(e) => setGrace(e.target.value.replace(/\D/g, ''))} aria-invalid={!valid} />
          </div>
        </div>
        {!valid && <FieldError message="Give the Staff between 5 and 3,600 seconds." />}
        <Button variant="gold" disabled={!valid || end.isPending} onClick={() => end.mutate()}>
          <MoonStar aria-hidden /> {end.isPending ? 'Ending the day…' : 'End the business day now'}
        </Button>
      </CardContent>
    </Card>
  )
}
