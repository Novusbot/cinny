import { atom } from 'jotai';

export type InsertLinkDialogState = {
  initialText: string;
  initialUrl: string;
  onInsert: (text: string, url: string) => void;
};

export const insertLinkDialogAtom = atom<InsertLinkDialogState | undefined>(undefined);
