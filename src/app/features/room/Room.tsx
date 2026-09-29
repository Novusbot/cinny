import React, { useCallback, useRef } from 'react';
import { Box, Line } from 'folds';
import { useNavigate, useParams } from 'react-router-dom';
import { isKeyHotkey } from 'is-hotkey';
import { useAtomValue } from 'jotai';
import { RoomView } from './RoomView';
import { MembersDrawer } from './MembersDrawer';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { PowerLevelsContextProvider, usePowerLevels } from '../../hooks/usePowerLevels';
import { useRoom } from '../../hooks/useRoom';
import { useKeyDown } from '../../hooks/useKeyDown';
import { markAsRead } from '../../utils/notifications';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useRoomMembers } from '../../hooks/useRoomMembers';
import { CallView } from '../call/CallView';
import { RoomViewHeader } from './RoomViewHeader';
import { callChatAtom } from '../../state/callEmbed';
import { CallChatView } from './CallChatView';
import { getHomePath } from '../../pages/pathUtils';
import { useMacNavigation } from '../../hooks/useMacNavigation';
import { useActiveThread, useSetActiveThread } from '../../state/hooks/activeThread';
import { hasOpenDialogsAtom } from '../../state/navigationStack';
import { useCallEmbed } from '../../hooks/useCallEmbed';
import { useCallMembers, useCallSession } from '../../hooks/useCall';
import { useMessageSelection } from '../../state/hooks/messageSelection';

export function Room() {
  const { eventId } = useParams();
  const room = useRoom();
  const mx = useMatrixClient();
  const navigate = useNavigate();
  const hasOpenDialogs = useAtomValue(hasOpenDialogsAtom);

  const callSession = useCallSession(room);
  const callMembers = useCallMembers(callSession);
  const callEmbed = useCallEmbed();

  const [isDrawer] = useSetting(settingsAtom, 'isPeopleDrawer');
  const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
  const screenSize = useScreenSizeContext();
  const powerLevels = usePowerLevels(room);
  const members = useRoomMembers(mx, room.roomId);
  const chat = useAtomValue(callChatAtom);

  // Thread navigation state
  const activeThread = useActiveThread();
  const setActiveThread = useSetActiveThread();

  // Use ref to always have the latest activeThread value
  // This avoids stale closure issues with the swipe handler
  const activeThreadRef = useRef(activeThread);
  activeThreadRef.current = activeThread;

  // Message selection state (priority 2 for Escape / swipe)
  const selection = useMessageSelection(room.roomId);
  const selectionActiveRef = useRef(selection.isActive);
  selectionActiveRef.current = selection.isActive;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  // macOS native navigation: swipe + Escape to go home (or close thread)
  useMacNavigation(
    useCallback(() => {
      // If message selection is active, clear it and prevent navigation
      if (selectionActiveRef.current) {
        selectionRef.current.clear();
        return true; // Consume the swipe
      }

      // If thread is open, close it and prevent navigation
      if (activeThreadRef.current !== null) {
        setActiveThread(null);
        return true; // Consume the swipe
      }
      return false; // Allow navigation home
    }, [setActiveThread])
  );

  useKeyDown(
    window,
    useCallback(
      (evt) => {
        if (isKeyHotkey('escape', evt)) {
          // Priority 1: Modal dialogs (declarative state check)
          if (hasOpenDialogs) {
            // Don't dispatch Escape here - the dialog's own ESC handler will catch it
            // because we have stopPropagation() in the dialog component
            return; // Consume the ESC - don't proceed to thread/room navigation
          }

          // Priority 2: If message selection is active, clear it
          if (selectionActiveRef.current) {
            selectionRef.current.clear();
            return;
          }

          // Priority 3: If thread is open, close it
          if (activeThreadRef.current !== null) {
            setActiveThread(null);
            return;
          }
          // Priority 4: Otherwise, navigate home
          markAsRead(mx, room.roomId, hideActivity);
          navigate(getHomePath(), { replace: false });
        }
      },
      [mx, room.roomId, hideActivity, navigate, setActiveThread, hasOpenDialogs]
    )
  );

  const callView = callEmbed?.roomId === room.roomId || room.isCallRoom() || callMembers.length > 0;

  return (
    <PowerLevelsContextProvider value={powerLevels}>
      <Box grow="Yes">
        {callView && (screenSize === ScreenSize.Desktop || !chat) && (
          <Box grow="Yes" direction="Column">
            <RoomViewHeader callView />
            <Box grow="Yes">
              <CallView />
            </Box>
          </Box>
        )}
        {!callView && (
          <Box grow="Yes" direction="Column">
            <RoomViewHeader />
            <Box grow="Yes">
              <RoomView eventId={eventId} />
            </Box>
          </Box>
        )}

        {callView && chat && (
          <>
            {screenSize === ScreenSize.Desktop && (
              <Line variant="Background" direction="Vertical" size="300" />
            )}
            <CallChatView />
          </>
        )}
        {!callView && screenSize === ScreenSize.Desktop && isDrawer && (
          <>
            <Line variant="Background" direction="Vertical" size="300" />
            <MembersDrawer key={room.roomId} room={room} members={members} />
          </>
        )}
      </Box>
    </PowerLevelsContextProvider>
  );
}
