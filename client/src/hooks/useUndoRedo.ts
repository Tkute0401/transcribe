import { useState, useCallback } from 'react';

export function useUndoRedo<T>(initial: T, maxHistory = 50) {
  const [history, setHistory] = useState<T[]>([initial]);
  const [index, setIndex] = useState(0);

  const current = history[index];

  const set = useCallback(
    (newValue: T) => {
      setHistory((prev) => {
        const newHistory = prev.slice(0, index + 1);
        newHistory.push(newValue);
        if (newHistory.length > maxHistory) newHistory.shift();
        return newHistory;
      });
      setIndex((prev) => {
        const newLen = Math.min(prev + 1, maxHistory - 1);
        return newLen;
      });
    },
    [index, maxHistory]
  );

  const undo = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const redo = useCallback(() => {
    setHistory((prev) => {
      setIndex((i) => Math.min(prev.length - 1, i + 1));
      return prev;
    });
  }, []);

  const canUndo = index > 0;
  const canRedo = index < history.length - 1;

  return { current, set, undo, redo, canUndo, canRedo };
}
