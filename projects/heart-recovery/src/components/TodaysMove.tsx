import { Footprints } from 'lucide-react';
import { getWalkingTargetMinutes, getStartingWalkingTargetMinutes } from '../lib/walkingTarget';

interface TodaysMoveProps {
  dayNumber: number;
}

export default function TodaysMove({ dayNumber }: TodaysMoveProps) {
  const targetMinutes = getWalkingTargetMinutes(dayNumber);
  const startMinutes = getStartingWalkingTargetMinutes();
  const isAtCap = targetMinutes >= 30;

  return (
    <section className="card border-recovery-teal/30 text-center">
      <div className="flex items-center justify-center gap-2 text-recovery-teal mb-1">
        <Footprints className="w-5 h-5" />
        <h2 className="font-bold uppercase tracking-wide text-sm">Today's move</h2>
      </div>
      <p className="text-4xl font-bold">{targetMinutes} min walk</p>
      <p className="text-recovery-ink/70 mt-1">
        {isAtCap
          ? "A steady walk, most days — that's the target now."
          : `Up from ${startMinutes} minutes when you started — a little more than a few days ago.`}
      </p>
      <p className="text-recovery-ink/50 text-sm mt-3">
        Stop and rest if you feel breathless, dizzy, or notice any chest discomfort. This isn't a race.
      </p>
    </section>
  );
}
