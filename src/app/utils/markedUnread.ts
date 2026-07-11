import { MatrixClient, Room } from 'matrix-js-sdk';

export const MARKED_UNREAD_EVENT_TYPE = 'm.marked_unread';

export type MarkedUnreadContent = {
  unread: boolean;
};

export function isRoomMarkedUnread(room: Room): boolean {
  const event = room.getAccountData(MARKED_UNREAD_EVENT_TYPE);
  if (!event) return false;
  const content = event.getContent<MarkedUnreadContent>();
  return content?.unread === true;
}

export async function setRoomMarkedUnread(
  mx: MatrixClient,
  roomId: string,
  unread: boolean
): Promise<void> {
  await mx.setRoomAccountData(roomId, MARKED_UNREAD_EVENT_TYPE, { unread });
}
