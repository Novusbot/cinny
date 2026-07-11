import { MatrixClient, MatrixEvent, Room, RoomEvent } from 'matrix-js-sdk';

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

/** Optimistic local update so isRoomMarkedUnread() + atom listeners work instantly, before server echo. */
function applyLocalMarkedUnread(room: Room, unread: boolean): void {
  const fakeEvent = {
    getType: () => MARKED_UNREAD_EVENT_TYPE,
    getContent: <T = MarkedUnreadContent>() => ({ unread }) as T,
  } as MatrixEvent;

  if (unread) {
    room.accountData.set(MARKED_UNREAD_EVENT_TYPE, fakeEvent);
  } else {
    room.accountData.delete(MARKED_UNREAD_EVENT_TYPE);
  }

  // Emit so useBindRoomToUnreadAtom picks up the change immediately (Element pattern)
  room.emit(RoomEvent.AccountData, fakeEvent, room, undefined);
}

export async function setRoomMarkedUnread(
  mx: MatrixClient,
  roomId: string,
  unread: boolean
): Promise<void> {
  const room = mx.getRoom(roomId);
  if (room) applyLocalMarkedUnread(room, unread);
  await mx.setRoomAccountData(roomId, MARKED_UNREAD_EVENT_TYPE, { unread });
}
