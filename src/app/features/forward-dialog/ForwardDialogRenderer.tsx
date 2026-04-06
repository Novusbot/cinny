import React from 'react';
import { useForwardDialogState } from '../../state/hooks/forwardDialog';
import { ForwardDialog } from './ForwardDialog';

export function ForwardDialogRenderer() {
  const state = useForwardDialogState();
  if (!state) return null;
  return <ForwardDialog state={state} />;
}
