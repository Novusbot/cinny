import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, config, color } from 'folds';
import { MatrixEvent, Room, RoomEvent, ThreadEvent } from 'matrix-js-sdk';
import { HTMLReactParserOptions } from 'html-react-parser';
import { Opts as LinkifyOpts } from 'linkifyjs';
import { Message, Reactions } from '../room/message';
import { RenderMessageContent } from '../../components/RenderMessageContent';
import { RedactedContent } from '../../components/message/MsgTypeRenderers';
import { MessageLayout, MessageSpacing } from '../../state/settings';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useIsDirectRoom } from '../../hooks/useRoom';
import { getMemberDisplayName } from '../../utils/room';
import { getMxIdLocalPart } from '../../utils/matrix';
import { useTheme } from '../../hooks/useTheme';
import { usePowerLevelsContext } from '../../hooks/usePowerLevels';
import { useRoomCreators } from '../../hooks/useRoomCreators';
import { useRoomCreatorsTag } from '../../hooks/useRoomCreatorsTag';
import { usePowerLevelTags } from '../../hooks/usePowerLevelTags';
import { useRoomPermissions } from '../../hooks/useRoomPermissions';
import { useAccessiblePowerTagColors, useGetMemberPowerTag } from '../../hooks/useMemberPowerTag';
import { useImagePackRooms } from '../../hooks/useImagePackRooms';
import { roomToParentsAtom } from '../../state/room/roomToParents';
import { useAtomValue } from 'jotai';
import { getEventReactions, getEditedEvent, reactionOrEditEvent } from '../../utils/room';
import { useMentionClickHandler } from '../../hooks/useMentionClickHandler';
import { useSpoilerClickHandler } from '../../hooks/useSpoilerClickHandler';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import {
  factoryRenderLinkifyWithMention,
  getReactCustomHtmlParser,
  LINKIFY_OPTS,
  makeMentionCustomProps,
  renderMatrixMention,
} from '../../plugins/react-custom-html-parser';
import { Reply } from '../../components/message/Reply';
import { EventType, Direction } from 'matrix-js-sdk';

type ThreadTimelineProps = {
  room: Room;
  rootEventId: string;
};

const THREAD_REL_TYPES = ['m.thread', 'io.element.thread'];

const getThreadRelationRootId = (event: MatrixEvent): string | undefined => {
  if (event.threadRootId) return event.threadRootId;

  const relation = event.getWireContent()?.['m.relates_to'];
  return THREAD_REL_TYPES.includes(relation?.rel_type) ? relation?.event_id : undefined;
};

const isThreadEvent = (event: MatrixEvent, rootEventId: string) =>
  event.getId() === rootEventId || getThreadRelationRootId(event) === rootEventId;

const mergeThreadEvents = (events: MatrixEvent[]) => {
  const eventById = new Map<string, MatrixEvent>();
  events.forEach((event) => {
    const eventId = event.getId();
    if (eventId) eventById.set(eventId, event);
  });

  return [...eventById.values()].sort((a, b) => a.getTs() - b.getTs());
};

