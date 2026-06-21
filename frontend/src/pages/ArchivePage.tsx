import { useState, useEffect, useCallback, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { Filter, RefreshCw, MapPin, Activity, Search } from 'lucide-react'
import { getHotspots, getEvents, getNearbyRoads, HotspotData, EventData, NearbyRoad } from '../lib/api'
import LoadingSkeleton from '../components/LoadingSkeleton'
import LocationSearchBox from '../components/LocationSearchBox'
import 'leaflet/dist/leaflet.css'

const EVENT_CAUSES = [
  'All', 'Accident', 'Road Work', 'VIP Movement', 'Vehicle Breakdown',
  'Public Event', 'Festival', 'Strike', 'Waterlogging', 'Fire', 'Protest', 'Other',
]

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

const redIcon = getBarricadeIcon('#D2001A') // Primary TomTom Red
const greenIcon = getBarricadeIcon('#10b981')
const yellowIcon = getBarricadeIcon('#f59e0b')

const CHART_COLORS = {
  blue: '#3b82f6',
  teal: '#14b8a6',
  amber: '#f59e0b',
  purple: '#a855f7',
  navy: '#1e3a5f',
  green: '#10b981',
  red: '#D2001A',
}

interface ChartCardProps {
  title: string
  children: React.ReactNode
  color?: string
}

function ChartCard({ title, children, color = '#f59e0b' }: ChartCardProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
      <div
        className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2"
        style={{ borderLeft: `3px solid ${color}`, paddingLeft: '8px' }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name?: string }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm z-50">
        <p className="text-text-secondary mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-text-primary font-semibold">
            {p.name ? `${p.name}: ` : ''}{p.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

function processEvents(events: EventData[]) {
  // By hour
  const hourMap: Record<number, number> = {}
  for (let i = 0; i < 24; i++) hourMap[i] = 0
  events.forEach((e) => {
    try {
      const h = new Date(e.start_datetime).getHours()
      hourMap[h] = (hourMap[h] || 0) + 1
    } catch {}
  })
  const byHour = Object.entries(hourMap).map(([h, count]) => ({ hour: `${h}:00`, count }))

  // By cause
  const causeMap: Record<string, number> = {}
  events.forEach((e) => {
    causeMap[e.event_cause] = (causeMap[e.event_cause] || 0) + 1
  })
  const byCause = Object.entries(causeMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([cause, count]) => ({ cause, count }))

  // Planned vs Unplanned
  const plannedCauses = ['VIP Movement', 'Public Event', 'Festival', 'Road Work']
  let planned = 0, unplanned = 0
  events.forEach((e) => {
    if (plannedCauses.includes(e.event_cause)) planned++
    else unplanned++
  })
  const plannedVsUnplanned = [
    { name: 'Planned', value: planned },
    { name: 'Unplanned', value: unplanned },
  ]

  // By corridor
  const corridorMap: Record<string, number> = {}
  events.forEach((e) => {
    if (e.corridor) corridorMap[e.corridor] = (corridorMap[e.corridor] || 0) + 1
  })
  const byCorridor = Object.entries(corridorMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([corridor, count]) => ({ corridor: corridor.slice(0, 25), count }))

  // Avg duration by cause
  const durationMap: Record<string, { total: number; count: number }> = {}
  events.forEach((e) => {
    if (e.duration_min && e.duration_min > 0) {
      if (!durationMap[e.event_cause]) durationMap[e.event_cause] = { total: 0, count: 0 }
      durationMap[e.event_cause].total += e.duration_min
      durationMap[e.event_cause].count += 1
    }
  })
  const avgDurationByCause = Object.entries(durationMap)
    .sort((a, b) => (b[1].total / b[1].count) - (a[1].total / a[1].count))
    .slice(0, 8)
    .map(([cause, data]) => ({ cause, duration: Math.round(data.total / data.count) }))

  return { byHour, byCause, plannedVsUnplanned, byCorridor, avgDurationByCause }
}

export default function ArchivePage() {
  const [hotspots, setHotspots] = useState<HotspotData[]>([])
  const [events, setEvents] = useState<EventData[]>([])
  const [nearbyRoads, setNearbyRoads] = useState<NearbyRoad[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string|number|null>(null)
  const [loading, setLoading] = useState(true)
  const [filterCause, setFilterCause] = useState('All')
  const [filterStart, setFilterStart] = useState('')
  const [filterEnd, setFilterEnd] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page_size: 300 }
      if (filterCause !== 'All') params.cause = filterCause
      if (filterStart) params.date_from = filterStart
      if (filterEnd) params.date_to = filterEnd

      const [hs, ev] = await Promise.all([
        getHotspots().catch(() => [] as HotspotData[]),
        getEvents(params).catch(() => ({ events: [] as EventData[], total: 0, page: 1, page_size: 300 })),
      ])
      setHotspots(hs)
      setEvents(ev.events || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [filterCause, filterStart, filterEnd])

  const handleApplyFilters = () => {
    setNearbyRoads([])
    setSelectedEventId(null)
    fetchData()
  }

  const handleMarkerClick = async (e: any) => {
    setSelectedEventId(e.id || e.event_id)
    try {
      const roads = await getNearbyRoads(e.latitude, e.longitude)
      setNearbyRoads(roads)
    } catch (err) {
      console.error("Failed to fetch nearby roads", err)
    }
  }

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const { byHour, byCause, plannedVsUnplanned, byCorridor, avgDurationByCause } = processEvents(events)

  return (
    <div className="min-h-screen pt-[60px] pb-12 bg-background">
      {/* Main Content (Original Dashboard Functionality) */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold text-text-primary mb-2">
              Event <span className="text-primary">Archive & Analytics</span>
            </h1>
            <p className="text-text-secondary">
              Geo-cluster hotspot map and historical event analytics across Bengaluru.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-surface border border-border rounded-xl p-4 mb-6 flex flex-wrap items-end gap-4 shadow-sm">
          <div>
            <label className="block text-xs mb-1 select-none">&nbsp;</label>
            <div className="flex items-center gap-2 text-text-secondary h-[38px]">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">Filters</span>
            </div>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-text-secondary mb-1">Event Cause</label>
            <select
              value={filterCause}
              onChange={(e) => setFilterCause(e.target.value)}
              className="bg-background border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-primary w-full h-[38px] text-sm"
            >
              <option value="All">All</option>
              {EVENT_CAUSES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Start Date</label>
            <input
              type="date"
              value={filterStart}
              onChange={(e) => setFilterStart(e.target.value)}
              className="bg-background border border-border rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:border-primary w-40 h-[38px] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">End Date</label>
            <input
              type="date"
              value={filterEnd}
              onChange={(e) => setFilterEnd(e.target.value)}
              className="bg-background border border-border rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:border-primary w-40 h-[38px] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs mb-1 select-none">&nbsp;</label>
            <button
              onClick={handleApplyFilters}
              className="btn-amber flex items-center gap-2 h-[38px] px-6 text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Apply Filters
            </button>
          </div>
        </div>

        {/* Map and Details Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <div className="lg:col-span-3 bg-surface border border-border rounded-xl overflow-hidden shadow-sm relative" style={{ height: '500px' }}>
            {loading ? (
              <div className="w-full h-full skeleton" />
            ) : (
              <MapContainer
                center={[12.97, 77.59]}
                zoom={11}
                style={{ width: '100%', height: '100%' }}
                scrollWheelZoom={true}
              >
                <LocationSearchBox onLocationFound={() => {}} />
                <TileLayer
                  url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                  attribution='&copy; <a href="https://www.google.com/intl/en_us/help/terms_maps/">Google Maps</a>'
                />
                {events.map((e, index) => {
                  let pinColor = '#10b981' // Green
                  if (e.requires_road_closure) {
                    pinColor = '#D2001A' // TomTom Red
                  } else if (['accident', 'water_logging', 'tree_fall', 'procession', 'vip_movement', 'protest'].includes(e.event_cause?.toLowerCase())) {
                    pinColor = '#f59e0b' // Yellow
                  }
                  return (
                  <CircleMarker
                    key={e.id || e.event_id || index}
                    center={[e.latitude, e.longitude]}
                    radius={8}
                    pathOptions={{
                      fillColor: pinColor,
                      fillOpacity: 0.9,
                      color: '#ffffff',
                      weight: 2,
                    }}
                    eventHandlers={{
                      click: () => handleMarkerClick(e)
                    }}
                  />
                )})}
                {nearbyRoads.map((road, idx) => (
                  <Marker 
                    key={`nearby-${idx}`} 
                    position={[road.latitude, road.longitude]} 
                    icon={road.risk_level === 'red' ? redIcon : road.risk_level === 'yellow' ? yellowIcon : greenIcon}
                  />
                ))}
              </MapContainer>
            )}
          </div>

          <div className="lg:col-span-1 bg-surface border border-border rounded-xl p-5 flex flex-col h-[500px] overflow-y-auto shadow-sm">
            <h3 className="font-bold text-lg mb-4 border-b border-border pb-3 flex items-center gap-2 text-text-primary">
              <MapPin className="w-5 h-5 text-primary" />
              Event Details
            </h3>
            
            {!selectedEventId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-text-secondary text-center">
                <MapPin className="w-12 h-12 mb-3 opacity-20" />
                <p>Select any pin on the map to view detailed event analytics and spillover impact.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {events.find(e => (e.id || e.event_id) === selectedEventId) && (() => {
                  const e = events.find(ev => (ev.id || ev.event_id) === selectedEventId)!
                  return (
                    <>
                      <div className="font-bold text-xl text-primary capitalize mb-1">
                        {e.event_cause?.replace(/_/g, ' ') || 'Unknown'}
                      </div>
                      <div className="text-xs text-text-secondary mb-4 border-b border-border pb-4">
                        {new Date(e.start_datetime).toLocaleString()}
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <Activity className="w-4 h-4 text-blue-500 mt-0.5" />
                          <div>
                            <div className="text-xs text-text-secondary">Corridor</div>
                            <div className="font-medium text-sm text-text-primary">{e.corridor || 'Unknown'}</div>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-3">
                          <MapPin className="w-4 h-4 text-primary mt-0.5" />
                          <div>
                            <div className="text-xs text-text-secondary">Road Closure Required</div>
                            <div className={`font-medium text-sm ${e.requires_road_closure ? 'text-primary' : 'text-text-primary'}`}>
                              {e.requires_road_closure ? 'Yes' : 'No'}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-3">
                          <svg className="w-4 h-4 text-amber-500 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          <div>
                            <div className="text-xs text-text-secondary">Duration</div>
                            <div className="font-medium text-sm text-text-primary">{e.duration_min ? `${Math.round(e.duration_min)} min` : 'Unknown'}</div>
                          </div>
                        </div>
                      </div>
                      
                      {nearbyRoads.length > 0 && (
                        <div className="mt-6 pt-4 border-t border-border">
                          <h4 className="font-semibold text-sm mb-3 text-text-secondary">Affected Corridors (Spillover)</h4>
                          <div className="space-y-2">
                            {nearbyRoads.map((road, idx) => (
                              <div key={idx} className="bg-background rounded-lg p-2.5 flex justify-between items-center border border-border">
                                <div>
                                  <div className="text-xs font-semibold text-text-primary">{road.name}</div>
                                  <div className="text-[10px] text-text-secondary">{road.distance_km} km away</div>
                                </div>
                                <div className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${road.risk_level === 'red' ? 'bg-red-500/10 text-red-600 dark:text-red-400' : road.risk_level === 'yellow' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                                  {road.risk_level}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 mb-6 text-sm text-text-secondary bg-surface p-3 rounded-lg border border-border shadow-sm inline-flex">
          <span className="font-medium">Map Events:</span>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span>Severe / Road Closure</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span>Moderate Impact</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span>Low Impact</span>
          </div>
        </div>

        {/* Charts grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 gap-6">
            <LoadingSkeleton variant="chart" />
            <LoadingSkeleton variant="chart" />
            <LoadingSkeleton variant="chart" />
            <LoadingSkeleton variant="chart" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <ChartCard title="Events by Hour of Day" color={CHART_COLORS.blue}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byHour} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    tick={{ fill: 'var(--text-secondary)', fontSize: 9 }}
                    axisLine={{ stroke: 'var(--border-color)' }}
                    tickLine={false}
                    interval={2}
                  />
                  <YAxis
                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill={CHART_COLORS.blue} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Top Event Causes" color={CHART_COLORS.teal}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={byCause}
                  layout="vertical"
                  margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="cause"
                    tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={110}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill={CHART_COLORS.teal} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Planned vs Unplanned Events" color={CHART_COLORS.amber}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={plannedVsUnplanned}
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    <Cell fill={CHART_COLORS.navy} />
                    <Cell fill={CHART_COLORS.amber} />
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    formatter={(value) => (
                      <span className="text-text-secondary text-xs">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Top 10 Traffic Corridors" color={CHART_COLORS.purple}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={byCorridor}
                  layout="vertical"
                  margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="corridor"
                    tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={120}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill={CHART_COLORS.purple} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        )}
      </main>
    </div>
  )
}
