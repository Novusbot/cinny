import React, { useEffect } from 'react';
import {
  Box,
  config,
  Header,
  Icon,
  IconButton,
  Icons,
  Modal,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Scroll,
  Text,
} from 'folds';
import FocusTrap from 'focus-trap-react';
import { CreateChat } from './CreateChat';
import {
  useCloseCreateChatModal,
  useCreateChatModalState,
} from '../../state/hooks/createChatModal';
import { stopPropagation } from '../../utils/keyboard';
import { useDialogStack } from '../../hooks/useDialogStack';

type CreateChatDialogProps = {
  userId: string;
};

function CreateChatDialog({ userId }: CreateChatDialogProps) {
  const closeDialog = useCloseCreateChatModal();
  const dialogStack = useDialogStack();

  // Register in the global navigation stack so ESC/swipe closes this
  // dialog instead of the room behind it.
  useEffect(() => {
    dialogStack.mount();
    return () => dialogStack.unmount();
  }, [dialogStack]);

  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            clickOutsideDeactivates: true,
            onDeactivate: closeDialog,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Modal size="300" flexHeight>
            <Box direction="Column">
              <Header
                size="500"
                style={{ padding: config.space.S200, paddingLeft: config.space.S400 }}
              >
                <Box grow="Yes">
                  <Text size="H4" truncate>
                    New Chat
                  </Text>
                </Box>
                <Box shrink="No">
                  <IconButton size="300" radii="300" onClick={closeDialog}>
                    <Icon src={Icons.Cross} />
                  </IconButton>
                </Box>
              </Header>
              <Scroll size="300" hideTrack>
                <Box
                  style={{ padding: config.space.S400, paddingRight: config.space.S200 }}
                  direction="Column"
                  gap="500"
                >
                  <CreateChat defaultUserId={userId} requestClose={closeDialog} />
                </Box>
              </Scroll>
            </Box>
          </Modal>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}

export function CreateChatModalRenderer() {
  const state = useCreateChatModalState();

  if (!state) return null;
  return <CreateChatDialog userId={state.userId} />;
}
