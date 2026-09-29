import { atom } from 'jotai';

export type CreateChatModalState = {
  userId: string;
};

export const createChatModalAtom = atom<CreateChatModalState | undefined>(undefined);
