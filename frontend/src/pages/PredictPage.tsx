import { useState, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap, Popup } from 'react-leaflet'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import L from 'leaflet'
import {
  MapPin,
  Clock,
  Users,
  Shield,
  Navigation,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Info,
} from 'lucide-react'
import { AlertCircle as AlertCircleIcon, Clock as ClockIcon, Users as UsersIcon, ShieldAlert, Navigation as NavigationIcon } from 'lucide-react'
import { format } from 'date-fns'
import { predictEvent, PredictRequest, PredictionResponse, TopFeature, submitFeedback } from '../lib/api'
import ClosureGauge from '../components/ClosureGauge'
import SeverityBadge from '../components/SeverityBadge'
import LocationSearchBox from '../components/LocationSearchBox'
import LoadingSkeleton from '../components/LoadingSkeleton'
import 'leaflet/dist/leaflet.css'

// Fix leaflet default icons
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const getBarricadeIcon = (color: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="6" width="20" height="8" rx="1" fill="#1a2035" />
    <path d="M17 14v7"/><path d="M7 14v7"/><path d="M17 3v3"/><path d="M7 3v3"/>
    <path d="M10 14 2.3 6.3"/><path d="m14 6 7.7 7.7"/><path d="m8 6 8 8"/>
  </svg>`
  return L.divIcon({
    html: `<div style="display: flex; justify-content: center; align-items: center; filter: drop-shadow(0px 3px 6px rgba(0,0,0,0.6));">${svg}</div>`,
    className: 'custom-barricade-icon',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  })
}

const redIcon = getBarricadeIcon('#ef4444')
const greenIcon = getBarricadeIcon('#10b981')
const yellowIcon = getBarricadeIcon('#f59e0b')

const locationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

const EVENT_CAUSES = [
  'Accident', 'Road Work', 'VIP Movement', 'Vehicle Breakdown', 'Public Event',
  'Festival', 'Strike', 'Waterlogging', 'Fire', 'Protest', 'Other',
]

const VEH_TYPES = [
  'Car', 'Bus', 'Truck', 'Two Wheeler', 'Auto', 'Ambulance', 'Mixed',
]

interface MapClickHandlerProps {
  onMapClick: (lat: number, lng: number) => void
}

function MapClickHandler({ onMapClick }: MapClickHandlerProps) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}



interface FormState {
  latitude: string
  longitude: string
  start_datetime: string
  event_cause: string
  veh_type: string
  event_type: 'Planned' | 'Unplanned'
  authenticated: boolean
  description: string
  has_junction: boolean
}

const defaultForm: FormState = {
  latitude: '',
  longitude: '',
  start_datetime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  event_cause: 'Accident',
  veh_type: 'Car',
  event_type: 'Unplanned',
  authenticated: false,
  description: '',
  has_junction: false,
}

interface InfoCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  unit?: string
  color?: string
}

function InfoCard({ icon, label, value, unit, color = 'text-text-primary' }: InfoCardProps) {
  return (
    <div className="glass p-4 rounded-xl">
      <div className="flex items-center gap-2 text-text-secondary text-xs mb-2 font-medium uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-bold ${color}`}>
        {value}
        {unit && <span className="text-sm text-text-secondary ml-1">{unit}</span>}
      </div>
    </div>
  )
}

const CustomTooltipBar = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-xl">
        <p className="text-text-secondary text-xs mb-1">{label}</p>
        <p className="text-accent-amber font-bold">{payload[0].value.toFixed(4)}</p>
      </div>
    )
  }
  return null
}

