import { Routes, Route } from 'react-router-dom'
import Navigation from './components/Navigation'
import CommandCenter from './pages/CommandCenter'
import PredictPage from './pages/PredictPage'
import DashboardPage from './pages/DashboardPage'
import ModelPage from './pages/ModelPage'
import AboutPage from './pages/AboutPage'

function App() {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      <Navigation />
      <main>
        <Routes>
          <Route path="/" element={<CommandCenter />} />
          <Route path="/predict" element={<PredictPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/model" element={<ModelPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
