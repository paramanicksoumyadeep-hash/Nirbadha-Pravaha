import { clsx } from 'clsx'
import { CheckCircle, AlertTriangle, Flame } from 'lucide-react'

type Severity = 'LOW' | 'MEDIUM' | 'HIGH'
type Size = 'sm' | 'md' | 'lg'

interface SeverityBadgeProps {
  severity: Severity
  size?: Size
}

const config: Record<
  Severity,
  { bg: string; border: string; text: string; label: string; glow: string }
> = {
  LOW: {
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500/40',
    text: 'text-emerald-400',
    label: 'LOW SEVERITY',
    glow: 'shadow-[0_0_15px_rgba(16,185,129,0.3)]',
  },
  MEDIUM: {
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/40',
    text: 'text-amber-400',
    label: 'MEDIUM SEVERITY',
    glow: 'shadow-[0_0_15px_rgba(245,158,11,0.3)]',
  },
  HIGH: {
    bg: 'bg-red-500/20',
    border: 'border-red-500/40',
    text: 'text-red-400',
    label: 'HIGH SEVERITY',
    glow: 'shadow-[0_0_15px_rgba(239,68,68,0.3)]',
  },
}

const sizeConfig: Record<Size, { wrapper: string; icon: string; text: string }> = {
  sm: { wrapper: 'px-2.5 py-1 gap-1.5', icon: 'w-3.5 h-3.5', text: 'text-xs font-semibold' },
  md: { wrapper: 'px-3.5 py-2 gap-2', icon: 'w-4 h-4', text: 'text-sm font-semibold' },
  lg: { wrapper: 'px-5 py-3 gap-2.5', icon: 'w-5 h-5', text: 'text-base font-bold' },
}

export default function SeverityBadge({ severity, size = 'md' }: SeverityBadgeProps) {
  const c = config[severity]
  const s = sizeConfig[size]

  return (
    <div
      className={clsx(
        'inline-flex items-center rounded-full border',
        c.bg,
        c.border,
        c.text,
        c.glow,
        s.wrapper
      )}
    >
      <span className={s.icon}>
        {severity === 'LOW' && <CheckCircle className={s.icon} />}
        {severity === 'MEDIUM' && <AlertTriangle className={s.icon} />}
        {severity === 'HIGH' && <Flame className={s.icon} />}
      </span>
      <span className={s.text}>{c.label}</span>
    </div>
  )
}
