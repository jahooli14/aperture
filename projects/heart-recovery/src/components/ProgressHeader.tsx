import type { RecoveryPhase } from '../data/recoveryPlan';

interface ProgressHeaderProps {
  dayNumber: number;
  phase: RecoveryPhase;
  onChangeDate: () => void;
}

export default function ProgressHeader({ dayNumber, phase, onChangeDate }: ProgressHeaderProps) {
  const weekNumber = Math.ceil(dayNumber / 7);

  return (
    <header className="text-center pt-4 pb-2">
      <p className="text-recovery-teal font-semibold tracking-wide uppercase text-sm">
        Day {dayNumber} &middot; Week {weekNumber}
      </p>
      <h1 className="text-3xl font-bold mt-1">{phase.title}</h1>
      <p className="text-recovery-ink/70 mt-2 max-w-md mx-auto">{phase.encouragement}</p>
      {phase.milestone && (
        <p className="mt-3 inline-block text-sm bg-recovery-teal-light text-recovery-teal-dark rounded-full px-4 py-1.5 font-medium">
          {phase.milestone}
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
