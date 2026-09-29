import { getMxIdLocalPart } from '../utils/matrix';

/**
 * Текст, который показывается для ссылки-упоминания пользователя.
 *
 * Порядок:
 * 1. display name из state текущей комнаты — самое точное;
 * 2. текст самой ссылки — нужен для пересланных сообщений, где отправитель
 *    мог переслать в комнату, где этого пользователя нет среди участников;
 * 3. localpart mxid — последний фолбэк.
 *
 * `linkText` может как содержать, так и не содержать ведущий `@`.
 */
export const resolveUserMentionLabel = (
  memberName: string | undefined,
  linkText: string | undefined,
  userId: string
): string => {
  if (memberName) return memberName;

  const fromLink = linkText?.replace(/^@/, '').trim();
  if (fromLink) return fromLink;

  return getMxIdLocalPart(userId) || userId;
};
