import { useState } from 'react';
import { useEventDate } from './hooks/useEventDate';
import { getDayNumber } from './lib/recoveryDay';
import { formatDateForDisplay } from './lib/dateUtils';
import { hasSeenOnboarding, markOnboardingSeen, resetOnboarding } from './lib/onboarding';
import { RECOVERY_PHASES, getPhaseForDay, getNextMilestone } from './data/recoveryPlan';
import Onboarding from './components/Onboarding';
import DateSetup from './components/DateSetup';
import ProgressHeader from './components/ProgressHeader';
import JourneyBar from './components/JourneyBar';
import TodaysMove from './components/TodaysMove';
import ActivityGuide from './components/ActivityGuide';
import MedicationReminder from './components/MedicationReminder';
import WarningSigns from './components/WarningSigns';
import Timeline from './components/Timeline';
import SourcesFooter from './components/SourcesFooter';

function App() {
  const { eventDate, setEventDate } = useEventDate();
  const [editingDate, setEditingDate] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(() => hasSeenOnboarding());

  if (!onboardingDone) {
    return (
      <Onboarding
        onDone={() => {
          markOnboardingSeen();
          setOnboardingDone(true);
        }}
      />
    );
  }

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

  const nextMilestone = getNextMilestone(dayNumber, RECOVERY_PHASES);

  return (
    <div className="min-h-screen">
      <main className="max-w-2xl mx-auto px-4 pb-12 space-y-4">
        <ProgressHeader
          dayNumber={dayNumber}
          phase={phase}
          nextMilestone={nextMilestone}
          onChangeDate={() => setEditingDate(true)}
        />
        <JourneyBar dayNumber={dayNumber} phases={RECOVERY_PHASES} />
        <MedicationReminder />
        <TodaysMove dayNumber={dayNumber} />
        <WarningSigns />
        <ActivityGuide activities={phase.activities} farm={phase.farm} />
        <Timeline phases={RECOVERY_PHASES} currentPhaseId={phase.id} />
        <SourcesFooter
          onReplayIntro={() => {
            resetOnboarding();
            setOnboardingDone(false);
          }}
        />
      </main>
    </div>
  );
}

export default App;
