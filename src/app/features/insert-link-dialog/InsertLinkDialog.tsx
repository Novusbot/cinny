import React, {
  ChangeEventHandler,
  KeyboardEventHandler,
  useCallback,
  useEffect,
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
  Button,
} from 'folds';
import FocusTrap from 'focus-trap-react';
import { isKeyHotkey } from 'is-hotkey';
import { useCloseInsertLinkDialog, useInsertLinkDialogState } from '../../state/hooks/insertLinkDialog';
import { stopPropagation } from '../../utils/keyboard';
import { useDialogStack } from '../../hooks/useDialogStack';

export function InsertLinkDialog() {
  const dialogState = useInsertLinkDialogState();
  const closeDialog = useCloseInsertLinkDialog();
  const textInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const dialogStack = useDialogStack();

  const [text, setText] = useState(dialogState?.initialText || '');
  const [url, setUrl] = useState(dialogState?.initialUrl || '');

  // Register this dialog in the global navigation stack
  useEffect(() => {
    dialogStack.mount();
    return () => dialogStack.unmount();
  }, [dialogStack]);

  // Wrapper for closeDialog to log all close attempts
  const handleRequestClose = useCallback(() => {
    console.log('[NavDebug] [InsertLinkDialog] handleRequestClose triggered (close dialog)');
    closeDialog();
  }, [closeDialog]);

  // Auto-focus URL field if text is already filled
  useEffect(() => {
    if (text && urlInputRef.current) {
      urlInputRef.current.focus();
    } else if (textInputRef.current) {
      textInputRef.current.focus();
    }
  }, []);

  // Root-level ESC handler to catch ESC even when focus is not in input fields
  // This prevents event bubbling to Room.tsx global handler
  const handleRootKeyDown: KeyboardEventHandler<HTMLDivElement> = (evt) => {
    if (isKeyHotkey('escape', evt)) {
      console.log('[NavDebug] [InsertLinkDialog] Escape caught at root Overlay level');
      // ЖЕСТКО блокируем всплытие события до Room.tsx / window
      evt.stopPropagation();
      if (evt.nativeEvent && evt.nativeEvent.stopImmediatePropagation) {
        evt.nativeEvent.stopImmediatePropagation();
      }
      console.log('[NavDebug] [InsertLinkDialog] ESC propagation stopped at root');
      handleRequestClose();
    }
  };

  const handleTextChange: ChangeEventHandler<HTMLInputElement> = (evt) => {
    setText(evt.currentTarget.value);
  };

  const handleUrlChange: ChangeEventHandler<HTMLInputElement> = (evt) => {
    setUrl(evt.currentTarget.value);
  };

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (evt) => {
    if (isKeyHotkey('escape', evt)) {
      console.log('[NavDebug] [InsertLinkDialog] Escape key pressed in input field');
      // ЖЕСТКО блокируем всплытие события до Room.tsx / window
      evt.stopPropagation();
      if (evt.nativeEvent && evt.nativeEvent.stopImmediatePropagation) {
        evt.nativeEvent.stopImmediatePropagation();
      }
      console.log('[NavDebug] [InsertLinkDialog] ESC propagation stopped');
      handleRequestClose();
      return;
    }
    if (isKeyHotkey('enter', evt)) {
      evt.preventDefault();
      handleInsert();
    }
  };

  const handleInsert = useCallback(() => {
    if (!url.trim()) {
      // Don't allow inserting without URL
      console.log('[NavDebug] [InsertLinkDialog] Insert blocked - URL is empty');
      return;
    }

    console.log('[NavDebug] [InsertLinkDialog] Inserting link and closing dialog', {
      text: text.trim(),
      url: url.trim()
    });
    if (dialogState?.onInsert) {
      dialogState.onInsert(text.trim(), url.trim());
    }
    closeDialog();
  }, [dialogState, text, url, closeDialog]);

  if (!dialogState) return null;

  return (
    <Overlay open backdrop={<OverlayBackdrop />} onKeyDown={handleRootKeyDown}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: () => textInputRef.current,
            clickOutsideDeactivates: true,
            onDeactivate: () => {
              console.log('[NavDebug] [InsertLinkDialog] FocusTrap onDeactivate triggered (click outside or programmatic close)');
              handleRequestClose();
            },
            escapeDeactivates: stopPropagation,
          }}
        >
          <Modal id="cinny-insert-link-dialog" size="400" style={{ borderRadius: config.radii.R500 }}>
            {/* Header */}
            <Header
              size="500"
              style={{ padding: `0 ${config.space.S200} 0 ${config.space.S400}` }}
            >
              <Box grow="Yes">
                <Text size="H4" truncate>
                  Вставить ссылку
                </Text>
              </Box>
              <Box shrink="No">
                <IconButton size="300" radii="300" onClick={handleRequestClose}>
                  <Icon src={Icons.Cross} />
                </IconButton>
              </Box>
            </Header>

            {/* Form */}
            <Box direction="Column" gap="300" style={{ padding: `${config.space.S300} ${config.space.S400}` }}>
              <Box direction="Column" gap="100">
                <Text size="T300" style={{ fontWeight: 600 }}>
                  Текст
                </Text>
                <Input
                  ref={textInputRef}
                  size="500"
                  variant="Background"
                  radii="400"
                  outlined
                  placeholder="Текст ссылки"
                  value={text}
                  onChange={handleTextChange}
                  onKeyDown={handleKeyDown}
                />
              </Box>

              <Box direction="Column" gap="100">
                <Text size="T300" style={{ fontWeight: 600 }}>
                  Ссылка
                </Text>
                <Input
                  ref={urlInputRef}
                  size="500"
                  variant="Background"
                  radii="400"
                  outlined
                  placeholder="https://example.com"
                  value={url}
                  onChange={handleUrlChange}
                  onKeyDown={handleKeyDown}
                />
              </Box>

              <Box direction="Row" gap="200" style={{ marginTop: config.space.S200 }}>
                <Button
                  size="400"
                  variant="Primary"
                  fill="Solid"
                  radii="400"
                  onClick={handleInsert}
                  disabled={!url.trim()}
                  style={{ flex: 1 }}
                >
                  <Text size="B300">Добавить</Text>
                </Button>
                <Button
                  size="400"
                  variant="Secondary"
                  fill="None"
                  radii="400"
                  onClick={handleRequestClose}
                >
                  <Text size="B300">Отмена</Text>
                </Button>
              </Box>
            </Box>
          </Modal>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}

export function InsertLinkDialogRenderer() {
  const dialogState = useInsertLinkDialogState();
  return dialogState ? <InsertLinkDialog /> : null;
}
