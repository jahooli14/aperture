/**
 * DailySpark — ambient daily synthesis from the knowledge graph.
 *
 * Not a recommendation. Not a task. Just the connection you hadn't made yet.
 * Shows once per day, cached in localStorage to avoid redundant fetches.
 */

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, X } from 'lucide-react'

interface SparkItem {
  id: string
  title: string
  type: 'thought' | 'article' | 'project'
}

interface SparkData {
  insight: string
  item_a: SparkItem
  item_b: SparkItem
  generated_at: string
}

const CACHE_KEY = 'polymath_daily_spark'
const DISMISSED_KEY = 'polymath_spark_dismissed'

function getTypeLabel(type: SparkItem['type']) {
  if (type === 'thought') return 'thought'
  if (type === 'article') return 'article'
  return 'project'
}

export function DailySpark() {
  const [spark, setSpark] = useState<SparkData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const today = new Date().toDateString()
    const dismissedOn = localStorage.getItem(DISMISSED_KEY)
    if (dismissedOn === today) {
      setDismissed(true)
      setLoading(false)
      return
    }

    // Check local cache first — spark is a daily thing
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        const { data, date } = JSON.parse(cached)
        if (date === today && data) {
          setSpark(data)
          setLoading(false)
          return
        }
      }
    } catch {}

    fetch('/api/analytics?resource=spark')
      .then((r) => (r.ok ? r.json() : { spark: null }))
      .then(({ spark: data }) => {
        if (data) {
          setSpark(data)
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data, date: today }))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem(DISMISSED_KEY, new Date().toDateString())
  }

  if (loading || dismissed || !spark) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative rounded-xl p-4 mb-1"
        style={{
          background: 'rgba(255,255,255,0.03)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07)',
        }}
      >
        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 rounded-full opacity-20 hover:opacity-50 transition-opacity"
          style={{ color: 'var(--brand-text-secondary)' }}
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div
            className="flex items-center justify-center h-6 w-6 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.07)' }}
          >
            <Zap className="h-3.5 w-3.5" style={{ color: 'var(--brand-primary)' }} />
          </div>
          <span
            className="text-[11px] font-semibold tracking-widest uppercase"
            style={{ color: 'var(--brand-text-secondary)', opacity: 0.5 }}
          >
            Today's Spark
          </span>
        </div>

        {/* The insight */}
        <p
          className="text-sm leading-relaxed mb-3 pr-6"
          style={{ color: 'var(--brand-text-primary)' }}
        >
          {spark.insight}
        </p>

        {/* Source attribution — subtle, not distracting */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-[11px] px-2 py-0.5 rounded-full"
            style={{
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--brand-text-secondary)',
              opacity: 0.6,
            }}
          >
            {getTypeLabel(spark.item_a.type)}: {spark.item_a.title.slice(0, 32)}
            {spark.item_a.title.length > 32 ? '…' : ''}
          </span>
          <span style={{ color: 'var(--brand-text-secondary)', opacity: 0.3, fontSize: '11px' }}>
            --
          </span>
          <span
            className="text-[11px] px-2 py-0.5 rounded-full"
            style={{
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--brand-text-secondary)',
              opacity: 0.6,
            }}
          >
            {getTypeLabel(spark.item_b.type)}: {spark.item_b.title.slice(0, 32)}
            {spark.item_b.title.length > 32 ? '…' : ''}
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
