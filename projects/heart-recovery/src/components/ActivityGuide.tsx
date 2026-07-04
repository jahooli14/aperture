import { Phone } from 'lucide-react';
import type { ActivityGuidance, ActivityStatus } from '../data/recoveryPlan';

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
}

export default function ActivityGuide({ activities }: ActivityGuideProps) {
  return (
    <section className="card">
      <h2 className="font-bold mb-4">Today, activity by activity</h2>
      <ul className="space-y-4">
        {activities.map((row) => (
          <li key={row.activity} className="border-b border-black/5 last:border-0 pb-4 last:pb-0">
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="font-semibold">{row.activity}</span>
              <span className={`status-pill ${STATUS_PILL_CLASS[row.status]}`}>
                {STATUS_LABEL[row.status]}
              </span>
            </div>
            <p className="text-recovery-ink/80 text-sm">{row.detail}</p>
            {row.action && (
              <a
                href={row.action.href}
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-recovery-ask"
              >
                <Phone className="w-3.5 h-3.5" /> {row.action.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
