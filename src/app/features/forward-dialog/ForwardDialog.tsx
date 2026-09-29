import React, {
  ChangeEventHandler,
  KeyboardEventHandler,
  MouseEventHandler,
  useCallback,
  useLayoutEffect,
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
  Spinner,
  TextArea,
  color,
} from 'folds';
import FocusTrap from 'focus-trap-react';
import { isKeyHotkey } from 'is-hotkey';
import { IContent, MatrixEvent, RoomMember } from 'matrix-js-sdk';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useCloseForwardDialog } from '../../state/hooks/forwardDialog';
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
import { getMxIdLocalPart, rateLimitedActions } from '../../utils/matrix';
import { buildForwardHeader } from './forwardHeader';
import { ForwardDialogState } from '../../state/forwardDialog';
import { highlightText, makeHighlightRegex } from '../../plugins/react-custom-html-parser';
import { pluralMessages } from '../../utils/i18n';
import * as css from './ForwardDialog.css';

const SEARCH_OPTIONS: UseAsyncSearchOptions = {
  limit: 50,
  matchOptions: {
    contain: true,
  },
};

/** Макс. высота поля комментария (~5 строк) — дальше включается скролл. */
const COMMENT_MAX_HEIGHT = 132;

type ForwardDialogProps = {
  state: ForwardDialogState;
};

