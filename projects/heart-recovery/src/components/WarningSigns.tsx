import { Phone, AlertTriangle } from 'lucide-react';
import { EMERGENCY_SIGNS_999, CONTACT_CARE_TEAM_SIGNS, BHF_HELPLINE } from '../data/recoveryPlan';

export default function WarningSigns() {
  return (
    <section className="space-y-3">
      <div className="card bg-recovery-warn-bg border-recovery-warn/30">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-5 h-5 text-recovery-warn shrink-0" />
          <h2 className="font-bold text-recovery-warn">Call 999 now if you notice</h2>
        </div>
        <ul className="list-disc list-inside space-y-1 text-recovery-ink mb-4">
          {EMERGENCY_SIGNS_999.map((sign) => (
            <li key={sign}>{sign}</li>
          ))}
        </ul>
        <a
          href="tel:999"
          className="inline-flex items-center gap-2 tap-target px-5 rounded-lg bg-recovery-warn text-white font-bold"
        >
          <Phone className="w-4 h-4" /> Call 999
        </a>
      </div>

      <div className="card bg-recovery-wait-bg border-recovery-wait/30">
        <h2 className="font-bold text-recovery-wait mb-2">Not an emergency, but don't wait — contact your care team today if you notice</h2>
        <ul className="list-disc list-inside space-y-1 text-recovery-ink mb-3">
          {CONTACT_CARE_TEAM_SIGNS.map((sign) => (
            <li key={sign}>{sign}</li>
          ))}
        </ul>
        <a href="tel:08088021234" className="text-recovery-wait font-semibold underline">
          Call the BHF heart helpline — {BHF_HELPLINE}
        </a>
      </div>
    </section>
  );
}
