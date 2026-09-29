import { atom } from 'jotai';
import { atomFamily } from 'jotai/utils';
import { MatrixEvent } from 'matrix-js-sdk';

const createMessageSelectionAtom = () => atom<MatrixEvent[]>([]);

export type MessageSelectionAtom = ReturnType<typeof createMessageSelectionAtom>;

/**
 * Выбранные сообщения в комнате (режим выбора сообщений, как в Telegram).
 *
 * Ключ — roomId, поэтому:
 * - главная лента и треды одной комнаты используют один набор;
 * - при переходе в другую комнату набор пустой, ничего не «протекает».
 *
 * Храним сами `MatrixEvent`, а не только id: треды в этом форке рендерят события,
 * загруженные напрямую через `/relations` (ThreadTimeline не складывает их в
 * ThreadTimelineSet), и `room.findEventById` такие события не находит —
 * с одними id пересылка пачки в треде молча теряла бы сообщения.
 *
 * Непустой массив = включён режим выбора.
 */
export const roomIdToMessageSelectionAtomFamily = atomFamily<string, MessageSelectionAtom>(
  createMessageSelectionAtom
);
