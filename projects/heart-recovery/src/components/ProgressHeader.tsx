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
      ? `Your next stage starts today — ${nextMilestone.weekLabel}: ${nextMilestone.title}`
      : `${nextMilestone.daysUntil} day${nextMilestone.daysUntil === 1 ? '' : 's'} until ${nextMilestone.weekLabel}: ${nextMilestone.title}`
    : null;

  return (
    <header className="text-center pt-3">
      <p className="text-recovery-teal font-semibold tracking-wide uppercase text-sm">
        Day {dayNumber} &middot; Week {weekNumber}
      </p>
      <h1 className="text-2xl font-bold mt-1 leading-tight">{phase.title}</h1>
      <p className="text-recovery-ink/70 mt-1.5 max-w-md mx-auto leading-snug">{phase.encouragement}</p>
      {countdownText && (
        <p className="mt-2.5 inline-block text-sm bg-recovery-teal-light text-recovery-teal-dark rounded-full px-4 py-1.5 font-medium">
          {countdownText}
        </p>
      )}
      {phase.milestone && (
        <p className="text-recovery-ink/50 text-xs mt-1.5 max-w-md mx-auto leading-snug">{phase.milestone}</p>
      )}
      <div>
        <button
          type="button"
          onClick={onChangeDate}
          className="mt-2 text-sm text-recovery-ink/50 underline tap-target"
        >
          Change date
        </button>
      </div>
    </header>
  );
}
