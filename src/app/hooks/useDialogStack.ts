import { useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { activeDialogsCountAtom, hasOpenDialogsAtom } from '../state/navigationStack';

/**
 * Hook for managing dialog lifecycle in the navigation stack.
 * 
 * Usage in dialog components:
 * ```tsx
 * const dialogManager = useDialogStack();
 * 
 * useEffect(() => {
 *   dialogManager.mount();
 *   return () => dialogManager.unmount();
 * }, []);
 * ```
 * 
 * This ensures the global navigation state is aware of the dialog
 * and can properly handle ESC/swipe navigation events.
 */
export function useDialogStack() {
  const setCount = useSetAtom(activeDialogsCountAtom);

  const mount = useCallback(() => {
    setCount((prev) => prev + 1);
  }, [setCount]);

  const unmount = useCallback(() => {
    setCount((prev) => Math.max(0, prev - 1));
  }, [setCount]);

  return { mount, unmount };
}

/**
 * Hook to check if any dialogs are currently open.
 * Use this in navigation handlers (Room.tsx, useMacNavigation).
 */
export const useHasOpenDialogs = () => useAtomValue(hasOpenDialogsAtom);

/**
 * Hook to get the exact count of open dialogs.
 * Useful for debugging or advanced scenarios.
 */
export const useActiveDialogsCount = () => useAtomValue(activeDialogsCountAtom);
