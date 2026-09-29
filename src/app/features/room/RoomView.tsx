import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Text, config } from 'folds';
import { EventType } from 'matrix-js-sdk';
import { ReactEditor } from 'slate-react';
import { isKeyHotkey } from 'is-hotkey';
import { useStateEvent } from '../../hooks/useStateEvent';
import { StateEvent } from '../../../types/matrix/room';
import { usePowerLevelsContext } from '../../hooks/usePowerLevels';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useEditor } from '../../components/editor';
import { RoomInputPlaceholder } from './RoomInputPlaceholder';
import { RoomTimeline } from './RoomTimeline';
import { ThreadTimeline } from './ThreadTimeline';
import { RoomViewTyping } from './RoomViewTyping';
import { RoomTombstone } from './RoomTombstone';
import { RoomInput } from './RoomInput';
import { RoomViewFollowing, RoomViewFollowingPlaceholder } from './RoomViewFollowing';
import { Page } from '../../components/page';
import { useKeyDown } from '../../hooks/useKeyDown';
import { editableActiveElement } from '../../utils/dom';
import { settingsAtom } from '../../state/settings';
import { useSetting } from '../../state/hooks/settings';
import { useRoomPermissions } from '../../hooks/useRoomPermissions';
import { useRoomCreators } from '../../hooks/useRoomCreators';
import { useRoom } from '../../hooks/useRoom';
import { useActiveThread, useSetActiveThread } from '../../state/hooks/activeThread';
import { useMessageSelection } from '../../state/hooks/messageSelection';
import { useOpenForwardDialog } from '../../state/hooks/forwardDialog';
import { MessageSelectionBar } from './MessageSelectionBar';
import { pluralMessages } from '../../utils/i18n';

const FN_KEYS_REGEX = /^F\d+$/;
const shouldFocusMessageField = (evt: KeyboardEvent): boolean => {
  const { code } = evt;
  if (evt.metaKey || evt.altKey || evt.ctrlKey) {
    return false;
  }

  if (FN_KEYS_REGEX.test(code)) return false;

  if (
    code.startsWith('OS') ||
    code.startsWith('Meta') ||
    code.startsWith('Shift') ||
    code.startsWith('Alt') ||
    code.startsWith('Control') ||
    code.startsWith('Arrow') ||
    code.startsWith('Page') ||
    code.startsWith('End') ||
    code.startsWith('Home') ||
    code === 'Tab' ||
    code === 'Space' ||
    code === 'Enter' ||
    code === 'NumLock' ||
    code === 'ScrollLock'
  ) {
    return false;
  }

  return true;
};

