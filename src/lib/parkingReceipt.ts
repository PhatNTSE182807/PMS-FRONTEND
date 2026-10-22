import { formatNumber } from '@/lib/format'
import type { ParkingReceiptDTO } from '@/types/parkingHistory.dto'

/** Escapes text placed into the receipt HTML. */
const html = (value: string | number | null | undefined) =>
  String(value ?? '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c]!)

const stamp = (iso: string | null | undefined) =>
  iso
    ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
    : '—'

const vnd = (amount: number) => `${formatNumber(amount)} VND`

export const formatDuration = (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`

const PURPOSE: Record<string, string> = { Deposit: 'Booking deposit', ParkingFee: 'Parking fee' }

/** The receipt as a standalone, print-friendly HTML page (A5-ish, light theme). */
export function receiptHtml(r: ParkingReceiptDTO): string {
  const row = (label: string, value: string, strong = false) =>
    `<tr><th>${html(label)}</th><td${strong ? ' class="strong"' : ''}>${html(value)}</td></tr>`
  const due = Math.max(0, r.finalFee - r.depositApplied)
  const payments = r.payments.length
    ? r.payments
        .map(
          (p) =>
            `<tr><td>${html(PURPOSE[p.purpose] ?? p.purpose)}<small>${html(p.paymentCode)} · ${html(stamp(p.paidAt))}</small></td>` +
            `<td>${html(p.provider ? `${p.method} · ${p.provider}` : p.method)}</td><td class="num">${html(vnd(p.amount))}</td></tr>`,
        )
        .join('')
    : `<tr><td colspan="3" class="muted">${html(r.zeroFeeReason ?? 'No payment was needed.')}</td></tr>`

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Receipt ${html(r.receiptNumber)}</title>
<style>
*{box-sizing:border-box}body{margin:0;padding:32px;font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;color:#14181c;background:#fff}
.sheet{max-width:620px;margin:0 auto}header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #14181c;padding-bottom:14px;margin-bottom:18px}
h1{margin:0;font-size:20px;letter-spacing:.04em}h1 span{color:#a17a10}.meta{text-align:right;font-size:12px;color:#55606a}.meta strong{display:block;font-size:15px;color:#14181c}
h2{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#55606a;margin:22px 0 6px}table{width:100%;border-collapse:collapse}
th,td{padding:6px 0;text-align:left;vertical-align:top;border-bottom:1px solid #e4e7ea}th{font-weight:500;color:#55606a;width:45%}
td.strong{font-weight:700}.num{text-align:right;white-space:nowrap}small{display:block;font-size:11px;color:#7a858e}.muted{color:#7a858e}
.total{display:flex;justify-content:space-between;margin-top:18px;padding:12px 14px;background:#f3f5f6;border-radius:8px;font-size:16px;font-weight:700}
footer{margin-top:26px;font-size:11px;color:#7a858e;text-align:center}@media print{body{padding:0}}
</style></head><body><div class="sheet">
<header><div><h1>XXIV <span>PARKING</span></h1><div class="muted">Parking e-receipt</div></div>
<div class="meta"><strong>${html(r.receiptNumber)}</strong>Issued ${html(stamp(r.issuedAt))}</div></header>
<h2>Session</h2><table>
${row('Customer', r.customerName ?? '—')}
${row('Parking lot', [r.lotName, r.lotDistrict].filter(Boolean).join(' · ') || '—')}
${r.lotAddress ? row('Address', r.lotAddress) : ''}
${row('Bay', [r.zoneName, r.slotCode].filter(Boolean).join(' · ') || '—')}
${row('Vehicle', [r.plateNumber, r.vehicleTypeName].filter(Boolean).join(' · ') || '—', true)}
${r.reservationCode ? row('Booking', r.reservationCode) : ''}
${row('Entry', stamp(r.entryTime))}
${row('Exit', stamp(r.exitTime))}
${row('Duration', formatDuration(r.durationMinutes))}
${row('Session', r.sessionCode)}
</table>
<h2>Charges</h2><table>
${row('Parking fee', vnd(r.originalFee))}
${r.discountAmount > 0 ? row('Discount', `- ${vnd(r.discountAmount)}`) : ''}
${row('Total fee', vnd(r.finalFee), true)}
${r.depositApplied > 0 ? row('Booking deposit applied', `- ${vnd(r.depositApplied)}`) : ''}
${row('Paid at exit', vnd(due))}
</table>
<h2>Payments</h2><table>${payments}</table>
<div class="total"><span>Total paid</span><span>${html(vnd(r.finalFee))}</span></div>
<footer>${html(r.lotName ?? 'XXIV Parking')}${r.lotPhone ? ` · ${html(r.lotPhone)}` : ''} · Thank you for parking with us.</footer>
</div><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),150))</script></body></html>`
}

/**
 * Shows the receipt in `target` (a window opened in the click handler, so pop-up blockers allow it)
 * and opens the print dialog, where the customer can save it as PDF.
 */
export function showReceipt(target: Window, receipt: ParkingReceiptDTO) {
  const url = URL.createObjectURL(new Blob([receiptHtml(receipt)], { type: 'text/html' }))
  target.location.href = url
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
