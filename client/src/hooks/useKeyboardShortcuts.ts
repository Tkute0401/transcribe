import { useEffect, useRef } from 'react';

type ShortcutMap = Record<string, () => void>;

const IGNORE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export function useKeyboardShortcuts(
  shortcuts: ShortcutMap,
  active = true
): void {
  // Keep a stable ref so callers don't need to memoize the shortcuts object
  const shortcutsRef = useRef<ShortcutMap>(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!active) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Ignore when typing in an input / textarea / contenteditable
      if (
        IGNORE_TAGS.has(target.tagName) ||
        target.isContentEditable
      ) {
        return;
      }

      // Build key string: e.g. "ctrl+z", "Space", "ArrowLeft"
      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push('ctrl');
      if (e.shiftKey) parts.push('shift');
      if (e.altKey) parts.push('alt');
      parts.push(e.key);
      const key = parts.join('+');

      const fn = shortcutsRef.current[key];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [active]);
}
