import { MatrixClient, MatrixEvent, Room, RoomEvent, RoomEventHandlerMap, EventType, RelationType } from 'matrix-js-sdk';
import { useEffect, useState, useCallback } from 'react';
import { MessageEvent } from '../../types/matrix/room';
import { mxcUrlToHttp } from '../utils/matrix';

export interface LastMessageInfo {
  senderPrefix: string | null;
  senderAvatarUrl: string | null;
  text: string;
  timestamp: Date | null;
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

  // Helper to extract text from a target event (handling encryption)
  const getTargetEventText = useCallback((targetEvent: MatrixEvent | null): string => {
    if (!targetEvent) return '""message""';

    const content = targetEvent.getContent();
    const clearContent = typeof targetEvent.getClearContent === 'function'
      ? targetEvent.getClearContent()
      : null;
    const body = clearContent?.body || content?.body;

    if (!body) return '""message""';

    // Sanitize: replace newlines with spaces
    return body.replace(/\n/g, ' ');
  }, []);

  const getTextFromEvent = useCallback((evt: MatrixEvent): string | undefined => {
    const content = evt.getContent();
    const msgType = content.msgtype;
    const type = evt.getType();

    // Try to get decrypted content first
    const clearContent = typeof evt.getClearContent === 'function' ? evt.getClearContent() : null;
    const body = clearContent?.body || content?.body;

    // Handle reactions
    if (type === MessageEvent.Reaction) {
      const relation = content['m.relates_to'];

      if (relation && relation.rel_type === 'm.annotation') {
        const emoji = relation.key;
        const targetEventId = relation.event_id;

        // Get sender name for the reaction
        const senderId = evt.getSender();
        const isMe = myUserId ? senderId === myUserId : false;
        const senderName = isMe ? 'Вы' : (evt.sender?.name || senderId?.split(':')[0] || senderId);
        const verb = isMe ? 'отреагировали' : 'отреагировал(а)';

        // Try to find the original event in room cache
        let targetText = 'сообщение';
        if (room && targetEventId) {
          const targetEvent = room.findEventById(targetEventId);
          if (targetEvent) {
            // Use the helper to extract text from the target event
            const originalText = getTargetEventText(targetEvent);
            // Trim if too long
            targetText = originalText.length > 50
              ? `${originalText.substring(0, 50)}...`
              : originalText;
          }
        }

        return `${senderName} ${verb} ${emoji} на ${targetText}`;
      }
      return 'Отреагировал(а) на сообщение';
    }

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
  }, [myUserId, room, getTargetEventText]);

  const getLastMessageInfo = useCallback((): LastMessageInfo | undefined => {
    // Получаем закэшированные события — сначала из live timeline, фоллбэк на сырой timeline
    const liveEvents = room.getLiveTimeline().getEvents();
    const events = liveEvents.length > 0 ? liveEvents : (room as any).timeline || liveEvents;

    // Determine if this is a direct/DM chat with fallback
    // A room is considered DM if explicitly flagged OR if it has exactly 2 members
    const joinedCount = room.getJoinedMemberCount();
    const effectiveIsDirect = isDirect === true || joinedCount === 2;

    // Идем с конца массива в поисках первого нормального сообщения
    for (let i = events.length - 1; i >= 0; i -= 1) {
      const evt = events[i];
      if (!evt || typeof evt.getType !== 'function') continue;

      const type = evt.getType();

      // Пропускаем всё кроме реальных сообщений
      if (
        type !== MessageEvent.RoomMessage &&
        type !== MessageEvent.RoomMessageEncrypted &&
        type !== 'm.sticker' &&
        type !== MessageEvent.Reaction
      ) {
        continue;
      }

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
        timestamp: evt.getDate(),
      };
    }

    return undefined;
  }, [room, isDirect, myUserId, mx, useAuthentication, getTextFromEvent, getTargetEventText]);

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
