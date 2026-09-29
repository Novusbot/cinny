import React, { useCallback, useState } from 'react';
import { Box, Icon, IconButton, Icons, Spinner, Text, color, config } from 'folds';
import { Room } from 'matrix-js-sdk';
import { MessageDeletePrompt } from './message';
import { useMessageSelection } from '../../state/hooks/messageSelection';
import { pluralMessages } from '../../utils/i18n';

type MessageSelectionBarProps = {
  room: Room;
  onDelete: (reason: string) => void;
  onForward: () => void;
  deleting: boolean;
  deleteError?: string | undefined;
};

/**
 * Нижняя панель режима выбора сообщений (в стиле Telegram).
 *
 * Показывается вместо инпута, пока в комнате есть выделенные сообщения.
 */
export function MessageSelectionBar({
  room,
  onDelete,
  onForward,
  deleting,
  deleteError,
}: MessageSelectionBarProps) {
  const { selected, clear } = useMessageSelection(room.roomId);
  const [promptOpen, setPromptOpen] = useState(false);

  const count = selected.length;

  const handleConfirmDelete = useCallback(
    (reason: string) => {
      onDelete(reason);
    },
    [onDelete]
  );

  const handleCancelDelete = useCallback(() => setPromptOpen(false), []);

  return (
    <Box direction="Column" style={{ padding: `0 ${config.space.S400} ${config.space.S200}` }}>
      <Box
        alignItems="Center"
        gap="200"
        style={{
          backgroundColor: color.SurfaceVariant.Container,
          borderRadius: config.radii.R500,
          padding: `${config.space.S200} ${config.space.S300}`,
        }}
      >
        <Box shrink="No">
          <IconButton
            size="400"
            radii="Pill"
            fill="None"
            onClick={clear}
            aria-label="Снять выделение"
          >
            <Icon size="400" src={Icons.Cross} />
          </IconButton>
        </Box>
        <Box shrink="No">
          <IconButton
            size="400"
            radii="Pill"
            fill="None"
            variant="Critical"
            onClick={() => setPromptOpen(true)}
            aria-label="Удалить выбранные"
          >
            {deleting ? (
              <Spinner size="200" variant="Critical" />
            ) : (
              <Icon size="400" src={Icons.Delete} />
            )}
          </IconButton>
        </Box>
        <Box grow="Yes" justifyContent="Center">
          <Text size="T300" truncate>
            {pluralMessages(count)} выбрано
          </Text>
        </Box>
        <Box shrink="No">
          <IconButton
            size="400"
            radii="Pill"
            fill="None"
            variant="Primary"
            onClick={onForward}
            aria-label="Переслать выбранные"
          >
            <Icon size="400" src={Icons.ArrowRight} />
          </IconButton>
        </Box>
      </Box>
      {/* Панель живёт, пока есть выделение, а оно снимается само после успешного
          удаления — тогда диалог размонтируется вместе с ней. При частичной
          ошибке выделение остаётся, и ошибка видна прямо в диалоге. */}
      <MessageDeletePrompt
        open={promptOpen}
        count={count}
        deleting={deleting}
        error={deleteError}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
    </Box>
  );
}
