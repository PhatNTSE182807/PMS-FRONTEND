import { useState } from 'react'
import { getErrorMessage } from '@/api/apiError'
import { PricingHistoryPanel } from '@/components/features/manager/PricingHistoryPanel'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/form-controls'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'
import { useParkingLots } from '@/hooks/useParking'
import { usePricingRules } from '@/hooks/usePricing'

/** The rules of the chosen lot, for the history's rule filter. */
function LotHistory({ lotId }: { lotId: string }) {
  const rules = usePricingRules(lotId)
  const options = (rules.data ?? []).map((r) => ({ id: r.id, label: `${r.vehicleTypeName} • ${r.name}` }))
  // A new panel per lot, so the rule filter and paging start again
  return <PricingHistoryPanel key={lotId} lotId={lotId} rules={options} />
}

/** /admin/pricing-history: the pricing history of any lot, read only (Managers change prices on their own page). */
export default function PricingHistoryPage() {
  const lots = useParkingLots()
  const [chosen, setChosen] = useState<string | null>(null)
  const lotId = chosen ?? lots.data?.[0]?.id ?? null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pricing History"
        description="Every price change, status change and price draft of a parking lot, with who made it and when."
        actions={
          lots.data && lots.data.length > 0 ? (
            <NativeSelect aria-label="Parking lot" className="w-auto" value={lotId ?? ''} onChange={(e) => setChosen(e.target.value)}>
              {lots.data.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.name}
                </option>
              ))}
            </NativeSelect>
          ) : null
        }
      />
      {lots.isPending && <Skeleton className="h-64 rounded-2xl" />}
      {lots.isError && (
        <Card>
          <ErrorState message={getErrorMessage(lots.error)} onRetry={() => lots.refetch()} />
        </Card>
      )}
      {lotId && <LotHistory lotId={lotId} />}
    </div>
  )
}
