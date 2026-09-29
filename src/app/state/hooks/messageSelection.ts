import { useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { MatrixEvent } from 'matrix-js-sdk';
import { roomIdToMessageSelectionAtomFamily } from '../messageSelection';

export type MessageSelection = {
  selected: MatrixEvent[];
  isActive: boolean;
  isSelected: (eventId: string | undefined) => boolean;
  toggle: (mEvent: MatrixEvent) => void;
  retain: (eventIds: string[]) => void;
  clear: () => void;
};

/**
 * Хук доступа к режиму выбора сообщений в комнате.
 *
 * Непустой набор = включён режим выбора (панель снизу, чекбоксы у сообщений).
 */
export const useMessageSelection = (roomId: string): MessageSelection => {
  const messageSelectionAtom = roomIdToMessageSelectionAtomFamily(roomId);
  const selected = useAtomValue(messageSelectionAtom);
  const setSelected = useSetAtom(messageSelectionAtom);

  const isSelected = useCallback(
    (eventId: string | undefined) =>
      eventId ? selected.some((evt) => evt.getId() === eventId) : false,
    [selected]
  );

  const toggle = useCallback(
    (mEvent: MatrixEvent) => {
      const eventId = mEvent.getId();
      if (!eventId) return;
      setSelected((prev) => {
        // Новый массив: мутировать атом на месте React не увидит.
        if (prev.some((evt) => evt.getId() === eventId)) {
          return prev.filter((evt) => evt.getId() !== eventId);
        }
        return [...prev, mEvent];
      });
    },
    [setSelected]
  );
  // Оставить выделенными только перечисленные события — нужно после частично
  // неудачного удаления, где успешно удалённые снимаются автоматически.
  const retain = useCallback(
    (eventIds: string[]) => {
      const keep = new Set(eventIds);
      setSelected((prev) => prev.filter((evt) => keep.has(evt.getId() ?? '')));
    },
    [setSelected]
  );

  const clear = useCallback(() => {
    setSelected([]);
  }, [setSelected]);

  return {
    selected,
    isActive: selected.length > 0,
    isSelected,
    toggle,
    retain,
    clear,
  };
};
