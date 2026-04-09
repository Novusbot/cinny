import React, {
  ChangeEventHandler,
  KeyboardEventHandler,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Box,
  Header,
  config,
  Text,
  IconButton,
  Icon,
  Icons,
  Input,
  Modal,
  toRem,
  Scroll,
  Avatar,
  MenuItem,
  Button,
} from 'folds';
import FocusTrap from 'focus-trap-react';
import { isKeyHotkey } from 'is-hotkey';
import { Room } from 'matrix-js-sdk';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useCloseForwardDialog, useForwardDialogState } from '../../state/hooks/forwardDialog';
import { stopPropagation } from '../../utils/keyboard';
import { useRooms, useDirects } from '../../state/hooks/roomList';
import { allRoomsAtom } from '../../state/room-list/roomList';
import { mDirectAtom } from '../../state/mDirectList';
import { getRoomAvatarUrl, getDirectRoomAvatarUrl } from '../../utils/room';
import { nameInitials } from '../../utils/common';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { RoomAvatar } from '../../components/room-avatar';
import { useAsyncSearch, UseAsyncSearchOptions } from '../../hooks/useAsyncSearch';
import { useAtomValue } from 'jotai';
import { getMxIdLocalPart } from '../../utils/matrix';

const SEARCH_OPTIONS: UseAsyncSearchOptions = {
  limit: 50,
  matchOptions: {
    contain: true,
  },
};

type ForwardDialogProps = {
  state: {
    eventToForward: any;
    roomId: string;
  };
};

