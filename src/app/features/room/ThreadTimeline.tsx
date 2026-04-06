import React from 'react';
import { Box, config, color } from 'folds';
import { MatrixEvent, Room } from 'matrix-js-sdk';
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
import { getEventReactions, getEditedEvent } from '../../utils/room';
import { Reply } from '../../components/message/Reply';
import { EventType } from 'matrix-js-sdk';

type ThreadTimelineProps = {
  room: Room;
  rootEventId: string;
};

export function ThreadTimeline({ room, rootEventId }: ThreadTimelineProps) {
  const mx = useMatrixClient();
  const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
  const [showDeveloperTools] = useSetting(settingsAtom, 'showDeveloperTools');
  const [messageLayout] = useSetting(settingsAtom, 'messageLayout');
  const [messageSpacing] = useSetting(settingsAtom, 'messageSpacing');
  const [legacyUsernameColor] = useSetting(settingsAtom, 'legacyUsernameColor');
  const [hour24Clock] = useSetting(settingsAtom, 'hour24Clock');
  const [dateFormatString] = useSetting(settingsAtom, 'dateFormatString');
  const [mediaAutoLoad] = useSetting(settingsAtom, 'mediaAutoLoad');
  const [urlPreview] = useSetting(settingsAtom, 'urlPreview');
  const [encUrlPreview] = useSetting(settingsAtom, 'encUrlPreview');
  const showUrlPreview = room.hasEncryptionStateEvent() ? encUrlPreview : urlPreview;
  const [showHiddenEvents] = useSetting(settingsAtom, 'showHiddenEvents');

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

  // Get all events from live timeline
  const allEvents = room.getLiveTimeline().getEvents();
  const rootEvent = allEvents.find((e) => e.getId() === rootEventId);
  const threadReplies = allEvents.filter((e) => e.threadRootId === rootEventId);

  if (allEvents.length === 0 || (!rootEvent && threadReplies.length === 0)) {
    return (
      <Box grow="Yes" alignItems="Center" justifyContent="Center">
        Thread not found
      </Box>
    );
  }

  const renderMessage = (mEvent: MatrixEvent, idx: number) => {
    const mEventId = mEvent.getId();
    if (!mEventId) return null;

    const timelineSet = room.getUnfilteredTimelineSet();
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
        showDeveloperTools={showDeveloperTools}
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
            htmlReactParserOptions={{}}
            linkifyOpts={{}}
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