export function RoomView({ eventId }: { eventId?: string }) {
  const roomInputRef = useRef<HTMLDivElement>(null);
  const roomViewRef = useRef<HTMLDivElement>(null);

  const [hideActivity] = useSetting(settingsAtom, 'hideActivity');

  const room = useRoom();
  const { roomId } = room;
  const editor = useEditor();

  const mx = useMatrixClient();

  // Thread navigation state
  const activeThread = useActiveThread();
  const setActiveThread = useSetActiveThread();

  // Message selection state
  const selection = useMessageSelection(roomId);
  const { selected, isActive: isSelectionActive, clear: clearSelection, retain } = selection;
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();
  const openForwardDialog = useOpenForwardDialog();

  const handleDeleteSelected = useCallback(
    async (reason: string) => {
      if (deleting) return;
      const mEvents = [...selected];
      if (mEvents.length === 0) return;
      setDeleting(true);
      setDeleteError(undefined);
      try {
        // allSettled, а не rateLimitedActions: тот глотает ошибки, и частично
        // неудачное удаление выглядело бы как успешное.
        const trimmedReason = reason.trim();
        const results = await Promise.allSettled(
          mEvents.map((evt) => {
            const selectedEventId = evt.getId();
            if (!selectedEventId) return Promise.reject(new Error('Сообщение без event ID'));
            return mx.redactEvent(
              roomId,
              selectedEventId,
              trimmedReason ? { reason: trimmedReason } : undefined
            );
          })
        );

        const failedIds = results
          .map((res, index) => (res.status === 'rejected' ? mEvents[index].getId() : undefined))
          .filter((id): id is string => Boolean(id));

        // Успешно удалённые снимаются сами (событие становится redacted),
        // неудачные оставляем выделенными, чтобы можно было повторить.
        retain(failedIds);

        if (failedIds.length > 0) {
          setDeleteError(
            `Не удалось удалить ${pluralMessages(failedIds.length)}. Проверьте права в комнате.`
          );
        }
      } finally {
        setDeleting(false);
      }
    },
    [deleting, mx, roomId, selected, retain]
  );

  const handleForwardSelected = useCallback(() => {
    if (selected.length === 0) return;
    // Порядок ленты: ранние сверху, как в таймлайне.
    const events = [...selected].sort((a, b) => a.getTs() - b.getTs());
    openForwardDialog({ eventsToForward: events, roomId });
    clearSelection();
  }, [roomId, selected, openForwardDialog, clearSelection]);

  // Clear active thread when switching rooms
  useEffect(() => {
    setActiveThread(null);
    clearSelection();
    return () => {
      setActiveThread(null);
      clearSelection();
    };
  }, [roomId, setActiveThread, clearSelection]);

  const tombstoneEvent = useStateEvent(room, StateEvent.RoomTombstone);
  const powerLevels = usePowerLevelsContext();
  const creators = useRoomCreators(room);

  const permissions = useRoomPermissions(creators, powerLevels);
  const canMessage = permissions.event(EventType.RoomMessage, mx.getSafeUserId());

  useKeyDown(
    window,
    useCallback(
      (evt) => {
        if (editableActiveElement()) return;
        // В режиме выбора сообщений инпута нет — фокусировать редактор некуда
        if (isSelectionActive) return;
        const portalContainer = document.getElementById('portalContainer');
        if (portalContainer && portalContainer.children.length > 0) {
          return;
        }
        if (shouldFocusMessageField(evt) || isKeyHotkey('mod+v', evt)) {
          ReactEditor.focus(editor);
        }
      },
      [editor, isSelectionActive]
    )
  );

  return (
    <Page ref={roomViewRef}>
      <Box grow="Yes" direction="Column" style={{ position: 'relative', minHeight: 0 }}>
        {/* Main timeline - always in DOM to preserve scroll position */}
        <Box
          grow="Yes"
          direction="Column"
          style={{
            display: activeThread ? 'none' : 'flex',
            minHeight: 0,
          }}
        >
          <RoomTimeline
            key={roomId}
            room={room}
            eventId={eventId}
            roomInputRef={roomInputRef}
            editor={editor}
          />
          <RoomViewTyping room={room} />
        </Box>

        {/* Thread view - overlays the main timeline */}
        {activeThread && (
          <Box
            grow="Yes"
            direction="Column"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1,
            }}
          >
            <ThreadTimeline room={room} rootEventId={activeThread} />
            <RoomViewTyping room={room} />
          </Box>
        )}
      </Box>
      <Box shrink="No" direction="Column">
        {isSelectionActive ? (
          <MessageSelectionBar
            room={room}
            deleting={deleting}
            deleteError={deleteError}
            onDelete={handleDeleteSelected}
            onForward={handleForwardSelected}
          />
        ) : (
          <div style={{ padding: `0 ${config.space.S400}` }}>
            {tombstoneEvent ? (
              <RoomTombstone
                roomId={roomId}
                body={tombstoneEvent.getContent().body}
                replacementRoomId={tombstoneEvent.getContent().replacement_room}
              />
            ) : (
              <>
                {canMessage && (
                  <RoomInput
                    room={room}
                    editor={editor}
                    roomId={roomId}
                    fileDropContainerRef={roomViewRef}
                    ref={roomInputRef}
                  />
                )}
                {!canMessage && (
                  <RoomInputPlaceholder
                    style={{ padding: config.space.S200 }}
                    alignItems="Center"
                    justifyContent="Center"
                  >
                    <Text align="Center">You do not have permission to post in this room</Text>
                  </RoomInputPlaceholder>
                )}
              </>
            )}
          </div>
        )}
        {!isSelectionActive &&
          (hideActivity ? <RoomViewFollowingPlaceholder /> : <RoomViewFollowing room={room} />)}
      </Box>
    </Page>
  );
}
