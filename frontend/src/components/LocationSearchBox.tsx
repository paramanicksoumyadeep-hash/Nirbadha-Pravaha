import React, { useState, useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { MapPin } from 'lucide-react'

interface LocationSearchBoxProps {
  onLocationFound: (lat: number, lng: number) => void
}

interface Suggestion {
  display_name: string
  lat: string
  lon: string
}

export default function LocationSearchBox({ onLocationFound }: LocationSearchBoxProps) {
  const map = useMap()
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Live autocomplete
  useEffect(() => {
    if (!query.trim() || query.trim().length < 3) {
      setSuggestions([])
      setShowDropdown(false)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query + ' Bengaluru')}&limit=5`
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          if (data && data.features) {
            const mapped = data.features.map((f: any) => {
              const p = f.properties
              const parts = [p.name, p.street, p.district].filter(Boolean)
              return {
                display_name: parts.join(', '),
                lat: f.geometry.coordinates[1].toString(),
                lon: f.geometry.coordinates[0].toString()
              }
            })
            setSuggestions(mapped)
            setShowDropdown(true)
          }
        }
      } catch (err) {
        console.error('Autocomplete failed', err)
      }
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const handleSelect = (latStr: string, lonStr: string, name: string) => {
    const lat = parseFloat(latStr)
    const lon = parseFloat(lonStr)
    setQuery(name.split(',')[0]) // Simplify the query text
    setShowDropdown(false)
    setSuggestions([])
    map.flyTo([lat, lon], 15)
    onLocationFound(lat, lon)
  }

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!query.trim()) return
    
    // If they press enter, just select the top suggestion if available
    if (suggestions.length > 0) {
      handleSelect(suggestions[0].lat, suggestions[0].lon, suggestions[0].display_name)
      return
    }

    setSearching(true)
    try {
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query + ' Bengaluru')}&limit=1`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Search API Error')
      const data = await res.json()
      if (data && data.features && data.features.length > 0) {
        const f = data.features[0]
        const p = f.properties
        const name = [p.name, p.street, p.district].filter(Boolean).join(', ')
        handleSelect(f.geometry.coordinates[1].toString(), f.geometry.coordinates[0].toString(), name)
      } else {
        alert('Location not found in Bengaluru. Try a different search term.')
      }
    } catch (err) {
      console.error('Search failed', err)
      alert('Search service unavailable.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div 
      className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] w-full max-w-sm px-4"
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="relative">
        <form onSubmit={handleSearch} className="flex gap-2 bg-surface/95 backdrop-blur-md p-2 rounded-xl shadow-2xl border border-white/10">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) setShowDropdown(true)
            }}
            placeholder="Search area (e.g. Koramangala)"
            className="flex-1 bg-transparent text-text-primary text-sm px-2 focus:outline-none placeholder-text-secondary"
          />
          <button type="submit" disabled={searching} className="btn-amber py-1.5 px-4 text-xs">
            {searching ? '...' : 'Find'}
          </button>
        </form>

        {showDropdown && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-surface/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/10 overflow-hidden">
            {suggestions.map((s, i) => (
              <div 
                key={i}
                className="px-4 py-3 hover:bg-white/5 cursor-pointer flex items-start gap-3 border-b border-white/5 last:border-0"
                onClick={() => handleSelect(s.lat, s.lon, s.display_name)}
              >
                <MapPin className="w-4 h-4 text-accent-amber mt-0.5 shrink-0" />
                <div className="text-xs text-text-primary">
                  {s.display_name}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
