'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PaginationControlsProps {
  page: number
  totalPages: number
  total?: number
  limit?: number
  onPageChange: (page: number) => void
  className?: string
}

export function PaginationControls({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  className,
}: PaginationControlsProps) {
  if (totalPages <= 1) return null

  const pageSize = limit ?? 10
  const startItem = (page - 1) * pageSize + 1
  const endItem = Math.min(page * pageSize, total ?? totalPages * pageSize)

  // Compute visible page numbers
  const getVisiblePages = () => {
    const pages: (number | 'ellipsis')[] = []
    const delta = 2 // pages around current

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
      return pages
    }

    pages.push(1)

    if (page - delta > 2) {
      pages.push('ellipsis')
    }

    const start = Math.max(2, page - delta)
    const end = Math.min(totalPages - 1, page + delta)

    for (let i = start; i <= end; i++) {
      pages.push(i)
    }

    if (page + delta < totalPages - 1) {
      pages.push('ellipsis')
    }

    pages.push(totalPages)
    return pages
  }

  const visiblePages = getVisiblePages()

  return (
    <div className={cn('flex flex-col sm:flex-row items-center gap-3 pt-4', className)}>
      <p className="text-xs text-muted-foreground order-2 sm:order-1">
        {startItem}–{endItem} sur {(total ?? 0).toLocaleString('fr-FR')}
      </p>
      <div className="flex items-center gap-1 order-1 sm:order-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Page précédente"
        >
          <ChevronLeft className="size-4" />
        </Button>

        {visiblePages.map((p, idx) =>
          p === 'ellipsis' ? (
            <span key={`e-${idx}`} className="flex size-8 items-center justify-center text-xs text-muted-foreground">
              ...
            </span>
          ) : (
            <Button
              key={p}
              variant={p === page ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'h-8 w-8 p-0 text-xs',
                p === page && 'bg-primary hover:bg-primary/90 text-primary-foreground'
              )}
              onClick={() => onPageChange(p)}
              aria-label={`Page ${p}`}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </Button>
          )
        )}

        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Page suivante"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

// Skeleton for loading state
export function PaginationControlsSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 animate-pulse">
      <div className="h-3 w-32 bg-muted rounded order-2 sm:order-1" />
      <div className="flex items-center gap-1 order-1 sm:order-2">
        <div className="h-8 w-8 rounded-md bg-muted" />
        <div className="h-8 w-8 rounded-md bg-muted" />
        <div className="h-8 w-8 rounded-md bg-muted" />
        <div className="h-8 w-8 rounded-md bg-muted" />
        <div className="h-8 w-8 rounded-md bg-muted" />
      </div>
    </div>
  )
}
