import { useCallback, useState } from 'react';
import { loadComfortableWalkMinutes, saveComfortableWalkMinutes } from '../lib/walkingBaseline';

export function useComfortableWalk() {
  const [minutes, setMinutesState] = useState<number | null>(() => loadComfortableWalkMinutes());

  const setMinutes = useCallback((value: number) => {
    saveComfortableWalkMinutes(value);
    setMinutesState(value);
  }, []);

  return { minutes, setMinutes };
}
