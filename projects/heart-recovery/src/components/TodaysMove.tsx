import { useState } from 'react';
import { Footprints } from 'lucide-react';
import { WALKING_STARTING_GUIDANCE, WALKING_RPE_GUIDANCE, WALKING_STOP_SIGNS } from '../data/recoveryPlan';
import { useComfortableWalk } from '../hooks/useComfortableWalk';
import { getSuggestedWalk } from '../lib/walkingBaseline';

const QUICK_OPTIONS = [2, 5, 10, 15, 20, 25, 30];

export default function TodaysMove() {
  const { minutes, setMinutes } = useComfortableWalk();
  const [editing, setEditing] = useState(false);

  const showPicker = minutes === null || editing;

  return (
    <section className="card border-recovery-teal/30 text-center">
      <div className="flex items-center justify-center gap-2 text-recovery-teal mb-1">
        <Footprints className="w-5 h-5" />
        <h2 className="font-bold uppercase tracking-wide text-sm">Today's walk</h2>
      </div>

      {showPicker ? (
        <>
          <p className="text-recovery-ink/80 mt-1 mb-3">
            {minutes === null
              ? "What's the longest walk you're comfortably managing right now? Not your best-ever effort — what feels easy most days."
              : 'Update it any time this changes.'}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {QUICK_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setMinutes(option);
                  setEditing(false);
                }}
                className="tap-target px-3 rounded-lg border-2 border-black/15 bg-white font-semibold text-recovery-ink hover:border-recovery-teal"
              >
                {option === 30 ? '30+' : option} min
              </button>
            ))}
          </div>
          {minutes !== null && (
            <p className="text-recovery-ink/50 text-xs mt-1">{WALKING_STARTING_GUIDANCE}</p>
          )}
        </>
      ) : (
        (() => {
          const suggestion = getSuggestedWalk(minutes);
          return (
            <>
              <p className="text-4xl font-bold">{suggestion.minutes} min</p>
              <p className="text-recovery-ink/70 mt-1">
                {suggestion.atTarget
                  ? "You're at the general target already — keep this up daily, focused on a steady, brisk pace rather than adding more time."
                  : `A bit more than the ${minutes} min you said feels comfortable now.`}
              </p>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-recovery-ink/50 text-xs underline mt-1 tap-target"
              >
                Update what feels comfortable
              </button>
            </>
          );
        })()
      )}

      <p className="text-recovery-ink/70 text-sm mt-3">{WALKING_RPE_GUIDANCE}</p>
      <p className="text-recovery-ink/50 text-sm mt-2">{WALKING_STOP_SIGNS}</p>
    </section>
  );
}
