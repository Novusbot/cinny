import { atom } from 'jotai';

// Stores the root event ID of the active thread being viewed
export const activeThreadAtom = atom<string | null>(null);
