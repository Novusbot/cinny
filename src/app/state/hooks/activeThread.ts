import { useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { activeThreadAtom } from '../activeThread';

export const useActiveThread = () => useAtomValue(activeThreadAtom);

export const useSetActiveThread = () => {
  const setActiveThread = useSetAtom(activeThreadAtom);
  return useCallback(
    (threadId: string | null) => {
      setActiveThread(threadId);
    },
    [setActiveThread]
  );
};
