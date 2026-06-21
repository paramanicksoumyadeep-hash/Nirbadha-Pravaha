import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Shield, Radio, Moon, Sun } from 'lucide-react'
import { clsx } from 'clsx'
import { useTheme } from '../lib/ThemeContext'

const navLinks = [
  { path: '/', label: 'Overview' },
  { path: '/predict', label: 'Report' },
  { path: '/archive', label: 'Archive' },
  { path: '/model', label: 'Intelligence' },
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
    <div className="flex items-center gap-2 text-right border-l border-border pl-4 ml-2">
      <div className="relative">
        <Radio className="w-4 h-4 text-primary" />
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full animate-pulse" />
      </div>
      <div className="hidden sm:block">
        <div className="text-primary font-mono text-xs font-semibold tracking-wider">
          {time}
        </div>
        <div className="text-text-secondary text-[10px] uppercase">IST LIVE</div>
      </div>
    </div>
  )
}

export default function Navigation() {
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface border-b border-border transition-colors duration-300">
      <div className="w-full px-4 sm:px-6">
        <div className="flex items-center justify-between h-[60px]">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="text-primary flex items-center justify-center">
                <Shield className="w-6 h-6 fill-current" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-text-primary font-bold text-xl tracking-tight">
                  Nirbadha Pravaha
                </span>
              </div>
            </Link>

            {/* Nav Links */}
            <nav className="hidden lg:flex items-center gap-6">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.path
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={clsx(
                      'relative text-sm font-semibold transition-colors py-5',
                      isActive
                        ? 'text-text-primary'
                        : 'text-text-secondary hover:text-text-primary'
                    )}
                  >
                    {link.label}
                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-sm" />
                    )}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3 sm:gap-4">
            
            <a 
              href="https://btp.karnataka.gov.in/en" 
              target="_blank" 
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-full bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/30 transition-colors"
            >
              Report Incident
            </a>

            <a 
              href="tel:112" 
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-500/30 transition-colors"
            >
              Call Emergency
            </a>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full text-text-secondary hover:text-text-primary hover:bg-background transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <LiveClock />
          </div>

        </div>
      </div>
    </header>
  )
}
