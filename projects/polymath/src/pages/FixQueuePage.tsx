import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wrench, Check, X, Play, Clock, AlertTriangle, Zap, Mail, Cloud, Home, ChevronDown, ChevronUp, ArrowLeft, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthContext } from '../contexts/AuthContext'
import { useToast } from '../components/ui/toast'
import { SubtleBackground } from '../components/SubtleBackground'

interface FixRequirement {
  env_var: string
  label: string
  description: string
}

interface FixDraft {
  name: string
  description: string
  schedule: { cron: string; timezone: string; description: string }
  actions: Array<{ type: string; [key: string]: unknown }>
  estimated_cost: string
  requirements?: FixRequirement[]
  ready?: boolean
}

interface FixItem {
  id: string
  content: string
  status: string
  created_at: string
  metadata: {
    severity?: string
    automatable?: boolean
    fix_hint?: string
    fix_status?: string
    fix_draft?: FixDraft
    original_thought?: string
    last_run_at?: string
    last_run_success?: boolean
    deployed_at?: string
    rejection_reason?: string
    run_count?: number
  }
}

const SEVERITY_CONFIG = {
  critical: { color: '#ef4444', label: 'Critical', icon: AlertTriangle },
  annoying: { color: '#f59e0b', label: 'Annoying', icon: Zap },
  minor: { color: '#6b7280', label: 'Minor', icon: Clock },
} as const

const STATUS_CONFIG: Record<string, { color: string; label: string; bg: string }> = {
  draft_pending: { color: '#9ca3af', label: 'Drafting...', bg: 'rgba(156, 163, 175, 0.1)' },
  drafted: { color: '#f59e0b', label: 'Ready to approve', bg: 'rgba(245, 158, 11, 0.1)' },
  approved: { color: '#3b82f6', label: 'Approved', bg: 'rgba(59, 130, 246, 0.1)' },
  deployed: { color: '#10b981', label: 'Running', bg: 'rgba(16, 185, 129, 0.1)' },
  manual: { color: '#8b5cf6', label: 'Manual fix needed', bg: 'rgba(139, 92, 246, 0.1)' },
  rejected: { color: '#ef4444', label: 'Rejected', bg: 'rgba(239, 68, 68, 0.1)' },
}

function ActionTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'send_email':
    case 'send_email_digest':
    case 'weather_email':
      return <Mail className="h-3.5 w-3.5" />
    case 'smart_home':
      return <Home className="h-3.5 w-3.5" />
    case 'http_request':
      return <Cloud className="h-3.5 w-3.5" />
    default:
      return <Zap className="h-3.5 w-3.5" />
  }
}

