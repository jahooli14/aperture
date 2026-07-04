import { useState } from 'react';
import { useEventDate } from './hooks/useEventDate';
import { getDayNumber } from './lib/recoveryDay';
import { formatDateForDisplay } from './lib/dateUtils';
import { RECOVERY_PHASES, getPhaseForDay } from './data/recoveryPlan';
import DateSetup from './components/DateSetup';
import ProgressHeader from './components/ProgressHeader';
import TodayCard from './components/TodayCard';
import ActivityGuide from './components/ActivityGuide';
import FarmWorkCallout from './components/FarmWorkCallout';
import MedicationReminder from './components/MedicationReminder';
import WarningSigns from './components/WarningSigns';
import Timeline from './components/Timeline';
import SourcesFooter from './components/SourcesFooter';

function App() {
  const { eventDate, setEventDate } = useEventDate();
  const [editingDate, setEditingDate] = useState(false);

  if (!eventDate || editingDate) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <DateSetup
          existingDate={eventDate}
          onSave={(date) => {
            setEventDate(date);
            setEditingDate(false);
          }}
          onCancel={eventDate ? () => setEditingDate(false) : undefined}
        />
      </div>
    );
  }

  const dayNumber = getDayNumber(eventDate);
  const hasStarted = dayNumber > 0;
  const phase = hasStarted ? getPhaseForDay(dayNumber) : null;

  if (!hasStarted || !phase) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
        <div className="card max-w-md">
          <h1 className="text-xl font-bold mb-2">Your timeline starts on {formatDateForDisplay(eventDate)}</h1>
          <p className="text-recovery-ink/70 mb-4">
            Come back once that date has arrived, or fix the date below if that's wrong.
          </p>
          <button
            type="button"
            className="text-recovery-teal underline tap-target"
            onClick={() => setEditingDate(true)}
          >
            Change date
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <main className="max-w-2xl mx-auto px-4 pb-12 space-y-5">
        <ProgressHeader dayNumber={dayNumber} phase={phase} onChangeDate={() => setEditingDate(true)} />
        <MedicationReminder />
        <WarningSigns />
        <TodayCard phase={phase} />
        <ActivityGuide activities={phase.activities} />
        <FarmWorkCallout farm={phase.farm} />
        <Timeline phases={RECOVERY_PHASES} currentPhaseId={phase.id} />
        <SourcesFooter />
      </main>
    </div>
  );
}

export default App;
