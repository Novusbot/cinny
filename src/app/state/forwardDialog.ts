import { atom } from 'jotai';
import { MatrixEvent } from 'matrix-js-sdk';

export type ForwardDialogState = {
  eventsToForward: MatrixEvent[];
  roomId: string;
};

export const forwardDialogAtom = atom<ForwardDialogState | undefined>(undefined);