export function ForwardDialog({ state }: ForwardDialogProps) {
  const mx = useMatrixClient();
  const closeDialog = useCloseForwardDialog();
  const inputRef = useRef<HTMLInputElement>(null);
  const useAuthentication = useMediaAuthentication();

  // События к пересылке (одно или несколько) и признак пакетной пересылки
  const events = state.eventsToForward;
  const isBatch = events.length > 1;

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
        const otherMember = room
          ?.getJoinedMembers()
          .find((m: RoomMember) => m.userId !== mx.getUserId());
        const username = otherMember ? getMxIdLocalPart(otherMember.userId) || '' : '';
        return [name, username].filter(Boolean);
      }
      return name;
    },
    [mx, mDirects]
  );

  const [result, search, resetSearch] = useAsyncSearch(targetRooms, getRoomName, SEARCH_OPTIONS);
  const query = result?.query ?? '';
  const roomsToRender = useMemo(() => {
    if (result) return result.items;
    // Без запроса показываем лички, а не первые 50 комнат: пересылка чаще
    // идёт в личку, и список должен начинаться с неё.
    return [...targetRooms].sort((a, b) => {
      const aDirect = mDirects.has(a) ? 0 : 1;
      const bDirect = mDirects.has(b) ? 0 : 1;
      if (aDirect !== bDirect) return aDirect - bDirect;
      const aName = mx.getRoom(a)?.name ?? '';
      const bName = mx.getRoom(b)?.name ?? '';
      return aName.localeCompare(bName, 'ru');
    });
  }, [result, targetRooms, mDirects, mx]);

  const highlightRegex = useMemo(
    () => (query ? makeHighlightRegex(query.split(' ')) : undefined),
    [query]
  );

  // Loading state for forwarding
  const [sendingRoomId, setSendingRoomId] = useState<string | null>(null);

  // Optional comment to send alongside forwarded message
  const [comment, setComment] = useState('');

  // Авторесайз поля комментария: растёт под текст до лимита, дальше скролл.
  const commentRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = commentRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, COMMENT_MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > COMMENT_MAX_HEIGHT ? 'auto' : 'hidden';
  }, [comment]);

  const [sendError, setSendError] = useState<string | undefined>();

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

  // Построение контента одного события для пересылки в другую комнату
  const buildForwardedContent = useCallback(
    (event: MatrixEvent) => {
      // Get content - try multiple sources
      let content: IContent | null = null;

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
      const forwardedContent: IContent = JSON.parse(JSON.stringify(content));

      // Remove relations (reply, thread, etc.) - message should be standalone in new room
      delete forwardedContent['m.relates_to'];

      // Add "Forwarded from..." header for text messages
      if (
        forwardedContent.msgtype === 'm.text' ||
        forwardedContent.msgtype === 'm.notice' ||
        forwardedContent.msgtype === 'm.emote'
      ) {
        const originalRoomId = event.getRoomId();
        const originalRoom = mx.getRoom(originalRoomId);

        // Личка определяется так же, как в сайдбаре (useRoomLastMessage.ts):
        // помечена в m.direct ИЛИ в комнате ровно два участника.
        const isDirectRoom =
          mDirects.has(originalRoomId) || (originalRoom?.getJoinedMemberCount() ?? 0) === 2;

        const { text: forwardText, html: forwardHtml } = buildForwardHeader({
          room: originalRoom,
          roomId: originalRoomId,
          eventId: event.getId(),
          senderId: event.getSender(),
          senderName: event.sender?.name,
          isDirectRoom,
        });

        const originalBody = forwardedContent.body || '';
        const originalHtml = forwardedContent.formatted_body || originalBody;

        // Rewrite body with forward header
        forwardedContent.body = forwardText + originalBody;

        // Enable HTML formatting
        forwardedContent.format = 'org.matrix.custom.html';
        forwardedContent.formatted_body = forwardHtml + originalHtml;
      }

      return forwardedContent;
    },
    [mx, mDirects]
  );

  // Actual forwarding logic
  const handleForward = useCallback(
    async (targetRoomId: string) => {
      if (sendingRoomId) return; // Prevent double-click

      try {
        setSendError(undefined);
        setSendingRoomId(targetRoomId);

        // rateLimitedActions глотает ошибки (это нужно Lobby/Invites/командам),
        // поэтому успешность проверяем по числу непустых результатов.
        const sent = await rateLimitedActions(
          events,
          async (event) => {
            const content = buildForwardedContent(event);
            await mx.sendMessage(targetRoomId, content);
            return true;
          },
          3
        );

        const failed = sent.filter((ok) => !ok).length;
        if (failed > 0) {
          setSendError(
            failed === events.length
              ? `${
                  isBatch ? 'Не удалось переслать сообщения' : 'Не удалось переслать сообщение'
                }: проверьте доступ к чату`
              : `Не удалось переслать ${failed} из ${events.length} — остальные отправлены`
          );
          return;
        }

        // Send optional comment as a separate standard text message
        const trimmedComment = comment.trim();
        if (trimmedComment) {
          await mx.sendMessage(targetRoomId, {
            msgtype: 'm.text',
            body: trimmedComment,
          });
        }

        // Close dialog on success
        closeDialog();
      } catch (error) {
        // Ошибка показывается в диалоге: alert() терял контекст и не давал понять,
        // в какую комнату не ушло.
        console.error('[Forward] Failed to forward message:', error);
        setSendError(
          `${isBatch ? 'Не удалось переслать сообщения' : 'Не удалось переслать сообщение'}: ${
            error instanceof Error ? error.message : 'неизвестная ошибка'
          }`
        );
      } finally {
        setSendingRoomId(null);
      }
    },
    [closeDialog, mx, events, isBatch, buildForwardedContent, sendingRoomId, comment]
  );

  // Event preview (для пачки показываем первое сообщение)
  const eventPreview = useMemo(() => {
    const event = events[0];
    if (!event) return { sender: '', text: '' };
    const sender = event.sender?.name || event.getSender()?.split(':')[0] || 'Unknown';
    let text = '';
    try {
      const content = event.getContent();
      const clearContent =
        typeof event.getClearContent === 'function' ? event.getClearContent() : null;
      const body = clearContent?.body || content?.body || '';
      text = body;
    } catch {
      text = '[Message]';
    }
    return { sender, text };
  }, [events]);

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
          <Modal size="400" flexHeight className={css.ForwardDialogModal}>
            <Header size="500" variant="Surface" className={css.ForwardDialogHeader}>
              <Box grow="Yes" direction="Column" gap="100" style={{ minWidth: 0 }}>
                <Text size="H5" truncate>
                  {isBatch ? 'Переслать сообщения' : 'Переслать сообщение'}
                </Text>
                <Text size="T200" priority="300" truncate>
                  {isBatch
                    ? `${eventPreview.sender} · ${pluralMessages(events.length)}`
                    : eventPreview.sender}
                </Text>
              </Box>
              <Box shrink="No">
                <IconButton size="300" radii="300" fill="None" onClick={closeDialog}>
                  <Icon src={Icons.Cross} />
                </IconButton>
              </Box>
            </Header>

            {/* Preview */}
            {eventPreview.text && (
              <Box shrink="No" className={css.ForwardDialogPreview} direction="Column">
                <Text as="span" size="T200" className={css.ForwardDialogPreviewText}>
                  {eventPreview.text}
                </Text>
                {isBatch && (
                  <Text as="span" size="T200" priority="300">
                    и ещё {pluralMessages(events.length - 1)}
                  </Text>
                )}
              </Box>
            )}

            {/* Search */}
            <Box shrink="No" className={css.ForwardDialogSearch} direction="Column">
              <Input
                ref={inputRef}
                className={css.ForwardDialogInput}
                size="400"
                variant="Background"
                radii="400"
                outlined
                placeholder="Поиск комнат или людей"
                before={<Icon size="200" src={Icons.Search} />}
                onChange={handleSearchChange}
                onKeyDown={handleKeyDown}
              />
            </Box>

            {/* Comment */}
            <Box shrink="No" className={css.ForwardDialogComment} direction="Column">
              <TextArea
                ref={commentRef}
                className={css.ForwardDialogCommentInput}
                size="400"
                variant="SurfaceVariant"
                radii="400"
                resize="None"
                rows={1}
                placeholder="Добавить комментарий..."
                value={comment}
                onChange={(evt) => setComment(evt.currentTarget.value)}
                disabled={sendingRoomId !== null}
              />
            </Box>

            {/* Room List */}
            <Scroll size="300" hideTrack className={css.ForwardDialogList}>
              <Box direction="Column" gap="100">
                {roomsToRender.length === 0 ? (
                  <Box className={css.ForwardDialogEmpty} direction="Column" alignItems="Center">
                    <Text size="T300" priority="300">
                      {query ? `Ничего не найдено по запросу «${query}»` : 'Нет доступных чатов'}
                    </Text>
                  </Box>
                ) : (
                  roomsToRender.map((roomId) => {
                    const room = mx.getRoom(roomId);
                    if (!room) return null;
                    const isDirect = mDirects.has(roomId);
                    const roomName = room.name || roomId;
                    const isSending = sendingRoomId === roomId;
                    const isBlocked = sendingRoomId !== null && !isSending;

                    const handleRowClick: MouseEventHandler<HTMLDivElement> = (evt) => {
                      if (isBlocked) return;
                      handleForward(roomId);
                    };

                    return (
                      <Box
                        key={roomId}
                        as="div"
                        className={css.ForwardDialogRow}
                        role="button"
                        tabIndex={isBlocked ? -1 : 0}
                        aria-disabled={isBlocked}
                        title={roomName}
                        onClick={handleRowClick}
                        onKeyDown={(evt: React.KeyboardEvent<HTMLDivElement>) => {
                          if (isBlocked) return;
                          if (isKeyHotkey('enter', evt) || isKeyHotkey('space', evt)) {
                            evt.preventDefault();
                            handleForward(roomId);
                          }
                        }}
                        alignItems="Center"
                        gap="300"
                        wrap="NoWrap"
                        style={{ padding: config.space.S100 }}
                      >
                        <Box shrink="No">
                          <Avatar size="400" radii={isDirect ? '400' : '300'}>
                            <RoomAvatar
                              roomId={roomId}
                              src={
                                isDirect
                                  ? getDirectRoomAvatarUrl(mx, room, 96, useAuthentication)
                                  : getRoomAvatarUrl(mx, room, 96, useAuthentication)
                              }
                              alt={roomName}
                              renderFallback={() => (
                                <Text as="span" size="H6">
                                  {nameInitials(roomName, 2)}
                                </Text>
                              )}
                            />
                          </Avatar>
                        </Box>
                        <Box grow="Yes" className={css.ForwardDialogRowName} direction="Column">
                          <Text as="span" size="T400" truncate>
                            {highlightRegex ? highlightText(highlightRegex, [roomName]) : roomName}
                          </Text>
                          {isDirect && (
                            <Text as="span" size="T200" priority="300" truncate>
                              Личный чат
                            </Text>
                          )}
                        </Box>
                        <Box shrink="No" className={css.ForwardDialogRowSend} alignItems="Center">
                          {isSending ? (
                            <>
                              <Spinner fill="Solid" variant="Primary" size="100" />
                              <Text as="span" size="B300">
                                Отправка
                              </Text>
                            </>
                          ) : (
                            <>
                              <Icon size="100" src={Icons.ArrowGoRight} />
                              <Text as="span" size="B300">
                                Переслать
                              </Text>
                            </>
                          )}
                        </Box>
                      </Box>
                    );
                  })
                )}
              </Box>
            </Scroll>

            {sendError && (
              <Box style={{ padding: `0 ${config.space.S400} ${config.space.S400}` }}>
                <Text size="T200" style={{ color: color.Critical.Main }}>
                  {sendError}
                </Text>
              </Box>
            )}
          </Modal>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}
