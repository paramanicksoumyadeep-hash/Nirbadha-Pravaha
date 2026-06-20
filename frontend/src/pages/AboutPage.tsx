import { motion } from 'framer-motion'
import {
  Database,
  Cpu,
  Layers,
  Shield,
  ArrowRight,
  Map,
  Clock,
  Users,
  GitBranch,
  CheckCircle,
} from 'lucide-react'

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
}

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
}

const TECH_STACK = [
  { label: 'Python 3.11', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { label: 'LightGBM', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { label: 'Random Forest', color: 'bg-teal-500/20 text-teal-300 border-teal-500/30' },
  { label: 'scikit-learn', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  { label: 'pandas', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { label: 'NumPy', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  { label: 'FastAPI', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  { label: 'React 18', color: 'bg-blue-400/20 text-blue-300 border-blue-400/30' },
  { label: 'TypeScript', color: 'bg-blue-600/20 text-blue-200 border-blue-600/30' },
  { label: 'Tailwind CSS', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
  { label: 'Recharts', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  { label: 'React-Leaflet', color: 'bg-emerald-600/20 text-emerald-200 border-emerald-600/30' },
  { label: 'Framer Motion', color: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
  { label: 'KMeans Clustering', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { label: 'Docker', color: 'bg-blue-700/20 text-blue-200 border-blue-700/30' },
]

const ARCHITECTURE_NODES = [
  {
    id: 'csv',
    icon: <Database className="w-5 h-5" />,
    label: 'CSV Data',
    sublabel: 'Astram TMP\n8,173 events',
    color: 'border-blue-500/50 bg-blue-500/10',
    iconColor: 'text-blue-400',
  },
  {
    id: 'fe',
    icon: <GitBranch className="w-5 h-5" />,
    label: 'Feature Engineering',
    sublabel: 'Geo-cluster, temporal\nencoding, audit',
    color: 'border-amber-500/50 bg-amber-500/10',
    iconColor: 'text-amber-400',
  },
  {
    id: 'lgbm',
    icon: <Cpu className="w-5 h-5" />,
    label: 'LightGBM Classifier',
    sublabel: 'Closure risk\n~90-91% acc',
    color: 'border-emerald-500/50 bg-emerald-500/10',
    iconColor: 'text-emerald-400',
  },
  {
    id: 'rf',
    icon: <Layers className="w-5 h-5" />,
    label: 'RF Regressor',
    sublabel: 'Duration forecast\nR² = 0.51',
    color: 'border-teal-500/50 bg-teal-500/10',
    iconColor: 'text-teal-400',
  },
  {
    id: 'rules',
    icon: <Shield className="w-5 h-5" />,
    label: 'Rule Engine',
    sublabel: 'Manpower\nBarricades\nDiversion',
    color: 'border-purple-500/50 bg-purple-500/10',
    iconColor: 'text-purple-400',
  },
  {
    id: 'ui',
    icon: <Map className="w-5 h-5" />,
    label: 'Command Center UI',
    sublabel: 'React + TypeScript\nReal-time dashboard',
    color: 'border-red-500/50 bg-red-500/10',
    iconColor: 'text-red-400',
  },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen pt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="text-center mb-16"
        >
          <motion.h1 variants={fadeUp} className="text-4xl md:text-5xl font-black mb-6">
            About{' '}
            <span className="bg-gradient-to-r from-amber-400 to-yellow-200 bg-clip-text text-transparent">
              Nirbadha Pravaha
            </span>
          </motion.h1>
          <motion.p variants={fadeUp} className="text-text-secondary text-xl max-w-3xl mx-auto leading-relaxed">
            An end-to-end ML pipeline built for Bengaluru Traffic Police to forecast
            event-driven congestion, predict resource requirements, and enable proactive deployment.
          </motion.p>
        </motion.div>

        {/* Problem Statement */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="mb-16"
        >
          <motion.h2 variants={fadeUp} className="text-2xl font-bold text-text-primary mb-6">
            The Problem
          </motion.h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <Clock className="w-6 h-6 text-red-400" />,
                title: 'Reactive Deployment',
                text: 'Traffic police currently deploy officers reactively — after an event has already caused congestion. This leads to delays, under-staffing, and prolonged clearance times.',
                color: 'border-red-500',
              },
              {
                icon: <Users className="w-6 h-6 text-amber-400" />,
                title: 'Resource Estimation Guesswork',
                text: 'Manpower allocation and barricade deployment are often based on intuition. There\'s no data-driven system to recommend the right number of officers per event type.',
                color: 'border-amber-500',
              },
              {
                icon: <Map className="w-6 h-6 text-blue-400" />,
                title: 'No Hotspot Intelligence',
                text: 'High-risk corridors and geo-clusters with repeated closure events have no systematic identification. Every event is treated independently instead of leveraging historical patterns.',
                color: 'border-blue-500',
              },
            ].map((item) => (
              <motion.div
                key={item.title}
                variants={fadeUp}
                className={`glass p-6 rounded-xl border-t-2 ${item.color}`}
              >
                <div className="mb-3">{item.icon}</div>
                <h3 className="text-text-primary font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{item.text}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Architecture Diagram */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="mb-16"
        >
          <motion.h2 variants={fadeUp} className="text-2xl font-bold text-text-primary mb-8">
            System Architecture
          </motion.h2>
          <motion.div variants={fadeUp} className="glass rounded-2xl p-8">
            {/* Desktop horizontal flow */}
            <div className="hidden md:flex items-stretch gap-0 overflow-x-auto">
              {ARCHITECTURE_NODES.map((node, i) => (
                <div key={node.id} className="flex items-center">
                  {/* Node */}
                  <div
                    className={`flex-shrink-0 w-36 border rounded-xl p-4 text-center ${node.color}`}
                  >
                    <div className={`flex justify-center mb-2 ${node.iconColor}`}>{node.icon}</div>
                    <div className="text-text-primary font-semibold text-xs leading-tight mb-1">
                      {node.label}
                    </div>
                    <div className="text-text-secondary text-[10px] leading-tight whitespace-pre-line">
                      {node.sublabel}
                    </div>
                  </div>
                  {/* Arrow */}
                  {i < ARCHITECTURE_NODES.length - 1 && (
                    <div className="flex items-center px-1">
                      <div className="w-6 h-0.5 bg-border" />
                      <ArrowRight className="w-4 h-4 text-text-secondary flex-shrink-0" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Mobile vertical flow */}
            <div className="md:hidden space-y-3">
              {ARCHITECTURE_NODES.map((node, i) => (
                <div key={node.id} className="flex flex-col items-center">
                  <div className={`w-full border rounded-xl p-4 flex items-center gap-3 ${node.color}`}>
                    <div className={node.iconColor}>{node.icon}</div>
                    <div>
                      <div className="text-text-primary font-semibold text-sm">{node.label}</div>
                      <div className="text-text-secondary text-xs">{node.sublabel.replace('\n', ' · ')}</div>
                    </div>
                  </div>
                  {i < ARCHITECTURE_NODES.length - 1 && (
                    <div className="flex flex-col items-center py-1">
                      <div className="w-0.5 h-4 bg-border" />
                      <ArrowRight className="w-4 h-4 text-text-secondary rotate-90" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Data flow legend */}
            <div className="mt-6 pt-6 border-t border-border flex flex-wrap gap-6 text-xs text-text-secondary">
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-text-secondary" />
                <ArrowRight className="w-3 h-3" />
                Data flow
              </div>
              <div>Training pipeline is offline; inference runs in real-time via FastAPI REST</div>
            </div>
          </motion.div>
        </motion.section>

        {/* Data Source */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="mb-16"
        >
          <motion.h2 variants={fadeUp} className="text-2xl font-bold text-text-primary mb-6">
            Data Source
          </motion.h2>
          <motion.div variants={fadeUp} className="glass rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                <Database className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-text-primary font-bold text-lg mb-1">
                  Astram Traffic Management Platform
                </h3>
                <p className="text-amber-400 text-sm mb-3">Bengaluru City Traffic Police · Nov 2023 – Apr 2024</p>
                <div className="grid sm:grid-cols-3 gap-4 mb-4">
                  {[
                    { label: 'Total Events', value: '8,173' },
                    { label: 'Date Range', value: '6 months' },
                    { label: 'Geo-Clusters', value: '25' },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-surface/50 rounded-lg p-3">
                      <div className="text-text-secondary text-xs mb-1">{stat.label}</div>
                      <div className="text-text-primary font-bold text-xl">{stat.value}</div>
                    </div>
                  ))}
                </div>
                <p className="text-text-secondary text-sm leading-relaxed">
                  Data includes event type, location (lat/lon), vehicle type, start/end timestamps, road closure flag,
                  police zone, corridor, and authentication status. Fully anonymized — no personal data.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.section>

        {/* Tech Stack */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="mb-16"
        >
          <motion.h2 variants={fadeUp} className="text-2xl font-bold text-text-primary mb-6">
            Technology Stack
          </motion.h2>
          <motion.div variants={fadeUp} className="flex flex-wrap gap-2">
            {TECH_STACK.map((tech) => (
              <span
                key={tech.label}
                className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-sm font-medium border ${tech.color}`}
              >
                {tech.label}
              </span>
            ))}
          </motion.div>
        </motion.section>

        {/* Leakage Audit Highlights */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="mb-8"
        >
          <motion.h2 variants={fadeUp} className="text-2xl font-bold text-text-primary mb-6">
            Leakage Audit Highlights
          </motion.h2>
          <motion.div variants={fadeUp} className="glass rounded-xl p-6 space-y-4">
            {[
              'Identified 3 categories of leaky features: post-event corridor metadata, resolved closure flags, and dispatch record proxies',
              'Enforced chronological train/test split (no random shuffling across time boundary)',
              'Applied class_weight="balanced" to handle 79%/21% class imbalance without oversampling',
              'Removed all corridor_info_* columns from training — derived at prediction time using spatial KMeans lookup',
              'Final model uses exactly 30 pre-event features available at dispatch time',
              'ROC-AUC of 0.80 is validated on a true hold-out set with no data leakage',
            ].map((point, i) => (
              <div key={i} className="flex items-start gap-3">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <p className="text-text-secondary text-sm leading-relaxed">{point}</p>
              </div>
            ))}
          </motion.div>
        </motion.section>
      </div>
    </div>
  )
}
