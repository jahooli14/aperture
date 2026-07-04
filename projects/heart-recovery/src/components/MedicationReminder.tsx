import { Pill } from 'lucide-react';
import { MEDICATION_NOTES } from '../data/recoveryPlan';

export default function MedicationReminder() {
  return (
    <section className="card border-recovery-teal/20 bg-recovery-teal-light/40">
      <div className="flex items-center gap-2 mb-3">
        <Pill className="w-5 h-5 text-recovery-teal-dark shrink-0" />
        <h2 className="font-bold text-recovery-teal-dark">Medication — the two things that matter every day</h2>
      </div>
      <ul className="space-y-3 text-recovery-ink">
        <li>{MEDICATION_NOTES.dapt}</li>
        <li>{MEDICATION_NOTES.fourPillars}</li>
        <li>{MEDICATION_NOTES.nsaidCaution}</li>
      </ul>
    </section>
  );
}
