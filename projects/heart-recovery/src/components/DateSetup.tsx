import { useState } from 'react';
import { getTodayLocalDateString } from '../lib/dateUtils';

interface DateSetupProps {
  existingDate?: string | null;
  onSave: (dateStr: string) => void;
  onCancel?: () => void;
}

export default function DateSetup({ existingDate, onSave, onCancel }: DateSetupProps) {
  const [value, setValue] = useState(existingDate ?? '');
  const today = getTodayLocalDateString();

  return (
    <div className="card max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-1">
        {existingDate ? 'Change the date' : 'When did it happen?'}
      </h2>
      <p className="text-recovery-ink/70 mb-4">
        The date of the heart attack — this is what the whole timeline is built from.
      </p>
      <label className="block mb-4">
        <span className="sr-only">Date of the heart attack</span>
        <input
          type="date"
          className="w-full border border-black/15 rounded-lg px-4 py-3 text-lg tap-target"
          value={value}
          max={today}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <div className="flex gap-3">
        <button
          type="button"
          className="btn-primary disabled:opacity-40"
          disabled={!value}
          onClick={() => value && onSave(value)}
        >
          Save
        </button>
        {onCancel && (
          <button
            type="button"
            className="tap-target px-4 text-recovery-ink/60"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
