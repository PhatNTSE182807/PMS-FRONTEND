import type { RevenuePeriodReport } from '@/hooks/useRevenueReport'
import { formatPeriod } from '@/lib/revenuePeriods'

/** One lot in one day, week, month or year of the report. */
export interface RevenuePeriodLotRow {
  startDate: string
  endDate: string
  parkingLotId: number
  parkingLotName: string
  totalSessions: number
  totalRevenue: number
}

/** Rows of the breakdown table: newest period first, lots by name, lots without sessions left out. */
export function periodLotRows(periods: RevenuePeriodReport[]): RevenuePeriodLotRow[] {
  return [...periods].reverse().flatMap(({ startDate, endDate, report }) =>
    report.byLot
      .filter((lot) => lot.totalSessions > 0 || lot.totalRevenue > 0)
      .map((lot) => ({
        startDate,
        endDate,
        parkingLotId: lot.parkingLotId,
        parkingLotName: lot.parkingLotName,
        totalSessions: lot.totalSessions,
        totalRevenue: lot.totalRevenue,
      })),
  )
}

/** Downloads the rows as CSV (opens in Excel). */
export function exportRevenueCsv(rows: RevenuePeriodLotRow[], fileName: string) {
  const quote = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const header = ['Period', 'From', 'To', 'Parking lot', 'Settled sessions', 'Revenue (VND)']
  const lines = rows.map((row) =>
    [formatPeriod(row), row.startDate, row.endDate, row.parkingLotName, row.totalSessions, row.totalRevenue].map(quote).join(','),
  )
  // BOM so Excel reads Vietnamese characters as UTF-8.
  const blob = new Blob(['﻿' + [header.join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
