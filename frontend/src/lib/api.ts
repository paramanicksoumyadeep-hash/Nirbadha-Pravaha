import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
})

// ─── Request / Response Types ─────────────────────────────────────────────────

export interface PredictRequest {
  latitude: number
  longitude: number
  start_datetime: string
  event_cause: string
  veh_type: string
  event_type: string
  authenticated: string
  description: string
  has_junction: boolean
}

export interface TopFeature {
  name: string
  importance: number
  value?: number | string
}

export interface PredictionResponse {
  requires_road_closure_probability: number
  requires_road_closure_prediction: boolean
  predicted_duration_min: number
  severity_tier: 'LOW' | 'MEDIUM' | 'HIGH'
  recommended_manpower: number
  barricade_units: number
  barricading: boolean
  diversion_plan: string
  top_features: TopFeature[]
  applied_rules: string[]
  derived_corridor: string
  derived_zone: string
  derived_police_station: string
  nearby_roads: NearbyRoad[]
}

export interface NearbyRoad {
  name: string
  latitude: number
  longitude: number
  distance_km: number
  risk_level: string
}

export interface HotspotData {
  cluster_id: number
  centroid_lat: number
  centroid_lon: number
  event_count: number
  closure_rate: number
  median_duration: number
}

export interface RocPoint {
  fpr: number
  tpr: number
}

export interface FeatureImportance {
  feature: string
  importance: number
}

export interface ModelMetrics {
  accuracy: number
  roc_auc: number
  cv_mean: number
  cv_std: number
  cv_accuracies: number[]
  confusion_matrix: number[][]
  feature_importances_closure: FeatureImportance[]
  feature_importances_duration: FeatureImportance[]
  r2_log: number
  mae_min: number
  rmse_min: number
  predicted_vs_actual_sample: { predicted: number; actual: number }[]
  roc_points: RocPoint[]
  positive_class_rate: number
}

export interface EventData {
  id?: string | number
  event_id?: string | number
  event_cause: string
  corridor: string
  zone: string
  latitude: number
  longitude: number
  requires_road_closure: boolean
  duration_min: number
  start_datetime: string
  severity: string
}

export interface EventsResponse {
  events: EventData[]
  total: number
  page: number
  page_size: number
}

export interface EventFilters {
  event_cause?: string
  start_date?: string
  end_date?: string
  page?: number
  page_size?: number
}

export interface FeedbackData {
  actual_duration_min?: number
  actual_closure?: boolean
  notes?: string
}

// ─── API Functions ─────────────────────────────────────────────────────────────

export const predictEvent = (req: PredictRequest): Promise<PredictionResponse> =>
  api.post('/api/predict', req).then((r) => r.data)

export const getHotspots = (): Promise<HotspotData[]> =>
  api.get('/api/events/hotspots').then((r) => r.data.hotspots)

export const getEvents = (params?: EventFilters): Promise<EventsResponse> =>
  api.get('/api/events', { params }).then((r) => r.data)

export const getModelMetrics = (): Promise<ModelMetrics> =>
  api.get('/api/model/metrics').then((r) => {
    const data = r.data
    if (data.feature_importances_closure && !Array.isArray(data.feature_importances_closure)) {
      data.feature_importances_closure = Object.entries(data.feature_importances_closure).map(([k, v]) => ({ feature: k, importance: v }))
    }
    if (data.feature_importances_duration && !Array.isArray(data.feature_importances_duration)) {
      data.feature_importances_duration = Object.entries(data.feature_importances_duration).map(([k, v]) => ({ feature: k, importance: v }))
    }
    return data
  })

export const submitFeedback = (eventId: string | number, data: FeedbackData) =>
  api.post(`/api/events/${eventId}/feedback`, data).then((r) => r.data)

export const getNearbyRoads = (lat: number, lon: number, limit: number = 5): Promise<NearbyRoad[]> =>
  api.get('/api/nearby-roads', { params: { lat, lon, limit } }).then((r) => r.data)

export default api
