import { useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { createChatModalAtom, CreateChatModalState } from '../createChatModal';

export const useCreateChatModalState = (): CreateChatModalState | undefined => {
  const data = useAtomValue(createChatModalAtom);

  return data;
};

export const useOpenCreateChatModal = () => {
  const setState = useSetAtom(createChatModalAtom);
  return useCallback(
    (state: CreateChatModalState) => {
      setState(state);
    },
    [setState]
  );
};

export const useCloseCreateChatModal = () => {
  const setState = useSetAtom(createChatModalAtom);
  return useCallback(() => {
    setState(undefined);
  }, [setState]);
};
