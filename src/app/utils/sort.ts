import { MatrixClient, Room } from 'matrix-js-sdk';

export type SortFunc<T> = (a: T, b: T) => number;

// Надежная функция получения времени последнего значимого события
const getReliableTimestamp = (room: Room | null | undefined): number => {
  if (!room) return 0;

  const events = room.timeline || room.getLiveTimeline()?.getEvents() || [];

  // Идем с конца таймлайна и ищем первое ЗНАЧИМОЕ событие
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i];
    if (!ev || typeof ev.getType !== 'function') continue;

    const type = ev.getType();

    // Учитываем только реальные сообщения (текст, файлы, зашифрованные данные, стикеры)
    if (type === 'm.room.message' || type === 'm.room.encrypted' || type === 'm.sticker') {
      const ts = ev.getTs();
      if (ts && !isNaN(ts)) {
        return ts; // Нашли время реального сообщения!
      }
    }
  }

  // Если значимых сообщений в локальном кэше нет, фоллбэк на кэш SDK
  return room.getLastActiveTimestamp() || 0;
};

// Хронологическая сортировка (заменяет A-Z)
export const factoryRoomIdByAtoZ =
  (mx: MatrixClient): SortFunc<string> =>
  (a, b) => {
    const room1 = mx.getRoom(a);
    const room2 = mx.getRoom(b);
    return getReliableTimestamp(room2) - getReliableTimestamp(room1);
  };

// Хронологическая сортировка (основная)
export const factoryRoomIdByActivity =
  (mx: MatrixClient): SortFunc<string> =>
  (a, b) => {
    const room1 = mx.getRoom(a);
    const room2 = mx.getRoom(b);
    return getReliableTimestamp(room2) - getReliableTimestamp(room1);
  };

export const factoryRoomIdByUnreadCount =
  (getUnreadCount: (roomId: string) => number): SortFunc<string> =>
  (a, b) => {
    const aT = getUnreadCount(a) ?? 0;
    const bT = getUnreadCount(b) ?? 0;
    return bT - aT;
  };

export const byTsOldToNew: SortFunc<number> = (a, b) => a - b;

export const byOrderKey: SortFunc<string | undefined> = (a, b) => {
  if (!a && !b) {
    return 0;
  }

  if (!b) return -1;
  if (!a) return 1;

  if (a < b) {
    return -1;
  }
  return 1;
};
