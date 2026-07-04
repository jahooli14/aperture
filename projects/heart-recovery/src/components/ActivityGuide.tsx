import { Phone, ChevronDown } from 'lucide-react';
import type { ActivityGuidance, ActivityStatus, FarmGuidance } from '../data/recoveryPlan';
import FarmWorkDetail from './FarmWorkCallout';

const STATUS_LABEL: Record<ActivityStatus, string> = {
  go: 'Go',
  'not-yet': 'Not yet',
  'ask-first': 'Ask first',
};

const STATUS_PILL_CLASS: Record<ActivityStatus, string> = {
  go: 'status-pill-go',
  'not-yet': 'status-pill-wait',
  'ask-first': 'status-pill-ask',
};

interface ActivityGuideProps {
  activities: ActivityGuidance[];
  farm: FarmGuidance;
}

export default function ActivityGuide({ activities, farm }: ActivityGuideProps) {
  return (
    <section className="card">
      <h2 className="font-bold mb-2">Today, activity by activity</h2>
      <p className="text-sm text-recovery-ink/50 mb-2">Tap anything for the detail behind it.</p>
      <div className="divide-y divide-black/5">
        {activities.map((row) => {
          const isFarm = row.activity === 'Farm / manual work';
          return (
            <details key={row.activity} className="group py-3 first:pt-0 last:pb-0">
              <summary className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="font-semibold flex items-center gap-2">
                  <ChevronDown className="w-4 h-4 text-recovery-ink/30 transition-transform group-open:rotate-180 shrink-0" />
                  {row.activity}
                </span>
                <span className={`status-pill ${STATUS_PILL_CLASS[row.status]} shrink-0`}>
                  {STATUS_LABEL[row.status]}
                </span>
              </summary>
              <div className="mt-2 pl-6 text-sm text-recovery-ink/80 space-y-3 leading-relaxed">
                <p>{row.detail}</p>
                {row.why && (
                  <p>
                    <span className="font-semibold text-recovery-ink/60">Why: </span>
                    {row.why}
                  </p>
                )}
                {row.action && (
                  <a
                    href={row.action.href}
                    className="inline-flex items-center gap-1.5 font-semibold text-recovery-ask"
                  >
                    <Phone className="w-3.5 h-3.5" /> {row.action.label}
                  </a>
                )}
                {isFarm && <FarmWorkDetail farm={farm} />}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