export function ThreadTimeline({ room, rootEventId }: ThreadTimelineProps) {
  const mx = useMatrixClient();
  const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
  const [messageLayout] = useSetting(settingsAtom, 'messageLayout');
  const [messageSpacing] = useSetting(settingsAtom, 'messageSpacing');
  const [legacyUsernameColor] = useSetting(settingsAtom, 'legacyUsernameColor');
  const [hour24Clock] = useSetting(settingsAtom, 'hour24Clock');
  const [dateFormatString] = useSetting(settingsAtom, 'dateFormatString');
  const [mediaAutoLoad] = useSetting(settingsAtom, 'mediaAutoLoad');
  const [urlPreview] = useSetting(settingsAtom, 'urlPreview');
  const [encUrlPreview] = useSetting(settingsAtom, 'encUrlPreview');
  const showUrlPreview = room.hasEncryptionStateEvent() ? encUrlPreview : urlPreview;

  const direct = useIsDirectRoom();
  const powerLevels = usePowerLevelsContext();
  const creators = useRoomCreators(room);
  const permissions = useRoomPermissions(creators, powerLevels);
  const canRedact = permissions.action('redact', mx.getSafeUserId());
  const canDeleteOwn = permissions.event(EventType.RoomRedaction, mx.getSafeUserId());
  const canSendReaction = permissions.event(EventType.Reaction, mx.getSafeUserId());
  const canPinEvent = permissions.stateEvent(EventType.RoomPinnedEvents, mx.getSafeUserId());

  const creatorsTag = useRoomCreatorsTag();
  const powerLevelTags = usePowerLevelTags(room, powerLevels);
  const getMemberPowerTag = useGetMemberPowerTag(room, creators, powerLevels);
  const theme = useTheme();
  const accessibleTagColors = useAccessiblePowerTagColors(theme.kind, creatorsTag, powerLevelTags);
  const roomToParents = useAtomValue(roomToParentsAtom);
  const imagePackRooms = useImagePackRooms(room.roomId, roomToParents);
  const useAuthentication = useMediaAuthentication();
  const mentionClickHandler = useMentionClickHandler(room.roomId);
  const spoilerClickHandler = useSpoilerClickHandler();

  const linkifyOpts = useMemo<LinkifyOpts>(
    () => ({
      ...LINKIFY_OPTS,
      render: factoryRenderLinkifyWithMention((href) =>
        renderMatrixMention(mx, room.roomId, href, makeMentionCustomProps(mentionClickHandler))
      ),
    }),
    [mx, room, mentionClickHandler]
  );
  const htmlReactParserOptions = useMemo<HTMLReactParserOptions>(
    () =>
      getReactCustomHtmlParser(mx, room.roomId, {
        linkifyOpts,
        useAuthentication,
        handleSpoilerClick: spoilerClickHandler,
        handleMentionClick: mentionClickHandler,
      }),
    [mx, room, linkifyOpts, spoilerClickHandler, mentionClickHandler, useAuthentication]
  );

  const thread = room.getThread(rootEventId);

  const getCachedThreadEvents = useCallback(() => {
    const liveEvents = room.getLiveTimeline().getEvents();
    const sdkThreadEvents = thread ? thread.events : [];
    return mergeThreadEvents(
      [...liveEvents, ...sdkThreadEvents].filter((e) => isThreadEvent(e, rootEventId))
    );
  }, [room, rootEventId, thread]);

  const [rootEvent, setRootEvent] = useState<MatrixEvent | undefined>(
    thread?.rootEvent ?? room.findEventById(rootEventId)
  );
  const [threadEvents, setThreadEvents] = useState<MatrixEvent[]>(getCachedThreadEvents);
  const [isLoading, setIsLoading] = useState(true);

  const syncCachedEvents = useCallback(() => {
    setRootEvent(thread?.rootEvent ?? room.findEventById(rootEventId));
    setThreadEvents(getCachedThreadEvents());
  }, [getCachedThreadEvents, room, rootEventId, thread]);

  // Эффект 1: загружаем тред через /relations и рендерим результат напрямую.
  // Не добавляем эти events в SDK ThreadTimelineSet: SDK отбрасывает часть replies
  // при nested replies, хотя Element показывает их из relations-ответа.
  useEffect(() => {
    let isUnmounted = false;

    const fetchAllThreadEvents = async () => {
      const loadedEvents: MatrixEvent[] = [];
      let loadedRootEvent: MatrixEvent | undefined;

      try {
        const cachedEvents = getCachedThreadEvents();
        if (cachedEvents.length > 0) {
          setThreadEvents(cachedEvents);
          setIsLoading(false);
        } else {
          setIsLoading(true);
        }

        for (const relType of THREAD_REL_TYPES) {
          let from: string | undefined;

          do {
            const relations = await mx.relations(room.roomId, rootEventId, relType, null, {
              dir: Direction.Backward,
              limit: 100,
              recurse: true,
              from,
            });

            if (relations.originalEvent) loadedRootEvent = relations.originalEvent;
            loadedEvents.push(...relations.events);
            from = relations.nextBatch ?? undefined;
          } while (from && !isUnmounted);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[ThreadTimeline] mx.relations failed:', e);
      } finally {
        if (!isUnmounted) {
          const cachedEvents = getCachedThreadEvents();
          setRootEvent(loadedRootEvent ?? thread?.rootEvent ?? room.findEventById(rootEventId));
          const mergedEvents = mergeThreadEvents(
            [...cachedEvents, ...loadedEvents].filter((e) => isThreadEvent(e, rootEventId))
          );
          setThreadEvents(mergedEvents);
          setIsLoading(false);
        }
      }
    };

    fetchAllThreadEvents();

    return () => {
      isUnmounted = true;
    };
  }, [getCachedThreadEvents, mx, room, rootEventId, thread]);

  // Эффект 2: подписка на ThreadEvent.Update / NewReply — реактивные обновления
  useEffect(() => {
    const handleUpdate = () => syncCachedEvents();
    const handleTimeline = (event: MatrixEvent, eventRoom?: Room) => {
      if (eventRoom?.roomId !== room.roomId) return;
      if (isThreadEvent(event, rootEventId)) syncCachedEvents();
    };

    thread?.on(ThreadEvent.Update, handleUpdate);
    thread?.on(ThreadEvent.NewReply, handleUpdate);
    room.on(RoomEvent.Timeline, handleTimeline);
    room.on(RoomEvent.LocalEchoUpdated, handleTimeline);

    return () => {
      thread?.off(ThreadEvent.Update, handleUpdate);
      thread?.off(ThreadEvent.NewReply, handleUpdate);
      room.off(RoomEvent.Timeline, handleTimeline);
      room.off(RoomEvent.LocalEchoUpdated, handleTimeline);
    };
  }, [room, rootEventId, syncCachedEvents, thread]);

  // Эффект 3: local echo — замена временного event ID на серверный
  useEffect(() => {
    const handleLocalEchoUpdated = (mEvent: MatrixEvent, eventRoom: Room) => {
      if (eventRoom?.roomId !== room.roomId) return;
      const relation = mEvent.getRelation?.();
      const isOurThread =
        (relation?.rel_type === 'm.thread' && relation?.event_id === rootEventId) ||
        (relation?.rel_type === 'io.element.thread' && relation?.event_id === rootEventId) ||
        mEvent.getId() === rootEventId;
      if (isOurThread) syncCachedEvents();
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    room.on('Room.localEchoUpdated' as any, handleLocalEchoUpdated);
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      room.off('Room.localEchoUpdated' as any, handleLocalEchoUpdated);
    };
  }, [room, rootEventId, syncCachedEvents]);

  if (isLoading) {
    return (
      <Box grow="Yes" alignItems="Center" justifyContent="Center">
        Loading thread…
      </Box>
    );
  }

  // 2. Получаем ответы. thread.events содержит только ответы (и локальные эхо)
  const threadReplies = threadEvents.filter(
    (e) => e.getId() !== rootEventId && !reactionOrEditEvent(e)
  );

  // Если нет ни корня, ни ответов
  if (!rootEvent && threadReplies.length === 0) {
    return (
      <Box grow="Yes" alignItems="Center" justifyContent="Center">
        Thread not found
      </Box>
    );
  }

  const timelineSet = room.getUnfilteredTimelineSet();

  const renderMessage = (mEvent: MatrixEvent, idx: number) => {
    const mEventId = mEvent.getId();
    if (!mEventId) return null;

    const reactionRelations = getEventReactions(timelineSet, mEventId);
    const reactions = reactionRelations && reactionRelations.getSortedAnnotationsByKey();
    const hasReactions = reactions && reactions.length > 0;
    const { replyEventId, threadRootId } = mEvent;

    const editedEvent = getEditedEvent(mEventId, mEvent, timelineSet);
    const getContent = (() =>
      editedEvent?.getContent()['m.new_content'] ?? mEvent.getContent()) as any;

    const senderId = mEvent.getSender() ?? '';
    const senderDisplayName =
      getMemberDisplayName(room, senderId) ?? getMxIdLocalPart(senderId) ?? senderId;

    return (
      <Message
        key={mEventId}
        data-message-item={idx}
        data-message-id={mEventId}
        room={room}
        mEvent={mEvent}
        messageSpacing={messageSpacing}
        messageLayout={messageLayout}
        collapse={false}
        highlight={false}
        edit={false}
        canDelete={canRedact || (canDeleteOwn && mEvent.getSender() === mx.getUserId())}
        canSendReaction={canSendReaction}
        canPinEvent={canPinEvent}
        imagePackRooms={imagePackRooms}
        relations={hasReactions ? reactionRelations : undefined}
        onUserClick={() => {}}
        onUsernameClick={() => {}}
        onReplyClick={() => {}}
        onReactionToggle={() => {}}
        onEditId={() => {}}
        reply={
          replyEventId ? (
            <Reply
              room={room}
              timelineSet={timelineSet}
              replyEventId={replyEventId}
              threadRootId={threadRootId}
              onClick={() => {}}
              getMemberPowerTag={getMemberPowerTag}
              accessibleTagColors={accessibleTagColors}
              legacyUsernameColor={legacyUsernameColor || direct}
            />
          ) : undefined
        }
        reactions={
          reactionRelations ? (
            <Reactions
              style={{ marginTop: config.space.S200 }}
              room={room}
              relations={reactionRelations}
              mEventId={mEventId}
              canSendReaction={canSendReaction}
              onReactionToggle={() => {}}
            />
          ) : undefined
        }
        hideReadReceipts={hideActivity}
        showDeveloperTools={false}
        memberPowerTag={getMemberPowerTag(senderId)}
        accessibleTagColors={accessibleTagColors}
        legacyUsernameColor={legacyUsernameColor || direct}
        hour24Clock={hour24Clock}
        dateFormatString={dateFormatString}
      >
        {mEvent.isRedacted() ? (
          <RedactedContent reason={mEvent.getUnsigned().redacted_because?.content.reason} />
        ) : (
          <RenderMessageContent
            displayName={senderDisplayName}
            msgType={mEvent.getContent().msgtype ?? ''}
            ts={mEvent.getTs()}
            edited={!!editedEvent}
            getContent={getContent}
            mediaAutoLoad={mediaAutoLoad}
            urlPreview={showUrlPreview}
            htmlReactParserOptions={htmlReactParserOptions}
            linkifyOpts={linkifyOpts}
            outlineAttachment={messageLayout === MessageLayout.Bubble}
          />
        )}
      </Message>
    );
  };

  return (
    <Box
      grow="Yes"
      direction="Column"
      style={{
        overflow: 'auto',
        backgroundColor: 'transparent',
      }}
    >
      <Box
        grow="Yes"
        style={{ overflow: 'auto', padding: `${config.space.S200} ${config.space.S400}` }}
        direction="Column"
        gap="100"
      >
        {/* 1. Thread root (original message) */}
        {rootEvent && renderMessage(rootEvent, 0)}

        {/* 2. Thread replies (with visual line and indentation) */}
        {threadReplies.length > 0 && (
          <Box
            style={{
              marginLeft: '48px',
              paddingLeft: '16px',
              borderLeft: `2px solid ${color.SurfaceVariant.ContainerActive}`,
              display: 'flex',
              flexDirection: 'column',
            }}
            direction="Column"
            gap="100"
          >
            {threadReplies.map((reply, idx) => renderMessage(reply, idx + 1))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
