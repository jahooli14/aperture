import { Phone, AlertTriangle, ChevronDown } from 'lucide-react';
import { EMERGENCY_SIGNS_999, CONTACT_CARE_TEAM_SIGNS, BHF_HELPLINE } from '../data/recoveryPlan';

export default function WarningSigns() {
  return (
    <section className="space-y-3">
      <div className="card bg-recovery-warn-bg border-recovery-warn/30">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-recovery-warn shrink-0" />
          <h2 className="font-bold text-recovery-warn leading-snug">
            Chest pain, severe breathlessness, or bleeding that won't stop?
          </h2>
        </div>
        <a
          href="tel:999"
          className="inline-flex items-center gap-2 tap-target px-5 rounded-lg bg-recovery-warn text-white font-bold"
        >
          <Phone className="w-4 h-4" /> Call 999
        </a>
        <details className="group mt-3">
          <summary className="flex items-center gap-1.5 text-sm font-semibold text-recovery-warn cursor-pointer">
            <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
            See the full list of emergency signs
          </summary>
          <ul className="list-disc list-inside space-y-1 text-recovery-ink mt-2 text-sm leading-relaxed">
            {EMERGENCY_SIGNS_999.map((sign) => (
              <li key={sign}>{sign}</li>
            ))}
          </ul>
        </details>
      </div>

      <details className="card bg-recovery-wait-bg border-recovery-wait/30 group">
        <summary className="flex items-center gap-1.5 font-bold text-recovery-wait cursor-pointer leading-snug">
          <ChevronDown className="w-4 h-4 shrink-0 transition-transform group-open:rotate-180" />
          Not an emergency, but don't wait — things to watch for
        </summary>
        <ul className="list-disc list-inside space-y-1 text-recovery-ink mt-3 mb-3 text-sm leading-relaxed">
          {CONTACT_CARE_TEAM_SIGNS.map((sign) => (
            <li key={sign}>{sign}</li>
          ))}
        </ul>
        <a href="tel:08088021234" className="text-recovery-wait font-semibold underline">
          Call the BHF heart helpline — {BHF_HELPLINE}
        </a>
      </details>
    </section>
  );
}
