import { MatrixClient, MatrixEvent, Room, RoomEvent, RoomEventHandlerMap } from 'matrix-js-sdk';
import { useEffect, useState } from 'react';
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

  useEffect(() => {
    const getLastMessageInfo = (): LastMessageInfo | undefined => {
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
          const content = evt.getContent();
          const msgType = content.msgtype;

          let text: string | undefined;

          // Handle different message types
          if (msgType === 'm.text' || msgType === 'm.emote' || msgType === 'm.notice') {
            text = content.body;
          } else if (evt.getType() === MessageEvent.RoomMessageEncrypted) {
            text = '🔒 Encrypted message';
          } else if (msgType === 'm.image') {
            text = '📷 Image';
          } else if (msgType === 'm.video') {
            text = '🎥 Video';
          } else if (msgType === 'm.audio') {
            text = '🎵 Audio';
          } else if (msgType === 'm.file') {
            text = '📎 File';
          } else if (msgType === 'm.location') {
            text = '📍 Location';
          } else {
            text = content.body;
          }

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
    };

    const handleTimelineEvent: RoomEventHandlerMap[RoomEvent.Timeline] = () => {
      setLastMessage(getLastMessageInfo());
    };

    // Set initial value
    setLastMessage(getLastMessageInfo());

    // Listen for new timeline events
    room.on(RoomEvent.Timeline, handleTimelineEvent);
    return () => {
      room.removeListener(RoomEvent.Timeline, handleTimelineEvent);
    };
  }, [room, isDirect, myUserId, mx, useAuthentication]);

  return lastMessage;
};
