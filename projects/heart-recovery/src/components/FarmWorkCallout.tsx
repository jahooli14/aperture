import { Sprout } from 'lucide-react';
import type { FarmGuidance } from '../data/recoveryPlan';

interface FarmWorkCalloutProps {
  farm: FarmGuidance;
}

export default function FarmWorkCallout({ farm }: FarmWorkCalloutProps) {
  return (
    <section className="card border-recovery-teal/20">
      <div className="flex items-center gap-2 mb-3">
        <Sprout className="w-4 h-4 text-recovery-teal shrink-0" />
        <h2 className="font-bold">About the farm</h2>
      </div>
      <p className="mb-3">{farm.headline}</p>
      <p className="text-recovery-ink/80 mb-4">{farm.ifTempted}</p>

      <h3 className="font-semibold text-sm uppercase tracking-wide text-recovery-ink/60 mb-2">
        What you can do instead, right now
      </h3>
      <ul className="list-disc list-inside space-y-1 mb-4">
        {farm.canDoInstead.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      {farm.askYourTeam && (
        <>
          <h3 className="font-semibold text-sm uppercase tracking-wide text-recovery-ink/60 mb-2">
            Take these questions to your next rehab appointment
          </h3>
          <ul className="list-disc list-inside space-y-1">
            {farm.askYourTeam.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
