import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from './button'

interface PaginationProps {
  pageNumber: number
  pageSize: number
  totalCount: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}

/** Page numbers to show: first, last, current ±1, with gaps marked as null. */
function visiblePages(current: number, total: number): (number | null)[] {
  const pages = new Set([1, total, current - 1, current, current + 1].filter((p) => p >= 1 && p <= total))
  const sorted = [...pages].sort((a, b) => a - b)
  return sorted.flatMap((page, i) => (i > 0 && page - sorted[i - 1] > 1 ? [null, page] : [page]))
}

export function Pagination({ pageNumber, pageSize, totalCount, totalPages, onPageChange, className }: PaginationProps) {
  if (totalCount === 0) return null
  const from = (pageNumber - 1) * pageSize + 1
  const to = Math.min(pageNumber * pageSize, totalCount)

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex flex-col items-center justify-between gap-3 text-sm text-slate-500 sm:flex-row', className)}
    >
      <p>
        Showing <span className="font-medium text-slate-900">{formatNumber(from)}</span>–
        <span className="font-medium text-slate-900">{formatNumber(to)}</span> of{' '}
        <span className="font-medium text-slate-900">{formatNumber(totalCount)}</span> results
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous page"
          disabled={pageNumber <= 1}
          onClick={() => onPageChange(pageNumber - 1)}
        >
          <ChevronLeft />
        </Button>
        {visiblePages(pageNumber, totalPages).map((page, i) =>
          page === null ? (
            <span key={`gap-${i}`} className="px-1 text-slate-400">
              …
            </span>
          ) : (
            <Button
              key={page}
              variant={page === pageNumber ? 'default' : 'ghost'}
              size="icon"
              aria-current={page === pageNumber ? 'page' : undefined}
              onClick={() => onPageChange(page)}
            >
              {page}
            </Button>
          ),
        )}
        <Button
          variant="outline"
          size="icon"
          aria-label="Next page"
          disabled={pageNumber >= totalPages}
          onClick={() => onPageChange(pageNumber + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </nav>
  )
}
