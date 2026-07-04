import type { RecoveryPhase, NextMilestone } from '../data/recoveryPlan';

interface ProgressHeaderProps {
  dayNumber: number;
  phase: RecoveryPhase;
  nextMilestone: NextMilestone | null;
  onChangeDate: () => void;
}

export default function ProgressHeader({ dayNumber, phase, nextMilestone, onChangeDate }: ProgressHeaderProps) {
  const weekNumber = Math.ceil(dayNumber / 7);

  const countdownText = nextMilestone
    ? nextMilestone.daysUntil <= 0
      ? `Your next stage starts today — ${nextMilestone.weekLabel}`
      : `${nextMilestone.daysUntil} day${nextMilestone.daysUntil === 1 ? '' : 's'} until ${nextMilestone.weekLabel}`
    : null;

  return (
    <header className="text-center pt-4 pb-1">
      <p className="text-recovery-teal font-semibold tracking-wide uppercase text-sm">
        Day {dayNumber} &middot; Week {weekNumber}
      </p>
      <h1 className="text-3xl font-bold mt-1 leading-tight">{phase.title}</h1>
      <p className="text-recovery-ink/70 mt-2 max-w-md mx-auto leading-relaxed">{phase.encouragement}</p>
      {phase.why && (
        <p className="text-recovery-ink/55 text-sm mt-2 max-w-md mx-auto leading-relaxed">{phase.why}</p>
      )}
      {phase.milestone && (
        <p className="text-recovery-ink/55 text-sm mt-2 max-w-md mx-auto leading-relaxed">{phase.milestone}</p>
      )}
      {countdownText && (
        <p className="mt-3 inline-block text-sm bg-recovery-teal-light text-recovery-teal-dark rounded-full px-4 py-1.5 font-medium">
          {countdownText}
        </p>
      )}
      <div>
        <button
          type="button"
          onClick={onChangeDate}
          className="mt-3 text-sm text-recovery-ink/50 underline tap-target"
        >
          Change date
        </button>
      </div>
    </header>
  );
}
