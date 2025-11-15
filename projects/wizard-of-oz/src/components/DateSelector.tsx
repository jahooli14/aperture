import { Calendar, RotateCcw } from 'lucide-react';

interface DateSelectorProps {
  customDate: string;
  today: string;
  minDate: string;
  onDateChange: (date: string) => void;
}

export function DateSelector({ customDate, today, minDate, onDateChange }: DateSelectorProps) {
  return (
    <div className="mb-6">
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center space-x-2 mb-3">
          <Calendar className="w-5 h-5 text-blue-600" />
          <label className="text-sm font-semibold text-gray-900">
            Photo Date
          </label>
          {customDate && (
            <button
              type="button"
              onClick={() => onDateChange('')}
              className="ml-auto p-1 text-gray-500 hover:text-gray-700 transition-colors"
              title="Reset to today"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>

        <input
          type="date"
          value={customDate || today}
          onChange={(e) => onDateChange(e.target.value)}
          min={minDate}
          max={today}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base"
        />

        <div className="mt-2 flex items-start space-x-1.5">
          <p className="text-xs text-gray-600">
            {customDate
              ? `📆 Backdating to ${new Date(customDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`
              : '📸 Uploading for today'
            }
          </p>
        </div>
      </div>
    </div>
  );
}
