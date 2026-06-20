import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Shield, Radio } from 'lucide-react'
import { clsx } from 'clsx'

const navLinks = [
  { path: '/', label: 'Home' },
  { path: '/predict', label: 'Predict' },
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/model', label: 'Model' },
  { path: '/about', label: 'About' },
]

function LiveClock() {
  const [time, setTime] = useState<string>('')

  useEffect(() => {
    const update = () => {
      const now = new Date()
      const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
      const h = ist.getHours().toString().padStart(2, '0')
      const m = ist.getMinutes().toString().padStart(2, '0')
      const s = ist.getSeconds().toString().padStart(2, '0')
      setTime(`${h}:${m}:${s}`)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center gap-2 text-right">
      <div className="relative">
        <Radio className="w-4 h-4 text-accent-green" />
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-accent-green rounded-full animate-pulse" />
      </div>
      <div>
        <div className="text-accent-green font-mono text-sm font-semibold tracking-wider">
          {time}
        </div>
        <div className="text-text-secondary text-xs">IST LIVE</div>
      </div>
    </div>
  )
}

export default function Navigation() {
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <header
      className={clsx(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-surface/95 backdrop-blur-md border-b border-border shadow-lg'
          : 'bg-surface/80 backdrop-blur-sm border-b border-border/50'
      )}
    >
      <div className="w-full px-4 sm:px-8 xl:px-16">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <Shield className="w-8 h-8 text-accent-amber group-hover:text-amber-300 transition-colors" />
              <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-md group-hover:bg-amber-400/30 transition-all" />
            </div>
            <div>
              <div className="text-text-primary font-bold text-lg leading-tight tracking-tight">
                Nirbadha Pravaha
              </div>
              <div className="text-text-secondary text-xs leading-tight">
                Bengaluru Traffic Command
              </div>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={clsx(
                    'relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200',
                    isActive
                      ? 'text-accent-amber'
                      : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                  )}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-0.5 bg-accent-amber rounded-full" />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Live Clock */}
          <LiveClock />
        </div>
      </div>
    </header>
  )
}