export function FixQueuePage() {
  const [items, setItems] = useState<FixItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [approving, setApproving] = useState<string | null>(null)
  const navigate = useNavigate()
  const { user } = useAuthContext()
  const { addToast } = useToast()

  const fetchItems = useCallback(async () => {
    if (!user) return
    // Find the fix queue list
    const { data: fixList } = await supabase
      .from('lists')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', 'fix')
      .maybeSingle()

    if (!fixList) {
      setItems([])
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('list_items')
      .select('*')
      .eq('list_id', fixList.id)
      .order('created_at', { ascending: false })

    setItems((data as FixItem[]) || [])
    setLoading(false)
  }, [user])

  useEffect(() => { fetchItems() }, [fetchItems])

  const getAuthHeaders = async () => {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
  }

  const handleApprove = async (item: FixItem) => {
    setApproving(item.id)
    const headers = await getAuthHeaders()
    const draft = item.metadata.fix_draft

    // Let the server check requirements (it has live env vars, client doesn't)
    const resp = await fetch('/api/fix-queue?action=approve', {
      method: 'POST',
      headers,
      body: JSON.stringify({ item_id: item.id })
    })

    if (resp.ok) {
      addToast({ title: `Approved: ${draft?.name}`, variant: 'success' })
      fetchItems()
    } else {
      const err = await resp.json().catch(() => ({ error: 'Failed' }))
      addToast({ title: err.error || 'Approval failed', variant: 'default' })
    }
    setApproving(null)
  }

  const handleReject = async (item: FixItem) => {
    const headers = await getAuthHeaders()
    await fetch('/api/fix-queue?action=reject', {
      method: 'POST',
      headers,
      body: JSON.stringify({ item_id: item.id })
    })

    addToast({ title: 'Fix rejected', variant: 'default' })
    fetchItems()
  }

  const handleMarkDone = async (item: FixItem) => {
    await supabase
      .from('list_items')
      .update({
        status: 'completed',
        metadata: {
          ...item.metadata,
          fix_status: 'completed',
          completed_at: new Date().toISOString()
        }
      })
      .eq('id', item.id)

    addToast({ title: 'Marked as fixed!', variant: 'success' })
    fetchItems()
  }

  // Group items by status
  const drafted = items.filter(i => i.metadata?.fix_status === 'drafted')
  const deployed = items.filter(i => i.metadata?.fix_status === 'deployed')
  const pending = items.filter(i => i.metadata?.fix_status === 'draft_pending')
  const manual = items.filter(i => i.metadata?.fix_status === 'manual')
  const done = items.filter(i => ['completed', 'rejected'].includes(i.metadata?.fix_status || ''))

  return (
    <div className="min-h-screen pb-32" style={{ backgroundColor: 'var(--brand-bg)' }}>
      <SubtleBackground />

      {/* Header */}
      <div className="sticky top-0 z-20 backdrop-blur-xl" style={{ backgroundColor: 'rgba(var(--brand-bg-rgb), 0.8)' }}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
            <ArrowLeft className="h-5 w-5" style={{ color: 'var(--brand-text-secondary)' }} />
          </button>
          <Wrench className="h-5 w-5" style={{ color: '#f59e0b' }} />
          <h1 className="text-xl font-bold" style={{ color: 'var(--brand-text)' }}>Fix Queue</h1>
          <span className="text-sm ml-auto" style={{ color: 'var(--brand-text-tertiary)' }}>
            {deployed.length} running
          </span>
          <button onClick={() => { setLoading(true); fetchItems() }} className="p-2 rounded-xl hover:bg-white/5">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} style={{ color: 'var(--brand-text-tertiary)' }} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 space-y-6">

        {/* Empty state */}
        {!loading && items.length === 0 && (
          <div className="text-center py-16">
            <Wrench className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--brand-text-tertiary)' }} />
            <p className="text-lg font-medium mb-2" style={{ color: 'var(--brand-text)' }}>No annoyances yet</p>
            <p className="text-sm" style={{ color: 'var(--brand-text-tertiary)' }}>
              Voice-capture a frustration and it'll appear here with a fix draft
            </p>
          </div>
        )}

        {/* Ready to approve */}
        {drafted.length > 0 && (
          <Section title="Ready to Approve" count={drafted.length} color="#f59e0b">
            {drafted.map(item => (
              <FixCard
                key={item.id}
                item={item}
                expanded={expandedId === item.id}
                onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                actions={
                  <>
                    <button
                      onClick={() => handleApprove(item)}
                      disabled={approving === item.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:scale-105"
                      style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}
                    >
                      <Check className="h-3.5 w-3.5" />
                      {approving === item.id ? 'Approving...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleReject(item)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:scale-105"
                      style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
                    >
                      <X className="h-3.5 w-3.5" />
                      Reject
                    </button>
                  </>
                }
              />
            ))}
          </Section>
        )}

        {/* Currently running */}
        {deployed.length > 0 && (
          <Section title="Running" count={deployed.length} color="#10b981">
            {deployed.map(item => (
              <FixCard
                key={item.id}
                item={item}
                expanded={expandedId === item.id}
                onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                actions={
                  <button
                    onClick={() => handleMarkDone(item)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:scale-105"
                    style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Mark Fixed
                  </button>
                }
              />
            ))}
          </Section>
        )}

        {/* Drafting */}
        {pending.length > 0 && (
          <Section title="Drafting" count={pending.length} color="#9ca3af">
            {pending.map(item => (
              <FixCard
                key={item.id}
                item={item}
                expanded={expandedId === item.id}
                onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
              />
            ))}
          </Section>
        )}

        {/* Manual fixes */}
        {manual.length > 0 && (
          <Section title="Manual Fixes" count={manual.length} color="#8b5cf6">
            {manual.map(item => (
              <FixCard
                key={item.id}
                item={item}
                expanded={expandedId === item.id}
                onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                actions={
                  <button
                    onClick={() => handleMarkDone(item)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:scale-105"
                    style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Done
                  </button>
                }
              />
            ))}
          </Section>
        )}

        {/* Completed / Rejected */}
        {done.length > 0 && (
          <Section title="Archive" count={done.length} color="#6b7280" defaultCollapsed>
            {done.map(item => (
              <FixCard
                key={item.id}
                item={item}
                expanded={expandedId === item.id}
                onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
              />
            ))}
          </Section>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Section
// ============================================================================

function Section({ title, count, color, defaultCollapsed = false, children }: {
  title: string; count: number; color: string; defaultCollapsed?: boolean; children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  return (
    <div>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 mb-3 group"
      >
        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--brand-text)' }}>{title}</span>
        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${color}20`, color }}>
          {count}
        </span>
        {collapsed ? (
          <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-40 group-hover:opacity-70 transition-opacity" style={{ color: 'var(--brand-text-tertiary)' }} />
        ) : (
          <ChevronUp className="h-3.5 w-3.5 ml-1 opacity-40 group-hover:opacity-70 transition-opacity" style={{ color: 'var(--brand-text-tertiary)' }} />
        )}
      </button>
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-3 overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================================================
// Fix Card
// ============================================================================

function FixCard({ item, expanded, onToggle, actions }: {
  item: FixItem; expanded: boolean; onToggle: () => void; actions?: React.ReactNode
}) {
  const meta = item.metadata || {}
  const severity = SEVERITY_CONFIG[meta.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.minor
  const status = STATUS_CONFIG[meta.fix_status || 'draft_pending'] || STATUS_CONFIG.draft_pending
  const draft = meta.fix_draft
  const SeverityIcon = severity.icon

  return (
    <motion.div
      layout
      className="rounded-2xl border overflow-hidden"
      style={{
        backgroundColor: 'var(--brand-card-bg)',
        borderColor: 'var(--brand-card-border)'
      }}
    >
      {/* Main row */}
      <button
        onClick={onToggle}
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-white/[0.02] transition-colors"
      >
        <SeverityIcon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: severity.color }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug" style={{ color: 'var(--brand-text)' }}>
            {item.content}
          </p>
          {draft && (
            <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--brand-text-tertiary)' }}>
              {draft.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: status.bg, color: status.color }}
            >
              {status.label}
            </span>
            {draft?.schedule && (
              <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--brand-text-tertiary)' }}>
                <Clock className="h-2.5 w-2.5" />
                {draft.schedule.description}
              </span>
            )}
            {draft?.actions && (
              <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--brand-text-tertiary)' }}>
                {draft.actions.map((a, i) => (
                  <ActionTypeIcon key={i} type={a.type} />
                ))}
              </span>
            )}
            {meta.last_run_at && (
              <span className="text-[10px]" style={{ color: meta.last_run_success ? '#10b981' : '#ef4444' }}>
                {meta.last_run_success ? 'Last run' : 'Failed'}: {new Date(meta.last_run_at).toLocaleDateString()}
                {meta.run_count ? ` (${meta.run_count}x)` : ''}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: 'var(--brand-card-border)' }}>
              {/* Original thought */}
              {meta.original_thought && (
                <div className="pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--brand-text-tertiary)' }}>
                    Original note
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--brand-text-secondary)' }}>
                    {meta.original_thought}
                  </p>
                </div>
              )}

              {/* Fix draft detail */}
              {draft && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--brand-text-tertiary)' }}>
                    Automation plan
                  </p>
                  <div className="space-y-2">
                    {draft.actions.map((action, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 p-2.5 rounded-xl"
                        style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                      >
                        <ActionTypeIcon type={action.type} />
                        <div className="text-xs leading-relaxed" style={{ color: 'var(--brand-text-secondary)' }}>
                          <span className="font-medium" style={{ color: 'var(--brand-text)' }}>
                            {action.type.replace(/_/g, ' ')}
                          </span>
                          {action.type === 'send_email' && (
                            <p className="mt-0.5">"{(action as { subject?: string }).subject}"</p>
                          )}
                          {action.type === 'weather_email' && (
                            <p className="mt-0.5">Weather briefing → {(action as { to?: string }).to}</p>
                          )}
                          {action.type === 'smart_home' && (
                            <p className="mt-0.5">{(action as { device?: string }).device} → {(action as { command?: string }).command}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px]" style={{ color: 'var(--brand-text-tertiary)' }}>
                      Est. cost: {draft.estimated_cost}
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--brand-text-tertiary)' }}>
                      Schedule: {draft.schedule.cron}
                    </span>
                  </div>
                </div>
              )}

              {/* Requirements / not-ready warning */}
              {draft?.ready === false && draft?.requirements && draft.requirements.length > 0 && (
                <div className="p-2.5 rounded-xl" style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#f59e0b' }}>
                    Setup needed before this can run
                  </p>
                  {draft.requirements.map((req, i) => (
                    <div key={i} className="flex items-start gap-2 mt-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" style={{ color: '#f59e0b' }} />
                      <div>
                        <p className="text-xs font-medium" style={{ color: 'var(--brand-text)' }}>{req.label}</p>
                        <p className="text-[10px]" style={{ color: 'var(--brand-text-tertiary)' }}>{req.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Fix hint for manual items */}
              {!draft && meta.fix_hint && (
                <div className="pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--brand-text-tertiary)' }}>
                    Suggestion
                  </p>
                  <p className="text-xs" style={{ color: 'var(--brand-text-secondary)' }}>{meta.fix_hint}</p>
                </div>
              )}

              {/* Action buttons */}
              {actions && (
                <div className="flex items-center gap-2 pt-2">
                  {actions}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default FixQueuePage
