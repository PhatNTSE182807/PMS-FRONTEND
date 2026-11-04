import { formatPeriod } from '@/lib/revenuePeriods'
import type { RevenueTimeSeriesPointDTO } from '@/types/report.dto'

/** One lot in one day, week, month or year of the report. */
export interface RevenuePeriodLotRow {
  startDate: string
  endDate: string
  parkingLotId: number
  parkingLotName: string
  carSessions: number
  motorbikeSessions: number
  totalSessions: number
  totalRevenue: number
}

/** Rows of the breakdown table: newest period first, lots by name (the API only lists lots with sessions). */
export function periodLotRows(points: RevenueTimeSeriesPointDTO[]): RevenuePeriodLotRow[] {
  return [...points].reverse().flatMap(({ startDate, endDate, byLot }) => byLot.map((lot) => ({ startDate, endDate, ...lot })))
}

/** Downloads the rows as CSV (opens in Excel). */
export function exportRevenueCsv(rows: RevenuePeriodLotRow[], fileName: string) {
  const quote = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const header = ['Period', 'From', 'To', 'Parking lot', 'Car sessions', 'Motorbike sessions', 'Settled sessions', 'Revenue (VND)']
  const lines = rows.map((row) =>
    [formatPeriod(row), row.startDate, row.endDate, row.parkingLotName, row.carSessions, row.motorbikeSessions, row.totalSessions, row.totalRevenue]
      .map(quote)
      .join(','),
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
