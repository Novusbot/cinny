import { useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { insertLinkDialogAtom, InsertLinkDialogState } from '../insertLinkDialog';

export const useInsertLinkDialogState = () => useAtomValue(insertLinkDialogAtom);

export const useOpenInsertLinkDialog = () => {
  const setState = useSetAtom(insertLinkDialogAtom);
  return useCallback(
    (state: InsertLinkDialogState) => {
      setState(state);
    },
    [setState]
  );
};

export const useCloseInsertLinkDialog = () => {
  const setState = useSetAtom(insertLinkDialogAtom);
  return useCallback(() => {
    setState(undefined);
  }, [setState]);
};
