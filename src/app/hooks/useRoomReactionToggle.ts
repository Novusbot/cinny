import { useCallback } from 'react';
import { Room } from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';
import { getEventReactions, getReactionContent } from '../utils/room';
import { eventWithShortcode, factoryEventSentBy } from '../utils/matrix';
import { MessageEvent } from '../../types/matrix/room';

/**
 * Toggles a reaction on an event: removes the current user's reaction with the
 * same key, or sends a new one.
 *
 * Never passes a threadId: an m.annotation on a thread reply is not a thread
 * event, and matrix-js-sdk would overwrite m.relates_to with rel_type
 * 'm.thread' (see addThreadRelationIfNeeded in client.ts).
 */
export const useRoomReactionToggle = (room: Room) => {
  const mx = useMatrixClient();

  return useCallback(
    (targetEventId: string, key: string, shortcode?: string) => {
      const relations = getEventReactions(room.getUnfilteredTimelineSet(), targetEventId);
      const allReactions = relations?.getSortedAnnotationsByKey() ?? [];
      const [, reactionsSet] = allReactions.find(([k]) => k === key) ?? [];
      const reactions = reactionsSet ? Array.from(reactionsSet) : [];
      const myReaction = reactions.find(factoryEventSentBy(mx.getUserId()!));

      if (myReaction && !!myReaction?.isRelation()) {
        mx.redactEvent(room.roomId, myReaction.getId()!);
        return;
      }

      const rShortcode =
        shortcode ||
        (reactions.find(eventWithShortcode)?.getContent().shortcode as string | undefined);

      mx.sendEvent(
        room.roomId,
        MessageEvent.Reaction as any,
        getReactionContent(targetEventId, key, rShortcode)
      );
    },
    [mx, room]
  );
};
