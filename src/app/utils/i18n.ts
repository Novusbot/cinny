/**
 * Русское склонение числительных: «1 сообщение», «2 сообщения», «5 сообщений».
 *
 * Правило для «сообщение» (msgtype = сообщени-):
 *   n % 100 в 11..14 → сообщений
 *   n % 10 = 1      → сообщение
 *   n % 10 ∈ 2..4   → сообщения
 *   иначе           → сообщений
 */
export const pluralMessages = (count: number): string => {
  const mod100 = count % 100;
  const mod10 = count % 10;

  if (mod100 >= 11 && mod100 <= 14) return `${count} сообщений`;
  if (mod10 === 1) return `${count} сообщение`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} сообщения`;
  return `${count} сообщений`;
};
