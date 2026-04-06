import { useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { forwardDialogAtom, ForwardDialogState } from '../forwardDialog';

export const useForwardDialogState = () => useAtomValue(forwardDialogAtom);

export const useOpenForwardDialog = () => {
  const setState = useSetAtom(forwardDialogAtom);
  return useCallback(
    (state: ForwardDialogState) => {
      setState(state);
    },
    [setState]
  );
};

export const useCloseForwardDialog = () => {
  const setState = useSetAtom(forwardDialogAtom);
  return useCallback(() => {
    setState(undefined);
  }, [setState]);
};
