import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, Zap, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MarkdownRenderer } from '../ui/MarkdownRenderer';

interface Flow {
  title: string;
  description: string;
  action_url: string;
  icon: string;
}

interface CohesiveSummary {
  overview: string;
  flows: Flow[];
}

export function CohesionSummaryWidget() {
  const [summary, setSummary] = useState<CohesiveSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSummary() {
      try {
        const response = await fetch('/api/analytics?resource=home-summary');
        if (response.ok) {
          const data = await response.json();
          setSummary(data);
        }
      } catch (error) {
        console.error('Failed to fetch cohesive summary:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSummary();
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
        <div className="animate-pulse bg-[var(--glass-surface)] rounded-2xl h-32 border border-[var(--glass-surface-hover)]" />
      </div>
    );
  }

  if (!summary) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl p-8 border border-[var(--glass-surface-hover)] backdrop-blur-3xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent"
      >
        <div className="absolute top-0 right-0 p-4 opacity-20">
          <Zap className="h-12 w-12 text-brand-primary" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-brand-primary/20 flex items-center justify-center">
              <Brain className="h-5 w-5 text-brand-primary" />
            </div>
            <h2 className="text-sm font-bold uppercase racking-wides ext-indigo-300">Where you're at</h2>
          </div>

          <div className="mb-8 max-w-4xl text-xl md:text-2xl font-medium text-[var(--brand-text-primary)]/90 leading-relaxed">
            <MarkdownRenderer
              content={summary.overview}
              className="text-xl md:text-2xl font-medium"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {summary.flows.map((flow, idx) => (
              <Link
                key={idx}
                to={flow.action_url}
                className="group flex items-center gap-4 p-4 rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-surface)] hover:border-indigo-500/30 hover:bg-[rgba(255,255,255,0.1)] transition-all duration-300"
              >
                <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-brand-primary/20 flex items-center justify-center text-brand-primary group-hover:scale-110 transition-transform">
                  {flow.icon === 'zap' && <Zap className="h-5 w-5" />}
                  {flow.icon === 'link' && <ArrowRight className="h-5 w-5 rotate-45" />}
                  {flow.icon === 'brain' && <Brain className="h-5 w-5" />}
                  {flow.icon === 'list' && <Zap className="h-5 w-5" />}
                  {!['zap', 'link', 'brain', 'list'].includes(flow.icon) && <Zap className="h-5 w-5" />}
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold ext-white">{flow.title}</h3>
                  <p className="text-xs text-[var(--brand-text-primary)]/50">{flow.description}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-[var(--brand-text-primary)]/30 group-hover:text-[var(--brand-text-primary)] group-hover:translate-x-1 transition-all" />
              </Link>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
