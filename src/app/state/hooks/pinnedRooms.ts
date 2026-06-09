import { useCallback, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { selectAtom } from 'jotai/utils';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { pinnedRoomsAtom, PIN_TAG } from '../pinnedRooms';

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

  const toggle = useCallback(async () => {
    const room = mx.getRoom(roomId);
    const isCurrentlyPinned = room?.tags?.[PIN_TAG] !== undefined;
    if (isCurrentlyPinned) {
      await mx.deleteRoomTag(roomId, PIN_TAG);
    } else {
      await mx.setRoomTag(roomId, PIN_TAG, {});
    }
  }, [mx, roomId]);

  return toggle;
};