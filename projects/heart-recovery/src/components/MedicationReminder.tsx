import { Pill, ChevronDown } from 'lucide-react';
import { MEDICATION_NOTES } from '../data/recoveryPlan';

export default function MedicationReminder() {
  return (
    <details className="card border-recovery-teal/20 bg-recovery-teal-light/40 group">
      <summary className="flex items-center gap-2 cursor-pointer">
        <Pill className="w-5 h-5 text-recovery-teal-dark shrink-0" />
        <h2 className="font-bold text-recovery-teal-dark flex-1">Medication — two things that matter every day</h2>
        <ChevronDown className="w-4 h-4 text-recovery-teal-dark/50 transition-transform group-open:rotate-180 shrink-0" />
      </summary>
      <ul className="space-y-3 text-recovery-ink mt-3 text-sm leading-relaxed">
        <li>{MEDICATION_NOTES.dapt}</li>
        <li>{MEDICATION_NOTES.fourPillars}</li>
        <li>{MEDICATION_NOTES.nsaidCaution}</li>
      </ul>
    </details>
  );
}
