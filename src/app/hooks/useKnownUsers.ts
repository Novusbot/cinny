import { useAtomValue } from 'jotai';
import { useMemo } from 'react';
import { AccountDataEvent, MDirectContent } from '../../types/matrix/accountData';
import { allRoomsAtom } from '../state/room-list/roomList';
import { mDirectAtom } from '../state/mDirectList';
import { useAccountData } from './useAccountData';
import { useMatrixClient } from './useMatrixClient';

type JoinedMember = {
  userId: string;
  rawDisplayName: string;
  getMxcAvatarUrl(): string | undefined;
};

export type KnownUser = {
  userId: string;
  displayName?: string;
  avatarMxc?: string;
};

export type KnownUsers = {
  users: KnownUser[];
  /** userId -> id of a joined room listed in m.direct for that user */
  dmRoomIdOf: (userId: string) => string | undefined;
};

/**
 * Local directory of people the user already shares something with:
 * everyone in m.direct plus members of every joined room.
 */
export const useKnownUsers = (): KnownUsers => {
  const mx = useMatrixClient();
  const allRooms = useAtomValue(allRoomsAtom);
  const mDirects = useAtomValue(mDirectAtom);
  const directEvent = useAccountData(AccountDataEvent.Direct);
  const myUserId = mx.getSafeUserId();

  const users = useMemo(() => {
    const userMap = new Map<string, KnownUser>();

    const add = (userId: string, displayName?: string, avatarMxc?: string) => {
      if (userId === myUserId) return;

      const existing = userMap.get(userId);
      if (!existing) {
        userMap.set(userId, { userId, displayName, avatarMxc });
        return;
      }
      if (existing.displayName === undefined && displayName !== undefined) {
        userMap.set(userId, { ...existing, displayName });
      }
      if (existing.avatarMxc === undefined && avatarMxc !== undefined) {
        userMap.set(userId, { ...existing, avatarMxc });
      }
    };

    // 1. everyone from m.direct, even without a joined room
    const directContent = directEvent?.getContent() as MDirectContent | undefined;
    if (typeof directContent === 'object') {
      Object.keys(directContent).forEach((userId) => add(userId));
    }

    // 2. members of every joined room
    allRooms.forEach((roomId) => {
      const room = mx.getRoom(roomId);
      if (!room) return;

      room.getJoinedMembers().forEach((member: JoinedMember) => {
        // rawDisplayName equals userId when no display name is set
        const displayName =
          member.rawDisplayName === member.userId ? undefined : member.rawDisplayName;
        add(member.userId, displayName, member.getMxcAvatarUrl());
      });
    });

    return Array.from(userMap.values());
  }, [allRooms, directEvent, mx, myUserId]);

  const dmRoomIdOf = useMemo(() => {
    const map = new Map<string, string>();
    const directContent = directEvent?.getContent() as MDirectContent | undefined;
    if (typeof directContent !== 'object') return () => undefined;

    Object.entries(directContent).forEach(([userId, roomIds]) => {
      if (!Array.isArray(roomIds)) return;
      const joinedRoomId = roomIds.find(
        (roomId) => typeof roomId === 'string' && mDirects.has(roomId) && !!mx.getRoom(roomId)
      );
      if (joinedRoomId !== undefined && !map.has(userId)) map.set(userId, joinedRoomId);
    });

    return (userId: string) => map.get(userId);
  }, [directEvent, mDirects, mx]);

  return useMemo(() => ({ users, dmRoomIdOf }), [users, dmRoomIdOf]);
};
