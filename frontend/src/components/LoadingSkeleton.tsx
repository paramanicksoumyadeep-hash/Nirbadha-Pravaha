import { clsx } from 'clsx'

type Variant = 'card' | 'gauge' | 'chart' | 'table' | 'text' | 'line'

interface LoadingSkeletonProps {
  variant?: Variant
  className?: string
  count?: number
}

function SkeletonLine({ className }: { className?: string }) {
  return <div className={clsx('skeleton h-4 rounded', className)} />
}

function CardSkeleton() {
  return (
    <div className="glass p-6 rounded-xl space-y-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="skeleton w-10 h-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <SkeletonLine className="w-3/4" />
          <SkeletonLine className="w-1/2" />
        </div>
      </div>
      <SkeletonLine className="w-full" />
      <SkeletonLine className="w-5/6" />
      <SkeletonLine className="w-4/6" />
    </div>
  )
}

function GaugeSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4 p-6 animate-pulse">
      <div className="skeleton w-48 h-24 rounded-full" />
      <SkeletonLine className="w-24 h-10" />
      <SkeletonLine className="w-16 h-4" />
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div className="glass p-6 rounded-xl animate-pulse">
      <SkeletonLine className="w-40 h-5 mb-6" />
      <div className="flex items-end gap-2 h-48">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="skeleton flex-1 rounded-t"
            style={{ height: `${20 + Math.random() * 80}%` }}
          />
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton flex-1 h-3 rounded" />
        ))}
      </div>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="glass rounded-xl overflow-hidden animate-pulse">
      <div className="skeleton h-12 rounded-none" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="border-t border-border p-4 flex gap-4">
          <SkeletonLine className="w-1/4" />
          <SkeletonLine className="w-1/4" />
          <SkeletonLine className="w-1/4" />
          <SkeletonLine className="w-1/4" />
        </div>
      ))}
    </div>
  )
}

export default function LoadingSkeleton({ variant = 'card', count = 1, className }: LoadingSkeletonProps) {
  const renderOne = () => {
    switch (variant) {
      case 'card':
        return <CardSkeleton />
      case 'gauge':
        return <GaugeSkeleton />
      case 'chart':
        return <ChartSkeleton />
      case 'table':
        return <TableSkeleton />
      case 'text':
        return (
          <div className="space-y-2 animate-pulse">
            <SkeletonLine className="w-full" />
            <SkeletonLine className="w-5/6" />
            <SkeletonLine className="w-4/6" />
          </div>
        )
      case 'line':
        return <SkeletonLine className={className} />
      default:
        return <CardSkeleton />
    }
  }

  if (count === 1) return <div className={className}>{renderOne()}</div>

  return (
    <div className={clsx('grid gap-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>{renderOne()}</div>
      ))}
    </div>
  )
}
