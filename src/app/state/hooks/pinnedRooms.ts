import { useCallback, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { selectAtom } from 'jotai/utils';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { pinnedRoomsAtom, PIN_TAG } from '../pinnedRooms';
import type { MatrixClient } from 'matrix-js-sdk';

const togglePin = async (mx: MatrixClient, roomId: string, isPinned: boolean) => {
  if (isPinned) {
    await mx.deleteRoomTag(roomId, PIN_TAG);
  } else {
    await mx.setRoomTag(roomId, PIN_TAG, {});
  }
};

export const usePinnedRooms = (): Set<string> => {
  return useAtomValue(pinnedRoomsAtom);
};

export const useIsRoomPinned = (roomId: string): boolean => {
  const isPinnedAtom = useMemo(
    () => selectAtom(pinnedRoomsAtom, (rooms) => rooms.has(roomId)),
    [roomId]
  );
  return useAtomValue(isPinnedAtom);
};

export const useTogglePinRoom = (roomId: string): (() => Promise<void>) => {
  const mx = useMatrixClient();
  const isPinned = useIsRoomPinned(roomId);

  const toggle = useCallback(async () => {
    await togglePin(mx, roomId, isPinned);
  }, [mx, roomId, isPinned]);

  return toggle;
};