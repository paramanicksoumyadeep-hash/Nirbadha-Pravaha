import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Brain,
  Clock,
  Map,
  Shield,
  ShieldAlert,
  Target,
  TrendingUp,
  Users,
  Zap,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react'

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0 },
}

const stagger = {
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
}

const stats = [
  { value: '8,173', label: 'Events Analyzed', icon: <Map className="w-5 h-5" />, color: 'text-accent-blue' },
  { value: '~90-91%', label: 'Forecast Accuracy', icon: <Target className="w-5 h-5" />, color: 'text-accent-green' },
  { value: '25', label: 'Geo Clusters', icon: <Zap className="w-5 h-5" />, color: 'text-accent-amber' },
  { value: '0.80', label: 'ROC-AUC Score', icon: <TrendingUp className="w-5 h-5" />, color: 'text-accent-blue' },
]

const components = [
  {
    icon: <Brain className="w-7 h-7 text-accent-amber" />,
    title: 'Closure Risk Classifier',
    subtitle: 'LightGBM · ~90–91% Accuracy · AUC 0.80',
    description:
      'Predicts whether a traffic event will require full road closure, using 30+ engineered features including geo-cluster identity, temporal patterns, and event metadata.',
    color: 'amber',
  },
  {
    icon: <Clock className="w-7 h-7 text-accent-blue" />,
    title: 'Clearance-Time Regressor',
    subtitle: 'Random Forest · R² 0.51 on log-scale',
    description:
      'Estimates event duration in minutes using Random Forest regression on log-transformed targets. Captures the heavy tail of long clearance events.',
    color: 'blue',
  },
  {
    icon: <Users className="w-7 h-7 text-accent-green" />,
    title: 'Resource Recommendation Engine',
    subtitle: 'Rules-Based · 3-Tier Severity System',
    description:
      'Translates model outputs into actionable deployment instructions: manpower headcount, barricade units, diversion plan text, and on-ground protocols.',
    color: 'green',
  },
]

const leakageSteps = [
  {
    icon: <AlertTriangle className="w-6 h-6 text-red-400" />,
    step: '01',
    title: 'Found Leakage',
    description:
      'Initial model used requires_road_closure directly as a feature when predicting closure. Also included fields derived post-event. Accuracy: 99.8%. Suspicious.',
    color: 'red',
  },
  {
    icon: <XCircle className="w-6 h-6 text-amber-400" />,
    step: '02',
    title: 'Audited & Removed',
    description:
      'Systematically stripped all post-event columns: corridor_info_* fields, actual_duration proxies, and any feature computed after road status was known.',
    color: 'amber',
  },
  {
    icon: <CheckCircle className="w-6 h-6 text-emerald-400" />,
    step: '03',
    title: 'Rebuilt Honestly',
    description:
      'Retrained on truly pre-event features only. Accuracy dropped to ~90–91%. ROC-AUC: 0.80. These are real-world deployable numbers, not lab artifacts.',
    color: 'green',
  },
]