export default function PredictPage() {
  const [form, setForm] = useState<FormState>(defaultForm)
  const [markerPos, setMarkerPos] = useState<[number, number] | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PredictionResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rulesOpen, setRulesOpen] = useState(false)

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setMarkerPos([lat, lng])
    setForm((f) => ({
      ...f,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    }))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.latitude || !form.longitude) {
      setError('Please click on the map to select an event location.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const payload: PredictRequest = {
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        start_datetime: form.start_datetime,
        event_cause: form.event_cause.toLowerCase().replace(' ', '_'),
        veh_type: form.veh_type.toLowerCase().replace(' ', '_'),
        event_type: form.event_type.toLowerCase(),
        authenticated: form.authenticated ? 'yes' : 'no',
        description: form.description,
        has_junction: form.has_junction,
      }
      const data = await predictEvent(payload)
      setResult(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Prediction failed. Check if backend is running.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const featuresData = result?.top_features?.slice(0, 8).map((f) => ({
    feature: f.name.replace(/_/g, ' ').slice(0, 20),
    importance: parseFloat(f.importance.toFixed(4)),
  })) ?? []

  return (
    <div className="min-h-screen pt-16">
      <div className="w-full px-4 sm:px-8 xl:px-16 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            Traffic Event{' '}
            <span className="bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
              Forecaster
            </span>
          </h1>
          <p className="text-text-secondary">
            Click on the map to place an event, fill in details, and get instant AI-powered impact predictions.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* ── LEFT: Form ──────────────────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="glass rounded-xl p-6">
              <h2 className="text-lg font-bold text-text-primary mb-5 flex items-center gap-2">
                <Shield className="w-5 h-5 text-accent-amber" />
                Report Traffic Event
              </h2>

              {/* Map click banner */}
              <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-5">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-blue-300 text-sm">
                  Click anywhere on the Bengaluru map to auto-fill the coordinates.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Coordinates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1 uppercase tracking-wide">
                      Latitude
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                      <input
                        type="text"
                        readOnly
                        value={form.latitude}
                        placeholder="Click map..."
                        className="input-dark pl-9 cursor-not-allowed"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1 uppercase tracking-wide">
                      Longitude
                    </label>
                    <div className="relative">
                      <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                      <input
                        type="text"
                        readOnly
                        value={form.longitude}
                        placeholder="Click map..."
                        className="input-dark pl-9 cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                {/* Date Time */}
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1 uppercase tracking-wide">
                    Event Date & Time
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                    <input
                      type="datetime-local"
                      value={form.start_datetime}
                      onChange={(e) => setForm((f) => ({ ...f, start_datetime: e.target.value }))}
                      className="input-dark pl-9"
                    />
                  </div>
                </div>

                {/* Event Cause */}
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1 uppercase tracking-wide">
                    Event Cause
                  </label>
                  <div className="relative">
                    <select
                      value={form.event_cause}
                      onChange={(e) => setForm((f) => ({ ...f, event_cause: e.target.value }))}
                      className="select-dark"
                    >
                      {EVENT_CAUSES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
                  </div>
                </div>

                {/* Vehicle Type */}
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1 uppercase tracking-wide">
                    Vehicle Type
                  </label>
                  <div className="relative">
                    <select
                      value={form.veh_type}
                      onChange={(e) => setForm((f) => ({ ...f, veh_type: e.target.value }))}
                      className="select-dark"
                    >
                      {VEH_TYPES.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
                  </div>
                </div>

                {/* Event Type toggle */}
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wide">
                    Event Type
                  </label>
                  <div className="pill-toggle">
                    {(['Planned', 'Unplanned'] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, event_type: opt }))}
                        className={`pill-option ${form.event_type === opt ? 'active' : 'inactive'}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Authenticated toggle */}
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wide">
                    Verification Status
                  </label>
                  <div className="pill-toggle">
                    {[
                      { label: 'Field-Verified', value: true },
                      { label: 'Unverified', value: false },
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, authenticated: opt.value }))}
                        className={`pill-option ${form.authenticated === opt.value ? 'active' : 'inactive'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1 uppercase tracking-wide">
                    Description (Optional)
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={2}
                    placeholder="Additional event details..."
                    className="input-dark resize-none"
                  />
                </div>

                {/* Junction checkbox */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="junction"
                    checked={form.has_junction}
                    onChange={(e) => setForm((f) => ({ ...f, has_junction: e.target.checked }))}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                  <label htmlFor="junction" className="text-text-secondary text-sm cursor-pointer">
                    Event is at or near a major junction
                  </label>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-amber w-full flex items-center justify-center gap-2 text-base disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Forecasting...
                    </>
                  ) : (
                    <>
                      <Shield className="w-5 h-5" />
                      Forecast Event Impact
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* ── RIGHT: Map + Results ─────────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Map */}
            <div className="glass rounded-xl overflow-hidden" style={{ height: '380px' }}>
              <MapContainer
                center={[12.97, 77.59]}
                zoom={11}
                style={{ width: '100%', height: '100%' }}
                className="z-0"
              >
                <TileLayer
                  url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                  attribution='&copy; <a href="https://www.google.com/intl/en_us/help/terms_maps/">Google Maps</a>'
                />
                <LocationSearchBox onLocationFound={handleMapClick} />
                <MapClickHandler onMapClick={handleMapClick} />
                {markerPos && <Marker position={markerPos} icon={locationIcon} />}
                {result?.nearby_roads?.map((road, idx) => (
                  <Marker 
                    key={idx} 
                    position={[road.latitude, road.longitude]} 
                    icon={road.risk_level === 'red' ? redIcon : road.risk_level === 'yellow' ? yellowIcon : greenIcon}
                  />
                ))}
              </MapContainer>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4"
                >
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-300 text-sm">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Loading skeleton */}
            {loading && (
              <div className="space-y-4">
                <LoadingSkeleton variant="gauge" />
                <LoadingSkeleton variant="card" />
              </div>
            )}

            {/* Results */}
            <AnimatePresence>
              {result && !loading && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-4"
                >
                  {/* Gauge + Badge */}
                  <div className="glass rounded-xl p-6 text-center">
                    <ClosureGauge probability={result.requires_road_closure_probability} />
                    <div className="mt-4 flex justify-center">
                      <SeverityBadge severity={result.severity_tier} size="lg" />
                    </div>
                  </div>

                  {/* Key metrics grid */}
                  <div className="grid grid-cols-3 gap-3">
                    <InfoCard
                      icon={<Clock className="w-3.5 h-3.5" />}
                      label="Duration"
                      value={Math.round(result.predicted_duration_min)}
                      unit="min"
                      color="text-accent-blue"
                    />
                    <InfoCard
                      icon={<Users className="w-3.5 h-3.5" />}
                      label="Manpower"
                      value={result.recommended_manpower}
                      unit="officers"
                      color="text-accent-amber"
                    />
                    <InfoCard
                      icon={<Shield className="w-3.5 h-3.5" />}
                      label="Barricades"
                      value={result.barricade_units}
                      unit="units"
                      color="text-accent-red"
                    />
                  </div>

                  {/* Diversion plan */}
                  {result.diversion_plan && (
                    <div className="glass rounded-xl p-4">
                      <div className="flex items-center gap-2 text-text-secondary text-xs font-semibold uppercase tracking-wide mb-2">
                        <Navigation className="w-4 h-4 text-accent-green" />
                        Diversion Plan
                      </div>
                      <p className="text-text-primary text-sm leading-relaxed">
                        {result.diversion_plan}
                      </p>
                    </div>
                  )}

                  {/* Derived location */}
                  <div className="glass rounded-xl p-4">
                    <div className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-3">
                      Derived Location
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <div className="text-text-secondary text-xs mb-0.5">Corridor</div>
                        <div className="text-text-primary font-medium truncate">
                          {result.derived_corridor || '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-text-secondary text-xs mb-0.5">Zone</div>
                        <div className="text-text-primary font-medium truncate">
                          {result.derived_zone || '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-text-secondary text-xs mb-0.5">Police Station</div>
                        <div className="text-text-primary font-medium truncate">
                          {result.derived_police_station || '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Applied rules - collapsible */}
                  {result.applied_rules && result.applied_rules.length > 0 && (
                    <div className="glass rounded-xl overflow-hidden">
                      <button
                        onClick={() => setRulesOpen((v) => !v)}
                        className="w-full flex items-center justify-between p-4 text-sm font-medium text-text-primary hover:bg-white/5 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-accent-amber" />
                          Applied Rules ({result.applied_rules.length})
                        </span>
                        {rulesOpen ? (
                          <ChevronUp className="w-4 h-4 text-text-secondary" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-text-secondary" />
                        )}
                      </button>
                      <AnimatePresence>
                        {rulesOpen && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
                              {result.applied_rules.map((rule, i) => (
                                <div key={i} className="flex items-start gap-2 text-sm">
                                  <span className="text-accent-amber mt-0.5 flex-shrink-0">▶</span>
                                  <span className="text-text-secondary">{rule}</span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Feature importance chart */}
                  {featuresData.length > 0 && (
                    <div className="glass rounded-xl p-5">
                      <div className="text-sm font-semibold text-text-primary mb-4">
                        Top Feature Importances
                      </div>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart
                          data={featuresData}
                          layout="vertical"
                          margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#2a3550" horizontal={false} />
                          <XAxis
                            type="number"
                            tick={{ fill: '#94a3b8', fontSize: 11 }}
                            axisLine={{ stroke: '#2a3550' }}
                            tickLine={false}
                          />
                          <YAxis
                            type="category"
                            dataKey="feature"
                            tick={{ fill: '#94a3b8', fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                            width={120}
                          />
                          <Tooltip content={<CustomTooltipBar />} />
                          <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                            {featuresData.map((_, i) => (
                              <Cell
                                key={i}
                                fill={`hsl(${38 - i * 3}, 90%, ${60 - i * 2}%)`}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