export function ForwardDialog({ state }: ForwardDialogProps) {
  const mx = useMatrixClient();
  const closeDialog = useCloseForwardDialog();
  const inputRef = useRef<HTMLInputElement>(null);
  const useAuthentication = useMediaAuthentication();

  // Get rooms
  const mDirects = useAtomValue(mDirectAtom);
  const allRooms = useRooms(mx, allRoomsAtom, mDirects);
  const directs = useDirects(mx, allRoomsAtom, mDirects);

  // Combine and filter out current room
  const targetRooms = useMemo(() => {
    return [...new Set([...allRooms, ...directs])].filter((id) => id !== state.roomId);
  }, [allRooms, directs, state.roomId]);

  // Search setup
  const getRoomName = useCallback(
    (roomId: string) => {
      const room = mx.getRoom(roomId);
      const name = room?.name || roomId;
      // For DMs, also search by username
      if (mDirects.has(roomId)) {
        const otherMember = room?.getJoinedMembers().find((m) => m.userId !== mx.getUserId());
        const username = otherMember ? getMxIdLocalPart(otherMember.userId) || '' : '';
        return [name, username].filter(Boolean);
      }
      return name;
    },
    [mx, mDirects]
  );

  const [result, search, resetSearch] = useAsyncSearch(targetRooms, getRoomName, SEARCH_OPTIONS);
  const roomsToRender = result?.items || targetRooms.slice(0, 50);

  // Loading state for forwarding
  const [sendingRoomId, setSendingRoomId] = useState<string | null>(null);

  const handleSearchChange: ChangeEventHandler<HTMLInputElement> = (evt) => {
    const value = evt.currentTarget.value.trim();
    if (value) {
      search(value);
    } else {
      resetSearch();
    }
  };

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (evt) => {
    if (isKeyHotkey('escape', evt)) {
      closeDialog();
    }
  };

  // Actual forwarding logic
  const handleForward = useCallback(
    async (targetRoomId: string) => {
      if (sendingRoomId) return; // Prevent double-click

      try {
        setSendingRoomId(targetRoomId);

        const event = state.eventToForward;

        // Get content - try multiple sources
        let content = null;
        
        // Try getClearContent first (for decrypted events)
        if (typeof event.getClearContent === 'function') {
          content = event.getClearContent();
        }
        
        // Fallback to getContent
        if (!content || Object.keys(content).length === 0) {
          content = event.getContent();
        }
        
        // Fallback to raw event.event.content
        if (!content || Object.keys(content).length === 0) {
          content = event.event?.content;
        }

        if (!content || Object.keys(content).length === 0) {
          throw new Error('No content found in event. Event might not be decrypted yet.');
        }

        // Deep copy to avoid mutating original
        content = JSON.parse(JSON.stringify(content));

        // Remove relations (reply, thread, etc.) - message should be standalone in new room
        delete content['m.relates_to'];

        // Add "Forwarded from..." header for text messages
        if (content.msgtype === 'm.text' || content.msgtype === 'm.notice' || content.msgtype === 'm.emote') {
          // Gather original message info
          const originalRoomId = event.getRoomId();
          const originalEventId = event.getId();
          const senderName = event.sender?.name || event.getSender()?.split(':')[0] || 'Unknown';
          const originalRoom = mx.getRoom(originalRoomId);
          const roomName = originalRoom?.name || originalRoomId || 'комнаты';

          // Universal Matrix link that Cinny will intercept
          const messageLink = `https://matrix.to/#/${originalRoomId}/${originalEventId}`;

          // Text and HTML versions of the header
          const forwardText = `Переслано от ${senderName} из ${roomName}\n`;
          // Ссылка на название комнаты (ведет на оригинальное сообщение)
          // Using <sup>+<font> for tiny superscript styling (Matrix-compatible, no style attribute)
          const forwardHtml = `<sup><font color="#888888"><em>Переслано от:</em> ${senderName} <em>из <a href="${messageLink}">${roomName}</a></em></font></sup><br/>`;

          // Preserve original text
          const originalBody = content.body || '';
          const originalHtml = content.formatted_body || originalBody;

          // Rewrite body with forward header
          content.body = forwardText + originalBody;
          
          // Enable HTML formatting
          content.format = 'org.matrix.custom.html';
          content.formatted_body = forwardHtml + originalHtml;
        }
        
        // Send message to target room
        await mx.sendMessage(targetRoomId, content as any);

        // Close dialog on success
        closeDialog();
      } catch (error) {
        console.error('[Forward] Failed to forward message:', error);
        if (error instanceof Error) {
          console.error('[Forward] Error message:', error.message);
        }
        alert(`Не удалось переслать сообщение: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      } finally {
        setSendingRoomId(null);
      }
    },
    [closeDialog, mx, state.eventToForward, sendingRoomId]
  );

  // Event preview
  const eventPreview = useMemo(() => {
    const event = state.eventToForward;
    if (!event) return { sender: '', text: '' };
    const sender = event.sender?.name || event.getSender()?.split(':')[0] || 'Unknown';
    let text = '';
    try {
      const content = event.getContent();
      const clearContent = typeof event.getClearContent === 'function' ? event.getClearContent() : null;
      const body = clearContent?.body || content?.body || '';
      text = body.length > 100 ? body.substring(0, 100) + '...' : body;
    } catch {
      text = '[Message]';
    }
    return { sender, text };
  }, [state.eventToForward]);

  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: () => inputRef.current,
            clickOutsideDeactivates: true,
            onDeactivate: closeDialog,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Modal size="400" style={{ maxHeight: toRem(500), borderRadius: config.radii.R500 }}>
            {/* Header */}
            <Header
              size="500"
              style={{ padding: `0 ${config.space.S200} 0 ${config.space.S400}` }}
            >
              <Box grow="Yes">
                <Text size="H4" truncate>
                  Переслать сообщение
                </Text>
              </Box>
              <Box shrink="No">
                <IconButton size="300" radii="300" onClick={closeDialog}>
                  <Icon src={Icons.Cross} />
                </IconButton>
              </Box>
            </Header>

            {/* Preview */}
            <Box style={{ padding: `${config.space.S200} ${config.space.S400}` }}>
              <Box
                style={{
                  padding: config.space.S200,
                  backgroundColor: 'var(--bg-surface-variant)',
                  borderRadius: toRem(8),
                }}
              >
                <Text size="T200" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {eventPreview.sender}
                </Text>
                <Text
                  size="T300"
                  style={{
                    marginTop: toRem(4),
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {eventPreview.text || '[Empty message]'}
                </Text>
              </Box>
            </Box>

            {/* Search */}
            <Box style={{ padding: `0 ${config.space.S400}` }}>
              <Input
                ref={inputRef}
                size="500"
                variant="Background"
                radii="400"
                outlined
                placeholder="Поиск комнат или людей"
                before={<Icon size="200" src={Icons.Search} />}
                onChange={handleSearchChange}
                onKeyDown={handleKeyDown}
              />
            </Box>

            {/* Room List */}
            <Scroll size="300" hideTrack style={{ maxHeight: toRem(300) }}>
              <Box style={{ padding: config.space.S200 }} direction="Column" gap="100">
                {roomsToRender.length === 0 ? (
                  <Text size="T300" style={{ textAlign: 'center', padding: config.space.S400 }}>
                    Комнаты не найдены
                  </Text>
                ) : (
                  roomsToRender.map((roomId) => {
                    const room = mx.getRoom(roomId);
                    if (!room) return null;
                    const isDirect = mDirects.has(roomId);
                    const roomName = room.name || roomId;

                    return (
                      <Box key={roomId} alignItems="Center" gap="200" style={{ padding: `${config.space.S100} 0` }}>
                        <Avatar size="300" radii="400">
                          <RoomAvatar
                            roomId={roomId}
                            src={
                              isDirect
                                ? getDirectRoomAvatarUrl(mx, room, 96, useAuthentication)
                                : getRoomAvatarUrl(mx, room, 96, useAuthentication)
                            }
                            alt={roomName}
                            renderFallback={() => <Text as="span" size="H6">{nameInitials(roomName)}</Text>}
                          />
                        </Avatar>
                        <Box grow="Yes">
                          <Text size="T300" truncate>{roomName}</Text>
                        </Box>
                        <Button
                          size="300"
                          disabled={sendingRoomId !== null}
                          onClick={() => handleForward(roomId)}
                        >
                          <Text size="B300">
                            {sendingRoomId === roomId ? 'Отправка...' : 'Отправить'}
                          </Text>
                        </Button>                      </Box>
                    );
                  })
                )}
              </Box>
            </Scroll>
          </Modal>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}
