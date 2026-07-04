import { ChevronDown } from 'lucide-react';
import type { RecoveryPhase } from '../data/recoveryPlan';

interface TimelineProps {
  phases: RecoveryPhase[];
  currentPhaseId: string;
}

export default function Timeline({ phases, currentPhaseId }: TimelineProps) {
  const currentIndex = phases.findIndex((p) => p.id === currentPhaseId);

  return (
    <details className="group">
      <summary className="font-bold cursor-pointer flex items-center gap-1.5">
        <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
        See your full path to recovery
      </summary>
      <ul className="space-y-2 mt-3">
        {phases.map((phase, index) => {
          const isCurrent = phase.id === currentPhaseId;
          const isPast = currentIndex >= 0 && index < currentIndex;

          return (
            <li
              key={phase.id}
              className={
                isCurrent
                  ? 'card border-recovery-teal ring-2 ring-recovery-teal/30'
                  : isPast
                    ? 'card opacity-50'
                    : 'card opacity-80'
              }
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">{phase.weekLabel}</span>
                {isCurrent && (
                  <span className="text-xs font-bold uppercase tracking-wide text-recovery-teal">
                    You are here
                  </span>
                )}
              </div>
              <p className="text-recovery-ink/80">{phase.title}</p>
              {phase.milestone && (
                <p className="text-recovery-ink/50 text-sm mt-1">{phase.milestone}</p>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
