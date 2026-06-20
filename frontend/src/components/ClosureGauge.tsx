import { useEffect, useRef, useState } from 'react'

interface ClosureGaugeProps {
  probability: number // 0 to 1
}

export default function ClosureGauge({ probability }: ClosureGaugeProps) {
  const [animatedProb, setAnimatedProb] = useState(0)
  const animRef = useRef<number | null>(null)

  const pct = Math.round(probability * 100)
  const animPct = Math.round(animatedProb * 100)

  useEffect(() => {
    let start: number | null = null
    const duration = 1200
    const from = 0
    const to = probability

    const step = (timestamp: number) => {
      if (!start) start = timestamp
      const elapsed = timestamp - start
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setAnimatedProb(from + (to - from) * eased)
      if (progress < 1) {
        animRef.current = requestAnimationFrame(step)
      }
    }
    animRef.current = requestAnimationFrame(step)
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [probability])

  // SVG gauge setup
  const W = 220
  const H = 130
  const cx = W / 2
  const cy = H - 10
  const R = 90
  const strokeW = 14

  // Semicircle: from 180° to 0° (left to right)
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const polarToCart = (angle: number, radius: number) => ({
    x: cx + radius * Math.cos(toRad(angle)),
    y: cy + radius * Math.sin(toRad(angle)),
  })

  const describeArc = (startDeg: number, endDeg: number) => {
    const s = polarToCart(startDeg, R)
    const e = polarToCart(endDeg, R)
    const largeArc = endDeg - startDeg > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${R} ${R} 0 ${largeArc} 1 ${e.x} ${e.y}`
  }

  // Three zones: green (180→243°), amber (243→297°), red (297→360°)
  // Range is 180° total (from 180° to 360°)
  // 0-35% => green: 180° to 180+63° = 243°
  // 35-65% => amber: 243° to 180+117° = 297°
  // 65-100% => red: 297° to 360°
  const greenEnd = 180 + 180 * 0.35   // 243
  const amberEnd = 180 + 180 * 0.65   // 297
  const redEnd = 360

  // Needle angle: 180° at 0% to 360° at 100%
  const needleAngle = 180 + animatedProb * 180
  const needleTip = polarToCart(needleAngle, R - 5)
  const needleBase1 = polarToCart(needleAngle + 90, 6)
  const needleBase2 = polarToCart(needleAngle - 90, 6)

  // Color based on probability
  const gaugeColor =
    pct < 35 ? '#10b981' : pct < 65 ? '#f59e0b' : '#ef4444'

  const label = pct < 35 ? 'LOW RISK' : pct < 65 ? 'MEDIUM RISK' : 'HIGH RISK'

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="overflow-visible"
      >
        {/* Background arc */}
        <path
          d={describeArc(180, 360)}
          fill="none"
          stroke="#2a3550"
          strokeWidth={strokeW}
          strokeLinecap="round"
        />

        {/* Green arc 0-35% */}
        <path
          d={describeArc(180, greenEnd)}
          fill="none"
          stroke="#10b981"
          strokeWidth={strokeW}
          strokeLinecap="round"
          opacity={0.7}
        />

        {/* Amber arc 35-65% */}
        <path
          d={describeArc(greenEnd, amberEnd)}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={strokeW}
          opacity={0.7}
        />

        {/* Red arc 65-100% */}
        <path
          d={describeArc(amberEnd, redEnd)}
          fill="none"
          stroke="#ef4444"
          strokeWidth={strokeW}
          strokeLinecap="round"
          opacity={0.7}
        />

        {/* Needle */}
        <polygon
          points={`${needleTip.x},${needleTip.y} ${needleBase1.x},${needleBase1.y} ${needleBase2.x},${needleBase2.y}`}
          fill={gaugeColor}
          className="transition-all duration-75"
        />

        {/* Needle center pin */}
        <circle cx={cx} cy={cy} r={8} fill={gaugeColor} />
        <circle cx={cx} cy={cy} r={4} fill="#0a0f1e" />

        {/* Zone markers */}
        <text x={cx - R - 8} y={cy + 4} fill="#10b981" fontSize="10" fontWeight="600">0</text>
        <text x={cx + R} y={cy + 4} fill="#ef4444" fontSize="10" fontWeight="600">100</text>
      </svg>

      {/* Percentage display */}
      <div className="mt-2 text-center">
        <div
          className="text-5xl font-black tabular-nums"
          style={{ color: gaugeColor }}
        >
          {animPct}%
        </div>
        <div className="text-text-secondary text-sm mt-1 font-medium tracking-wider uppercase">
          Closure Risk
        </div>
        <div
          className="text-xs font-bold tracking-widest mt-1 uppercase"
          style={{ color: gaugeColor }}
        >
          {label}
        </div>
      </div>
    </div>
  )
}
