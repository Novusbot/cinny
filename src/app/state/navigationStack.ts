import { atom } from 'jotai';

/**
 * Centralized navigation stack for tracking open dialogs.
 * 
 * This replaces imperative DOM-based checks (querySelector) with declarative state management.
 * Each modal/dialog component registers itself on mount and unregisters on unmount.
 * 
 * Architecture:
 * - activeDialogsCountAtom: Tracks how many dialogs are currently open
 * - Dialog components use useEffect to register/unregister themselves
 * - Navigation handlers (ESC, swipe) read this atom instead of querying DOM
 */

/**
 * Atom tracking the number of currently open modal dialogs.
 * 
 * Value: 0 = no dialogs open, >0 = one or more dialogs open
 * Navigation handlers use this to determine priority:
 * 1. If count > 0: close topmost dialog (don't navigate thread/room)
 * 2. If count === 0 && activeThread: close thread
 * 3. If count === 0 && no thread: navigate home
 */
export const activeDialogsCountAtom = atom(0);

/**
 * Derived atom: boolean flag indicating if any dialogs are open.
 * Convenience for conditional logic in navigation handlers.
 */
export const hasOpenDialogsAtom = atom((get) => get(activeDialogsCountAtom) > 0);
