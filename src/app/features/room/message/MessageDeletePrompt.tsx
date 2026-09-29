import React, { FormEventHandler, useCallback, useEffect, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import {
  Box,
  Button,
  Dialog,
  Header,
  Icon,
  IconButton,
  Icons,
  Input,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Spinner,
  Text,
  color,
  config,
} from 'folds';
import { stopPropagation } from '../../../utils/keyboard';
import { useDialogStack } from '../../../hooks/useDialogStack';
import { pluralMessages } from '../../../utils/i18n';

export type MessageDeletePromptProps = {
  open: boolean;
  count: number;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  error?: string | undefined;
};

/**
 * Диалог подтверждения удаления одного или нескольких сообщений.
 *
 * Диалог монтируется только когда `open === true`, поэтому регистрация в
 * стеке диалогов тоже зависит от `open` — иначе ESC/свайп закрывали бы комнату.
 */
export function MessageDeletePrompt({
  open,
  count,
  deleting,
  onCancel,
  onConfirm,
  error,
}: MessageDeletePromptProps) {
  const { mount, unmount } = useDialogStack();
  const [reason, setReason] = useState('');

  useEffect(() => {
    // Диалог живёт только пока `open === true` — счётчик диалогов тоже.
    if (!open) return undefined;
    mount();
    return () => unmount();
  }, [open, mount, unmount]);

  const handleClose = useCallback(() => {
    setReason('');
    onCancel();
  }, [onCancel]);

  const handleSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    if (deleting) return;
    setReason('');
    onConfirm(reason);
  };

  return (
    <Overlay open={open} backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            onDeactivate: handleClose,
            clickOutsideDeactivates: true,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Dialog variant="Surface">
            <Header
              style={{
                padding: `0 ${config.space.S200} 0 ${config.space.S400}`,
                borderBottomWidth: config.borderWidth.B300,
              }}
              variant="Surface"
              size="500"
            >
              <Box grow="Yes">
                <Text size="H4">
                  {count === 1 ? 'Удалить сообщение' : `Удалить ${pluralMessages(count)}`}
                </Text>
              </Box>
              <IconButton size="300" onClick={handleClose} radii="300">
                <Icon src={Icons.Cross} />
              </IconButton>
            </Header>
            <Box
              as="form"
              onSubmit={handleSubmit}
              style={{ padding: config.space.S400 }}
              direction="Column"
              gap="400"
            >
              <Text priority="400">
                {count === 1
                  ? 'Сообщение будет удалено у всех участников.'
                  : `Будут удалены ${pluralMessages(count)} у всех участников.`}
              </Text>
              <Box direction="Column" gap="100">
                <Text size="L400">Причина</Text>
                <Input
                  name="reasonInput"
                  variant="Background"
                  placeholder="Причина (необязательно)"
                  value={reason}
                  onChange={(evt: React.ChangeEvent<HTMLInputElement>) =>
                    setReason(evt.currentTarget.value)
                  }
                  disabled={deleting}
                />
              </Box>
              {error && (
                <Text style={{ color: color.Critical.Main }} size="T300">
                  {error}
                </Text>
              )}
              <Button
                type="submit"
                variant="Critical"
                before={
                  deleting ? <Spinner fill="Solid" variant="Critical" size="200" /> : undefined
                }
                aria-disabled={deleting}
              >
                <Text size="B400">{deleting ? 'Удаление...' : 'Удалить'}</Text>
              </Button>
            </Box>
          </Dialog>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}
