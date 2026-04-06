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

      // Handle reactions
      if (evt.getType() === EventType.Reaction) {
        const relatesTo = evt.getContent()['m.relates_to'];
        if (!relatesTo || relatesTo.rel_type !== RelationType.Annotation) continue;

        const emoji = relatesTo.key;
        const targetEventId = relatesTo.event_id;
        
        if (!emoji || !targetEventId) continue;

        // Get reaction sender name
        const reactionSenderId = evt.getSender();
        const isMyReaction = myUserId ? reactionSenderId === myUserId : false;
        const reactionSenderName = evt.sender?.name || reactionSenderId?.split(':')[0];
        
        // Try to find the target event in the room timeline
        const targetEvent = room.findEventById(targetEventId);
        const targetText = getTargetEventText(targetEvent);

        // Format: "Вы отреагировали 👍 на Hello world" or "John reacted 👋 on Hi there"
        const reactionText = isMyReaction
          ? `Вы отреагировали ${emoji} на ${targetText}`
          : `${reactionSenderName} отреагировал ${emoji} на ${targetText}`;

        // Get reaction sender avatar for group chats
        let senderAvatarUrl: string | null = null;
        const senderMxc = evt.sender?.getMxcAvatarUrl?.();
        if (senderMxc) {
          senderAvatarUrl = mxcUrlToHttp(mx, senderMxc, useAuthentication, 24, 24, 'crop');
        }

        // For reactions, prefix logic:
        // - My reaction: "Вы отреагировали" (embedded in text, no prefix)
        // - Other's reaction in DM: null (no prefix)
        // - Other's reaction in group: reaction sender name
        let senderPrefix: string | null = null;
        if (!isMyReaction && !effectiveIsDirect) {
          senderPrefix = reactionSenderName || null;
        }

        return {
          senderPrefix,
          senderAvatarUrl,
          text: reactionText,
          timestamp: evt.getDate(),
        };
      }

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
          timestamp: evt.getDate(),
        };
      }
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
