import { Pill, ChevronDown, Check } from 'lucide-react';
import { MEDICATION_NOTES } from '../data/recoveryPlan';
import { useMedicationCheck } from '../hooks/useMedicationCheck';
import type { Dose } from '../lib/medicationTracker';

export default function MedicationReminder() {
  const { morning, evening, toggle } = useMedicationCheck();

  return (
    <section className="card border-2 border-recovery-teal bg-recovery-teal-light/40">
      <div className="flex items-center gap-2 mb-3">
        <Pill className="w-5 h-5 text-recovery-teal-dark shrink-0" />
        <h2 className="font-bold text-recovery-teal-dark">Medication — twice a day, every day</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <DoseButton label="Morning" checked={morning} onToggle={() => toggle('morning')} />
        <DoseButton label="Evening" checked={evening} onToggle={() => toggle('evening')} />
      </div>
      <details className="group mt-3">
        <summary className="flex items-center gap-1.5 text-sm font-semibold text-recovery-teal-dark cursor-pointer">
          <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
          Why this matters
        </summary>
        <ul className="space-y-3 text-recovery-ink mt-3 text-sm leading-relaxed">
          <li>{MEDICATION_NOTES.dapt}</li>
          <li>{MEDICATION_NOTES.fourPillars}</li>
          <li>{MEDICATION_NOTES.nsaidCaution}</li>
        </ul>
      </details>
    </section>
  );
}

function DoseButton({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  const dose: Dose = label === 'Morning' ? 'morning' : 'evening';
  return (
    <button
      type="button"
      aria-pressed={checked}
      data-dose={dose}
      onClick={onToggle}
      className={`tap-target flex items-center justify-center gap-2 rounded-lg border-2 py-3 font-semibold transition-colors ${
        checked
          ? 'bg-recovery-go border-recovery-go text-white'
          : 'bg-white border-black/15 text-recovery-ink'
      }`}
    >
      <Check className={`w-4 h-4 ${checked ? 'opacity-100' : 'opacity-25'}`} />
      {label}{checked ? ' taken' : ''}
    </button>
  );
}