export default function CommandCenter() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        {/* Background grid */}
        <div className="absolute inset-0 bg-grid opacity-30" />

        {/* Radial gradient overlay */}
        <div className="absolute inset-0 bg-radial-gradient" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(245,158,11,0.06) 0%, transparent 70%)',
          }}
        />

        {/* Animated background orbs */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
          >
            {/* Badge */}
            <motion.div variants={fadeUp} className="mb-6">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-sm font-medium">
                <Shield className="w-4 h-4" />
                Bengaluru Traffic Police · Command Intelligence Platform
              </span>
            </motion.div>

            {/* Main Title */}
            <motion.h1
              variants={fadeUp}
              className="text-6xl md:text-8xl font-black tracking-tight mb-4 leading-none"
            >
              <span className="text-black dark:text-transparent dark:bg-gradient-to-r dark:from-white dark:via-slate-100 dark:to-slate-300 dark:bg-clip-text">
                Nirbadha
              </span>
              <br />
              <span
                className="text-black dark:text-transparent dark:bg-gradient-to-r dark:from-amber-400 dark:via-amber-300 dark:to-yellow-200 dark:bg-clip-text"
                style={{ textShadow: 'none' }}
              >
                Pravaha
              </span>
            </motion.h1>

            {/* Kannada meaning */}
            <motion.p
              variants={fadeUp}
              className="text-text-secondary text-lg md:text-xl font-light mb-6 italic"
            >
              ನಿರ್ಬಾಧಿತ ಜೀವನಾಡಿ - "Vitality Uninterrupted"
            </motion.p>

            {/* Subtitle */}
            <motion.p
              variants={fadeUp}
              className="text-text-secondary text-lg md:text-xl max-w-3xl mx-auto mb-10 leading-relaxed"
            >
              Real-time Event Congestion Forecasting &amp; Resource Recommendation
              <br className="hidden md:block" /> for Bengaluru Traffic Police Command Centers
            </motion.p>

            {/* CTAs */}
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/predict"
                className="group relative inline-flex items-center justify-center gap-3 bg-gradient-to-r from-primary to-primary-hover text-white text-lg font-medium px-8 py-4 rounded-full shadow-[0_0_20px_rgba(var(--accent-primary),0.3)] hover:shadow-[0_0_30px_rgba(var(--accent-primary),0.5)] hover:-translate-y-0.5 transition-all duration-300"
              >
                <Zap className="w-5 h-5" />
                <span>Start Forecasting</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/dashboard"
                className="group relative inline-flex items-center justify-center gap-3 bg-surface/50 backdrop-blur-xl border border-border/50 text-text-primary text-lg font-medium px-8 py-4 rounded-full shadow-sm hover:bg-surface hover:shadow-md hover:border-border hover:-translate-y-0.5 transition-all duration-300"
              >
                <Map className="w-5 h-5 text-text-secondary group-hover:text-primary transition-colors" />
                <span>View Live Dashboard</span>
              </Link>
            </motion.div>
          </motion.div>
        </div>

      </section>

      {/* Stat Strip */}
      <section className="py-16 px-6 bg-surface/50">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {stats.map((stat) => (
              <motion.div
                key={stat.label}
                variants={fadeUp}
                className="stat-card group cursor-default"
              >
                <div className={`${stat.color} mb-3 flex justify-center`}>{stat.icon}</div>
                <div className={`text-3xl font-black ${stat.color} mb-1`}>{stat.value}</div>
                <div className="text-text-secondary text-sm">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Honest Metrics Promise */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
          >
            <motion.div variants={fadeUp} className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
                The{' '}
                <span className="bg-gradient-to-r from-amber-400 to-yellow-200 bg-clip-text text-transparent">
                  Honest Metrics
                </span>{' '}
                Promise
              </h2>
              <p className="text-text-secondary text-lg max-w-2xl mx-auto">
                We discovered data leakage that inflated accuracy to 99.8%.
                We audited it, removed it, and rebuilt from scratch.
              </p>
            </motion.div>

            {/* Leakage audit steps */}
            <motion.div
              variants={stagger}
              className="grid md:grid-cols-3 gap-6 mb-10"
            >
              {leakageSteps.map((step) => (
                <motion.div
                  key={step.step}
                  variants={fadeUp}
                  className={`glass p-6 rounded-xl border-t-2 ${
                    step.color === 'red'
                      ? 'border-red-500'
                      : step.color === 'amber'
                      ? 'border-amber-500'
                      : 'border-emerald-500'
                  } hover:scale-[1.02] transition-transform`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    {step.icon}
                    <span
                      className={`text-xs font-bold tracking-wider ${
                        step.color === 'red'
                          ? 'text-red-400'
                          : step.color === 'amber'
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      STEP {step.step}
                    </span>
                  </div>
                  <h3 className="text-text-primary font-bold text-lg mb-2">{step.title}</h3>
                  <p className="text-text-secondary text-sm leading-relaxed">{step.description}</p>
                </motion.div>
              ))}
            </motion.div>

            {/* Yellow callout */}
            <motion.div
              variants={fadeUp}
              className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/5 p-8 text-center"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
              <div className="text-4xl font-black text-amber-400 mb-3">
                We could have reported 99.8%. We chose not to.
              </div>
              <p className="text-text-secondary max-w-2xl mx-auto">
                Real deployments fail when models see test-time features that don't exist at inference time.
                Our ~90-91% accuracy is honest, reproducible, and production-safe.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* System Components */}
      <section className="py-20 px-6 bg-surface/30">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
          >
            <motion.div variants={fadeUp} className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
                Three-Engine{' '}
                <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                  Intelligence Stack
                </span>
              </h2>
              <p className="text-text-secondary text-lg max-w-2xl mx-auto">
                Each component solves a distinct operational challenge for traffic command centers.
              </p>
            </motion.div>

            <motion.div variants={stagger} className="grid md:grid-cols-3 gap-6">
              {components.map((comp) => (
                <motion.div
                  key={comp.title}
                  variants={fadeUp}
                  className={`glass p-6 rounded-xl hover:scale-[1.02] transition-all duration-300 group ${
                    comp.color === 'amber'
                      ? 'hover:border-amber-500/30 hover:shadow-[0_0_20px_rgba(245,158,11,0.1)]'
                      : comp.color === 'blue'
                      ? 'hover:border-blue-500/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)]'
                      : 'hover:border-emerald-500/30 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                  }`}
                >
                  <div
                    className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 ${
                      comp.color === 'amber'
                        ? 'bg-amber-500/15'
                        : comp.color === 'blue'
                        ? 'bg-blue-500/15'
                        : 'bg-emerald-500/15'
                    }`}
                  >
                    {comp.icon}
                  </div>
                  <h3 className="text-text-primary font-bold text-lg mb-1">{comp.title}</h3>
                  <p
                    className={`text-xs font-semibold mb-3 ${
                      comp.color === 'amber'
                        ? 'text-amber-400'
                        : comp.color === 'blue'
                        ? 'text-blue-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {comp.subtitle}
                  </p>
                  <p className="text-text-secondary text-sm leading-relaxed">{comp.description}</p>
                </motion.div>
              ))}
            </motion.div>

            {/* CTA */}
            <motion.div variants={fadeUp} className="text-center mt-12">
              <Link
                to="/predict"
                className="group inline-flex items-center gap-3 btn-amber text-lg px-10 py-4 rounded-xl"
              >
                <Zap className="w-5 h-5" />
                Try the Predictor
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-text-secondary text-sm">
            <Shield className="w-4 h-4 text-amber-400" />
            <span>Nirbadha Pravaha · Bengaluru Traffic Command Center</span>
          </div>
          <div className="text-text-secondary text-xs">
            Data: Astram TMP · Nov 2023 – Apr 2024 · 8,173 events
          </div>
        </div>
      </footer>
    </div>
  )
}
