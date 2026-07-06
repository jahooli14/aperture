import { useCallback, useState } from 'react';
import { getTodaysMedicationState, setDoseChecked, type Dose } from '../lib/medicationTracker';

export function useMedicationCheck() {
  const [state, setState] = useState(() => getTodaysMedicationState());

  const toggle = useCallback((dose: Dose) => {
    setState((prev) => setDoseChecked(dose, !prev[dose]));
  }, []);

  return { morning: state.morning, evening: state.evening, toggle };
}
