import { Footprints } from 'lucide-react';
import type { RecoveryPhase } from '../data/recoveryPlan';
import { WALKING_STARTING_GUIDANCE, WALKING_RPE_GUIDANCE, WALKING_STOP_SIGNS } from '../data/recoveryPlan';

interface TodaysMoveProps {
  phase: RecoveryPhase;
}

export default function TodaysMove({ phase }: TodaysMoveProps) {
  const stage = phase.walkingStage;

  return (
    <section className="card border-recovery-teal/30 text-center">
      <div className="flex items-center justify-center gap-2 text-recovery-teal mb-1">
        <Footprints className="w-5 h-5" />
        <h2 className="font-bold uppercase tracking-wide text-sm">Today's walk</h2>
      </div>

      {stage ? (
        <>
          <p className="text-4xl font-bold">{stage.minutes} min</p>
          <p className="text-recovery-ink/70 mt-1">{stage.pace}</p>
          <p className="text-recovery-ink/50 text-xs mt-1">
            {stage.label} of a typical NHS cardiac rehab walking plan — move up a stage once this
            feels easy, not by the calendar.
          </p>
        </>
      ) : (
        <p className="text-recovery-ink/80 mt-1">{WALKING_STARTING_GUIDANCE}</p>
      )}

      <p className="text-recovery-ink/70 text-sm mt-3">{WALKING_RPE_GUIDANCE}</p>
      <p className="text-recovery-ink/50 text-sm mt-2">{WALKING_STOP_SIGNS}</p>
    </section>
  );
}
