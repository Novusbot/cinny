import { MatrixClient, MatrixEvent, Room, RoomEvent, RoomEventHandlerMap } from 'matrix-js-sdk';
import { useEffect, useState, useCallback } from 'react';
import { MessageEvent } from '../../types/matrix/room';
import { mxcUrlToHttp } from '../utils/matrix';

export interface LastMessageInfo {
  senderPrefix: string | null;
  senderAvatarUrl: string | null;
  text: string;
}

/**
 * Hook to get the last message info from a room's timeline
 * Returns { senderPrefix, senderAvatarUrl, text } formatted Telegram-style
 */
export const useRoomLastMessage = (
  room: Room,
  isDirect: boolean | undefined,
  myUserId: string | null,
  mx: MatrixClient,
  useAuthentication: boolean
): LastMessageInfo | undefined => {
  const [lastMessage, setLastMessage] = useState<LastMessageInfo>();

  const getTextFromEvent = useCallback((evt: MatrixEvent): string | undefined => {
    const content = evt.getContent();
    const msgType = content.msgtype;

    // Try to get decrypted content first
    const clearContent = typeof evt.getClearContent === 'function' ? evt.getClearContent() : null;
    const body = clearContent?.body || content?.body;

    if (!body) return undefined;

    // Handle different message types
    if (msgType === 'm.text' || msgType === 'm.emote' || msgType === 'm.notice') {
      return body;
    } else if (evt.getType() === MessageEvent.RoomMessageEncrypted) {
      // If we have body from decrypted content, use it; otherwise show encrypted placeholder
      if (clearContent?.body) {
        return body;
      }
      return '🔒 Зашифрованное сообщение';
    } else if (msgType === 'm.image') {
      return '📷 Image';
    } else if (msgType === 'm.video') {
      return '🎥 Video';
    } else if (msgType === 'm.audio') {
      return '🎵 Audio';
    } else if (msgType === 'm.file') {
      return '📎 File';
    } else if (msgType === 'm.location') {
      return '📍 Location';
    } else {
      return body;
    }
  }, []);

  const getLastMessageInfo = useCallback((): LastMessageInfo | undefined => {
    const liveEvents = room.getLiveTimeline().getEvents();

    // Determine if this is a direct/DM chat with fallback
    // A room is considered DM if explicitly flagged OR if it has exactly 2 members
    const joinedCount = room.getJoinedMemberCount();
    const effectiveIsDirect = isDirect === true || joinedCount === 2;

    // Iterate from the end to find the last message event
    for (let i = liveEvents.length - 1; i >= 0; i -= 1) {
      const evt = liveEvents[i];
      if (!evt) continue;

      // Only consider message events
      if (
        evt.getType() === MessageEvent.RoomMessage ||
        evt.getType() === MessageEvent.RoomMessageEncrypted
      ) {
        const text = getTextFromEvent(evt);

        if (!text) continue;

        // Check if message is from current user
        const senderId = evt.getSender();
        const isMe = myUserId ? senderId === myUserId : false;

        // Get sender name
        const senderName = evt.sender?.name || senderId?.split(':')[0];

        // Get sender avatar URL
        let senderAvatarUrl: string | null = null;
        const senderMxc = evt.sender?.getMxcAvatarUrl?.();
        if (senderMxc) {
          senderAvatarUrl = mxcUrlToHttp(mx, senderMxc, useAuthentication, 24, 24, 'crop');
        }

        // Determine sender prefix with strict if/else-if/else chain
        let senderPrefix: string | null = null;

        if (isMe) {
          // My own message - always show "Вы: "
          senderPrefix = 'Вы: ';
        } else if (effectiveIsDirect) {
          // Direct/private chat, not my message - NO prefix
          senderPrefix = null;
        } else {
          // Group/channel, not my message - show sender name
          senderPrefix = senderName || null;
        }

        return {
          senderPrefix,
          senderAvatarUrl,
          text,
        };
      }
    }

    return undefined;
  }, [room, isDirect, myUserId, mx, useAuthentication, getTextFromEvent]);

  useEffect(() => {

    const handleTimelineEvent: RoomEventHandlerMap[RoomEvent.Timeline] = () => {
      setLastMessage(getLastMessageInfo());
    };

    // Listen for decryption events to update last message when encrypted content is decrypted
    const handleDecrypted = (evt: MatrixEvent) => {
      if (evt.getRoomId() === room.roomId) {
        setLastMessage(getLastMessageInfo());
      }
    };

    mx.on('Event.decrypted', handleDecrypted);

    // Set initial value
    setLastMessage(getLastMessageInfo());

    // Listen for new timeline events
    room.on(RoomEvent.Timeline, handleTimelineEvent);
    return () => {
      room.removeListener(RoomEvent.Timeline, handleTimelineEvent);
      mx.removeListener('Event.decrypted', handleDecrypted);
    };
  }, [room, isDirect, myUserId, mx, useAuthentication, getLastMessageInfo]);

  return lastMessage;
};
