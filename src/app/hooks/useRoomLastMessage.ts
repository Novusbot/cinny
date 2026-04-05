import { MatrixEvent, Room, RoomEvent, RoomEventHandlerMap } from 'matrix-js-sdk';
import { useEffect, useState } from 'react';
import { MessageEvent } from '../../types/matrix/room';

/**
 * Hook to get the last text message from a room's timeline
 * Returns the message body (text content) of the last message event
 */
export const useRoomLastMessage = (room: Room): string | undefined => {
  const [lastMessage, setLastMessage] = useState<string>();

  useEffect(() => {
    const getLastMessageText = (): string | undefined => {
      const liveEvents = room.getLiveTimeline().getEvents();
      
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
          
          // Handle different message types
          if (msgType === 'm.text' || msgType === 'm.emote' || msgType === 'm.notice') {
            return content.body;
          }
          
          // For encrypted messages, we can't decrypt here, so show a placeholder
          if (evt.getType() === MessageEvent.RoomMessageEncrypted) {
            return '🔒 Encrypted message';
          }
          
          // For other types (image, video, etc.), show a generic indicator
          if (msgType === 'm.image') return '📷 Image';
          if (msgType === 'm.video') return '🎥 Video';
          if (msgType === 'm.audio') return '🎵 Audio';
          if (msgType === 'm.file') return '📎 File';
          if (msgType === 'm.location') return '📍 Location';
          
          return content.body;
        }
      }
      
      return undefined;
    };

    const handleTimelineEvent: RoomEventHandlerMap[RoomEvent.Timeline] = () => {
      setLastMessage(getLastMessageText());
    };

    // Set initial value
    setLastMessage(getLastMessageText());

    // Listen for new timeline events
    room.on(RoomEvent.Timeline, handleTimelineEvent);
    return () => {
      room.removeListener(RoomEvent.Timeline, handleTimelineEvent);
    };
  }, [room]);

  return lastMessage;
};
