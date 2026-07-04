import type { FarmGuidance } from '../data/recoveryPlan';

interface FarmWorkDetailProps {
  farm: FarmGuidance;
}

/**
 * Nested inside the "Farm / manual work" row of ActivityGuide, not a
 * standalone section — this is the one part of the guide he's most likely
 * to push back on, so it gets a direct-address explanation rather than a
 * bare status pill.
 */
export default function FarmWorkDetail({ farm }: FarmWorkDetailProps) {
  return (
    <div className="space-y-3 border-t border-black/5 pt-3">
      <p className="font-medium text-recovery-ink">{farm.headline}</p>
      <p>{farm.ifTempted}</p>

      <div>
        <p className="font-semibold text-xs uppercase tracking-wide text-recovery-ink/50 mb-1">
          What you can do instead, right now
        </p>
        <ul className="list-disc list-inside space-y-1">
          {farm.canDoInstead.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      {farm.askYourTeam && (
        <div>
          <p className="font-semibold text-xs uppercase tracking-wide text-recovery-ink/50 mb-1">
            Take these questions to your next rehab appointment
          </p>
          <ul className="list-disc list-inside space-y-1">
            {farm.askYourTeam.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
