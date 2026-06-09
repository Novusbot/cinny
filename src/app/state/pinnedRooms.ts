import { atom, useSetAtom } from 'jotai';
import { MatrixClient, MatrixEvent, Room, RoomEvent } from 'matrix-js-sdk';
import { useEffect } from 'react';

export type PinnedRoomsAction = {
  type: 'INITIALIZE' | 'UPDATE';
  rooms: Set<string>;
};

export const PIN_TAG = 'm.favourite';

const basePinnedRoomsAtom = atom(new Set<string>());

export const pinnedRoomsAtom = atom<Set<string>, [PinnedRoomsAction], undefined>(
  (get) => get(basePinnedRoomsAtom),
  (get, set, action) => {
    set(basePinnedRoomsAtom, action.rooms);
  }
);

const collectPinnedRoomIds = (mx: MatrixClient): Set<string> => {
  const pinnedRoomIds = new Set<string>();
  mx.getRooms().forEach((room: Room) => {
    if (room.tags?.[PIN_TAG] !== undefined) {
      pinnedRoomIds.add(room.roomId);
    }
  });
  return pinnedRoomIds;
};

export const useBindPinnedRoomsAtom = (
  mx: MatrixClient,
  pinnedAtom: typeof pinnedRoomsAtom
) => {
  const setPinned = useSetAtom(pinnedAtom);

  useEffect(() => {
    setPinned({
      type: 'INITIALIZE',
      rooms: collectPinnedRoomIds(mx),
    });

    const handleRoomTags = (_event: MatrixEvent, _room?: Room) => {
      setPinned({
        type: 'UPDATE',
        rooms: collectPinnedRoomIds(mx),
      });
    };

    mx.on(RoomEvent.Tags, handleRoomTags);
    return () => {
      mx.removeListener(RoomEvent.Tags, handleRoomTags);
    };
  }, [mx, setPinned]);
};