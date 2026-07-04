import type { RecoveryPhase } from '../data/recoveryPlan';

const TRACK_MAX_DAY = 90;

interface JourneyBarProps {
  dayNumber: number;
  phases: RecoveryPhase[];
}

export default function JourneyBar({ dayNumber, phases }: JourneyBarProps) {
  const clampedDay = Math.min(dayNumber, TRACK_MAX_DAY);
  const percent = Math.max(0, Math.min(100, (clampedDay / TRACK_MAX_DAY) * 100));

  return (
    <div className="px-1" aria-label={`Day ${dayNumber} of your recovery`}>
      <div className="relative h-2.5 bg-black/10 rounded-full">
        <div
          className="absolute inset-y-0 left-0 bg-recovery-teal rounded-full transition-[width]"
          style={{ width: `${percent}%` }}
        />
        {phases.map((phase) => (
          <div
            key={phase.id}
            className="absolute top-1/2 w-1.5 h-1.5 rounded-full bg-white ring-2 ring-recovery-teal-dark/30"
            style={{
              left: `${Math.min(100, (phase.dayRange.start / TRACK_MAX_DAY) * 100)}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}
        <div
          className="absolute top-1/2 w-4 h-4 rounded-full bg-recovery-teal border-2 border-white shadow"
          style={{ left: `${percent}%`, transform: 'translate(-50%, -50%)' }}
        />
      </div>
      <div className="flex justify-between text-xs text-recovery-ink/45 mt-1.5">
        <span>Day 1</span>
        <span>12 weeks+</span>
      </div>
    </div>
  );
}
