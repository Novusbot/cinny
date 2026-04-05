import { useAtomValue } from 'jotai';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { mDirectAtom } from '../../../state/mDirectList';
import { allRoomsAtom } from '../../../state/room-list/roomList';
import { useRooms } from '../../../state/hooks/roomList';

/**
 * Returns all rooms (including rooms belonging to Spaces) for the Home tab.
 * Only Direct Messages (m.direct) are excluded so they don't duplicate in the Home view.
 */
export const useHomeRooms = () => {
  const mx = useMatrixClient();
  const mDirects = useAtomValue(mDirectAtom);
  const rooms = useRooms(mx, allRoomsAtom, mDirects);
  return rooms;
};
