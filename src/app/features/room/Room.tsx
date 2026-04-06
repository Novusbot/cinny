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

export function Room() {
  const { eventId } = useParams();
  const room = useRoom();
  const mx = useMatrixClient();
  const navigate = useNavigate();

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

  // macOS native navigation: swipe + Escape to go home (or close thread)
  useMacNavigation(
    useCallback(() => {
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
          // Priority 1: If thread is open, close it
          if (activeThreadRef.current !== null) {
            setActiveThread(null);
            return;
          }
          // Priority 2: Otherwise, navigate home
          markAsRead(mx, room.roomId, hideActivity);
          navigate(getHomePath(), { replace: false });
        }
      },
      [mx, room.roomId, hideActivity, navigate, setActiveThread]
    )
  );

  const callView = room.isCallRoom();

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
