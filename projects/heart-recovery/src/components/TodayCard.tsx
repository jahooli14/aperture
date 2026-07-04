import type { RecoveryPhase } from '../data/recoveryPlan';

interface TodayCardProps {
  phase: RecoveryPhase;
}

export default function TodayCard({ phase }: TodayCardProps) {
  if (!phase.why) return null;

  return (
    <section className="card">
      <h2 className="font-bold mb-1">Why the pace right now</h2>
      <p className="text-recovery-ink/80">{phase.why}</p>
    </section>
  );
}
